from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from fastapi import UploadFile, File
import os
from pydantic import BaseModel
from typing import List, Optional   # ✅ ADD THIS

from auth.security import get_current_user
from jarvis_core import db, handle_command
from core.presence import mark_user_online
from auth.database import users_collection
from notifications.service import create_notification

router = APIRouter(prefix="/workspace", tags=["Workspace"])

# ==============================
# IN-MEMORY TYPING STATE (MVP)
# ==============================
typing_users = {}
# ==============================
# MongoDB Collections
# ==============================
workspaces_col = db["workspaces"]
messages_col = db["workspace_messages"]
invites_col = db["workspace_invites"]


    

def track_presence(current_user: dict = Depends(get_current_user)):
    mark_user_online(current_user)
    return current_user

# ==============================
# REQUEST MODEL
# ==============================
class CreateWorkspaceRequest(BaseModel):
    name: str
    invites: Optional[List[str]] = []
    range: Optional[str] = "private"

# ==============================
# CREATE WORKSPACE (FIXED)
# ==============================
@router.post("/create")
async def create_workspace(
    data: CreateWorkspaceRequest,
    current_user: dict = Depends(get_current_user)
):
    # Create workspace document
    workspace = {
        "name": data.name,
        "range": data.range,

        # ✅ ADD THIS LINE
        "wallpaper": "wap6",

        "members": [{
            "user_id": current_user["email"],
            "name": current_user["name"],
            "role": "admin"
        }],
        "created_at": datetime.utcnow()
    }


    result = workspaces_col.insert_one(workspace)

    workspace_id = str(result.inserted_id)

    # ==============================
    # SEND INVITES
    # ==============================
    for email in data.invites:

        # skip self invite
        if email == current_user["email"]:
            continue

        # skip if already member
        existing_member = workspaces_col.find_one({
            "_id": ObjectId(workspace_id),
            "members.user_id": email
        })

        if existing_member:
            continue

        invites_col.insert_one({
            "workspace_id": workspace_id,
            "workspace_name": data.name,
            "email": email,
            "invited_by": current_user["email"],
            "status": "pending",
            "created_at": datetime.utcnow()
        })

        # 🔔 create notification
        invitee = users_collection.find_one({"email": email})

        if invitee:
            await create_notification(
                user_id=str(invitee["_id"]),
                source="GROUP",
                event_type="INVITE",
                title="Workspace Invitation",
                message=f"You were invited to {data.name}",
                metadata={
                    "workspace_id": workspace_id
                }
            )

    return {
        "workspace_id": workspace_id,
        "message": "Workspace created"
    }
# =====================================================
# 🔥 NEW — GET MY WORKSPACES (MULTI WORKSPACE SUPPORT)
# =====================================================
# =====================================================
# GET MY WORKSPACES (UPDATED)
# =====================================================
@router.get("/my")
def get_my_workspaces(current_user: dict = Depends(track_presence)):

    workspaces = workspaces_col.find({
        "members.user_id": current_user["email"]
    })

    result = []

    for ws in workspaces:

        # ✅ FIX old broken data where name was stored as object
        workspace_name = ws.get("name")

        if isinstance(workspace_name, dict):
            workspace_name = workspace_name.get("name", "Untitled Workspace")

        # ✅ get current user role
        my_role = "member"
        for m in ws.get("members", []):
            if m.get("user_id") == current_user["email"]:
                my_role = m.get("role", "member")
                break

        result.append({
            "_id": str(ws["_id"]),

            # safe name
            "name": workspace_name,

            # new field
            "range": ws.get("range", "private"),

            # useful info
            "members_count": len(ws.get("members", [])),

            # optional but enterprise useful
            "my_role": my_role,

            # optional metadata
            "created_at": ws.get("created_at")
        })

    return result

# ==============================
# GET MY INVITES
# ==============================
@router.get("/invites")
def get_my_invites(current_user: dict = Depends(get_current_user)):
    invites = invites_col.find({
        "email": current_user["email"],
        "status": "pending"
    })

    return [{**inv, "_id": str(inv["_id"])} for inv in invites]

# ==============================
# ACCEPT INVITE
# ==============================
@router.post("/invites/{invite_id}/accept")
def accept_invite(invite_id: str, current_user: dict = Depends(get_current_user)):
    invite = invites_col.find_one({"_id": ObjectId(invite_id)})
    if not invite:
        raise HTTPException(404, "Invite not found")

    if invite["email"] != current_user["email"]:
        raise HTTPException(403, "Not allowed")

    workspaces_col.update_one(
        {"_id": ObjectId(invite["workspace_id"])},
        {"$addToSet": {"members": {
            "user_id": current_user["email"],
            "name": current_user["name"],
            "role": "member"
        }}}
    )


    invites_col.update_one(
        {"_id": ObjectId(invite_id)},
        {"$set": {"status": "accepted"}}
    )
# 🔔 NOTIFY INVITER
    inviter = users_collection.find_one({"email": invite["invited_by"]})

    if inviter:
        create_notification(
            user_id=str(inviter["_id"]),
            source="GROUP",
            event_type="JOINED",
            title="New Member Joined",
            message=f"{current_user['email']} joined {invite['workspace_name']}",
            metadata={
                "workspace_id": invite["workspace_id"]
            }
        )

    return {
        "message": "Joined workspace",
        "workspace_id": invite["workspace_id"]
    }

# ==============================
# REJECT INVITE
# ==============================
@router.post("/invites/{invite_id}/reject")
def reject_invite(invite_id: str, current_user: dict = Depends(get_current_user)):
    invite = invites_col.find_one({"_id": ObjectId(invite_id)})
    if not invite:
        raise HTTPException(404, "Invite not found")

    if invite["email"] != current_user["email"]:
        raise HTTPException(403, "Not allowed")

    invites_col.update_one(
        {"_id": ObjectId(invite_id)},
        {"$set": {"status": "rejected"}}
    )

    return {"message": "Invite rejected"}

# ==============================
# GET WORKSPACE
# ==============================
@router.get("/{workspace_id}")
def get_workspace(
    workspace_id: str,
    current_user: dict = Depends(get_current_user)
):
    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})

    if not ws:
        raise HTTPException(404, "Workspace not found")

    if current_user["email"] not in [m["user_id"] for m in ws["members"]]:
        raise HTTPException(403, "Access denied")

    # convert ObjectId to string
    ws["_id"] = str(ws["_id"])

    # ✅ CRITICAL FIX — ensure wallpaper exists
    if "wallpaper" not in ws:
        ws["wallpaper"] = "wap6"

    return ws

# ==============================
# SEND INVITE
# ==============================
@router.post("/{workspace_id}/invite")
async def invite_member(   # ✅ async
    workspace_id: str,
    user_email: str,
    current_user: dict = Depends(get_current_user)
):
    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})
    if not ws:
        raise HTTPException(404, "Workspace not found")

    # ✅ Ensure inviter is a workspace member
    if current_user["email"] not in [m["user_id"] for m in ws["members"]]:
        raise HTTPException(403, "Only workspace members can invite")

    # ✅ CHECK: user already in workspace
    if user_email in [m["user_id"] for m in ws["members"]]:
        raise HTTPException(
            status_code=400,
            detail="User already belongs to this workspace"
        )

    # ✅ CHECK: pending invite already exists
    existing_invite = invites_col.find_one({
        "workspace_id": workspace_id,
        "email": user_email,
        "status": "pending"
    })
    if existing_invite:
        raise HTTPException(
            status_code=400,
            detail="Invite already sent to this user"
        )

    invites_col.insert_one({
        "workspace_id": workspace_id,
        "workspace_name": ws["name"],
        "email": user_email,
        "invited_by": current_user["email"],
        "status": "pending",
        "created_at": datetime.utcnow()
    })

    # 🔔 NOTIFY INVITED USER
    invitee = users_collection.find_one({"email": user_email})

    if invitee:
        await create_notification(   # ✅ await
            user_id=str(invitee["_id"]),
            source="GROUP",
            event_type="INVITE",
            title="Workspace Invitation",
            message=f"You were invited to {ws['name']}",
            metadata={
                "workspace_id": workspace_id
            }
        )

    return {"message": "Invite sent"}

# ==============================
# SEND MESSAGE
# ==============================
@router.post("/{workspace_id}/message")
async def send_message(   # ✅ async
    workspace_id: str,
    content: str,
    current_user: dict = Depends(track_presence)
):
    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})
    if not ws:
        raise HTTPException(404, "Workspace not found")

    if current_user["email"] not in [m["user_id"] for m in ws["members"]]:
        raise HTTPException(403, "Access denied")

    # 👤 Human message
    messages_col.insert_one({
        "workspace_id": workspace_id,
        "sender": current_user["email"],
        "type": "human",
        "content": content,
        "created_at": datetime.utcnow(),
        "seen_by": [current_user["email"]]
    })

    # 🔔 NOTIFY OTHER WORKSPACE MEMBERS
    for member in ws["members"]:
        if member["user_id"] != current_user["email"]:
            user = users_collection.find_one({"email": member["user_id"]})
            if user:
                await create_notification(
                    user_id=str(user["_id"]),
                    source="GROUP",
                    event_type="MESSAGE",
                    title=f"{current_user['name']} sent a message",
                    message="New message",
                    metadata={
                        "workspace_id": workspace_id,
                        "workspace_name": ws["name"],   # ✅ ADD THIS
                        "sender": current_user["email"]
                    }
                )

    # 🤖 Jarvis response (ONLY if invoked)
    if "@jarvis" in content.lower():
        from jarvis_core import handle_command

        response = handle_command(
            command=content.replace("@jarvis", "").strip(),
            user_role=current_user.get("role", "guest"),
            user_name=current_user.get("name"),
            chat_id=workspace_id
        )

        messages_col.insert_one({
            "workspace_id": workspace_id,
            "sender": "jarvis",
            "type": "jarvis",
            "content": response["reply"],
            "created_at": datetime.utcnow()
        })

    return {"status": "ok"}

# ==============================
# GET MESSAGES
# ==============================
@router.get("/{workspace_id}/messages")
def get_messages(
    workspace_id: str,
current_user: dict = Depends(get_current_user)
):
    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})
    if not ws:
        raise HTTPException(404, "Workspace not found")

    if current_user["email"] not in [m["user_id"] for m in ws["members"]]:
        raise HTTPException(403, "Access denied")

    msgs = messages_col.find({"workspace_id": workspace_id}).sort("created_at", 1)
    return [{**m, "_id": str(m["_id"])} for m in msgs]
# ==============================
# 👀 MARK LAST MESSAGE SEEN (GROUP CHAT)
# ==============================
@router.post("/{workspace_id}/messages/{message_id}/seen")
def mark_message_seen(
    workspace_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})
    if not ws:
        raise HTTPException(404, "Workspace not found")

    if current_user["email"] not in [m["user_id"] for m in ws["members"]]:
        raise HTTPException(403, "Access denied")

    messages_col.update_one(
        {
            "_id": ObjectId(message_id),
            "workspace_id": workspace_id
        },
        {
            "$addToSet": {"seen_by": current_user["email"]}
        }
    )

    return {"status": "ok"}

# ==============================
# TYPING INDICATOR
# ==============================
@router.post("/{workspace_id}/typing")
def set_typing(
    workspace_id: str,
    current_user: dict = Depends(track_presence)
):
    # 🔐 Verify workspace exists
    ws = workspaces_col.find_one({
        "_id": ObjectId(workspace_id)
    })

    if not ws:
        raise HTTPException(404, "Workspace not found")

    # 🔐 Verify current user is a workspace member
    if current_user["email"] not in [
        m["user_id"] for m in ws.get("members", [])
    ]:
        raise HTTPException(403, "Access denied")

    # 🧠 Keep typing state separately for each user
    if workspace_id not in typing_users:
        typing_users[workspace_id] = {}

    typing_users[workspace_id][current_user["email"]] = datetime.utcnow()

    return {"status": "typing"}

@router.get("/{workspace_id}/typing")
def get_typing(
    workspace_id: str,
    current_user: dict = Depends(track_presence)
):
    # 🔐 Verify workspace exists and user is a member
    ws = workspaces_col.find_one({
        "_id": ObjectId(workspace_id)
    })

    if not ws:
        raise HTTPException(404, "Workspace not found")

    if current_user["email"] not in [
        m["user_id"] for m in ws.get("members", [])
    ]:
        raise HTTPException(403, "Access denied")

    workspace_typing = typing_users.get(workspace_id, {})

    now = datetime.utcnow()
    active_users = []

    # Remove stale typing states
    for email, timestamp in list(workspace_typing.items()):

        if (now - timestamp).total_seconds() > 2:
            del workspace_typing[email]
            continue

        # Don't show the current user as typing
        if email != current_user["email"]:
            active_users.append(email)

    # Clean empty workspace entry
    if not workspace_typing:
        typing_users.pop(workspace_id, None)

    return {
        "typing": active_users
    }
# =====================================================
# 🔥 NEW — LEAVE WORKSPACE (ANYTIME)
# =====================================================
@router.post("/{workspace_id}/leave")
def leave_workspace(
    workspace_id: str,
    current_user: dict = Depends(track_presence)
):
    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})
    if not ws:
        raise HTTPException(404, "Workspace not found")

    workspaces_col.update_one(
        {"_id": ObjectId(workspace_id)},
        {"$pull": {"members": {"user_id": current_user["email"]}}}
    )

    return {"message": "Left workspace"}
# ==============================
# GET WORKSPACE MEMBERS (FINAL)
# ==============================
from datetime import datetime

ONLINE_TIMEOUT = 8  # seconds (adjust if you want)

@router.get("/{workspace_id}/members")
def get_workspace_members(
    workspace_id: str,
    current_user: dict = Depends(get_current_user)
):
    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})

    if not ws:
        raise HTTPException(404, "Workspace not found")

    if current_user["email"] not in [m["user_id"] for m in ws["members"]]:
        raise HTTPException(403, "Access denied")

    members = []
    now = datetime.utcnow()

    for m in ws.get("members", []):

        user = users_collection.find_one({"email": m["user_id"]})

        if not user:
            continue

        last_seen = user.get("last_seen_at")

        is_online = (
            last_seen and
            (now - last_seen).total_seconds() <= ONLINE_TIMEOUT
        )

        members.append({
            "_id": str(user["_id"]),   # 🔥 FIXED HERE
            "email": user["email"],
            "name": user.get("name", user["email"].split("@")[0]),
            "role": m.get("role", "member"),
            "online": bool(is_online),
            "last_seen_at": last_seen
        })

    return members

#Rename
class RenameWorkspaceRequest(BaseModel):
    name: str


@router.put("/{workspace_id}/rename")
def rename_workspace(
    workspace_id: str,
    data: RenameWorkspaceRequest,
    current_user: dict = Depends(get_current_user)
):
    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})

    if not ws:
        raise HTTPException(404, "Workspace not found")

    # only admin can rename
    admin = next(
        (m for m in ws["members"]
         if m["user_id"] == current_user["email"] and m["role"] == "admin"),
        None
    )

    if not admin:
        raise HTTPException(403, "Only admin can rename")

    workspaces_col.update_one(
        {"_id": ObjectId(workspace_id)},
        {"$set": {"name": data.name}}
    )

    return {"message": "Workspace renamed"}
#workspace delete
@router.delete("/{workspace_id}")
def delete_workspace(
    workspace_id: str,
    current_user: dict = Depends(get_current_user)
):
    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})

    if not ws:
        raise HTTPException(404, "Workspace not found")

    # only admin
    admin = next(
        (m for m in ws["members"]
         if m["user_id"] == current_user["email"] and m["role"] == "admin"),
        None
    )

    if not admin:
        raise HTTPException(403, "Only admin can delete")

    workspaces_col.delete_one({"_id": ObjectId(workspace_id)})

    messages_col.delete_many({"workspace_id": workspace_id})

    invites_col.delete_many({"workspace_id": workspace_id})

    return {"message": "Workspace deleted"}
#visibility

class WorkspaceVisibilityRequest(BaseModel):
    range: str


@router.put("/{workspace_id}/visibility")
def change_visibility(
    workspace_id: str,
    data: WorkspaceVisibilityRequest,
    current_user: dict = Depends(get_current_user)
):
    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})

    if not ws:
        raise HTTPException(404, "Workspace not found")

    admin = next(
        (m for m in ws["members"]
         if m["user_id"] == current_user["email"] and m["role"] == "admin"),
        None
    )

    if not admin:
        raise HTTPException(403, "Only admin can change visibility")

    workspaces_col.update_one(
        {"_id": ObjectId(workspace_id)},
        {"$set": {"range": data.range}}
    )

    return {"message": "Visibility updated"}

# ==============================
# DELETE MESSAGE
# ==============================
@router.delete("/{workspace_id}/message/{message_id}")
def delete_message(
    workspace_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})

    if not ws:
        raise HTTPException(404, "Workspace not found")

    # check message exists
    msg = messages_col.find_one({
        "_id": ObjectId(message_id),
        "workspace_id": workspace_id
    })

    if not msg:
        raise HTTPException(404, "Message not found")

    # only sender can delete
    if msg["sender"] != current_user["email"]:
        raise HTTPException(403, "Cannot delete others message")

    messages_col.delete_one({
        "_id": ObjectId(message_id)
    })

    return {"status": "deleted"}
# ==============================
# UPDATE MESSAGE
# ==============================
class UpdateMessageRequest(BaseModel):
    content: str


@router.put("/{workspace_id}/message/{message_id}")
def update_message(
    workspace_id: str,
    message_id: str,
    data: UpdateMessageRequest,
    current_user: dict = Depends(get_current_user)
):

    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})

    if not ws:
        raise HTTPException(404, "Workspace not found")

    msg = messages_col.find_one({
        "_id": ObjectId(message_id),
        "workspace_id": workspace_id
    })

    if not msg:
        raise HTTPException(404, "Message not found")

    # only sender can edit
    if msg["sender"] != current_user["email"]:
        raise HTTPException(403, "Cannot edit others message")

    messages_col.update_one(
        {"_id": ObjectId(message_id)},
        {
            "$set": {
                "content": data.content,
                "edited": True,
                "edited_at": datetime.utcnow()
            }
        }
    )

    return {"status": "updated"}
