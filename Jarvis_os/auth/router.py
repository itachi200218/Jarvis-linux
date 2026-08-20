from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pathlib import Path
import uuid, shutil
from datetime import datetime, timezone

from bson import ObjectId

from auth.models import (
    RegisterRequest,
    LoginRequest,
    UpdateProfileRequest,
    ChangePasswordRequest
)

from auth.database import users_collection, password_reset_tokens
from auth.security import (
    hash_password,
    verify_password,
    needs_password_upgrade,
    create_access_token,
    get_current_user
)

router = APIRouter(prefix="/auth", tags=["Auth"])

# ==============================
# 🔐 REGISTER
# ==============================
@router.post("/register")
def register(data: RegisterRequest):
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if users_collection.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="User already exists")

    users_collection.insert_one({
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "role": "user",
        "secure_mode": False,
        "avatar": None,
        "online": False,
        "created_at": datetime.utcnow(),
        "last_login_at": None,
        "last_seen_at": None
    })

    return {"message": "User registered successfully"}

# ==============================
# 🔐 LOGIN (FIXED)
# ==============================
@router.post("/login")
def login(data: LoginRequest):
    user = users_collection.find_one({
        "$or": [
            {"email": data.email},
            {"name": data.email}
        ]
    })

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # 🔁 Upgrade hash if needed (CORRECT)
    if needs_password_upgrade(user["password"]):
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"password": hash_password(data.password)}}
        )

    now = datetime.utcnow()

    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "last_login_at": now,
                "online": True
            }
        }
    )

    token = create_access_token({
        "sub": user["email"],
        "name": user["name"]
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "name": user["name"],
            "email": user["email"],
            "role": user.get("role", "user")
        }
    }

# ==============================
# 👤 MY PROFILE
# ==============================
@router.get("/me")
def get_my_profile(current_user: dict = Depends(get_current_user)):
    users_collection.update_one(
        {"email": current_user["email"]},
        {
            "$set": {
                "last_seen_at": datetime.utcnow(),
                "online": True
            }
        }
    )

    return {
        "user_id": str(current_user["_id"]),
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user.get("role", "user"),
        "secure_mode": current_user.get("secure_mode", False),
        "avatar": current_user.get("avatar")
    }
# ==============================
# 🔴 MARK USER OFFLINE
# ==============================
@router.post("/offline")
def mark_offline(payload: dict):
    email = payload.get("email")
    if not email:
        return {"status": "ignored"}

    users_collection.update_one(
        {"email": email},
        {
            "$set": {
                "online": False,
                "last_seen_at": datetime.utcnow()
            }
        }
    )

    return {"status": "offline"}

# ==============================
# 👤 PUBLIC USER PROFILE
# ==============================
@router.get("/user/{email}")
def get_user_profile(
    email: str,
    current_user: dict = Depends(get_current_user),
):
    user = users_collection.find_one(
        {"email": email},
        {"password": 0}
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role", "user"),
        "avatar": user.get("avatar"),
        "online": user.get("online", False),
        "last_seen_at": user.get("last_seen_at")
    }

# ==============================
# ✏️ UPDATE PROFILE
# ==============================
@router.put("/profile")
def update_profile(
    data: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user)
):
    users_collection.update_one(
        {"email": current_user["email"]},
        {"$set": {"name": data.name}}
    )
    return {"message": "Profile updated successfully"}

# ==============================
# 🔁 RESET PASSWORD (EMAIL TOKEN)
# ==============================
@router.post("/reset-password")
def reset_password(payload: dict):
    token = payload.get("token")
    new_password = payload.get("newPassword")

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Invalid request")

    reset_token = password_reset_tokens.find_one({"_id": token})
    if not reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    expiry = reset_token["expiry"]
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    if expiry < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token expired")

    user_id = ObjectId(reset_token["userId"])
    user = users_collection.find_one({"_id": user_id})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"password": hash_password(new_password)}}
    )

    password_reset_tokens.delete_one({"_id": token})

    return {"message": "Password reset successful"}

# ==============================
# 🔑 CHANGE PASSWORD
# ==============================
@router.put("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    if not verify_password(data.old_password, current_user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    users_collection.update_one(
        {"email": current_user["email"]},
        {"$set": {"password": hash_password(data.new_password)}}
    )

    return {"message": "Password updated successfully"}

# ==============================
# 🖼 UPLOAD AVATAR
# ==============================
@router.post("/upload-avatar")
def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Only JPG or PNG allowed")

    UPLOAD_DIR = Path("uploads/profiles")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4()}.png"
    file_path = UPLOAD_DIR / filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    avatar_url = f"http://localhost:8000/uploads/profiles/{filename}"

    users_collection.update_one(
        {"email": current_user["email"]},
        {"$set": {"avatar": avatar_url}}
    )

    return {
        "message": "Avatar uploaded successfully",
        "avatar": avatar_url
    }
