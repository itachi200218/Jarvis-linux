from fastapi import APIRouter, Depends
from bson import ObjectId
from auth.database import notifications_collection
from auth.security import get_current_user
from datetime import timezone

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)

# ==============================
# GET ALL NOTIFICATIONS
# ==============================
@router.get("")
def get_notifications(user=Depends(get_current_user)):
    user_id = str(user["_id"])

    cursor = notifications_collection.find(
        {"user_id": user_id}
    ).sort("created_at", -1)

    results = []

    for n in cursor:
        results.append({
            "id": str(n["_id"]),
            "user_id": n["user_id"],
            "source": n["source"],
            "event_type": n["event_type"],
            "title": n["title"],
            "message": n["message"],
            "metadata": n.get("metadata", {}),
            "is_read": n["is_read"],
            # ✅ CRITICAL FIX HERE
            "created_at": n["created_at"]
                .replace(tzinfo=timezone.utc)
                .isoformat()
        })

    return results
# ==============================
# MARK ONE AS READ
# ==============================
@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    user=Depends(get_current_user)
):
    user_id = str(user["_id"])

    notifications_collection.update_one(
        {
            "_id": ObjectId(notification_id),
            "user_id": user_id
        },
        {"$set": {"is_read": True}}
    )

    return {"status": "ok"}


# ==============================
# MARK ALL AS READ
# ==============================
@router.put("/read-all")
def mark_all_read(user=Depends(get_current_user)):
    user_id = str(user["_id"])

    notifications_collection.update_many(
        {
            "user_id": user_id,
            "is_read": False
        },
        {"$set": {"is_read": True}}
    )

    return {"status": "ok"}
