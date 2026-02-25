from typing import Dict
from fastapi import WebSocket
import json
from datetime import datetime
from bson import ObjectId


# ==============================
# JSON SAFE CONVERTER
# ==============================
def json_safe(obj):

    if isinstance(obj, datetime):
        return obj.isoformat()

    if isinstance(obj, ObjectId):
        return str(obj)

    return str(obj)


# ==============================
# NOTIFICATION MANAGER
# ==============================
class NotificationManager:

    def __init__(self):

        # key = user_id
        # value = websocket
        self.active_connections: Dict[str, list[WebSocket]] = {}

    # ==============================
    # CONNECT USER
    # ==============================
    async def connect(self, user_id: str, websocket: WebSocket):

        user_id = str(user_id)

        await websocket.accept()

        self.active_connections[user_id] = websocket

        print("🟢 Connected users:", list(self.active_connections.keys()))


    # ==============================
    # DISCONNECT USER
    # ==============================
    def disconnect(self, user_id: str):

        user_id = str(user_id)

        if user_id in self.active_connections:

            del self.active_connections[user_id]

            print("🔴 Disconnected:", user_id)

            print("🟢 Remaining users:",
                  list(self.active_connections.keys()))


    # ==============================
    # SEND TO USER
    # ==============================
    async def send_to_user(self, user_id: str, payload: dict):

        user_id = str(user_id)

        ws = self.active_connections.get(user_id)

        if not ws:

            print(f"❌ Target user NOT connected: {user_id}")

            print("🟢 Available users:",
                  list(self.active_connections.keys()))

            return

        try:

            safe_json = json.dumps(payload, default=json_safe)

            await ws.send_text(safe_json)

            print(f"📤 Sent to {user_id}")

        except Exception as e:

            print(f"❌ Send error to {user_id}:", e)

            self.disconnect(user_id)


# ==============================
# GLOBAL INSTANCE
# ==============================
manager = NotificationManager()