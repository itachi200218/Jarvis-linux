import { useEffect, useRef, useState } from "react";
import "../App.css";
import "../styles/chat-drawer.css";
import JarvisScene from "../3dModel/JarvisScene";
import { useAuth } from "../context/authcontext_temp.jsx";
import { useNavigate } from "react-router-dom";
import { SYSTEM_COMMAND_KEYWORDS } from "../SystemCommands/commands";
import "../styles/jarvisToast.css";
import Fuse from "fuse.js"; // 🔥 ADDED
import ChatHistory from "../components/ChatHistory";
import { getChatHistory } from "../api/historyApi";
import ReactMarkdown from "react-markdown";
import JarvisPopup from "../pages/JarvisPopup";
import { JarvisCodeBlock } from "../components/JarvisCodeBlock";

const API_URL = "http://127.0.0.1:8000/command";

// 🔥 ADDED: Frontend fuzzy matcher (same idea as backend)
const fuse = new Fuse(SYSTEM_COMMAND_KEYWORDS, {
  includeScore: true,
  threshold: 0.4, // works well for chrome / crome / cromr / chorme
});



function JarvisApp({ openLogin }) {
  const recognitionRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const jarvisTextRef = useRef(null);
const historyPanelRef = useRef(null); // 👈 ADD THIS
const allowJarvisSpeechRef = useRef(true); // 🔊 MAIN JARVIS SPEECH FLAG

  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("Awaiting command");
  const [lastCommand, setLastCommand] = useState("");
  const [textCommand, setTextCommand] = useState("");
  const [jarvisReply, setJarvisReply] = useState("");
const [activeChatId, setActiveChatId] = useState(null);
// const [isJarvisPopupOpen, setIsJarvisPopupOpen] = useState(false);
const [windows, setWindows] = useState([]);
  // 🔥 ROBOTIC HUD NOTIFICATION STATE
  const [showRestriction, setShowRestriction] = useState(false);
const [showHistory, setShowHistory] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
const [isJarvisExpanded, setIsJarvisExpanded] = useState(false);
const [showOverflow, setShowOverflow] = useState(false);

const openNewWindow = (replyText) => {
  setWindows((prev) => [
    ...prev,
    {
      id: Date.now() + Math.random(),
      title: lastCommand || "JARVIS",
      minimized: false,
      messages: [
        {
          role: "assistant",
          text: replyText,
          time: Date.now(),
        },
      ],
    },
  ]);
};



  // =========================
  // 🔊 FRONTEND JARVIS VOICE (DENIAL ONLY)
  // =========================
 const speakFrontend = (text, shouldSpeak) => {
  if (!shouldSpeak) return;
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 0.8;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
};

  // =========================
  // SPEECH RECOGNITION
  // =========================
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech Recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.trim();
      recognition.stop();
      setListening(false);
      setStatus("Processing…");
      setLastCommand(text);
      sendCommand(text);
    };

    recognition.onend = () => {
      setListening(false);
      setStatus("Awaiting command");
    };

    recognitionRef.current = recognition;
  }, []);

  // =========================
  // TYPING EFFECT
  // =========================
  const typeJarvisReply = (text) => {
    if (typeof text !== "string") {
      setJarvisReply("⚠️ Invalid response from Jarvis");
      return;
    }

    clearInterval(typingIntervalRef.current);

    const cleanText = text.trim();
    let index = 0;
    setJarvisReply("");

    const CHARS_PER_SECOND = 13.5;
    const estimatedSpeechTime = Math.max(
      500,
      (cleanText.length / CHARS_PER_SECOND) * 1000 - 1000
    );

    const typingSpeed = Math.max(
      18,
      Math.floor(estimatedSpeechTime / cleanText.length)
    );

    typingIntervalRef.current = setInterval(() => {
      index++;
      setJarvisReply(cleanText.slice(0, index));

      if (jarvisTextRef.current) {
        jarvisTextRef.current.scrollTop =
          jarvisTextRef.current.scrollHeight;
      }

      if (index >= cleanText.length) {
        clearInterval(typingIntervalRef.current);
      }
    }, typingSpeed);
  };
useEffect(() => {
  if (!activeChatId) return;

  getChatHistory().then((data) => {
    const found = data.find((c) => c.id === activeChatId);
    if (found) {
      setActiveConversation(found);
      sessionStorage.setItem("active_chat_id", found.id);
    }
  });
}, [activeChatId]);
// =========================
// 🔥 CLICK OUTSIDE TO CLOSE CHAT HISTORY
// =========================
useEffect(() => {
  function handleClickOutside(event) {
    if (
      showHistory &&
      historyPanelRef.current &&
      !historyPanelRef.current.contains(event.target)
    ) {
      setShowHistory(false);
    }
  }

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [showHistory]);

  // =========================
  // BACKEND CALL
  // =========================
async function sendCommand(command, source = "main") {
  if (!command || !command.trim()) return;

  const shouldSpeak = source === "main";

  const token = sessionStorage.getItem("jarvis_token");
  const isGuest = !token;

  const isSystemCommand = fuse.search(command.toLowerCase()).length > 0;

  if (isGuest && isSystemCommand) {
    const denyText =
      "Access denied. Guest users cannot execute system commands.";

    setStatus("Restricted");
    typeJarvisReply(
      "⛔ ACCESS DENIED — Guest users cannot execute system commands."
    );

    if (shouldSpeak) {
      speakFrontend(denyText);
    }

    setShowRestriction(true);
    setTimeout(() => setShowRestriction(false), 3000);
    setStatus("Awaiting command");
    return;
  }

  try {
    let chatId = sessionStorage.getItem("active_chat_id");

    if (token && !chatId) {
      const chatRes = await fetch("http://127.0.0.1:8000/auth/new-chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const chatData = await chatRes.json();
      if (chatData?.chat_id) {
        chatId = chatData.chat_id;
        sessionStorage.setItem("active_chat_id", chatId);
      }
    }

    if (!token) chatId = null;
    else if (!chatId) return;

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        command: command.trim(),
        ...(token && { chat_id: chatId }),
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      typeJarvisReply(err?.reply || "⚠️ Request failed");
      return;
    }

    const data = await res.json();

    setStatus("Responding…");
    typeJarvisReply(data.reply);

    if (shouldSpeak) {
      speakFrontend(data.reply);
    }

  } catch (err) {
    console.error(err);
    typeJarvisReply("Something went wrong.");
  } finally {
    setStatus("Awaiting command");
  }
}


  // =========================
  // MIC TOGGLE
  // =========================
  const toggleListening = () => {
    if (!listening) {
      recognitionRef.current.start();
      setListening(true);
      setStatus("Listening…");
    } else {
      recognitionRef.current.stop();
      setListening(false);
      setStatus("Awaiting command");
    }
  };

  // =========================
  // TEXT COMMAND
  // =========================
  const handleTextSubmit = async () => {
    if (!textCommand.trim()) return;
    setLastCommand(textCommand);
    setStatus("Processing…");
    await sendCommand(textCommand);
    setTextCommand("");
  };

  if (loading) {
    return <div className="status">Initializing Jarvis…</div>;
  }
const MAX_VISIBLE_TABS = 5;

const minimizedWindows = windows.filter(w => w.minimized);

const visibleTabs = minimizedWindows.slice(0, MAX_VISIBLE_TABS);
const overflowTabs = minimizedWindows.slice(MAX_VISIBLE_TABS);


const handleWindowSend = async (windowId, text) => {
  // 🔇 ABSOLUTE SILENCE FOR WINDOW TABS
 
allowJarvisSpeechRef.current = false; // 🔇 HARD MUTE FOR WINDOW TABS

  // 1️⃣ Add USER message to that window
  setWindows(prev =>
    prev.map(w =>
      w.id === windowId
        ? {
            ...w,
            messages: [
              ...w.messages,
              { role: "user", text, time: Date.now() }
            ]
          }
        : w
    )
  );

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: text,
        silent: true
      }),
    });

    const data = await res.json();

    // 2️⃣ Append response ONLY to that window
    setWindows(prev =>
      prev.map(w =>
        w.id === windowId
          ? {
              ...w,
              messages: [
                ...w.messages,
                {
                  role: "assistant",
                  text: data.reply,
                  time: Date.now(),
                },
              ],
            }
          : w
      )
    );
  } catch (err) {
    console.error(err);
  }
};

  // =========================
  // UI
  // =========================
  return (
  <div className="hud">
    <div className="hud-grid">
      <div className="box-aura" />
    </div>

    <div className="three-bg">
      <JarvisScene />
    </div>

    <div className="hud-login" onClick={() => navigate("/auth")}>
      <span className="hud-login-icon">🔐</span>
      <span className="hud-login-text">SECURE MODE</span>
    </div>

    {user && (
      <div
        className="hud-login"
        style={{ top: "90px" }}
        onClick={() => setShowHistory((prev) => !prev)}
      >
        <span className="hud-login-icon">🗂️</span>
        <span className="hud-login-text">
          {showHistory ? "CLOSE CHATS" : "MY CHATS"}
        </span>
      </div>
    )}

    {showHistory && (
      <div className="chat-drawer" ref={historyPanelRef}>
        <div className="scan-line" />
        <div className="hud-corner tl" />
        <div className="hud-corner tr" />
        <div className="hud-corner bl" />
        <div className="hud-corner br" />

        <ChatHistory
          onSelectChat={(chatId) => {
            setActiveChatId(chatId);
            setShowHistory(false);
          }}
        />
      </div>
    )}

    <div className="hud-frame">
      <div className="hud-header">
        <div className="hud-title">J.A.R.V.I.S</div>

        <div className="hud-subtitle">
          <div className="hud-user">
            <div className="hud-user-info">
              <div className="hud-welcome">Welcome</div>
              <div className="hud-username">
                {user ? user.name : "GUEST"}
              </div>
              <div className="hud-role">
                ROLE: {user ? user.role.toUpperCase() : "LIMITED"}
              </div>
              <div
                className={`hud-system-status ${
                  user ? "enabled" : "restricted"
                }`}
              >
                SYSTEM COMMANDS: {user ? "ENABLED" : "RESTRICTED"}
              </div>
            </div>

            {user && (
              <>
                <div className="hud-divider" />
                <button
                  className="hud-profile-btn"
                  onClick={() => navigate("/profile")}
                >
                  PROFILE
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={`mic-orb 
          ${listening ? "listening" : ""} 
          ${status === "Processing…" ? "processing" : ""} 
          ${status === "Responding…" ? "speaking" : ""}
        `}
        onClick={toggleListening}
      >
        🎙️
      </div>

      <div className="status">{status}</div>

      {lastCommand && (
        <div className="command-box user">
          <span className="label">USER</span>
          <span className="text">{lastCommand}</span>
        </div>
      )}
      
{jarvisReply && (
  <div
    className="command-box jarvis-card"
    onClick={() => openNewWindow(jarvisReply)}

  >
    <span className="label">JARVIS</span>

    <div className="jarvis-card-content">
      <ReactMarkdown
  components={{
    pre({ children }) {
      return <>{children}</>; // 🔥 removes extra outer box
    },
    code({ inline, children }) {
      if (inline) return <code>{children}</code>;
      return (
        <JarvisCodeBlock>
          {String(children).trim()}
        </JarvisCodeBlock>
      );
    },
  }}
>
  {jarvisReply}
</ReactMarkdown>


    </div>
  </div>
)}

      <div className="text-input">
        <input
          type="text"
          placeholder="Type command…"
          value={textCommand}
          onChange={(e) => setTextCommand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
        />
        <button onClick={handleTextSubmit}>EXECUTE</button>
      </div>
    </div>
{windows.map((win) => (
  <JarvisPopup
    key={win.id}
    id={win.id}
    messages={win.messages}          // ✅ NEW
    minimized={win.minimized}
    onMinimize={(id) =>
      setWindows((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, minimized: true } : w
        )
      )
    }
    onClose={(id) =>
      setWindows((prev) => prev.filter((w) => w.id !== id))
    }
    onSendMessage={handleWindowSend} // ✅ NEW
  />
))}


{/* 🧭 TASKBAR (MINIMIZED WINDOWS) */}
<div className="jarvis-taskbar">

  {/* NORMAL VISIBLE TABS */}
  {visibleTabs.map((w) => (
    <div
  key={w.id}
  className="jarvis-taskbar-tab"
  onClick={() => {
    setWindows(prev =>
      prev.map(win =>
        win.id === w.id
          ? { ...win, minimized: false }
          : win
      )
    );
    setShowOverflow(false);
  }}
>
  <span>{w.title || "JARVIS"}</span>

  {/* ❌ CLOSE */}
  <button
    className="taskbar-close"
    onClick={(e) => {
      e.stopPropagation(); // 🔥 IMPORTANT
      setWindows(prev =>
        prev.filter(win => win.id !== w.id)
      );
    }}
  >
    ✕
  </button>
</div>

  ))}

  {/* +N OVERFLOW BUTTON */}
  {overflowTabs.length > 0 && (
    <div className="jarvis-overflow-wrapper">
      <div
        className="jarvis-taskbar-tab overflow"
        onClick={() => setShowOverflow(prev => !prev)}
      >
        +{overflowTabs.length}
      </div>
    </div>
  )}

</div>

{/* 🔽 OVERFLOW POPUP */}
{showOverflow && (
  <div className="jarvis-overflow-popup">
    {overflowTabs.map((w) => (
      <div key={w.id} className="overflow-item">

        {/* 🪟 RESTORE WINDOW */}
        <span
          className="overflow-title"
          onClick={() => {
            setWindows(prev =>
              prev.map(win =>
                win.id === w.id
                  ? { ...win, minimized: false }
                  : win
              )
            );
            setShowOverflow(false);
          }}
        >
          {w.title || "JARVIS"}
        </span>

        {/* ❌ CLOSE WINDOW */}
        <button
          className="overflow-close"
          onClick={(e) => {
            e.stopPropagation(); // 🔥 VERY IMPORTANT
            setWindows(prev =>
              prev.filter(win => win.id !== w.id)
            );
          }}
        >
          ✕
        </button>

      </div>
    ))}
  </div>
)}


    {showRestriction && (
      <div className="jarvis-toast">
        <div className="jarvis-toast-title">🔒 ACCESS RESTRICTED</div>
        <div className="jarvis-toast-text">
          Please login to use system commands
        </div>
      </div>
    )}
  </div>
);


}
export default JarvisApp;
 