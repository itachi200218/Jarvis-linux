import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useState
} from "react";

import GroupCallManager from "../call/GroupCallManager";

import { useNotification } from "../components/NotificationContext";

import { useNavigate } from "react-router-dom";

import CallManager from "../call/CallManager";

import {
  getUserProfile,
  getMyProfile
} from "../api/profileApi";
import "../styles/incoming-call.css";

import { useLocation } from "react-router-dom";

const CallContext = createContext();

export function CallProvider({ children }) {

  const { ws } = useNotification();
  const navigate = useNavigate();

const callManagerRef = useRef(null);
const groupCallManagerRef = useRef(null);

const [groupCallManager, setGroupCallManager] =
  useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCallUser, setActiveCallUser] = useState(null);
  const [incomingCallerInfo, setIncomingCallerInfo] = useState(null);
const location = useLocation();

const [myUserId, setMyUserId] = useState(null);

useEffect(() => {
  const loadMyUserId = async () => {
    try {
      const profile = await getMyProfile();

      console.log(
        "👤 CURRENT USER PROFILE:",
        profile
      );

      const id = profile.user_id;

      console.log(
        "👤 Current user UUID:",
        id
      );

      setMyUserId(id);

    } catch (error) {
      console.error(
        "❌ Failed to load current user ID:",
        error
      );
    }
  };

  loadMyUserId();
}, []);

const ensureGroupCallManager = () => {
  if (groupCallManagerRef.current) {
    return groupCallManagerRef.current;
  }

  if (!ws || !myUserId) {
    console.warn(
      "⏳ Cannot create GroupCallManager yet:",
      {
        ws: !!ws,
        myUserId
      }
    );

    return null;
  }

  console.log(
    "🛠️ Creating GroupCallManager on demand:",
    myUserId
  );

  const manager = new GroupCallManager(
    ws,
    myUserId
  );

  groupCallManagerRef.current = manager;
  setGroupCallManager(manager);

  console.log(
    "👥 GroupCallManager ready:",
    myUserId
  );

  return manager;
};


// useEffect(() => {
//   if (!ws || !myUserId) return;

//   const manager = new GroupCallManager(
//     ws,
//     myUserId
//   );

//   groupCallManagerRef.current = manager;
//   setGroupCallManager(manager);

//   console.log(
//     "👥 GroupCallManager ready:",
//     myUserId
//   );

//   return () => {
//     manager.endCall();
//     groupCallManagerRef.current = null;
//     setGroupCallManager(null);
//   };
// }, [ws, myUserId]);
  // =========================
// GROUP CALL INVITE
// =========================
useEffect(() => {

  const handleGroupCallInvite = (event) => {

    const data = event.detail;

    console.log(
      "📞 GROUP CALL INVITE RECEIVED IN CALL CONTEXT:",
      data
    );

    setIncomingCall({

      type: "group",

      callId: data.call_id,

      workspaceId: data.workspace_id,

      callerId: data.from,

      name: data.hostName || "Group Call",

      email: data.hostEmail || "",

      participants: data.participants || [],

      callType: "group"
    });

  };

  window.addEventListener(
    "group-call-invite",
    handleGroupCallInvite
  );

  return () => {

    window.removeEventListener(
      "group-call-invite",
      handleGroupCallInvite
    );

  };

}, []);
// INIT / UPDATE CALL MANAGERS
  // =========================
  // GLOBAL WS LISTENER
  // =========================
  useEffect(() => {

    if (!ws) return;

    const handleMessage = async (event) => {

      const data = JSON.parse(event.data);

if (
  !callManagerRef.current &&
  data.type !== "group_call_end"
) {
  return;
}
      console.log("GLOBAL CALL EVENT:", data.type);


      // =========================
      // INCOMING CALL (FIXED FOR VIDEO)
      // =========================
      if (data.type === "call_offer") {

        console.log("Incoming call type:", data.callType);

        setIncomingCall({

          offer: {
            ...data.offer,
            callType: data.callType || "audio"
          },

          callerId: data.from,

          name: data.name,

          email: data.email,

          callType: data.callType || "audio"   // ✅ FIX

        });

        try {

          const profile =
            await getUserProfile(data.from);

          setIncomingCallerInfo(profile);

        } catch {

          setIncomingCallerInfo({
            name: data.from,
            email: data.from
          });

        }

        return;
      }


      // =========================
      // CALL ANSWER
      // =========================
     // =========================
// CALL ANSWER
// =========================
if (data.type === "call_answer") {

  console.log("🚨 BACKEND SENT call_answer:", data);

  await callManagerRef.current.receiveAnswer(
    data.answer
  );

  setActiveCallUser(data.from);

  return;
}

      // =========================
      // ICE CANDIDATE
      // =========================
      if (data.type === "call_candidate") {

        await callManagerRef.current.addCandidate(
          data.candidate
        );

        return;
      }


      // =========================
      // CALL REJECTED
      // =========================
if (data.type === "call_rejected") {

  // 🚫 IMPORTANT:
  // Ignore 1-to-1 rejection events while
  // inside a group call.
  if (location.pathname.startsWith("/call/group/")) {

    console.log(
      "👥 Ignoring 1-to-1 call_rejected during group call"
    );

    return;
  }

  console.log("User is busy");

  callManagerRef.current.endCall(null, false);

  const busyAudio = new Audio("/sounds/busy.mp3");
  busyAudio.play().catch(() => {});

  alert("User is busy");

  setIncomingCall(null);
  setActiveCallUser(null);

  return;
}

      // =========================
      // CALL ENDED
      // =========================
      if (data.type === "call_end") {

  console.log("Call ended globally");

  callManagerRef.current.endCall(null, false); // ✅ FIX

  cleanupAndExit();

  window.dispatchEvent(
    new Event("CALL_ENDED")
  );

  return;
}
// =========================
// GROUP CALL ENDED
// =========================
if (data.type === "group_call_end") {
  console.log("👥 Group call ended globally");

  if (groupCallManagerRef.current) {
    console.log("🧹 Cleaning up GroupCallManager");

    groupCallManagerRef.current.endCall();

    groupCallManagerRef.current = null;
    setGroupCallManager(null);
  }

  cleanupAndExit();

  window.dispatchEvent(
    new Event("CALL_ENDED")
  );

  return;
}
    };

    ws.addEventListener("message", handleMessage);

    return () =>
      ws.removeEventListener("message", handleMessage);

  }, [ws]);


  // =========================
  // CALL_ENDED LISTENER
  // =========================
  useEffect(() => {

    const handleEnded = () => {

      console.log(
        "CALL_ENDED event received in provider"
      );

      cleanupAndExit();

    };

    window.addEventListener(
      "CALL_ENDED",
      handleEnded
    );

    return () =>
      window.removeEventListener(
        "CALL_ENDED",
        handleEnded
      );

  }, []);


 // =========================
// CLEANUP FUNCTION
// =========================
const cleanupAndExit = () => {

  // 👥 GROUP CALL CLEANUP
  if (groupCallManagerRef.current) {

    console.log(
      "🧹 Cleaning up GroupCallManager"
    );

    groupCallManagerRef.current.endCall();

    groupCallManagerRef.current = null;
    setGroupCallManager(null);
  }

  setIncomingCall(null);
  setActiveCallUser(null);
};


  // =========================
  // ACCEPT CALL (FIXED FOR VIDEO)
  // =========================
  const acceptCall = async () => {

  if (!incomingCall) return;

  // ==============================
  // GROUP CALL
  // ==============================
  if (incomingCall.type === "group") {

    console.log(
      "👥 ACCEPTING GROUP CALL:",
      incomingCall.callId
    );

    // Close incoming popup
    setIncomingCall(null);

    // Store active group call information
    setActiveCallUser(incomingCall.callerId);

    const previousPage =
      window.location.pathname;

    navigate(
      `/call/group/${incomingCall.callId}`,
      {
        state: {
          callId: incomingCall.callId,
          workspaceId: incomingCall.workspaceId,
          host: incomingCall.callerId,
          participants: incomingCall.participants,
          previousPage
        }
      }
    );

    return;
  }


  // ==============================
  // EXISTING 1-TO-1 CALL
  // ==============================

  callManagerRef.current.callType =
    incomingCall.callType || "audio";

  await callManagerRef.current.receiveOffer(
    {
      ...incomingCall.offer,
      callType: incomingCall.callType
    },
    incomingCall.callerId,
    incomingCall.name,
    incomingCall.email
  );

  setActiveCallUser(
    incomingCall.callerId
  );

  setIncomingCall(null);

  const previousPage =
    window.location.pathname;

  navigate(
    `/call/${incomingCall.callerId}`,
    {
      state: {
        previousPage,
        email: incomingCall.email,
        name: incomingCall.name
      }
    }
  );
};
// =========================
// REJECT CALL
// =========================
const rejectCall = () => {

  if (!incomingCall) return;


  // ==============================
  // GROUP CALL REJECT
  // ==============================
  if (incomingCall.type === "group") {

    console.log(
      "👥 Rejecting group call:",
      incomingCall.callId
    );

    ws.send(
      JSON.stringify({
        type: "group_call_reject",
        target: incomingCall.callerId,
        call_id: incomingCall.callId,
        workspace_id: incomingCall.workspaceId
      })
    );

    // ❌ DO NOT reset CallManager
    // ❌ DO NOT dispatch CALL_ENDED
    // ❌ DO NOT affect the host

    cleanupAndExit();

    return;
  }


  // ==============================
  // EXISTING 1-TO-1 REJECT
  // ==============================

  console.log(
    "Sending call_rejected to caller"
  );

  ws.send(
    JSON.stringify({
      type: "call_rejected",
      target: incomingCall.callerId
    })
  );

  callManagerRef.current.resetState();

  window.dispatchEvent(
    new Event("CALL_ENDED")
  );

  cleanupAndExit();
};

  return (

<CallContext.Provider
 value={{
  callManagerRef,
  groupCallManagerRef,
  groupCallManager,
  ensureGroupCallManager
}}
>
      {children}

      {/* GLOBAL POPUP */}
    {/* GLOBAL POPUP */}
{incomingCall && !location.pathname.startsWith("/call/") && (

  <div className="incoming-call-popup">

    <h3>
  {incomingCall.type === "group"
    ? "👥 Incoming Group Call"
    : incomingCall.callType === "video"
      ? "📹 Incoming Video Call"
      : "📞 Incoming Voice Call"}
</h3>

    <p>
  {incomingCall.type === "group"
    ? `Group call • ${
        incomingCall.participants?.length || 0
      } participants`
    : `User: ${
        incomingCall.name ||
        incomingCall.email ||
        incomingCall.callerId
      }`}
</p>

    <button
      onClick={acceptCall}
      className="incoming-call-accept"
    >
      Accept
    </button>

    <button
      onClick={rejectCall}
      className="incoming-call-reject"
    >
      Reject
    </button>

  </div>

)}


    </CallContext.Provider>

  );

}


export function useCallManager() {

  return useContext(CallContext);

}
