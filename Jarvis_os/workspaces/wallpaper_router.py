from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from bson import ObjectId
import os
import uuid

from auth.security import get_current_user
from jarvis_core import db

router = APIRouter(prefix="/workspace", tags=["Workspace Wallpaper"])

workspaces_col = db["workspaces"]

# absolute folder path (IMPORTANT)
BASE_DIR = os.getcwd()
WALLPAPER_DIR = os.path.join(BASE_DIR, "wallpapers")

os.makedirs(WALLPAPER_DIR, exist_ok=True)


# ==============================
# UPDATE WORKSPACE WALLPAPER
# ==============================
@router.put("/{workspace_id}/wallpaper")
def update_workspace_wallpaper(
    workspace_id: str,
    wallpaper: str,
    current_user: dict = Depends(get_current_user)
):

    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})

    if not ws:
        raise HTTPException(404, "Workspace not found")

    if current_user["email"] not in [
        m["user_id"] for m in ws["members"]
    ]:
        raise HTTPException(403, "Access denied")

    workspaces_col.update_one(
        {"_id": ObjectId(workspace_id)},
        {"$set": {"wallpaper": wallpaper}}
    )

    return {"status": "updated"}


# ==============================
# UPLOAD CUSTOM WALLPAPER
# ==============================
@router.post("/{workspace_id}/wallpaper/upload")
async def upload_workspace_wallpaper(
    workspace_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):

    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})

    if not ws:
        raise HTTPException(404, "Workspace not found")

    if current_user["email"] not in [
        m["user_id"] for m in ws["members"]
    ]:
        raise HTTPException(403, "Access denied")

    # generate unique filename
    filename = f"custom_{workspace_id}_{uuid.uuid4().hex}.jpg"

    filepath = os.path.join(WALLPAPER_DIR, filename)

    contents = await file.read()

    with open(filepath, "wb") as f:
        f.write(contents)

    workspaces_col.update_one(
        {"_id": ObjectId(workspace_id)},
        {"$set": {"wallpaper": filename}}
    )

    return {
        "status": "uploaded",
        "wallpaper": filename
    }


# ==============================
# LIST CUSTOM WALLPAPERS
# ==============================
@router.get("/{workspace_id}/wallpaper/custom")
def list_custom_wallpapers(
    workspace_id: str,
    current_user: dict = Depends(get_current_user)
):

    ws = workspaces_col.find_one({"_id": ObjectId(workspace_id)})

    if not ws:
        raise HTTPException(404, "Workspace not found")

    if current_user["email"] not in [
        m["user_id"] for m in ws["members"]
    ]:
        raise HTTPException(403, "Access denied")

    files = []

    if os.path.exists(WALLPAPER_DIR):

        for f in os.listdir(WALLPAPER_DIR):

            if f.startswith(f"custom_{workspace_id}_"):
                files.append(f)

    files.sort(reverse=True)

    return files