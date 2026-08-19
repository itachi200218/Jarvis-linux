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
        # user_id -> multiple WebSocket connections
        self.active_connections: Dict[str, list[WebSocket]] = {}

    # ==============================
    # CONNECT USER
    # ==============================
    async def connect(self, user_id: str, websocket: WebSocket):

        user_id = str(user_id)

        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = []

        self.active_connections[user_id].append(websocket)

        print(
            "🟢 Connected users:",
            list(self.active_connections.keys())
        )

    # ==============================
    # DISCONNECT ONE CONNECTION
    # ==============================
    def disconnect(
        self,
        user_id: str,
        websocket: WebSocket
    ):

        user_id = str(user_id)

        connections = self.active_connections.get(user_id)

        if not connections:
            return

        if websocket in connections:
            connections.remove(websocket)

        # Only remove the user when ALL their tabs/connections are gone
        if not connections:
            del self.active_connections[user_id]

        print("🔴 Disconnected:", user_id)

        print(
            "🟢 Remaining users:",
            list(self.active_connections.keys())
        )

    # ==============================
    # SEND TO USER
    # ==============================
    async def send_to_user(
        self,
        user_id: str,
        payload: dict
    ):

        user_id = str(user_id)

        connections = self.active_connections.get(user_id, [])

        if not connections:

            print(
                f"❌ Target user NOT connected: {user_id}"
            )

            print(
                "🟢 Available users:",
                list(self.active_connections.keys())
            )

            return

        try:

            safe_json = json.dumps(
                payload,
                default=json_safe
            )

            dead_connections = []

            for websocket in connections:

                try:

                    await websocket.send_text(
                        safe_json
                    )

                    print(
                        f"📤 Sent to {user_id}"
                    )

                except Exception as e:

                    print(
                        f"❌ Send error to {user_id}:",
                        e
                    )

                    dead_connections.append(
                        websocket
                    )

            # Remove dead sockets
            for websocket in dead_connections:

                self.disconnect(
                    user_id,
                    websocket
                )

        except Exception as e:

            print(
                f"❌ Error sending to {user_id}:",
                e
            )
# ==============================
# GLOBAL INSTANCE
# ==============================
manager = NotificationManager()