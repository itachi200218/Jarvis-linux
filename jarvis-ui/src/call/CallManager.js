class CallManager {
constructor(ws, myName = null, myEmail = null) {

  this.ws = ws;
  this.pc = null;
  this.localStream = null;
  this.currentTarget = null;

  this.myName = myName;
  this.myEmail = myEmail;

  this.targetName = null;
  this.targetEmail = null;

  this.ringAudio = null;
  this.isRinging = false;
  this.ringTimeout = null;

  this.localVideo = null;
  this.remoteVideo = null;
  this.callType = "audio";
this.ringAudio = new Audio("/sounds/ringing.mp3");
this.ringAudio.loop = false; // IMPORTANT
this.ringAudio.preload = "auto";
this.ringAudio.volume = 1.0;

this.ringTimer = null;
  this.remoteStream = new MediaStream();

  // ✅ ADD THIS LINE (CRITICAL FIX)
  this.pendingCandidates = [];

}



// ✅ SET VIDEO ELEMENTS
setVideoElements(localVideoElement, remoteVideoElement) {

  this.localVideo = localVideoElement;
  this.remoteVideo = remoteVideoElement;

  if (this.localVideo && this.localStream) {
    this.localVideo.srcObject = this.localStream;
  }

  // ✅ THIS IS THE SMALL FIX YOU WERE MISSING
  if (this.remoteVideo && this.remoteStream.getTracks().length > 0) {

    console.log("Force attaching existing remote stream");

    this.remoteVideo.srcObject = this.remoteStream;

    this.remoteVideo.play().catch(()=>{});
  }

}



createPeerConnection(targetUserId) {

  this.currentTarget = targetUserId;

  // ✅ ADD THIS LINE
  this.pendingCandidates = [];

  // reset remote stream
  this.remoteStream = new MediaStream();

  this.pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });

  this.isNegotiating = false;

  // ================= REMOTE TRACK =================
  this.pc.ontrack = (event) => {

    console.log("Receiving remote track:", event.track.kind);

    // use official stream
    if (event.streams && event.streams[0]) {
      this.remoteStream = event.streams[0];
    } else {
      this.remoteStream.addTrack(event.track);
    }

    if (this.remoteVideo) {

      console.log("Attaching remote stream");

      this.remoteVideo.srcObject = this.remoteStream;

      this.remoteVideo.onloadedmetadata = () => {
        this.remoteVideo.play().catch(()=>{});
      };
    }

  };

  // ================= CONNECTION =================
 // ================= CONNECTION =================
this.pc.onconnectionstatechange = () => {

  if (!this.pc) return;

  console.log("Connection state:", this.pc.connectionState);

  if (this.pc.connectionState === "connected") {

    console.log("Call connected, clearing timeout");

    // ✅ CLEAR TIMEOUT HERE
    if (this.ringTimeout) {
      clearTimeout(this.ringTimeout);
      this.ringTimeout = null;
    }

    window.dispatchEvent(new Event("CALL_CONNECTED"));
  }

  if (
    this.pc.connectionState === "failed" ||
    this.pc.connectionState === "closed"
  ) {
    this.endCall(null, false);
  }

};

  // ================= ICE =================
  this.pc.onicecandidate = (event) => {

    if (event.candidate && this.currentTarget) {

      this.ws.send(JSON.stringify({
        type: "call_candidate",
        candidate: event.candidate,
        target: this.currentTarget
      }));

    }

  };

}



// ==============================
// START VOICE CALL
// ==============================
async startVoiceCall(targetUserId, targetName = null, targetEmail = null) {

  this.callType = "audio";

  this.targetName = targetName;
  this.targetEmail = targetEmail;

  this.createPeerConnection(targetUserId);

  this.startRinging();

  this.ringTimeout = setTimeout(() => {
    this.stopRinging();
    this.endCall(targetUserId, true);
  }, 30000);

  // ✅ GET MIC FIRST
  this.localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });

  const audioTrack = this.localStream.getAudioTracks()[0];

  // ✅ create transceiver WITH TRACK
  this.audioTransceiver = this.pc.addTransceiver(audioTrack, {
    direction: "sendrecv"
  });

  const offer = await this.pc.createOffer();

  await this.pc.setLocalDescription(offer);

  this.ws.send(JSON.stringify({
    type: "call_offer",
    offer,
    target: targetUserId,
    name: this.myName,
    email: this.myEmail,
    callType: "audio"
  }));

}
// ==============================
// START VIDEO CALL
// ==============================
async startVideoCall(targetUserId, targetName = null, targetEmail = null) {

  this.callType = "video";

  this.targetName = targetName;
  this.targetEmail = targetEmail;

  this.createPeerConnection(targetUserId);

  this.startRinging();

  this.ringTimeout = setTimeout(() => {
    this.stopRinging();
    this.endCall(targetUserId, true);
  }, 30000);

  // ✅ CRITICAL FIX: use sendrecv, not recvonly
  this.videoTransceiver = this.pc.addTransceiver("video", {
    direction: "sendrecv"
  });

  this.audioTransceiver = this.pc.addTransceiver("audio", {
    direction: "sendrecv"
  });

  const offer = await this.pc.createOffer();

  await this.pc.setLocalDescription(offer);

  this.ws.send(JSON.stringify({
    type: "call_offer",
    offer,
    target: targetUserId,
    name: this.myName,
    email: this.myEmail,
    callType: "video"
  }));

}

async receiveOffer(offer, callerId, callerName = null, callerEmail = null) {

  this.targetName = callerName;
  this.targetEmail = callerEmail;
  this.callType = offer.callType || "audio";

  this.createPeerConnection(callerId);

  this.localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: this.callType === "video"
  });

  if (this.callType === "video" && this.localVideo) {
    this.localVideo.srcObject = this.localStream;
  }

  this.localStream.getTracks().forEach(track => {
    this.pc.addTrack(track, this.localStream);
  });

  await this.pc.setRemoteDescription(
    new RTCSessionDescription(offer)
  );

  // ✅ CRITICAL FIX: flush queued ICE candidates
  while (this.pendingCandidates.length > 0) {

    const candidate = this.pendingCandidates.shift();

    try {
      await this.pc.addIceCandidate(candidate);
    } catch(e) {
      console.error(e);
    }

  }

  const answer = await this.pc.createAnswer();

  await this.pc.setLocalDescription(answer);

  this.ws.send(JSON.stringify({
    type: "call_answer",
    answer,
    target: callerId
  }));

}


// ==============================
// RECEIVE ANSWER
// ==============================
async receiveAnswer(answer) {

  if (!this.pc) return;

  await this.pc.setRemoteDescription(
    new RTCSessionDescription(answer)
  );

  while (this.pendingCandidates.length > 0) {
    const candidate = this.pendingCandidates.shift();
    await this.pc.addIceCandidate(candidate);
  }

  // ✅ open correct media based on call type
  if (this.callType === "video") {

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });

    const videoTrack = this.localStream.getVideoTracks()[0];
    const audioTrack = this.localStream.getAudioTracks()[0];

    await this.videoTransceiver.sender.replaceTrack(videoTrack);
    await this.audioTransceiver.sender.replaceTrack(audioTrack);

    if (this.localVideo) {
      this.localVideo.srcObject = this.localStream;
    }

  } else {

    // ✅ voice call → audio only
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });

    const audioTrack = this.localStream.getAudioTracks()[0];

    // create audio transceiver if not exists
    if (!this.audioTransceiver) {
      this.audioTransceiver = this.pc.addTransceiver("audio", {
        direction: "sendrecv"
      });
    }

    await this.audioTransceiver.sender.replaceTrack(audioTrack);

  }

  this.stopRinging();

}
// ==============================
// ICE
// ==============================

async addCandidate(candidate) {

  if (!this.pc) return;

  const ice = new RTCIceCandidate(candidate);

  if (!this.pc.remoteDescription) {

    console.log("Queue ICE candidate");

    this.pendingCandidates.push(ice);

    return;

  }

  try {

    await this.pc.addIceCandidate(ice);

  } catch(e) {

    console.error("ICE error:", e);

  }

}



// ==============================
// END CALL
// ==============================

endCall(targetUserId = null, sendSignal = true) {

  console.log("Ending call cleanup")

  this.stopRinging()

  if (this.pc) {

    try {

      this.pc.getSenders().forEach(sender => {
        if (sender.track) sender.track.stop()
      })

      this.pc.close()

    } catch {}

    this.pc = null

  }


  if (this.localStream) {

    this.localStream.getTracks().forEach(track =>
      track.stop()
    )

    this.localStream = null

  }


  // AUDIO CLEANUP
  if (this.remoteAudio) {

    this.remoteAudio.pause()
    this.remoteAudio.srcObject = null

  }


  // VIDEO CLEANUP
  if (this.remoteVideo) {

    this.remoteVideo.srcObject = null

  }

  if (this.localVideo) {

    this.localVideo.srcObject = null

  }


  // ✅ CRITICAL FIX: reset remote stream
  this.remoteStream = new MediaStream()


  if (targetUserId && sendSignal) {

    this.ws.send(JSON.stringify({

      type: "call_end",
      target: targetUserId

    }))

  }


  this.currentTarget = null

  window.dispatchEvent(new Event("CALL_ENDED"))

}


// ==============================
// RESET STATE
// ==============================

resetState() {

  console.log("Resetting CallManager state");

  if (this.pc) {

    try {
      this.pc.getSenders().forEach(sender => {
        if (sender.track) sender.track.stop();
      });

      this.pc.close();

    } catch {}

    this.pc = null;
  }


  if (this.localStream) {

    try {
      this.localStream.getTracks().forEach(track => track.stop());
    } catch {}

    this.localStream = null;
  }


  if (this.remoteAudio) {

    try {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
    } catch {}

  }


  if (this.remoteVideo) {

    this.remoteVideo.srcObject = null

  }

  if (this.localVideo) {

    this.localVideo.srcObject = null

  }


  this.currentTarget = null;

}
startRinging() {

  if (this.isRinging) return;
  if (!this.ringAudio) return;

  this.isRinging = true;

  const playRing = () => {

    if (!this.isRinging) return;

    this.ringAudio.currentTime = 0;

    this.ringAudio.play()
      .then(() => {

        // manually restart after sound ends
        this.ringAudio.onended = () => {
          playRing();
        };

      })
      .catch(() => {

        // retry if browser blocks
        this.ringTimer = setTimeout(playRing, 500);

      });

  };

  playRing();

  console.log("Ringing started");

}
// ==============================
// STOP RING
// ==============================
stopRinging() {

  this.isRinging = false;

  if (this.ringTimer) {
    clearTimeout(this.ringTimer);
    this.ringTimer = null;
  }

  if (this.ringAudio) {
    this.ringAudio.pause();
    this.ringAudio.currentTime = 0;
    this.ringAudio.onended = null;
  }

  console.log("Ringing stopped");

}
}

export default CallManager

