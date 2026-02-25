from datetime import datetime
from auth.database import notifications_collection
from notifications.ws_manager import manager


# 🔔 CREATE + PUSH NOTIFICATION
async def create_notification(
    user_id: str,
    source: str,
    event_type: str,
    title: str,
    message: str,
    metadata: dict = None
):

    print("🔥 create_notification called for:", user_id)
    print("🟢 Currently connected users:", list(manager.active_connections.keys()))

    notif = {
        "user_id": user_id,
        "source": source,
        "event_type": event_type,
        "title": title,
        "message": message,
        "metadata": metadata or {},
        "is_read": False,
        "created_at": datetime.utcnow()
    }

    # ✅ SAVE TO DB
    result = notifications_collection.insert_one(notif)

    # ✅ ADD ID FOR FRONTEND
    notif["id"] = str(result.inserted_id)

    # ✅ FIX: convert datetime to string for websocket
    notif["created_at"] = notif["created_at"].isoformat()

    print("📤 Attempting to send notification to:", user_id)

    # 🔥 REALTIME PUSH (NOW SAFE)
    await manager.send_to_user(user_id, {
        "type": "notification",
        "data": notif
    })

    print("✅ Notification send function executed")