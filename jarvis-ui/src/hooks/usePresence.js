import { useEffect, useRef } from "react";
import { pingPresence, getPresenceUsers } from "../api/presenceApi";

export default function usePresence() {
  const heartbeatRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    const token = sessionStorage.getItem("jarvis_token");
    if (!token) return;

    /* ==========================
       🟢 HEARTBEAT (I AM ONLINE)
    ========================== */
    const startHeartbeat = () => {
      if (heartbeatRef.current) return;

      pingPresence().catch(() => {});

      heartbeatRef.current = setInterval(() => {
        pingPresence().catch(() => {});
      }, 3000); // must be < backend timeout
    };

    /* ==========================
       👀 POLL OTHERS (READ)
    ========================== */
    const startPolling = () => {
      if (pollRef.current) return;

      pollRef.current = setInterval(() => {
        getPresenceUsers().catch(() => {});
      }, 5000); // read presence
    };

    /* ==========================
       🔴 OFFLINE (TAB CLOSE)
    ========================== */
    const goOffline = () => {
      try {
        const token = sessionStorage.getItem("jarvis_token");
        if (!token) return;

        const email = JSON.parse(atob(token.split(".")[1])).sub;

        navigator.sendBeacon(
          "http://127.0.0.1:8000/auth/offline",
          JSON.stringify({ email })
        );
      } catch {}
    };

    startHeartbeat();
    startPolling();

    window.addEventListener("beforeunload", goOffline);

    return () => {
      clearInterval(heartbeatRef.current);
      clearInterval(pollRef.current);
      window.removeEventListener("beforeunload", goOffline);
    };
  }, []);
}
