import { createContext, useContext, useState, useEffect } from "react";
import { playNotificationArriveSound } from "../utils/soundManager";
const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ws, setWs] = useState(null);
useEffect(() => {

  const token = sessionStorage.getItem("jarvis_token");
  if (!token) return;

  const socket = new WebSocket(
    `ws://127.0.0.1:8000/ws/notifications?token=${token}`
  );

  socket.onopen = () => {
    console.log("✅ Notification WS Connected");
    setWs(socket);
  };
socket.onmessage = (event) => {
  console.log("📥 RAW WS MESSAGE:", event.data);

  const payload = JSON.parse(event.data);
  console.log("📦 PARSED PAYLOAD:", payload);

  if (payload.type === "notification") {
    console.log("✅ Notification event received!");

    const notif = payload.data;

    setNotifications(prev => {
      if (prev.find(n => n.id === notif.id)) return prev;

      playNotificationArriveSound();
      return [notif, ...prev];
    });

    setUnreadCount(prev => prev + 1);
  }
};

  socket.onclose = () => {
    console.log("❌ Notification WS Closed");
    setWs(null);
  };

  socket.onerror = (err) => {
    console.log("Notification WS Error:", err);
  };

  return () => socket.close();

}, []);
  const markAllRead = () => {
    setUnreadCount(0);
    setNotifications(prev =>
      prev.map(n => ({ ...n, is_read: true }))
    );
  };

  const markOneRead = (id) => {

    setNotifications(prev =>
      prev.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      )
    );

    setUnreadCount(prev => Math.max(prev - 1, 0));
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAllRead,
      markOneRead,
      ws
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {

  const ctx = useContext(NotificationContext);

  if (!ctx)
    throw new Error("useNotification must be used inside provider");

  return ctx;
}