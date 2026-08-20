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

        # ==============================
        # GET JWT TOKEN
        # ==============================
        token = websocket.query_params.get("token")

        if not token:
            print("❌ WS connection rejected: No token")
            await websocket.close(code=1008)
            return

        # ==============================
        # DECODE JWT
        # ==============================
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        email = payload.get("sub")

        if not email:
            print("❌ WS connection rejected: No email in token")
            await websocket.close(code=1008)
            return

        # ==============================
        # FIND USER
        # ==============================
        user = users_collection.find_one({
            "email": email
        })

        if not user:
            print(f"❌ WS connection rejected: User not found: {email}")
            await websocket.close(code=1008)
            return

        user_id = str(user["_id"])

        # ==============================
        # REGISTER CONNECTION
        # ==============================
        await manager.connect(
            user_id,
            websocket
        )

        print(
            f"🔔 WS connected: {email} ({user_id})"
        )

        # ==============================
        # RECEIVE SIGNALS
        # ==============================
        while True:

            data = await websocket.receive_json()

            event_type = data.get("type")
            target = data.get("target")

            # ==============================
            # VALIDATE TARGET
            # ==============================
            if not target:

                print(
                    f"⚠️ WS event without target: {event_type}"
                )

                continue

            target_user_id = str(target)

            print(
                f"📡 Signal {event_type} "
                f"from {user_id} "
                f"to {target_user_id}"
            )

            print(
                "🟢 Available users:",
                list(
                    manager.active_connections.keys()
                )
            )

            # ==============================
            # ALLOWED SIGNAL TYPES
            # ==============================
            if event_type in [
       # ==============================
# 1-TO-1 CALL SIGNALS
# ==============================
"call_offer",
"call_answer",
"call_candidate",
"call_end",
"call_rejected",

# ==============================
# GROUP CALL
# ==============================
"group_call_invite",
"group_call_offer",
"group_call_answer",
"group_call_candidate",
"group_call_end",
"group_call_reject"
]:

                await manager.send_to_user(
                    target_user_id,
                    {
                        **data,
                        "from": user_id
                    }
                )

            else:

                print(
                    f"⚠️ Unknown WS event type: {event_type}"
                )

       # ==============================
    # DISCONNECT
    # ==============================
    except WebSocketDisconnect:

        print(
            f"🔕 WS disconnected: {user_id}"
        )

        if user_id:
            manager.disconnect(
                user_id,
                websocket
            )

    # ==============================
    # OTHER ERRORS
    # ==============================
    except Exception as e:

        print(
            f"❌ WS error for {user_id}:",
            e
        )

        if user_id:
            manager.disconnect(
                user_id,
                websocket
            )