import { useEffect, useRef } from "react";
import { pingPresence } from "../api/presenceApi";

export function usePresenceHeartbeat() {
  const intervalRef = useRef(null);

  useEffect(() => {
    const start = () => {
      if (intervalRef.current) return;

      // 🔥 fire immediately (VERY IMPORTANT)
      pingPresence().catch(() => {});

      intervalRef.current = setInterval(() => {
        pingPresence().catch(() => {});
      }, 3000); // must be < backend timeout
    };

    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // start immediately if logged in
    if (sessionStorage.getItem("jarvis_token")) {
      start();
    }

    // listen for login/logout via storage events
    const onStorage = (e) => {
      if (e.key === "jarvis_token") {
        if (e.newValue) start();
        else stop();
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      stop();
      window.removeEventListener("storage", onStorage);
    };
  }, []);
}
