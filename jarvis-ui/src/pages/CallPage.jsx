import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

import { useNotification } from "../components/NotificationContext";
import { useCallManager } from "../context/CallContext";
import { getUserProfile } from "../api/profileApi";

import "../styles/call-page.css";


export default function CallPage() {

  const { userId, callId } = useParams();

  const navigate = useNavigate();

const {
  ws,
  markGroupSignalListenerReady
} = useNotification();

const {
  callManagerRef,
  groupCallManagerRef,
  groupCallManager,
  ensureGroupCallManager
} = useCallManager();
  const location = useLocation();


  // =============================fv
  // DETECT CALL TYPE
  // =============================

  const isGroupCall =
    Boolean(callId);


  // =============================
  // LOCATION STATE
  // =============================

  const emailFromState =
    location.state?.email;

  const nameFromState =
    location.state?.name;

  const participants =
    location.state?.participants || [];

  const workspaceId =
    location.state?.workspaceId;

  const groupHost =
    location.state?.host;


  const previousPage =
    location.state?.previousPage ||
    "/workspaces";


  // =============================
  // VIDEO REFS
  // =============================

  const localVideoRef =
    useRef(null);

  const remoteVideoRef =
    useRef(null);


  // =============================
  // STATE
  // =============================

  const [status, setStatus] =
    useState(
      isGroupCall
        ? "Joining group call..."
        : "Connecting..."
    );

  const [time, setTime] =
    useState(0);

  const [connected, setConnected] =
    useState(false);


  const [callType, setCallType] =
    useState(

      location.state?.callType ||

      callManagerRef.current?.callType ||

      "audio"

    );


  const [userInfo, setUserInfo] =
    useState({

      name:
        nameFromState || null,

      email:
        emailFromState || null,

      avatar: null

    });


  // =============================
  // GROUP PARTICIPANTS
  // =============================

// const manager =
//   new GroupCallManager(
//     ws,
//     myUserId
//   );

// groupCallManagerRef.current =
//   manager;

// setGroupCallManager(
//   manager
// );

  // =============================
  // CONNECT VIDEO ELEMENTS
  // =============================

  useEffect(() => {

    const attachVideo = () => {

      if (
        callManagerRef.current &&
        localVideoRef.current &&
        remoteVideoRef.current
      ) {

        console.log(
          "Attaching video elements now"
        );


        callManagerRef.current.setVideoElements(

          localVideoRef.current,

          remoteVideoRef.current

        );


        setCallType(

          location.state?.callType ||

          callManagerRef.current.callType ||

          "audio"

        );


        return true;

      }


      return false;

    };


    if (attachVideo())
      return;


    const interval =
      setInterval(() => {

        if (attachVideo()) {

          clearInterval(
            interval
          );

        }

      }, 100);


    return () =>
      clearInterval(interval);

  }, []);


  // =============================
  // LOAD USER PROFILE
  // =============================

  useEffect(() => {

    // GROUP CALL
    // Do NOT fetch one profile.

    if (isGroupCall) {

      console.log(
        "👥 Group call participants:",
        participants
      );

      setUserInfo({

        name:
          groupHost
            ? participants.find(
                p =>
                  p.user_id ===
                  groupHost
              )?.name ||
              "Group Call"
            : "Group Call",

        email: "",

        avatar:
          "/default-avatar.png"

      });

      return;

    }


    // =============================
    // NORMAL 1-TO-1 CALL
    // =============================

    const fetchUserInfo =
      async () => {

        try {

          const emailToFetch =

            callManagerRef.current
              ?.targetEmail ||

            emailFromState;


          if (!emailToFetch) {

            console.warn(
              "No email available for profile fetch"
            );

            return;

          }


          console.log(
            "Fetching profile for:",
            emailToFetch
          );


          const profile =
            await getUserProfile(
              emailToFetch
            );


          setUserInfo(profile);


        } catch (err) {

          console.error(
            "Failed to load user info",
            err
          );


          setUserInfo({

            name:

              callManagerRef.current
                ?.targetName ||

              emailFromState ||

              "Unknown User",

            email:
              emailFromState,

            avatar: null

          });

        }

      };


    fetchUserInfo();

  }, [
    emailFromState,
    callManagerRef,
    isGroupCall,
    participants,
    groupHost
  ]);


  // =============================
  // TIMER
  // =============================

  useEffect(() => {

    if (!connected)
      return;


    const interval =
      setInterval(() => {

        setTime(
          prev =>
            prev + 1
        );

      }, 1000);


    return () =>
      clearInterval(
        interval
      );

  }, [connected]);

// =============================
// START GROUP CALL
// =============================
useEffect(() => {
  if (!isGroupCall) return;

  let cancelled = false;

  const startGroupCall = async () => {
    console.log("🔍 GROUP START EFFECT", {
      callId,
      workspaceId,
      participants,
      managerExists: !!groupCallManagerRef.current
    });

    try {
      // 1. Ensure manager exists
      const manager =
        groupCallManagerRef.current ||
        await ensureGroupCallManager();

      if (cancelled || !manager) {
        console.error(
          "❌ GroupCallManager could not be created"
        );
        return;
      }

      console.log(
        "👥 GroupCallManager ready in CallPage"
      );

      // 2. Register signal listener BEFORE starting WebRTC
      const handler = async (event) => {
        const payload = event.detail;

        const activeManager =
          groupCallManagerRef.current;

        if (!activeManager) {
          console.error(
            "❌ GroupCallManager unavailable"
          );
          return;
        }

        console.log(
          "📡 GROUP CALL SIGNAL:",
          payload.type,
          payload
        );

        try {
          if (
            payload.type ===
            "group_call_offer"
          ) {
            await activeManager.handleOffer(
              payload.from,
              payload.offer
            );
          }

          else if (
            payload.type ===
            "group_call_answer"
          ) {
            await activeManager.handleAnswer(
              payload.from,
              payload.answer
            );
          }

          else if (
            payload.type ===
            "group_call_candidate"
          ) {
            await activeManager.handleCandidate(
              payload.from,
              payload.candidate
            );
          }

        } catch (error) {
          console.error(
            "❌ Group signal handling failed:",
            error
          );
        }
      };

      window.addEventListener(
        "group-call-signal",
        handler
      );

      // 3. Tell NotificationContext we are ready
      markGroupSignalListenerReady();

      console.log(
        "✅ Group signal listener registered"
      );

      // 4. NOW start WebRTC
      console.log(
        "🚀 Starting GroupCallManager"
      );

      await manager.startCall(
        callId,
        workspaceId,
        participants
      );

      console.log(
        "✅ GroupCallManager started"
      );

    } catch (error) {
      console.error(
        "❌ Failed to start group call:",
        error
      );
    }

    return () => {
      window.removeEventListener(
        "group-call-signal",
        handler
      );
    };
  };

  startGroupCall();

}, [
  isGroupCall,
  callId,
  workspaceId,
  participants,
  ensureGroupCallManager,
  markGroupSignalListenerReady
]);

// // =============================
// // GROUP CALL SIGNALS
// // =============================

// useEffect(() => {

//   if (!isGroupCall) return;

//   const handler = async (event) => {

//     const payload =
//       event.detail;

//     const manager =
//       groupCallManagerRef.current;

//     if (!manager) {

//       console.error(
//         "❌ GroupCallManager unavailable"
//       );

//       return;
//     }

//     console.log(
//       "📡 GROUP CALL SIGNAL:",
//       payload.type,
//       payload
//     );

//     try {

//       if (
//         payload.type ===
//         "group_call_offer"
//       ) {

//         await manager.handleOffer(
//           payload.from,
//           payload.offer
//         );

//       }

//       else if (
//         payload.type ===
//         "group_call_answer"
//       ) {

//         await manager.handleAnswer(
//           payload.from,
//           payload.answer
//         );

//       }

//       else if (
//         payload.type ===
//         "group_call_candidate"
//       ) {

//         await manager.handleCandidate(
//           payload.from,
//           payload.candidate
//         );

//       }

//     } catch (error) {

//       console.error(
//         "❌ Group signal handling failed:",
//         error
//       );

//     }

//   };

//   window.addEventListener(
//     "group-call-signal",
//     handler
//   );

//   return () => {

//     window.removeEventListener(
//       "group-call-signal",
//       handler
//     );

//   };

// }, [
//   isGroupCall,
//   groupCallManagerRef
// ]);
  // =============================
  // CALL CONNECTED
  // =============================

  useEffect(() => {

    const handler = () => {

      setStatus(
        "Connected"
      );

      setConnected(
        true
      );

    };


    window.addEventListener(
      "CALL_CONNECTED",
      handler
    );


    return () =>
      window.removeEventListener(
        "CALL_CONNECTED",
        handler
      );

  }, []);


  // =============================
  // CALL ENDED
  // =============================

  useEffect(() => {

    const handler = () => {

      setConnected(
        false
      );

      setStatus(
        "Call Ended"
      );


      setTimeout(() => {

        navigate(
          previousPage
        );

      }, 500);

    };


    window.addEventListener(
      "CALL_ENDED",
      handler
    );


    return () =>
      window.removeEventListener(
        "CALL_ENDED",
        handler
      );

  }, [
    navigate,
    previousPage
  ]);


  // =============================
  // SAFETY CHECK
  // =============================

  useEffect(() => {

    // GROUP CALL

    if (isGroupCall) {

      console.log(
        "👥 Group Call Page:",
        callId
      );

      return;

    }


    // NORMAL CALL

    const check = () => {

      const cm =
        callManagerRef.current;


      if (
        !cm ||
        (
          !cm.pc &&
          !cm.localStream &&
          !cm.currentTarget
        )
      ) {

        navigate(
          previousPage
        );

      }

    };


    check();


    const interval =
      setInterval(
        check,
        500
      );


    return () =>
      clearInterval(
        interval
      );

  }, [
    callManagerRef,
    navigate,
    previousPage,
    isGroupCall,
    callId
  ]);


  // =============================
  // END CALL
  // =============================

  const endCall = () => {

    if (isGroupCall) {

  console.log(
    "👥 Ending group call:",
    callId
  );

  // 🔴 IMPORTANT:
  // Completely destroy GroupCallManager resources
  if (groupCallManagerRef.current) {

    console.log(
      "🧹 Cleaning up GroupCallManager"
    );

    groupCallManagerRef.current.endCall();
  }

  // Notify CallPage / CallContext
  window.dispatchEvent(
    new Event("CALL_ENDED")
  );

  navigate(previousPage);

  return;
}

    // EXISTING 1-TO-1

    callManagerRef.current
      ?.endCall(userId);


    navigate(
      previousPage
    );

  };


  // =============================
  // FORMAT TIMER
  // =============================

  const formatTime = () => {

    const min =
      Math.floor(
        time / 60
      );

    const sec =
      time % 60;


    return `${min}:${sec
      .toString()
      .padStart(
        2,
        "0"
      )}`;

  };


  // =============================
  // DISPLAY NAME
  // =============================

  const displayName =

    isGroupCall

      ? "Group Call"

      :

        userInfo?.name ||

        callManagerRef.current
          ?.targetName ||

        emailFromState ||

        userId;


  const avatarUrl =

    userInfo?.avatar ||

    "/default-avatar.png";


  // =============================
  // UI
  // =============================

  return (

    <div className="call-page">


      {/* =========================
          GROUP CALL
      ========================= */}

      {isGroupCall && (

        <div className="call-content">

          <h2 className="call-title">
            👥 Group Call
          </h2>


          <div
            style={{
              marginTop: "20px"
            }}
          >

            {participants.map(
              participant => (

                <div
                  key={
                    participant.user_id
                  }
                  style={{
                    marginBottom:
                      "10px"
                  }}
                >

                  👤{" "}
                  {participant.name}

                  <small
                    style={{
                      marginLeft:
                        "8px",
                      color:
                        "#94a3b8"
                    }}
                  >
                    {
                      participant.email
                    }
                  </small>

                </div>

              )
            )}

          </div>


          <p className="call-status">

            {status}

          </p>


          {connected && (

            <p className="call-timer">

              {formatTime()}

            </p>

          )}

        </div>

      )}


      {/* =========================
          VIDEO 1-TO-1
      ========================= */}

      {!isGroupCall &&
        callType === "video" && (

        <div
          className="video-layout"
        >

          <video
            ref={
              remoteVideoRef
            }
            autoPlay
            playsInline
            className="remote-video"
          />


          <video
            ref={
              localVideoRef
            }
            autoPlay
            muted
            playsInline
            className="local-video"
          />


          <div
            className=
              "video-overlay-info"
          >

            <h2>
              {displayName}
            </h2>

            <p>
              {status}
            </p>

            {connected && (

              <p>
                {formatTime()}
              </p>

            )}

          </div>

        </div>

      )}


      {/* =========================
          VOICE 1-TO-1
      ========================= */}

      {!isGroupCall &&
        callType === "audio" && (

        <>

          <div
            className="call-background"
            style={{
              backgroundImage:
                `url(${avatarUrl})`
            }}
          />


          <div
            className="call-overlay"
          />


          <div
            className="call-content"
          >

            <h2
              className=
                "call-title"
            >
              Voice Call
            </h2>


            <img
              src={avatarUrl}
              alt="avatar"

              onError={(e) => {

                e.target.src =
                  "/default-avatar.png";

              }}

              className=
                "call-avatar"
            />


            <h1
              className=
                "call-name"
            >

              {displayName}

            </h1>


            <p
              className=
                "call-status"
            >

              {status}

            </p>


            {connected && (

              <p
                className=
                  "call-timer"
              >

                {formatTime()}

              </p>

            )}

          </div>

        </>

      )}


      {/* =========================
          END CALL
      ========================= */}

      <button
        onClick={endCall}
        className=
          "call-end-button"
      >

        End Call

      </button>


    </div>

  );

}