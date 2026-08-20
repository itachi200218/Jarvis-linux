import { playNotificationArriveSound } from "../utils/soundManager";

let socket = null;
let isConnecting = false;

// Queue messages if the socket is still connecting
const pendingSignals = [];


// ==============================
// CONNECT
// ==============================
export function connectNotificationSocket(token, onMessage) {

  if (!token) return;

  if (socket || isConnecting) return;

  isConnecting = true;

  socket = new WebSocket(
    `ws://127.0.0.1:8000/ws/notifications?token=${token}`
  );

  socket.onopen = () => {

    isConnecting = false;

    console.log("🔔 Notification WS connected");

    // Send anything that was waiting
    while (pendingSignals.length > 0) {

      const payload = pendingSignals.shift();

      socket.send(
        JSON.stringify(payload)
      );

      console.log(
        "📤 Queued WS signal sent:",
        payload
      );
    }
  };


  // ==============================
  // RECEIVE
  // ==============================
  socket.onmessage = (e) => {

    const payload = JSON.parse(e.data);

    console.log(
      "📡 WS message received:",
      payload
    );


    // ==============================
    // NORMAL NOTIFICATION
    // ==============================
    if (payload.type === "notification") {

      console.log(
        "🔥 REALTIME NOTIFICATION RECEIVED"
      );

      playNotificationArriveSound();

      onMessage(payload.data);

      return;
    }


    // ==============================
    // GROUP CALL INVITE
    // ==============================
    if (payload.type === "group_call_invite") {

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

      onMessage(payload);

      return;
    }


    // ==============================
    // OTHER CALL SIGNALS
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

      onMessage(payload);

      return;
    }

  };


  // ==============================
  // CLOSE
  // ==============================
  socket.onclose = () => {

    console.log(
      "🔕 Notification WS closed"
    );

    socket = null;
    isConnecting = false;
  };


  // ==============================
  // ERROR
  // ==============================
  socket.onerror = (error) => {

    console.error(
      "❌ Notification WS error:",
      error
    );

    socket = null;
    isConnecting = false;
  };
}


// ==============================
// SEND SIGNAL
// ==============================
export function sendNotificationSignal(payload) {

  // Socket doesn't exist yet
  if (!socket) {

    console.warn(
      "⏳ Notification WS not connected yet — queueing signal"
    );

    pendingSignals.push(payload);

    return true;
  }


  // Socket is still connecting
  if (socket.readyState === WebSocket.CONNECTING) {

    console.warn(
      "⏳ Notification WS connecting — queueing signal"
    );

    pendingSignals.push(payload);

    return true;
  }


  // Socket isn't usable
  if (socket.readyState !== WebSocket.OPEN) {

    console.error(
      "❌ Notification WS is not OPEN"
    );

    return false;
  }


  // Send immediately
  socket.send(
    JSON.stringify(payload)
  );

  console.log(
    "📤 WS signal sent:",
    payload
  );

  return true;
}


// ==============================
// DISCONNECT
// ==============================
export function disconnectNotificationSocket() {

  if (socket) {

    socket.close();

    socket = null;
  }

  isConnecting = false;

  pendingSignals.length = 0;
}