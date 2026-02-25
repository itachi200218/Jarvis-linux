import { useEffect, useState } from "react";
import {
  getInvites,
  acceptInvite,
  rejectInvite
} from "../api/workspace";

export default function InviteNotifications({ onJoin }) {
  const [invites, setInvites] = useState([]);

  useEffect(() => {
    const token = sessionStorage.getItem("jarvis_token");
    if (!token) return;

    loadInvites();

    // 🔁 optional polling (Slack-like)
    const interval = setInterval(loadInvites, 500);
    return () => clearInterval(interval);
  }, []);

  const loadInvites = async () => {
    try {
      const res = await getInvites();
      setInvites(res.data || []);
      console.log("Invites loaded:", res.data); // 👈 DEBUG (KEEP FOR NOW)
    } catch (err) {
      console.error("Invite fetch failed", err);
    }
  };

  // ==============================
  // ACCEPT INVITE (WITH ALERT)
  // ==============================
  const handleAccept = async (inviteId) => {
    try {
      const res = await acceptInvite(inviteId);
      setInvites(prev => prev.filter(i => i._id !== inviteId));

      // 🔥 auto join workspace
      onJoin(res.data.workspace_id);
       window.dispatchEvent(new Event("workspace-member-update"));
    } catch (err) {
      const message =
        err?.response?.data?.detail || "Failed to accept invite";
      alert("⚠️ " + message);
    }
  };

  // ==============================
  // REJECT INVITE (WITH ALERT)
  // ==============================
  const handleReject = async (inviteId) => {
    try {
      await rejectInvite(inviteId);
      setInvites(prev => prev.filter(i => i._id !== inviteId));
    } catch (err) {
      const message =
        err?.response?.data?.detail || "Failed to reject invite";
      alert("⚠️ " + message);
    }
  };

  if (invites.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        width: 320,
        background: "#0b0f1a",
        border: "1px solid #00d4ff",
        borderRadius: 12,
        padding: 12,
        zIndex: 9999 // 👈 VERY IMPORTANT
      }}
    >
      <h4 style={{ color: "#7dd3ff" }}>🔔 Workspace Invites</h4>

      {invites.map(invite => (
        <div
          key={invite._id}
          style={{
            background: "#0f1629",
            padding: 10,
            borderRadius: 8,
            marginBottom: 8
          }}
        >
          <p style={{ color: "#e6f1ff", fontSize: 14 }}>
            <b>{invite.invited_by}</b> invited you to <br />
            <b>{invite.workspace_name}</b>
          </p>

          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => handleAccept(invite._id)}>
              Accept
            </button>
            <button onClick={() => handleReject(invite._id)}>
              Cancel
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
