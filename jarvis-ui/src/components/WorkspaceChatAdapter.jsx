import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  sendMessage,
  getMessages,
  inviteMember,
  sendTyping,
  getTyping,
  leaveWorkspace,
  getWorkspaceMembers,
  updateMessage,      // ✅ ADD
  deleteMessage       // ✅ ADD
} from "../api/workspace";
import { JarvisCodeBlock } from "../components/JarvisCodeBlock";

import LeaveWorkspaceNotification from "./LeaveWorkspaceNotification";
import "../styles/workspace-chat.css";
import "../styles/workspace-members.css";
import { useNotification } from "../components/NotificationContext";
import API from "../api/api";
// import CallManager from "../call/CallManager"
import { useCallManager } from "../context/CallContext";
import { playHoverSound } from "../utils/soundManager";

export default function WorkspaceChatAdapter({ workspaceId, onBack, highlight }) {
/* ============================
   PRESENCE HELPERS
============================ */
function getLastSeenText(lastSeenAt) {
  if (!lastSeenAt) return "never";

  const safeTime = lastSeenAt.endsWith("Z")
    ? lastSeenAt
    : lastSeenAt + "Z";

  const lastSeen = new Date(safeTime);
  const now = new Date();

  const diffMs = now - lastSeen;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} mins ago`;
  if (hours < 24) return `${hours} hrs ago`;
  return `${days} days ago`;
}
function getPresence(m) {
  if (m.online) {
    return { text: "🟢 Online", className: "online" };
  }

  if (!m.last_seen_at) {
    return { text: "🔴 Offline (last seen never)", className: "offline" };
  }

  const safeTime = m.last_seen_at.endsWith("Z")
    ? m.last_seen_at
    : m.last_seen_at + "Z";

  const lastSeen = new Date(safeTime);
  const diffMin = (Date.now() - lastSeen.getTime()) / 60000;

  if (diffMin <= 10) {
    return {
      text: `🟡 Away (last seen ${Math.floor(diffMin)} mins ago)`,
      className: "away",
    };
  }

  return {
    text: `🔴 Offline (last seen ${getLastSeenText(m.last_seen_at)})`,
    className: "offline",
  };
}
function formatIST(dateString) {
  if (!dateString) return "";

  // Force treat as UTC
  const utcDate = new Date(
    dateString.includes("Z")
      ? dateString
      : dateString + "Z"
  );

  // Convert to IST manually (+5:30)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(utcDate.getTime() + istOffsetMs);

  return istDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}



// function isUserReallyOnline(user) {
//   if (!user.online || !user.lastLoginAt) return false;

//   const diffMs = Date.now() - new Date(user.lastLoginAt).getTime();
//   return diffMs / 60000 <= 5;
// }

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [highlightActive, setHighlightActive] = useState(false);
const [workspaceName, setWorkspaceName] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const bottomRef = useRef(null);
  const typingCooldown = useRef(false);
  const isNearBottom = useRef(true);
const [menu, setMenu] = useState(null);
const [editingMsg, setEditingMsg] = useState(null);
const [editText, setEditText] = useState("");
const [wallpaper, setWallpaper] = useState("wap3");
// ✅ ADD MENTION STATES HERE
const [mentionOpen, setMentionOpen] = useState(false);
const [mentionQuery, setMentionQuery] = useState("");
const [mentionList, setMentionList] = useState([]);
const inputRef = useRef(null);
const mentionRef = useRef(null);
const wsRef = useRef(null);
const callManagerRef = useCallManager();
const [callReady, setCallReady] = useState(false);
// const [incomingCall, setIncomingCall] = useState(null);

  const navigate = useNavigate();
let myEmail = null;

try {
  const token = sessionStorage.getItem("jarvis_token");
  if (token) {
    const payload = JSON.parse(atob(token.split(".")[1]));
    myEmail = payload.sub; // email
  }
} catch (e) {
  myEmail = null;
}
const { showNotification, ws } = useNotification();

const [showSeenPopup, setShowSeenPopup] = useState(false);
const [seenUsers, setSeenUsers] = useState([]);

useEffect(() => {

  const handleClickOutside = (event) => {

    if (
      mentionRef.current &&
      !mentionRef.current.contains(event.target) &&
      inputRef.current &&
      !inputRef.current.contains(event.target)
    ) {
      setMentionOpen(false);
    }

  };

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };

}, []);

// /* ============================
//    🔥 HEARTBEAT (KEEP USER ONLINE)
// ============================ */
useEffect(() => {
  const interval = setInterval(() => {
    API.get("/auth/me").catch(() => {});
  }, 3000); // every 3 seconds

  return () => clearInterval(interval);
}, []);
  /* ============================
     LOAD MEMBERS (BACKEND TRUTH)
  ============================ */
  const loadMembers = async () => {
    if (!workspaceId) return;
    try {
      const res = await getWorkspaceMembers(workspaceId);
      setMembers(res.data || []);
    } catch {
      setMembers([]);
    }
  };

  /* ============================
     LOAD MESSAGES
  ============================ */
  useEffect(() => {
    if (!workspaceId) return;

    loadMembers();

    const loadMessages = async () => {
      const res = await getMessages(workspaceId);
      setMessages(res.data || []);
    };

    loadMessages();
    const interval = setInterval(loadMessages, 800);
    return () => clearInterval(interval);
  }, [workspaceId]);
  useEffect(() => {

  if (!workspaceId) return;

  loadMembers();

  const interval = setInterval(() => {

    loadMembers();

  }, 2000); // every 2 seconds

  return () => clearInterval(interval);

}, [workspaceId]);

/* ============================
   MARK LAST MESSAGE AS SEEN
============================ */
useEffect(() => {
  if (!workspaceId) return;
  if (!isNearBottom.current) return;
  if (!messages.length) return;

  const lastHumanMessage = [...messages]
    .reverse()
    .find((m) => m.type === "human");

  if (!lastHumanMessage) return;

  // 🔥 ADD THIS LINE (important)
  if (lastHumanMessage.seen_by?.includes(myEmail)) return;

  API.post(
    `/workspace/${workspaceId}/messages/${lastHumanMessage._id}/seen`
  ).then(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m._id === lastHumanMessage._id
          ? {
              ...m,
              seen_by: [...new Set([...(m.seen_by || []), myEmail])],
            }
          : m
      )
    );
  }).catch(() => {});
}, [messages.length, workspaceId]);

  /* ============================
     TYPING POLLING
  ============================ */
  useEffect(() => {
    if (!workspaceId) return;

    const interval = setInterval(async () => {
      const res = await getTyping(workspaceId);
      setTypingUser(res.data?.user || null);
    }, 1000);

    return () => clearInterval(interval);
  }, [workspaceId]);

  /* ============================
     AUTO SCROLL
  ============================ */
  useEffect(() => {
    if (isNearBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
/* ============================
   HIGHLIGHT WORKSPACE ON OPEN
============================ */
useEffect(() => {

  if (!workspaceId) return;

  // delay to ensure component fully rendered
  const start = setTimeout(() => {

    if (highlight) {

      setHighlightActive(true);

      setTimeout(() => {

        setHighlightActive(false);

      }, 2000);

    }

  }, 150); // small delay fixes animation visibility

  return () => clearTimeout(start);

}, [workspaceId, highlight]);
useEffect(() => {

  if (!workspaceId) return;

  const loadWallpaper = () => {

    const saved =
      localStorage.getItem(`wallpaper_${workspaceId}`);

    if (saved) setWallpaper(saved);

  };

  loadWallpaper();

  window.addEventListener(
    "wallpaperChanged",
    loadWallpaper
  );

  return () =>
    window.removeEventListener(
      "wallpaperChanged",
      loadWallpaper
    );

}, [workspaceId]);

  /* ============================
     SEND MESSAGE
  ============================ */
  const handleSend = async () => {
    if (!text.trim()) return;
    await sendMessage(workspaceId, text);
    setText("");
  };

  /* ============================
     INVITE MEMBER
  ============================ */
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    try {
      setInviting(true);
      await inviteMember(workspaceId, inviteEmail);
      showNotification("Invite sent successfully", "success");
      loadMembers();
      setInviteEmail("");
    } catch (err) {
      showNotification(
        err?.response?.data?.detail || err?.message || "Invite failed",
        "error"
      );
    } finally {
      setInviting(false);
    }
  };

  /* ============================
     LEAVE WORKSPACE
  ============================ */
  const confirmLeave = async () => {
    await leaveWorkspace(workspaceId);
    setShowLeaveConfirm(false);
    onBack();
  };

  /* ============================
     TYPING EVENT
  ============================ */
  const handleTyping = (value) => {
    setText(value);
    if (!typingCooldown.current) {
      sendTyping(workspaceId);
      typingCooldown.current = true;
      setTimeout(() => (typingCooldown.current = false), 1000);
    }
  };
// ✅ ADD THIS BELOW handleTyping
const handleTypingWithMention = (value) => {

  setText(value);

  // existing typing logic
  if (!typingCooldown.current) {
    sendTyping(workspaceId);
    typingCooldown.current = true;
    setTimeout(() => (typingCooldown.current = false), 1000);
  }

  const match = value.match(/@(\w*)$/);

  if (match) {

    const query = match[1].toLowerCase();

    // Jarvis always first
    const jarvis = {
      name: "jarvis",
      email: "jarvis"
    };

    const filtered = members.filter(m =>
  m.name.toLowerCase().includes(query) &&
  m.email.toLowerCase() !== myEmail?.toLowerCase()
);


    setMentionList([jarvis, ...filtered]);
    setMentionOpen(true);

  } else {

    setMentionOpen(false);

  }
};

  /* ============================
     MEMBERS AUTO REFRESH
  ============================ */
useEffect(() => {

  if (!workspaceId) return;

  API.get(`/workspace/${workspaceId}`)
    .then(res => {

      setWallpaper(res.data.wallpaper || "wap3");

      // ✅ ADD THIS
      setWorkspaceName(res.data.name);

    })
    .catch(() => {
      setWorkspaceName("Workspace");
    });

}, [workspaceId]);

/* ============================
   LOAD WALLPAPER (FINAL FIX)
============================ */
useEffect(() => {

  if (!workspaceId) return;

  const loadWallpaper = async () => {

    try {

      const res = await API.get(`/workspace/${workspaceId}`);

      const wp = res.data.wallpaper || "wap6";

      setWallpaper(wp);

    } catch {

      setWallpaper("wap6");

    }

  };

  loadWallpaper();

}, [workspaceId]);

// RIGHT CLICK MENU
const handleRightClick = (e, msg) => {

  e.preventDefault();
  e.stopPropagation();

  console.log("Sender:", msg.sender);
  console.log("MyEmail:", myEmail);

  if (
    msg.sender?.toLowerCase().trim() !==
    myEmail?.toLowerCase().trim()
  ) return;

  setMenu({
    x: e.clientX,
    y: e.clientY,
    msg
  });

};




// DELETE
const handleDelete = async () => {

  await deleteMessage(workspaceId, menu.msg._id);

  setMessages(prev =>
    prev.filter(m => m._id !== menu.msg._id)
  );

  setMenu(null);
};


// EDIT START
const handleEditStart = () => {

  setEditingMsg(menu.msg._id);

  setEditText(menu.msg.content);

  setMenu(null);
};


// EDIT SAVE
const handleEditSave = async () => {

  await updateMessage(
    workspaceId,
    editingMsg,
    editText
  );

  setMessages(prev =>
    prev.map(m =>
      m._id === editingMsg
        ? { ...m, content: editText, edited: true }
        : m
    )
  );

  setEditingMsg(null);
};

const renderSeenIndicator = (msg, index) => {
  const lastHumanIndex = [...messages]
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.type === "human")
    .pop()?.i;

  if (index !== lastHumanIndex) return null;
  if (!msg.seen_by) return null;

  // 🔥 FIX: ensure members loaded
  if (!members || members.length <= 1) return "✓✓";

  const totalReceivers = members.filter(
    (m) => m.email !== msg.sender
  ).length;

  const seenReceivers = msg.seen_by.filter(
    (email) => email !== msg.sender
  ).length;

  if (seenReceivers === 0) return "✓✓ Delivered";

  if (seenReceivers < totalReceivers)
    return `✓✓ Seen by ${seenReceivers}`;

  if (seenReceivers === totalReceivers)
    return "✓✓ Seen by all";

  return "✓✓ Delivered";
};


const handleSeenClick = (msg) => {
  if (!Array.isArray(msg.seen_by)) {
    setSeenUsers([]);
    setShowSeenPopup(true);
    return;
  }

  const viewer = myEmail?.toLowerCase();

  const users = members.filter((m) => {
    const email = m.email?.toLowerCase();
    if (!email) return false;

    // must have seen the message
    if (!msg.seen_by.map(e => e.toLowerCase()).includes(email)) {
      return false;
    }

    // ✅ exclude the CURRENT VIEWER
    if (email === viewer) return false;

    return true;
  });

  setSeenUsers(users);
  setShowSeenPopup(true);
};
// ✅ FORMAT MENTIONS WITH COLOR
const formatMentions = (text) => {

  if (!text) return text;

  const parts = text.split(/(@\w+)/g);

  return parts.map((part, index) => {

    if (part.startsWith("@")) {

      const name = part.substring(1).toLowerCase();

      // Jarvis = red
      if (name === "jarvis") {
        return (
          <span key={index} className="mention-jarvis">
            {part}
          </span>
        );
      }

      // Users = blue
      return (
        <span key={index} className="mention-user">
          {part}
        </span>
      );

    }

    return part;

  });

};
/* ============================
   CALL SIGNAL LISTENER (CRITICAL FIX)
============================ */
useEffect(() => {

  if (!ws) return;

  const handleCallSignal = (event) => {

    try {

      const data = JSON.parse(event.data);

      console.log("📞 Call signal received:", data);

      // ✅ CALL REJECTED FIX
      if (data.type === "call_rejected") {

        console.log("❌ Call rejected by other user");

        if (callManagerRef.current) {
          callManagerRef.current.cleanupCall();
        }

        showNotification("Call rejected", "error");

      }

      // ✅ CALL END FIX
      if (data.type === "call_end") {

        console.log("📴 Call ended by other user");

        if (callManagerRef.current) {
          callManagerRef.current.cleanupCall();
        }

        showNotification("Call ended", "info");

      }

    } catch (err) {
      console.error("Call signal error:", err);
    }

  };

  ws.addEventListener("message", handleCallSignal);

  return () => {
    ws.removeEventListener("message", handleCallSignal);
  };

}, [ws, callManagerRef]);

  return (
    <div className="workspace-chat">
      <LeaveWorkspaceNotification
        visible={showLeaveConfirm}
        onConfirm={confirmLeave}
        onCancel={() => setShowLeaveConfirm(false)}
      />

    {/* HEADER */}
<div className="workspace-chat-header">

  {/* LEFT */}
  <div className="workspace-header-left">

    <button className="back-btn"  onMouseEnter={playHoverSound} 
    onClick={() => navigate("/")}>
      🏠 Home
    </button>

    <button className="back-btn"  onMouseEnter={playHoverSound} 
    onClick={onBack}>
      👥 My Workspaces
    </button>
<button
  className="back-btn leave-btn"
   onMouseEnter={playHoverSound}
  onClick={() => setShowLeaveConfirm(true)}
>
  🚪 Leave
</button>

  </div>


  {/* CENTER */}
  <div className="workspace-header-center">

    <div className="workspace-title-main">
      💬 {workspaceName || "Workspace"}
    </div>

    <div className="workspace-title-sub">
      {members.length} members
    </div>

  </div>


{/* RIGHT */}
<div className="workspace-header-right">
<button
  className="call-btn"
   onMouseEnter={playHoverSound}
  onClick={() => {

    console.log("Call clicked");

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert("WS not connected");
      return;
    }

    if (!callManagerRef.current) {
      alert("CallManager not ready");
      return;
    }

    const target = members.find(m => m.email !== myEmail);

    if (!target) {
      alert("No target");
      return;
    }

    callManagerRef.current.startVoiceCall(target._id);

    navigate(`/call/${target._id}`, {
      state: {
        email: target.email,
        name: target.name
      }
    });

  }}
>
📞
</button>


<button
  className="video-btn"
   onMouseEnter={playHoverSound}
  onClick={() => {

    console.log("Video Call clicked");

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert("WS not connected");
      return;
    }

    if (!callManagerRef.current) {
      alert("CallManager not ready");
      return;
    }

    const target = members.find(m => m.email !== myEmail);

    if (!target) {
      alert("No target");
      return;
    }

    callManagerRef.current.startVideoCall(target._id);

    navigate(`/call/${target._id}`, {
      state: {
        email: target.email,
        name: target.name,
        previousPage: window.location.pathname,
        callType: "video"
      }
    });

  }}
>
📹
</button>

  <input
    className="invite-input"
    value={inviteEmail}
    onChange={(e) => setInviteEmail(e.target.value)}
    placeholder="Enter email"
  />

  <button
    className="invite-btn"
     onMouseEnter={playHoverSound}
    onClick={handleInvite}
    disabled={inviting}
  >
    Invite
  </button>

  <button
    className="wallpaper-open-btn"
     onMouseEnter={playHoverSound}
    onClick={() =>
navigate(`/workspaces/${workspaceId}/wallpaper`)
    }
  >
    🖼️
  </button>

</div>

</div>


      {/* MAIN */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* MEMBERS PANEL */}
<div className="workspace-members">
  <h4>Members</h4>

  {members.map((m) => {
    // 🔥 DEBUG — THIS IS IMPORTANT
    console.log("UI MEMBER DATA:", m.email, m.last_seen_at);

    return (
     <div
  key={m._id}
  className={`workspace-member ${m.online ? "" : "offline"} ${
    m.email === myEmail ? "active" : ""
  }`}

  onMouseEnter={playHoverSound}   // ✅ ADD THIS LINE

  onClick={() =>
    navigate(`/profile/${encodeURIComponent(m.email || m._id)}`)
  }
>
  <div className="member-avatar">
    {m.name?.charAt(0)?.toUpperCase() || "?"}
  </div>

  <div className="member-info">
    <span className="member-name">
      {m.name.charAt(0).toUpperCase() + m.name.slice(1)}
    </span>

    <span className="member-status">
      {m.email === myEmail ? (
        "🟢 Online (You)"
      ) : m.online ? (
        "🟢 Online"
      ) : (
        `🔴 Offline (last seen ${getLastSeenText(m.last_seen_at)})`
      )}
    </span>
  </div>
</div>
    );
  })}
</div>

{/* CHAT */}
{/* CHAT */}
<div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

  <div
    className={`workspace-chat-box ${
      highlightActive ? "workspace-highlight" : ""
    }`}

style={{
  backgroundImage: `
    linear-gradient(rgba(2,6,23,0.55), rgba(2,6,23,0.75)),
    url("${
      wallpaper?.startsWith("custom_")
        ? `http://localhost:8000/wallpapers/${wallpaper}`
        : `/wallpapers/${wallpaper}`
    }")
  `,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat"
}}

    onScroll={(e) => {

      const el = e.target;

      isNearBottom.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 120;

      if (!isNearBottom.current) return;
      if (!messages.length) return;

      const lastHumanMessage = [...messages]
        .reverse()
        .find((m) => m.type === "human");

      if (!lastHumanMessage) return;
      if (lastHumanMessage.seen_by?.includes(myEmail)) return;

      API.post(
        `/workspace/${workspaceId}/messages/${lastHumanMessage._id}/seen`
      )
        .then(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === lastHumanMessage._id
                ? {
                    ...m,
                    seen_by: [
                      ...new Set([...(m.seen_by || []), myEmail]),
                    ],
                  }
                : m
            )
          );
        })
        .catch(() => {});
    }}
  >

  {messages.map((m, index) => (

 <div
  key={m._id}
  className={`workspace-message ${
    m.sender === "jarvis" ? "right" : "left"
  } ${editingMsg === m._id ? "editing" : ""}`}

  onContextMenu={(e) => {
    e.preventDefault();
    e.stopPropagation();
    handleRightClick(e, m);
  }}
>


    <b>{m.sender}:</b>

    {editingMsg === m._id ? (

      <>
     <div className="edit-message-container">

  <input
    className="edit-message-input"
    value={editText}
    autoFocus
    onChange={(e) => setEditText(e.target.value)}
    onKeyDown={(e)=>{
      if(e.key==="Enter") handleEditSave();
      if(e.key==="Escape") setEditingMsg(null);
    }}
  />

  <button
    className="edit-message-save"
     onMouseEnter={playHoverSound}
    onClick={handleEditSave}
  >
    Save
  </button>

</div>


      </>

   ) : (

  <div style={{
    display: "flex",
    flexDirection: "column",
    width: "100%"
  }}>

    {/* MESSAGE TEXT */}
 <div>

  {m.content.includes("```") ? (

    <JarvisCodeBlock>
      {m.content.replace(/```[\w]*\n?|```/g, "")}
    </JarvisCodeBlock>

  ) : (

    formatMentions(m.content)

  )}

  {m.edited && (
    <span style={{
      fontSize: 11,
      color: "#94a3b8",
      marginLeft: 6
    }}>
      (edited)
    </span>
  )}

</div>

    {/* IST TIME */}
   {/* IST TIME */}
<div style={{
  fontSize: 11,
  color: "#64748b",
  marginTop: 4,
  textAlign: "right"
}}>
  {new Date(
    m.created_at?.endsWith("Z")
      ? m.created_at
      : m.created_at + "Z"
  ).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  })}
</div>



  </div>

)}


    {renderSeenIndicator(m, index) && (
      <div
        className="seen-indicator clickable"
         onMouseEnter={playHoverSound}
        onClick={() => handleSeenClick(m)}
      >
        {renderSeenIndicator(m, index)}
      </div>
    )}

  </div>

))}
  {typingUser && typingUser !== myEmail && (
<div className="typing">
  <span className="typing-text">{typingUser} is typing</span>

  <span className="typing-dots">
    <span></span>
    <span></span>
    <span></span>
  </span>
</div>
  )}
    <div ref={bottomRef} />
  </div>


 <div className="workspace-input">

  {/* ✅ MENTION DROPDOWN */}
  {mentionOpen && (
<div ref={mentionRef} className="mention-box">
      {mentionList.map((m, i) => (
        <div
          key={i}
          className="mention-item"
          onClick={() => {
            const newText = text.replace(/@\w*$/, `@${m.name} `);
            setText(newText);
            setMentionOpen(false);
            inputRef.current.focus();
          }}
        >
          @{m.name}
        </div>
      ))}
    </div>
  )}

  {/* ✅ INPUT */}
  <input
    ref={inputRef}
    value={text}
    onChange={(e) => handleTypingWithMention(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && handleSend()}
  />

  <button  onMouseEnter={playHoverSound} 
  onClick={handleSend}>Send</button>

</div>
</div>
</div>  {/* ✅ CLOSE MAIN FLEX WRAPPER */}

      {/* SEEN POPUP */}
      {showSeenPopup && (
        <div className="seen-popup-overlay" onClick={() => setShowSeenPopup(false)}>
          <div className="seen-popup" onClick={(e) => e.stopPropagation()}>
            <h4>Seen by</h4>
            {seenUsers.map((u) => (
              <div key={u.email} className="seen-user">
                <div className="seen-avatar">{u.name[0]}</div>
                {u.name}
              </div>
            ))}
            <button onClick={() => setShowSeenPopup(false)}>Close</button>
          </div>
        </div>
      )}
      {menu && (

  <div
    onClick={(e) => e.stopPropagation()}
    style={{
      position: "fixed",
      top: menu.y,
      left: menu.x,
      background: "#020617",
      border: "1px solid #334155",
      padding: 8,
      borderRadius: 8,
      zIndex: 99999,
      boxShadow: "0 0 20px rgba(0,0,0,0.6)"
    }}
  >


    <div
      style={{cursor:"pointer"}}
       onMouseEnter={playHoverSound}
      onClick={handleEditStart}
    >
      ✏️ Edit
    </div>

    <div
      style={{cursor:"pointer",color:"red"}}
       onMouseEnter={playHoverSound}
      onClick={handleDelete}
    >
      🗑 Delete
    </div>

  </div>

)}


    </div>
  );
}