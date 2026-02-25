import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useState
} from "react";

import { useNotification } from "../components/NotificationContext";
import { useNavigate } from "react-router-dom";
import CallManager from "../call/CallManager";
import { getUserProfile } from "../api/profileApi";
import "../styles/incoming-call.css";
import { useLocation } from "react-router-dom";

const CallContext = createContext();

export function CallProvider({ children }) {

  const { ws } = useNotification();
  const navigate = useNavigate();

  const callManagerRef = useRef(null);

  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCallUser, setActiveCallUser] = useState(null);
  const [incomingCallerInfo, setIncomingCallerInfo] = useState(null);
const location = useLocation();


  // =========================
  // INIT CALL MANAGER
  // =========================
  useEffect(() => {

  if (!ws) return;

  // ✅ CRITICAL FIX: do NOT recreate CallManager if already exists
  if (callManagerRef.current) {
    console.log("CallManager already exists, skipping re-init");
    return;
  }

  console.log("Initializing GLOBAL CallManager");

  const token = sessionStorage.getItem("jarvis_token");

  let myEmail = null;
  let myName = null;

  if (token) {

    const payload = JSON.parse(atob(token.split(".")[1]));

    myEmail = payload.sub;
    myName = payload.name;

  }

  callManagerRef.current =
    new CallManager(ws, myName, myEmail);

}, [ws]);

  // =========================
  // GLOBAL WS LISTENER
  // =========================
  useEffect(() => {

    if (!ws) return;

    const handleMessage = async (event) => {

      const data = JSON.parse(event.data);

      if (!callManagerRef.current) return;

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

  console.log("User is busy");

  callManagerRef.current.endCall(null, false); // ✅ FIX

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

    setIncomingCall(null);
    setActiveCallUser(null);

  };


  // =========================
  // ACCEPT CALL (FIXED FOR VIDEO)
  // =========================
const acceptCall = async () => {

  if (!incomingCall) return;

  // set call type
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

  setActiveCallUser(incomingCall.callerId);

  // ✅ CRITICAL FIX: clear popup FIRST
  setIncomingCall(null);

  const previousPage = window.location.pathname;

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

    console.log(
      "Sending call_rejected to caller"
    );

    ws.send(JSON.stringify({

      type: "call_rejected",

      target: incomingCall.callerId

    }));

    callManagerRef.current.resetState();

    window.dispatchEvent(
      new Event("CALL_ENDED")
    );

    cleanupAndExit();

  };


  return (

    <CallContext.Provider value={callManagerRef}>

      {children}

      {/* GLOBAL POPUP */}
    {/* GLOBAL POPUP */}
{incomingCall && !location.pathname.startsWith("/call/") && (

  <div className="incoming-call-popup">

    <h3>
      {incomingCall.callType === "video"
        ? "📹 Incoming Video Call"
        : "📞 Incoming Voice Call"}
    </h3>

    <p>
      User:
      {incomingCall.name ||
       incomingCall.email ||
       incomingCall.callerId}
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
