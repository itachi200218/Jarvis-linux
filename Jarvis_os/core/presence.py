from datetime import datetime, timedelta
from auth.database import users_collection

PRESENCE_TIMEOUT = timedelta(seconds=10)

def mark_user_online(user: dict):
    users_collection.update_one(
        {"email": user["email"]},
        {
            "$set": {
                "last_seen_at": datetime.utcnow()
            }
        }
    )

def is_user_online(email: str) -> bool:
    user = users_collection.find_one(
        {"email": email},
        {"last_seen_at": 1}
    )

    if not user or not user.get("last_seen_at"):
        return False

    return datetime.utcnow() - user["last_seen_at"] < PRESENCE_TIMEOUT
