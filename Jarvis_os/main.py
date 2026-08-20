import threading
import uvicorn
import os
import jwt
from dotenv import load_dotenv

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from notifications.router import router as notifications_router
from jarvis_core import handle_command, speak_async
from workspaces.wallpaper_router import router as wallpaper_router
from auth.router import router as auth_router
from auth.historyrouter import router as history_router
from chat.chatrouter import router as chat_router
from workspaces.router import router as workspace_router
from core.presence_router import router as presence_router
from auth.support import router as support_router

from auth.database import users_collection
from notifications.ws_router import router as notifications_ws_router
# ==============================
# LOAD ENV
# ==============================
load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET not loaded")

security = HTTPBearer(auto_error=False)

# ==============================
# FASTAPI APP
# ==============================
app = FastAPI(title="Jarvis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # ✅ USER APP + ADMIN APP
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# ROUTERS
# ==============================
app.include_router(auth_router)
app.include_router(history_router)
app.include_router(chat_router)
app.include_router(workspace_router)
app.include_router(presence_router)
app.include_router(support_router)
app.include_router(notifications_router)
app.include_router(wallpaper_router)
app.include_router(notifications_ws_router)
app.mount("/wallpapers", StaticFiles(directory="wallpapers"), name="wallpapers")
# ==============================
# STATIC FILES
# ==============================
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ==============================
# STARTUP
# ==============================
@app.on_event("startup")
def startup_event():
    threading.Thread(
        target=lambda: speak_async("Hello. I am Jarvis. System is online."),
        daemon=True
    ).start()

# ==============================
# MODELS
# ==============================
class CommandRequest(BaseModel):
    command: str
    chat_id: str | None = None

# ==============================
# ROUTES
# ==============================
@app.get("/")
def root():
    return {"status": "Jarvis is running"}

@app.post("/command")
def execute_command(
    req: CommandRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # 🔑 DEFAULTS
    user_role = "guest"
    user_name = None
    user_id = None   # ✅ IMPORTANT

    # 🔐 AUTH HANDLING
    if credentials and credentials.credentials:
        try:
            payload = jwt.decode(
                credentials.credentials,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM]
            )

            email = payload.get("sub")
            if email:
                user = users_collection.find_one({"email": email})

                if user:
                    user_id = str(user["_id"])     # ✅ FIX
                    user_name = user.get("name")
                    user_role = user.get("role", "guest")

        except jwt.ExpiredSignatureError:
            pass
        except jwt.InvalidTokenError:
            pass

    # 🤖 CORE HANDLER
    return handle_command(
        command=req.command,
        user_role=user_role,
        user_id=user_id,        # ✅ REAL USER ID
        user_name=user_name,
        chat_id=req.chat_id
    )

# ==============================
# ENTRY
# ==============================
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
