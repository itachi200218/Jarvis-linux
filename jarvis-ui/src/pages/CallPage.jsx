import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useNotification } from "../components/NotificationContext";
import { useCallManager } from "../context/CallContext";
import { getUserProfile } from "../api/profileApi";
import "../styles/call-page.css";

export default function CallPage() {

  const { userId } = useParams();

  const navigate = useNavigate();

  const { ws } = useNotification();

  const callManagerRef = useCallManager();

  const location = useLocation();

  const emailFromState = location.state?.email;
  const nameFromState = location.state?.name;

  const previousPage =
    location.state?.previousPage || "/workspaces";


  // ✅ VIDEO REFS
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);


  const [status, setStatus] = useState("Connecting...");
  const [time, setTime] = useState(0);
  const [connected, setConnected] = useState(false);

const [callType, setCallType] = useState(
  location.state?.callType ||
  callManagerRef.current?.callType ||
  "audio"
);



  const [userInfo, setUserInfo] = useState({
    name: nameFromState || null,
    email: emailFromState || null,
    avatar: null
  });


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

      console.log("Attaching video elements now");

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

  // Try immediately
  if (attachVideo()) return;

  // Retry until ready
  const interval = setInterval(() => {

    if (attachVideo()) {
      clearInterval(interval);
    }

  }, 100);

  return () => clearInterval(interval);

}, []);

  // =============================
  // LOAD USER PROFILE
  // =============================
// =============================
// LOAD USER PROFILE (FIXED)
// =============================
useEffect(() => {

  const fetchUserInfo = async () => {

    try {

      // ✅ ONLY use email, never userId
      const emailToFetch =
        callManagerRef.current?.targetEmail ||
        emailFromState;

      if (!emailToFetch) {
        console.warn("No email available for profile fetch");
        return;
      }

      console.log("Fetching profile for:", emailToFetch);

      const profile =
        await getUserProfile(emailToFetch);

      setUserInfo(profile);

    } catch (err) {

      console.error("Failed to load user info", err);

      // fallback display
      setUserInfo({
        name:
          callManagerRef.current?.targetName ||
          emailFromState ||
          "Unknown User",
        email: emailFromState,
        avatar: null
      });

    }

  };

  fetchUserInfo();

}, [emailFromState, callManagerRef]);
  // =============================
  // TIMER
  // =============================
  useEffect(() => {

    if (!connected) return;

    const interval = setInterval(() => {

      setTime(prev => prev + 1);

    }, 1000);

    return () => clearInterval(interval);

  }, [connected]);


  // =============================
  // CALL CONNECTED EVENT
  // =============================
  useEffect(() => {

    const handler = () => {

      setStatus("Connected");
      setConnected(true);

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
  // CALL ENDED EVENT
  // =============================
  useEffect(() => {

    const handler = () => {

      setConnected(false);
      setStatus("Call Ended");

      setTimeout(() => {

        navigate(previousPage);

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

  }, [navigate, previousPage]);


  // =============================
  // SAFETY CHECK
  // =============================
  useEffect(() => {

    const check = () => {

      const cm =
        callManagerRef.current;

      if (
        !cm ||
        (!cm.pc &&
         !cm.localStream &&
         !cm.currentTarget)
      ) {

        navigate(previousPage);

      }

    };

    check();

    const interval =
      setInterval(check, 500);

    return () =>
      clearInterval(interval);

  }, [callManagerRef, navigate, previousPage]);


  // =============================
  // END CALL BUTTON
  // =============================
  const endCall = () => {

    callManagerRef.current
      ?.endCall(userId);

    navigate(previousPage);

  };


  const formatTime = () => {

    const min =
      Math.floor(time / 60);

    const sec =
      time % 60;

    return `${min}:${sec
      .toString()
      .padStart(2, "0")}`;

  };


  const displayName =

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

    {/* ================= VIDEO LAYOUT ================= */}
    {callType === "video" && (
      <div className="video-layout">

        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="remote-video"
        />

        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="local-video"
        />

        {/* Overlay info */}
        <div className="video-overlay-info">
          <h2>{displayName}</h2>
          <p>{status}</p>
          {connected && <p>{formatTime()}</p>}
        </div>

      </div>
    )}


    {/* ================= VOICE LAYOUT ================= */}
    {callType === "audio" && (
      <>
        <div
          className="call-background"
          style={{
            backgroundImage: `url(${avatarUrl})`
          }}
        />

        <div className="call-overlay"></div>

        <div className="call-content">

          <h2 className="call-title">
            Voice Call
          </h2>

          <img
            src={avatarUrl}
            alt="avatar"
            onError={(e)=>{
              e.target.src="/default-avatar.png";
            }}
            className="call-avatar"
          />

          <h1 className="call-name">
            {displayName}
          </h1>

          <p className="call-status">
            {status}
          </p>

          {connected && (
            <p className="call-timer">
              {formatTime()}
            </p>
          )}

        </div>
      </>
    )}


    {/* ================= END BUTTON ================= */}
    <button
      onClick={endCall}
      className="call-end-button"
    >
      End Call
    </button>

  </div>

);

}
