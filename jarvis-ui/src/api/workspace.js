import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

// attach token
API.interceptors.request.use((req) => {
  const token = sessionStorage.getItem("jarvis_token");

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  return req;
});


/* ============================
   WORKSPACE
============================ */

// CREATE
export const createWorkspace = (data) =>
  API.post("/workspace/create", data);


// GET MY WORKSPACES
export const getMyWorkspaces = () =>
  API.get("/workspace/my");


// LEAVE WORKSPACE
export const leaveWorkspace = (workspaceId) =>
  API.post(`/workspace/${workspaceId}/leave`);


// RENAME WORKSPACE
export const renameWorkspace = (workspaceId, name) =>
  API.put(`/workspace/${workspaceId}/rename`, {
    name: name
  });


// DELETE WORKSPACE
export const deleteWorkspace = (workspaceId) =>
  API.delete(`/workspace/${workspaceId}`);


// CHANGE VISIBILITY (PUBLIC / PRIVATE)
export const changeWorkspaceVisibility = (workspaceId, range) =>
  API.put(`/workspace/${workspaceId}/visibility`, {
    range: range
  });



/* ============================
   CHAT
============================ */

// SEND MESSAGE
export const sendMessage = (workspaceId, content) =>
  API.post(`/workspace/${workspaceId}/message`, null, {
    params: { content },
  });

// GET MESSAGES
export const getMessages = (workspaceId) =>
  API.get(`/workspace/${workspaceId}/messages`);


// ✏️ UPDATE MESSAGE
export const updateMessage = (workspaceId, messageId, content) =>
  API.put(`/workspace/${workspaceId}/message/${messageId}`, {
    content: content,
  });


// 🗑 DELETE MESSAGE
export const deleteMessage = (workspaceId, messageId) =>
  API.delete(`/workspace/${workspaceId}/message/${messageId}`);



/* ============================
   INVITES
============================ */

// INVITE MEMBER
export const inviteMember = (workspaceId, email) =>
  API.post(`/workspace/${workspaceId}/invite`, null, {
    params: { user_email: email },
  });


// GET INVITES
export const getInvites = () =>
  API.get("/workspace/invites");


// ACCEPT INVITE
export const acceptInvite = (inviteId) =>
  API.post(`/workspace/invites/${inviteId}/accept`);


// REJECT INVITE
export const rejectInvite = (inviteId) =>
  API.post(`/workspace/invites/${inviteId}/reject`);




/* ============================
   MEMBERS
============================ */

export const getWorkspaceMembers = (workspaceId) =>
  API.get(`/workspace/${workspaceId}/members`);




/* ============================
   TYPING INDICATOR
============================ */

export const sendTyping = (workspaceId) =>
  API.post(`/workspace/${workspaceId}/typing`);


export const getTyping = (workspaceId) =>
  API.get(`/workspace/${workspaceId}/typing`);
