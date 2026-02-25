from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId

from auth.security import get_current_user
from auth.database import support_collection
from notifications.service import create_notification

router = APIRouter(
    prefix="/auth/support",
    tags=["Support"]
)

# ==============================
# MODELS
# ==============================
class SupportRequest(BaseModel):
    message: str

class ReplyRequest(BaseModel):
    message: str

# ==============================
# CREATE NEW TICKET (ALWAYS)
# ==============================
@router.post("/message")
async def create_ticket(   # ✅ MUST BE async
    data: SupportRequest,
    user=Depends(get_current_user)
):
    user_id = str(user["_id"])
    username = user.get("name") or user.get("email")

    message = {
        "sender": "user",
        "text": data.message,
        "timestamp": datetime.utcnow()
    }

    result = support_collection.insert_one({
        "userId": user_id,
        "username": username,
        "status": "open",
        "messages": [message],
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    })

    # 🔔 NOTIFY USER — TICKET CREATED (REALTIME)
    await create_notification(
        user_id=user_id,
        source="SUPPORT",
        event_type="CREATED",
        title="Support Ticket Created",
        message="Your support ticket has been created",
        metadata={
            "ticket_id": str(result.inserted_id)
        }
    )

    return {
        "success": True,
        "action": "created",
        "ticketId": str(result.inserted_id)
    }

# ==============================
# REPLY TO EXISTING TICKET
# ==============================
@router.post("/tickets/{ticket_id}/reply")
async def reply_ticket(   # ✅ MUST BE async
    ticket_id: str,
    data: ReplyRequest,
    user=Depends(get_current_user)
):
    user_id = str(user["_id"])

    message = {
        "sender": "user",
        "text": data.message,
        "timestamp": datetime.utcnow()
    }

    result = support_collection.update_one(
        {
            "_id": ObjectId(ticket_id),
            "userId": user_id,
            "status": "open"
        },
        {
            "$push": {"messages": message},
            "$set": {"updatedAt": datetime.utcnow()}
        }
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found or closed")

    # 🔔 NOTIFY USER — TICKET REPLIED (REALTIME)
    await create_notification(
        user_id=user_id,
        source="SUPPORT",
        event_type="REPLY",
        title="Support Ticket Updated",
        message="Your support ticket has a new reply",
        metadata={
            "ticket_id": ticket_id
        }
    )

    return {"success": True, "action": "updated"}
# ==============================
# GET ALL USER TICKETS
# ==============================
@router.get("/tickets")
def get_user_tickets(user=Depends(get_current_user)):
    user_id = str(user["_id"])

    tickets = list(
        support_collection.find(
            {"userId": user_id},
            {"messages": 0}
        ).sort("createdAt", -1)
    )

    for t in tickets:
        t["_id"] = str(t["_id"])

    return tickets

# ==============================
# GET SINGLE TICKET
# ==============================
@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: str, user=Depends(get_current_user)):
    user_id = str(user["_id"])

    ticket = support_collection.find_one({
        "_id": ObjectId(ticket_id),
        "userId": user_id
    })

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket["_id"] = str(ticket["_id"])
    return ticket

# ==============================
# CLOSE TICKET
# ==============================
@router.patch("/tickets/{ticket_id}/close")
async def close_ticket(   # ✅ MUST BE async
    ticket_id: str,
    user=Depends(get_current_user)
):
    user_id = str(user["_id"])

    result = support_collection.update_one(
        {
            "_id": ObjectId(ticket_id),
            "userId": user_id
        },
        {
            "$set": {
                "status": "closed",
                "updatedAt": datetime.utcnow()
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # 🔔 NOTIFY USER — TICKET CLOSED (REALTIME)
    await create_notification(
        user_id=user_id,
        source="SUPPORT",
        event_type="CLOSED",
        title="Support Ticket Closed",
        message="Your support ticket has been closed",
        metadata={
            "ticket_id": ticket_id
        }
    )

    return {"success": True, "status": "closed"}