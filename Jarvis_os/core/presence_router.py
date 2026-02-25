from fastapi import APIRouter, Depends
from auth.security import get_current_user
from core.presence import mark_user_online

router = APIRouter(prefix="/presence", tags=["Presence"])

@router.post("/ping")
def ping(current_user: dict = Depends(get_current_user)):
    mark_user_online(current_user)
    return {"status": "online"}

@router.get("/users")
def get_presence(current_user: dict = Depends(get_current_user)):
    now = datetime.utcnow()

    users = users_collection.find({}, {
        "email": 1,
        "name": 1,
        "last_seen_at": 1
    })

    return [
        {
            "email": u["email"],
            "name": u.get("name"),
            "online": (
                u.get("last_seen_at") and
                (now - u["last_seen_at"]).total_seconds() <= 10
            ),
            "last_seen_at": u.get("last_seen_at")
        }
        for u in users
    ]
from fastapi import APIRouter, Depends
from datetime import datetime
from auth.security import get_current_user
from auth.database import users_collection

router = APIRouter(prefix="/presence", tags=["Presence"])

@router.post("/ping")
def ping(current_user: dict = Depends(get_current_user)):
    users_collection.update_one(
        {"email": current_user["email"]},
        {"$set": {"last_seen_at": datetime.utcnow()}}
    )
    return {"status": "online"}

@router.get("/users")
def get_presence(current_user: dict = Depends(get_current_user)):
    now = datetime.utcnow()

    users = users_collection.find(
        {},
        {"email": 1, "name": 1, "last_seen_at": 1}
    )

    result = []

    for u in users:
        is_online = False
        if u.get("last_seen_at"):
            is_online = (now - u["last_seen_at"]).total_seconds() <= 10

        result.append({
            "email": u["email"],
            "name": u.get("name"),
            "online": is_online,
            "last_seen_at": u.get("last_seen_at")
        })

    return result
