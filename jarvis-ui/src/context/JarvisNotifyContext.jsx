import { createContext, useContext, useEffect, useState } from "react";
import "../styles/notify.css";

const JarvisNotifyContext = createContext(null);

export function JarvisNotifyProvider({ children }) {
  const [systemNotify, setSystemNotify] = useState(null);

  const notify = ({ type = "info", message }) => {
    console.log("🤖 JARVIS NOTIFY:", type, message); // 🔥 DEBUG
    setSystemNotify({ type, message });

    setTimeout(() => {
      setSystemNotify(null);
    }, 3000);
  };

  // 🔥 GUARANTEED GLOBAL FALLBACK
  useEffect(() => {
    const handler = (e) => {
      setSystemNotify(e.detail);
      setTimeout(() => setSystemNotify(null), 3000);
    };

    window.addEventListener("JARVIS_NOTIFY", handler);
    return () => window.removeEventListener("JARVIS_NOTIFY", handler);
  }, []);

  return (
    <JarvisNotifyContext.Provider value={{ notify }}>
      {children}

      {systemNotify && (
        <div className={`jarvis-notify ${systemNotify.type}`}>
          <span className="jarvis-prefix">🤖 JARVIS:</span>
          {systemNotify.message}
        </div>
      )}
    </JarvisNotifyContext.Provider>
  );
}

export const useJarvisNotify = () => {
  const ctx = useContext(JarvisNotifyContext);
  if (!ctx) {
    console.warn("❌ JarvisNotifyContext not mounted");
  }
  return ctx;
};
