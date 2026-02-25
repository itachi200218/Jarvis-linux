import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  sendSupportMessage,
  getSupportTickets,
  getSupportTicket,
} from "../api/support";
import "../styles/support.css";

export default function Support() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem("jarvis_token");

  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // 🔥 ONLY NEW STATE (feature #2)
  const [mode, setMode] = useState("new"); // "new" | "view"

  // dropdown states (unchanged)
  const [showPending, setShowPending] = useState(true);
  const [showSolved, setShowSolved] = useState(false);
const { ticketId } = useParams();

  // ==============================
  // LOAD USER TICKETS
  // ==============================
  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    try {
      const data = await getSupportTickets(token);
      setTickets(data);
    } catch (err) {
      console.error(err);
    }
  }

  // ==============================
  // OPEN A TICKET (feature #2)
  // ==============================
  async function openTicket(ticketId) {
    try {
      const data = await getSupportTicket(ticketId, token);
      setActiveTicket(data);
      setMode("view"); // 👈 important
      setStatus("");
    } catch (err) {
      console.error(err);
    }
  }

  // ==============================
  // SEND MESSAGE (unchanged logic)
  // ==============================
  const handleSend = async () => {
    if (!message.trim()) return;

    try {
      setLoading(true);
      setStatus("");

      const res = await sendSupportMessage(message, token);
      setMessage("");

      await loadTickets();

      if (mode === "view" && activeTicket) {
        openTicket(activeTicket._id);
      }

      setStatus(`Message ${res.action}`);
    } catch (err) {
      setStatus("Failed to send message");
    } finally {
      setLoading(false);
    }
  };
// ==============================
// AUTO OPEN TICKET FROM URL
// ==============================
useEffect(() => {
  if (ticketId) {
    openTicket(ticketId);
  }
}, [ticketId]);

  // ==============================
  // SPLIT TICKETS (unchanged)
  // ==============================
  const pendingTickets = tickets.filter(t => t.status === "open");
  const solvedTickets = tickets.filter(t => t.status === "closed");

  return (
    <div className="support-page">
      <div className="support-layout">

        {/* ================= LEFT PANEL ================= */}
        <div className="ticket-list">

          <button
            className="support-back-btn"
            onClick={() => navigate("/")}
          >
            ← Back to Jarvis
          </button>

          <h3 className="ticket-title">Your Tickets</h3>

          {/* 🔥 SMALL NEW TICKET BUTTON (feature #1) */}
          <button
            className="new-ticket-btn"
            onClick={() => {
              setActiveTicket(null);
              setMessage("");
              setMode("new");
              setStatus("");
            }}
          >
            + New Ticket
          </button>

          {/* ===== Pending Tickets ===== */}
          <div className="ticket-section">
            <div
              className="ticket-section-header"
              onClick={() => setShowPending(!showPending)}
            >
              ▾ Pending Tickets ({pendingTickets.length})
            </div>

            {showPending && pendingTickets.map(t => (
              <div
                key={t._id}
                className="ticket-item open"
                onClick={() => {
  navigate(`/support/${t._id}`);
  openTicket(t._id);
}}

              >
                Ticket #{t._id.slice(-6)}
              </div>
            ))}
          </div>

          {/* ===== Solved Tickets ===== */}
          <div className="ticket-section">
            <div
              className="ticket-section-header solved"
              onClick={() => setShowSolved(!showSolved)}
            >
              ▾ Solved Tickets ({solvedTickets.length})
            </div>

            {showSolved && solvedTickets.map(t => (
              <div
                key={t._id}
                className="ticket-item closed"
                onClick={() => openTicket(t._id)}
              >
                Ticket #{t._id.slice(-6)}
              </div>
            ))}
          </div>
        </div>

        {/* ================= RIGHT PANEL ================= */}
        <div className="support-container">

          {/* ===== VIEW EXISTING TICKET ===== */}
          {mode === "view" && activeTicket && (
            <>
              <h2 className="support-title">
                Ticket #{activeTicket._id.slice(-6)}
              </h2>

              <div className="ticket-chat">
                {activeTicket.messages.map((m, i) => (
                  <div key={i} className={`chat-msg ${m.sender}`}>
                    <span className="sender">{m.sender}</span>
                    <p>{m.text}</p>
                  </div>
                ))}
              </div>

              {activeTicket.status !== "closed" && (
                <>
                  <textarea
                    className="support-textarea"
                    placeholder="Reply to this ticket..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />

                  <button
                    className="support-button"
                    onClick={handleSend}
                    disabled={loading}
                  >
                    {loading ? "Sending..." : "Send Reply"}
                  </button>
                </>
              )}
            </>
          )}

          {/* ===== CREATE NEW TICKET ===== */}
          {mode === "new" && (
            <>
              <h2 className="support-title">Create New Ticket</h2>

              <textarea
                className="support-textarea"
                placeholder="Describe your issue..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />

              <button
                className="support-button"
                onClick={handleSend}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Ticket"}
              </button>
            </>
          )}

          {status && <p className="support-status">{status}</p>}
        </div>
      </div>

      {/* ================= FOOTER ================= */}
      <footer className="support-footer">
        <div className="footer-brand">Jarvis Admin</div>
        <div className="footer-links">
          <span>Support</span>
          <span>Privacy</span>
          <span>Security</span>
          <span>Status</span>
        </div>
        <div className="footer-meta">
          © 2026 Jarvis • Secure AI Platform
        </div>
      </footer>
    </div>
  );
}
