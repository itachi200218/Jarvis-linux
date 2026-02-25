import { useEffect, useState, useRef } from "react";

import { useNavigate, useLocation } from "react-router-dom";


import {
  createWorkspace,
  getMyWorkspaces,
  renameWorkspace,
  deleteWorkspace,
  changeWorkspaceVisibility,
  leaveWorkspace
} from "../api/workspace";

import "../styles/WorkspacesPage.css";

import WorkspaceChatAdapter from "./WorkspaceChatAdapter";
import InviteNotifications from "./InviteNotifications";
import { playHoverSound } from "../utils/soundManager";


export default function WorkspacesPage() {

  const [workspaceId, setWorkspaceId] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [highlight, setHighlight] = useState(false);

  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);

  const [menu, setMenu] = useState(null);

  const [modal, setModal] = useState(null);

  const [modalInput, setModalInput] = useState("");

 const [formData, setFormData] = useState({
  name: "",
  invites: [],
  range: "private",
});

  const navigate = useNavigate();

  const menuRef = useRef(null);

const location = useLocation();
const [highlightWorkspaceId, setHighlightWorkspaceId] = useState(null);

useEffect(() => {

  if (location.state?.highlightWorkspaceId) {

    const id = location.state.highlightWorkspaceId;

    setHighlightWorkspaceId(id);

    setTimeout(() => {
      setHighlightWorkspaceId(null);
    }, 2000);

  }

}, [location.state]);
useEffect(() => {

  if (location.state?.workspaceId) {

    setWorkspaceId(location.state.workspaceId);

  }

}, [location.state]);

  /* ============================
     CLICK OUTSIDE MENU
  ============================ */
  useEffect(() => {

    const handleClickOutside = (event) => {

      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenu(null);
      }

    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };

  }, []);
/*time*/
function formatIST(utcDate) {
  if (!utcDate) return "";

  const date = new Date(utcDate);

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}


  /* ============================
     LOAD WORKSPACES
  ============================ */
  const loadWorkspaces = async () => {

    try {
      const res = await getMyWorkspaces();
      setWorkspaces(res.data || []);
    }
    catch {
      setWorkspaces([]);
    }

  };



  /* ============================
     AUTO REFRESH
  ============================ */
  useEffect(() => {

    loadWorkspaces();

    const interval = setInterval(loadWorkspaces, 3000);

    return () => clearInterval(interval);

  }, []);



  /* ============================
     CREATE WORKSPACE
  ============================ */
  const handleCreate = async () => {

    if (!formData.name.trim()) {
      alert("Workspace name required");
      return;
    }

    try {

      setLoading(true);

      const res = await createWorkspace({
        name: formData.name,
        invites: formData.invites,

        range: formData.range
      });

      setWorkspaceId(res.data.workspace_id);

      setShowForm(false);

      setFormData({
        name: "",
        invites: "",
        range: "private"
      });

      loadWorkspaces();

    }
    catch {
      alert("Failed to create workspace");
    }
    finally {
      setLoading(false);
    }

  };



  /* ============================
     RIGHT CLICK HANDLERS
  ============================ */

  const handleRename = (ws) => {

    setModal({
      type: "rename",
      ws
    });

    setModalInput(ws.name);

    setMenu(null);

  };


  const handleDelete = (ws) => {

    setModal({
      type: "delete",
      ws
    });

    setMenu(null);

  };


  const handleMakePublic = (ws) => {

    setModal({
      type: "public",
      ws
    });

    setMenu(null);

  };


  const handleMakePrivate = (ws) => {

    setModal({
      type: "private",
      ws
    });

    setMenu(null);

  };


  const handleLeave = (ws) => {

    setModal({
      type: "leave",
      ws
    });

    setMenu(null);

  };



  /* ============================
     MODAL ACTION CONFIRM
  ============================ */

  const handleModalConfirm = async () => {

    const ws = modal.ws;

    if (modal.type === "rename") {
      await renameWorkspace(ws._id, modalInput);
    }

    if (modal.type === "delete") {
      await deleteWorkspace(ws._id);
    }

    if (modal.type === "public") {
      await changeWorkspaceVisibility(ws._id, "public");
    }

    if (modal.type === "private") {
      await changeWorkspaceVisibility(ws._id, "private");
    }

    if (modal.type === "leave") {
      await leaveWorkspace(ws._id);
    }

    setModal(null);

    loadWorkspaces();

  };


return (

  <div className="workspace-page">


    {/* INVITES */}
    <InviteNotifications
      onJoin={(id) => {

        setWorkspaceId(id);

        setHighlight(true);

        setTimeout(() => {
          setHighlight(false);
        }, 2000);

        loadWorkspaces();

      }}
    />


    {/* WORKSPACE PANEL */}
    {!workspaceId && (

      <div className="workspace-panel">


     {/* HEADER */}
<div className="workspace-panel-header">

  {/* LEFT */}
  <div className="header-left">
    <button
      className="home-btn"
       onMouseEnter={playHoverSound}
      onClick={() => navigate("/")}
    >
      🏠 Home
    </button>
  </div>

  {/* CENTER */}
  <div className="header-center">
    <h2 className="workspace-title">
      My Workspaces
    </h2>
  </div>

  {/* RIGHT */}
  <div className="header-right">
    <button
      className="create-btn"
       onMouseEnter={playHoverSound}
      onClick={() => setShowForm(true)}
    >
      + Create Workspace
    </button>
  </div>

</div>

        {/* WORKSPACE LIST */}
        <div className="workspace-list">

          {workspaces.map(ws => (

            <div
              key={ws._id}
              className={`workspace-card ${
                highlightWorkspaceId === ws._id
                  ? "workspace-card-highlight"
                  : ""
              }`}
 onMouseEnter={playHoverSound}
              onClick={() => setWorkspaceId(ws._id)}

              onContextMenu={(e) => {

                e.preventDefault();

                setMenu({
                  x: e.pageX,
                  y: e.pageY,
                  ws
                });

              }}

              style={{
                padding: 12,
                marginBottom: 8,
                background: "#0f1629",
                borderRadius: 8,
                cursor: "pointer"
              }}
            >

              <b>{ws.name}</b>

              <span style={{ marginLeft: 10 }}>
                ({ws.members_count})
              </span>

              <span style={{ marginLeft: 10, color: "#4cafef" }}>
                [{ws.range}]
              </span>


              {/* CREATED TIME */}
              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  marginTop: "4px"
                }}
              >
                Created: {ws.created_at
                  ? new Date(
                      ws.created_at.endsWith("Z")
                        ? ws.created_at
                        : ws.created_at + "Z"
                    ).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : ""}
              </div>

            </div>

          ))}

        </div>

      </div>

    )}



    {/* RIGHT CLICK MENU */}
    {menu && (

      <div
        ref={menuRef}
        className="context-menu"
        style={{
          top: menu.y,
          left: menu.x
        }}
      >

        <div
          className="context-item"
           onMouseEnter={playHoverSound}
          onClick={() => handleRename(menu.ws)}
        >
          ✏️ Rename
        </div>

        <div
          className="context-item"
           onMouseEnter={playHoverSound}
          onClick={() => handleMakePublic(menu.ws)}
        >
          🌐 Make Public
        </div>

        <div
          className="context-item"
           onMouseEnter={playHoverSound}
          onClick={() => handleMakePrivate(menu.ws)}
        >
          🔒 Make Private
        </div>

        <div className="context-divider" />

        <div
          className="context-item"
           onMouseEnter={playHoverSound}
          onClick={() => handleLeave(menu.ws)}
        >
          🚪 Leave Workspace
        </div>

        <div
          className="context-item danger"
           onMouseEnter={playHoverSound}
          onClick={() => handleDelete(menu.ws)}
        >
          🗑 Delete Workspace
        </div>

      </div>

    )}



    {/* CUSTOM MODAL */}
    {modal && (

      <div className="modal-overlay">

        <div className="modal-box">

          <h3>

            {modal.type === "rename" && "Rename Workspace"}
            {modal.type === "delete" && "Delete Workspace?"}
            {modal.type === "public" && "Make Workspace Public?"}
            {modal.type === "private" && "Make Workspace Private?"}
            {modal.type === "leave" && "Leave Workspace?"}

          </h3>


          {modal.type === "rename" && (

            <input
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
            />

          )}


          <button  onMouseEnter={playHoverSound} 
          onClick={handleModalConfirm}>
            Confirm
          </button>

          <button  onMouseEnter={playHoverSound} 
          onClick={() => setModal(null)}>
            Cancel
          </button>

        </div>

      </div>

    )}



    {/* CREATE MODAL */}
    {showForm && (

      <div className="modal-overlay">

        <div className="modal-box">

          <input
            placeholder="Workspace Name"
            value={formData.name}
            onChange={(e) =>
              setFormData({
                ...formData,
                name: e.target.value
              })
            }
          />


          <div className="invite-container">

            {formData.invites.map((email, index) => (

              <div key={index} className="invite-chip">

                {email}

                <span
                  className="invite-remove"
                   onMouseEnter={playHoverSound}
                  onClick={() => {

                    const updated = [...formData.invites];

                    updated.splice(index, 1);

                    setFormData({
                      ...formData,
                      invites: updated
                    });

                  }}
                >
                  ✕
                </span>

              </div>

            ))}


            <input
              type="text"
              placeholder="Type email and press Enter"
              className="invite-input"

              onKeyDown={(e) => {

                if (e.key === "Enter" || e.key === ",") {

                  e.preventDefault();

                  const value = e.target.value.trim();

                  if (!value) return;

                  if (!formData.invites.includes(value)) {

                    setFormData({
                      ...formData,
                      invites: [...formData.invites, value]
                    });

                  }

                  e.target.value = "";

                }

              }}
            />

          </div>


          <select
            value={formData.range}
            onChange={(e) =>
              setFormData({
                ...formData,
                range: e.target.value
              })
            }
          >

            <option value="private">Private</option>
            <option value="public">Public</option>

          </select>


          <button  onMouseEnter={playHoverSound} 
          onClick={handleCreate}>
            Create
          </button>

          <button  onMouseEnter={playHoverSound} 
          onClick={() => setShowForm(false)}>
            Cancel
          </button>

        </div>

      </div>

    )}



    {/* CHAT */}
    {workspaceId && (

      <WorkspaceChatAdapter
        workspaceId={workspaceId}
        highlight={highlight}
        onBack={() => setWorkspaceId(null)}
      />

    )}


  </div>

);
}