export default class GroupCallManager {

constructor(ws, myUserId) {
  this.ws = ws;
  this.myUserId = myUserId;

  this.peerConnections = new Map();
  this.remoteStreams = new Map();

  this.localStream = null;

  this.callId = null;
  this.workspaceId = null;
  this.participants = [];

  this.onRemoteStream = null;
  this.onParticipantConnected = null;
  this.onParticipantDisconnected = null;

  this.onCallConnected = null;

  // 🔥 ICE candidates that arrive early
  this.pendingCandidates = new Map();
this.pendingAnswers = new Map();
  // 🔥 Track connected peers
  this.connectedPeers = new Set();

  console.log(
    "👥 GroupCallManager initialized:",
    myUserId
  );
}


  // ==============================
  // START GROUP CALL
  // ==============================

  async startCall(
    callId,
    workspaceId,
    participants
  ) {

    this.callId = callId;
    this.workspaceId = workspaceId;
    this.participants = participants || [];

    console.log(
      "👥 Starting group call:",
      callId
    );

    // Get microphone
    this.localStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

    console.log(
      "🎙️ Local microphone acquired"
    );

    // Only connect to other participants
    const others =
      this.participants.filter(
        participant =>
          participant.user_id !==
          this.myUserId
      );

    console.log(
      "👥 Other participants:",
      others
    );

    /*
     * IMPORTANT:
     *
     * The host should create offers.
     *
     * For now we use deterministic ordering
     * so only the participant with the
     * smaller user ID creates the offer.
     *
     * This prevents both sides from creating
     * competing offers.
     */

    for (const participant of others) {

      const remoteId =
        participant.user_id;

      if (
        this.myUserId <
        remoteId
      ) {

        await this.createPeer(
          remoteId,
          true
        );

      }

    }
  }


  // ==============================
  // CREATE PEER
  // ==============================

  async createPeer(
    remoteUserId,
    createOffer = false
  ) {

    if (
      this.peerConnections.has(
        remoteUserId
      )
    ) {

      return this.peerConnections.get(
        remoteUserId
      );

    }


    console.log(
      "🔗 Creating peer connection:",
      remoteUserId
    );


    const pc =
      new RTCPeerConnection({

        iceServers: [
          {
            urls:
              "stun:stun.l.google.com:19302"
          }
        ]

      });


    this.peerConnections.set(
      remoteUserId,
      pc
    );

const queuedAnswers =
  this.pendingAnswers.get(remoteUserId) || [];

for (const queuedAnswer of queuedAnswers) {
  try {
    await pc.setRemoteDescription(
      new RTCSessionDescription(
        queuedAnswer
      )
    );

    console.log(
      "✅ Flushed queued answer:",
      remoteUserId
    );
  } catch (error) {
    console.error(
      "❌ Failed to flush queued answer:",
      error
    );
  }
}

this.pendingAnswers.delete(
  remoteUserId
);
    // ==============================
    // LOCAL TRACKS
    // ==============================

    if (this.localStream) {

      this.localStream
        .getTracks()
        .forEach(track => {

          pc.addTrack(
            track,
            this.localStream
          );

        });

    }


    // ==============================
    // REMOTE TRACK
    // ==============================

    pc.ontrack = event => {

      console.log(
        "🎧 Remote track received from:",
        remoteUserId
      );


      let stream =
        this.remoteStreams.get(
          remoteUserId
        );


      if (!stream) {

        stream =
          new MediaStream();

        this.remoteStreams.set(
          remoteUserId,
          stream
        );

      }


      // Avoid duplicate tracks
      event.streams[0]
        ?.getTracks()
        .forEach(track => {

          const exists =
            stream
              .getTracks()
              .some(
                existing =>
                  existing.id ===
                  track.id
              );

          if (!exists) {

            stream.addTrack(
              track
            );

          }

        });


      if (this.onRemoteStream) {

        this.onRemoteStream(
          remoteUserId,
          stream
        );

      }


      if (
        this.onParticipantConnected
      ) {

        this.onParticipantConnected(
          remoteUserId
        );

      }

    };


    // ==============================
    // ICE CANDIDATE
    // ==============================

    pc.onicecandidate = event => {

      if (!event.candidate)
        return;


      this.sendSignal({

        type:
          "group_call_candidate",

        target:
          remoteUserId,

        call_id:
          this.callId,

        workspace_id:
          this.workspaceId,

        candidate:
          event.candidate

      });

    };


    // ==============================
    // CONNECTION STATE
    // ==============================

    pc.onconnectionstatechange =
      () => {

        console.log(
          `🔗 ${remoteUserId} state:`,
          pc.connectionState
        );


     if (pc.connectionState === "connected") {

  console.log(
    "🟢 GROUP PEER CONNECTED:",
    remoteUserId
  );

  // Prevent duplicate connected events
  if (!this.connectedPeers.has(remoteUserId)) {

    this.connectedPeers.add(remoteUserId);

    console.log(
      "🟢 Connected peers:",
      [...this.connectedPeers]
    );

    // 🔥 Direct callback
    if (this.onCallConnected) {
      this.onCallConnected(remoteUserId);
    }

    // Keep existing event for compatibility
    window.dispatchEvent(
      new CustomEvent("CALL_CONNECTED", {
        detail: {
          userId: remoteUserId
        }
      })
    );

    if (this.onParticipantConnected) {
      this.onParticipantConnected(remoteUserId);
    }
  }
}


        if (
          pc.connectionState ===
            "disconnected" ||
          pc.connectionState ===
            "failed" ||
          pc.connectionState ===
            "closed"
        ) {

          this.remoteStreams.delete(
            remoteUserId
          );


          if (
            this.onParticipantDisconnected
          ) {

            this.onParticipantDisconnected(
              remoteUserId
            );

          }

        }

      };


    // ==============================
    // CREATE OFFER
    // ==============================

    if (createOffer) {

      const offer =
        await pc.createOffer();

      await pc.setLocalDescription(
        offer
      );


      console.log(
        "📤 Sending group offer to:",
        remoteUserId
      );


      this.sendSignal({

        type:
          "group_call_offer",

        target:
          remoteUserId,

        call_id:
          this.callId,

        workspace_id:
          this.workspaceId,

        offer:
          offer

      });

    }


    return pc;
  }


  // ==============================
  // RECEIVE OFFER
  // ==============================

  async handleOffer(
    from,
    offer
  ) {

    console.log(
      "📥 Group offer received from:",
      from
    );


    const pc =
      await this.createPeer(
        from,
        false
      );

await pc.setRemoteDescription(
  new RTCSessionDescription(offer)
);

// 🔥 Flush queued candidates
const queuedCandidates =
  this.pendingCandidates.get(from) || [];

for (const candidate of queuedCandidates) {

  try {
    await pc.addIceCandidate(
      new RTCIceCandidate(candidate)
    );

    console.log(
      "✅ Flushed queued ICE candidate:",
      from
    );

  } catch (error) {
    console.error(
      "❌ Failed to flush queued ICE:",
      error
    );
  }
}

this.pendingCandidates.delete(from);

const answer = await pc.createAnswer();

await pc.setLocalDescription(answer);


    console.log(
      "📤 Sending group answer to:",
      from
    );


    this.sendSignal({

      type:
        "group_call_answer",

      target:
        from,

      call_id:
        this.callId,

      workspace_id:
        this.workspaceId,

      answer:
        answer

    });

  }


  // ==============================
  // RECEIVE ANSWER
  // ==============================

async handleAnswer(from, answer) {

  console.log(
    "📥 Group answer received from:",
    from
  );

 let pc =
  this.peerConnections.get(from);

if (!pc) {
  console.log(
    "⏳ Queueing answer for:",
    from
  );

  if (!this.pendingAnswers.has(from)) {
    this.pendingAnswers.set(from, []);
  }

  this.pendingAnswers
    .get(from)
    .push(answer);

  return;
}

  await pc.setRemoteDescription(
    new RTCSessionDescription(answer)
  );

  // 🔥 Flush ICE candidates that arrived
  // before the answer was available
  const queuedCandidates =
    this.pendingCandidates.get(from) || [];

  for (const candidate of queuedCandidates) {

    try {

      await pc.addIceCandidate(
        new RTCIceCandidate(candidate)
      );

      console.log(
        "✅ Flushed queued ICE candidate:",
        from
      );

    } catch (error) {

      console.error(
        "❌ Failed to flush queued ICE:",
        error
      );
    }
  }

  this.pendingCandidates.delete(from);
}
  // ==============================
  // RECEIVE ICE
  // ==============================
async handleCandidate(from, candidate) {

  let pc = this.peerConnections.get(from);

  // 🔥 Peer doesn't exist yet.
  // Queue the ICE candidate instead of losing it.
  if (!pc) {

    console.log(
      "⏳ Queueing ICE candidate for:",
      from
    );

    if (!this.pendingCandidates.has(from)) {
      this.pendingCandidates.set(from, []);
    }

    this.pendingCandidates
      .get(from)
      .push(candidate);

    return;
  }

  try {

    // If remote description is not ready yet,
    // queue the candidate.
    if (!pc.remoteDescription) {

      console.log(
        "⏳ Remote description not ready. Queueing ICE:",
        from
      );

      if (!this.pendingCandidates.has(from)) {
        this.pendingCandidates.set(from, []);
      }

      this.pendingCandidates
        .get(from)
        .push(candidate);

      return;
    }

    await pc.addIceCandidate(
      new RTCIceCandidate(candidate)
    );

    console.log(
      "✅ ICE candidate added:",
      from
    );

  } catch (error) {

    console.error(
      "❌ Failed to add group ICE:",
      error
    );
  }
}


  // ==============================
  // SEND SIGNAL
  // ==============================

  sendSignal(payload) {

    if (
      !this.ws ||
      this.ws.readyState !==
        WebSocket.OPEN
    ) {

      console.error(
        "❌ Group WS unavailable"
      );

      return false;

    }


    this.ws.send(
      JSON.stringify(payload)
    );


    console.log(
      "📡 Group signal sent:",
      payload.type,
      "→",
      payload.target
    );


    return true;
  }


  // ==============================
  // END CALL
  // ==============================

  endCall() {

    console.log(
      "📞 Ending group call"
    );


    for (
      const [
        userId,
        pc
      ]
      of this.peerConnections
    ) {

      try {

        pc.close();

      } catch {}

    }


  this.peerConnections.clear();
this.remoteStreams.clear();

this.connectedPeers.clear();
this.pendingCandidates.clear();


    if (this.localStream) {

      this.localStream
        .getTracks()
        .forEach(track =>
          track.stop()
        );

      this.localStream = null;

    }


    this.callId = null;
    this.workspaceId = null;
    this.participants = [];

  }


  // ==============================
  // GET REMOTE STREAM
  // ==============================

  getRemoteStream(
    userId
  ) {

    return this.remoteStreams.get(
      userId
    );

  }


  // ==============================
  // SET CALLBACKS
  // ==============================

 setCallbacks({
  onRemoteStream,
  onParticipantConnected,
  onParticipantDisconnected,
  onCallConnected
}) {

  this.onRemoteStream =
    onRemoteStream;

  this.onParticipantConnected =
    onParticipantConnected;

  this.onParticipantDisconnected =
    onParticipantDisconnected;

  this.onCallConnected =
    onCallConnected;
}

}