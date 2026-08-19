import { playNotificationArriveSound } from "../utils/soundManager";
let socket = null;
let isConnecting = false;

export function connectNotificationSocket(token, onMessage) {
  if (!token) return;
  if (socket || isConnecting) return; // 🔥 prevent double connect

  isConnecting = true;

  socket = new WebSocket(
    `ws://127.0.0.1:8000/ws/notifications?token=${token}`
  );

  socket.onopen = () => {
    isConnecting = false;
    console.log("🔔 Notification WS connected");
  };

socket.onmessage = (e) => {
  const payload = JSON.parse(e.data);

if (payload.type === "notification") {

    console.log("🔥 REALTIME NOTIFICATION RECEIVED");

    playNotificationArriveSound();

    onMessage(payload.data);
}
};

  socket.onclose = () => {
    console.log("🔕 Notification WS closed");
    socket = null;
    isConnecting = false;
  };

  socket.onerror = () => {
    socket = null;
    isConnecting = false;
  };
}

export function disconnectNotificationSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
}
