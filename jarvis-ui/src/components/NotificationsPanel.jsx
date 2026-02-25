import { useEffect, useState, useRef } from "react";
import {
  getNotifications,
  markNotificationRead,
} from "../api/notificationsApi";
import "../styles/notifications.css";
import { useNavigate } from "react-router-dom";
import { playNotificationArriveSound } from "../utils/soundManager";
import { playNotificationSound } from "../utils/soundManager";
export default function NotificationsPanel({ onClose, onUnreadChange }) {
  const [notifications, setNotifications] = useState([]);

  const navigate = useNavigate();

  const token = sessionStorage.getItem("jarvis_token");
const panelRef = useRef(null);
  /* =========================
     INITIAL LOAD
  ========================= */

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {

    const data = await getNotifications(token);

    setNotifications((prev) => {

      const map = new Map();

      [...data, ...prev].forEach((n) => map.set(n.id, n));

      return Array.from(map.values());

    });

  }
useEffect(() => {
  function handleClickOutside(event) {
    if (
      panelRef.current &&
      !panelRef.current.contains(event.target)
    ) {
      onClose();
    }
  }

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [onClose]);
  /* =========================
     REALTIME LISTENER
  ========================= */
useEffect(() => {

  function onNewNotification(e) {

    const notif = e.detail;

    setNotifications((prev) => {

      if (prev.find((n) => n.id === notif.id))
        return prev;

    

      return [notif, ...prev];
    });

  }

  window.addEventListener("NEW_NOTIFICATION", onNewNotification);

  return () =>
    window.removeEventListener("NEW_NOTIFICATION", onNewNotification);

}, []);
/* =========================
   CLICK HANDLER (UPDATED)
========================= */

async function handleClick(n) {

  // mark read
  if (!n.is_read) {

    await markNotificationRead(n.id, token);

    setNotifications((prev) =>
      prev.map((x) =>
        x.id === n.id
          ? { ...x, is_read: true }
          : x
      )
    );

    // ✅ decrease unread badge instantly
    if (onUnreadChange) {
      onUnreadChange((prev) => Math.max(prev - 1, 0));
    }
  }

  /* =========================
     GROUP NAVIGATION
  ========================= */

  if (n.source === "GROUP") {

    if (n.metadata?.workspace_id) {
      navigate("/workspaces", {
        state: {
          workspaceId: n.metadata.workspace_id,
          highlightWorkspaceId: n.metadata.workspace_id
        }
      });
    } else {
      navigate("/workspaces");
    }
  }

  /* =========================
     SUPPORT NAVIGATION
  ========================= */

  if (n.source === "SUPPORT") {

    if (n.metadata?.ticket_id) {
      navigate(`/support/${n.metadata.ticket_id}`);
    } else {
      navigate("/support");
    }
  }

  // close panel after navigation
  setTimeout(onClose, 0);
}
  /* =========================
     MARK ALL READ
  ========================= */
async function markAllRead() {

  await fetch("http://127.0.0.1:8000/notifications/read-all", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  setNotifications((prev) =>
    prev.map((n) => ({
      ...n,
      is_read: true
    }))
  );

  // ✅ reset unread badge instantly
  if (onUnreadChange) {
    onUnreadChange(0);
  }

  setTimeout(onClose, 0);
}

  /* =========================
     UI
  ========================= */

  return (

<div
  ref={panelRef}
  className="notifications-panel"
>
      {/* HEADER */}

      <div className="panel-header">

        <span className="panel-title">
          🔔 Notifications
        </span>

        <div className="panel-actions">

          <button
            className="mark-all"
            onClick={markAllRead}
          >
            Mark all
          </button>

          <button
            className="close-btn"
            onClick={onClose}
          >
            ✕
          </button>

        </div>

      </div>

      {/* EMPTY */}

      {notifications.length === 0 && (

        <div className="empty">
          No notifications
        </div>

      )}

      {/* LIST */}

      {notifications.map((n) => (

        <div
          key={n.id}
          className={`notif-item ${
            n.is_read ? "read" : "unread"
          }`}
        onMouseEnter={playNotificationSound}
          onClick={() => handleClick(n)}
        >

          <div className="notif-left">
            <div
              className={`notif-dot ${
                n.is_read ? "" : "active"
              }`}
            />
          </div>

          <div className="notif-body">

            <div className="notif-title">
              {n.title}
            </div>

            <div className="notif-msg">
  {n.metadata?.workspace_name
    ? `Workspace: ${n.metadata.workspace_name}`
    : n.message}
</div>

            <div className="notif-time">
              {new Date(n.created_at)
                .toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata"
                })}
            </div>

          </div>

        </div>

      ))}

    </div>

  );

}
