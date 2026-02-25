from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import jwt
import os
from dotenv import load_dotenv

from notifications.ws_manager import manager
from auth.database import users_collection

load_dotenv()

router = APIRouter(prefix="/ws")

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"


# ==============================
# MAIN WEBSOCKET ROUTE
# ==============================
@router.websocket("/notifications")
async def notifications_ws(websocket: WebSocket):

    user_id = None

    print("🔥 WS connection attempt")

    try:

        token = websocket.query_params.get("token")

        if not token:
            await websocket.close(code=1008)
            return

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        email = payload.get("sub")

        user = users_collection.find_one({"email": email})

        user_id = str(user["_id"])

        await manager.connect(user_id, websocket)

        print(f"🔔 WS connected: {email} ({user_id})")


        while True:

            data = await websocket.receive_json()

            event_type = data.get("type")
            target = data.get("target")

            # 🔥 CRITICAL FIX HERE
            target_user_id = str(target)

            print(f"📡 Signal {event_type} from {user_id} to {target_user_id}")
            print(f"🟢 Available users: {list(manager.active_connections.keys())}")

            if event_type in [
                "call_offer",
                "call_answer",
                "call_candidate",
                "call_end",
                "call_rejcted"
            ]:

                await manager.send_to_user(
                    target_user_id,
                    {
                        **data,
                        "from": user_id
                    }
                )

    except WebSocketDisconnect:

        print(f"🔕 WS disconnected: {user_id}")

        manager.disconnect(user_id)
