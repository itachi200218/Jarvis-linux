import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef
} from "react";

import { playNotificationArriveSound } from "../utils/soundManager";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ws, setWs] = useState(null);

  // Keep the actual socket in a ref
  const socketRef = useRef(null);

// ==============================
// GROUP CALL SIGNAL QUEUE
// ==============================
const pendingGroupSignalsRef = useRef([]);
const groupSignalListenerReadyRef = useRef(false);
  // ==============================
  // CONNECT NOTIFICATION WEBSOCKET
  // ==============================
  useEffect(() => {

    const token = sessionStorage.getItem("jarvis_token");

    if (!token) return;


    const socket = new WebSocket(
      `ws://127.0.0.1:8000/ws/notifications?token=${token}`
    );

    socketRef.current = socket;


    // ==============================
    // CONNECTED
    // ==============================
    socket.onopen = () => {

      console.log(
        "✅ Notification WS Connected"
      );

      setWs(socket);
    };

socket.onmessage = (event) => {

  console.log(
    "📥 RAW WS MESSAGE:",
    event.data
  );

  const payload = JSON.parse(
    event.data
  );

  console.log(
    "📦 PARSED PAYLOAD:",
    payload
  );


  // ==============================
  // NORMAL NOTIFICATION
  // ==============================

  if (
    payload.type === "notification"
  ) {

    // existing code...

    return;
  }


  // ==============================
  // GROUP CALL INVITE
  // ==============================

  if (
    payload.type === "group_call_invite"
  ) {

    console.log(
      "📞 GROUP CALL INVITE RECEIVED"
    );

    console.log(
      "📞 Call ID:",
      payload.call_id
    );

    console.log(
      "👤 From:",
      payload.from
    );

    console.log(
      "👥 Participants:",
      payload.participants
    );

    window.dispatchEvent(
      new CustomEvent(
        "group-call-invite",
        {
          detail: payload
        }
      )
    );

    return;
  }


  // ==============================
  // 1-TO-1 CALL SIGNALS
  // ==============================

  if (
    payload.type === "call_offer" ||
    payload.type === "call_answer" ||
    payload.type === "call_candidate" ||
    payload.type === "call_end" ||
    payload.type === "call_rejected"
  ) {

    console.log(
      `📡 CALL SIGNAL RECEIVED: ${payload.type}`
    );

    window.dispatchEvent(
      new CustomEvent(
        "call-signal",
        {
          detail: payload
        }
      )
    );

    return;
  }


  // ==============================
  // GROUP CALL SIGNALS
  // ==============================

  // ==============================
// GROUP CALL SIGNALS
// ==============================
if (
  payload.type === "group_call_offer" ||
  payload.type === "group_call_answer" ||
  payload.type === "group_call_candidate" ||
  payload.type === "group_call_end"
) {

  console.log(
    `📡 GROUP CALL SIGNAL RECEIVED: ${payload.type}`
  );

  // 🔥 CallPage/GroupCallManager not ready yet
  if (!groupSignalListenerReadyRef.current) {

    console.log(
      "⏳ Queueing group signal:",
      payload.type
    );

    pendingGroupSignalsRef.current.push(
      payload
    );

    return;
  }

  // ✅ Listener is ready
  window.dispatchEvent(
    new CustomEvent(
      "group-call-signal",
      {
        detail: payload
      }
    )
  );

  return;
}

};

    // ==============================
    // CLOSED
    // ==============================
    socket.onclose = () => {

      console.log(
        "❌ Notification WS Closed"
      );

      socketRef.current = null;

      setWs(null);
    };


    // ==============================
    // ERROR
    // ==============================
    socket.onerror = (err) => {

      console.log(
        "❌ Notification WS Error:",
        err
      );
    };


    // ==============================
    // CLEANUP
    // ==============================
    return () => {

      socket.close();

      socketRef.current = null;

      setWs(null);
    };

  }, []);

// ==============================
// GROUP CALL SIGNAL LISTENER READY
// ==============================
const markGroupSignalListenerReady = () => {

  groupSignalListenerReadyRef.current = true;

  const pending =
    pendingGroupSignalsRef.current;

  pendingGroupSignalsRef.current = [];

  console.log(
    "📦 Flushing queued group signals:",
    pending.length
  );

  pending.forEach(payload => {

    window.dispatchEvent(
      new CustomEvent(
        "group-call-signal",
        {
          detail: payload
        }
      )
    );

  });
};
  // ==============================
  // SEND WEBSOCKET SIGNAL
  // ==============================
  const sendNotificationSignal = (
    payload
  ) => {

    const socket =
      socketRef.current;


    if (!socket) {

      console.error(
        "❌ Notification WS not connected"
      );

      return false;
    }


    if (
      socket.readyState !==
      WebSocket.OPEN
    ) {

      console.error(
        "❌ Notification WS is not OPEN"
      );

      return false;
    }


    socket.send(
      JSON.stringify(payload)
    );

    console.log(
      "📤 WS signal sent:",
      payload
    );

    return true;
  };


  // ==============================
  // MARK ALL READ
  // ==============================
  const markAllRead = () => {

    setUnreadCount(0);

    setNotifications(prev =>
      prev.map(n => ({
        ...n,
        is_read: true
      }))
    );
  };


  // ==============================
  // MARK ONE READ
  // ==============================
  const markOneRead = (id) => {

    setNotifications(prev =>
      prev.map(n =>
        n.id === id
          ? {
              ...n,
              is_read: true
            }
          : n
      )
    );

    setUnreadCount(
      prev =>
        Math.max(
          prev - 1,
          0
        )
    );
  };


  return (

    <NotificationContext.Provider
      value={{
  notifications,
  unreadCount,
  markAllRead,
  markOneRead,
  ws,
  sendNotificationSignal,
  markGroupSignalListenerReady
}}
    >

      {children}

    </NotificationContext.Provider>
  );
}


export function useNotification() {

  const ctx =
    useContext(
      NotificationContext
    );

  if (!ctx) {

    throw new Error(
      "useNotification must be used inside provider"
    );
  }

  return ctx;
}