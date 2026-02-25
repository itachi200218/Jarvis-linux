# seed_commands.py
import os
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

# ==============================
# LOAD ENV
# ==============================
load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = "Jarvis"
COLLECTION_NAME = "commands"

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
commands_col = db[COLLECTION_NAME]

# ==============================
# ROLE CONSTANTS
# ==============================
ROLE_USER = "user"
ROLE_ADMIN = "admin"

# ==============================
# DEFAULT FLAGS
# ==============================
DEFAULT_DISABLED = False

# ==============================
# COMMAND SEED DATA
# ==============================
COMMANDS = [
    {
        "intent": "open_chrome",
        "patterns": [
            "open chrome",
            "open crome",
            "launch chrome",
            "start chrome",
            "open google chrome"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "open_vscode",
        "patterns": [
            "open vs code",
            "open vscode",
            "launch vscode",
            "start vs code"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "shutdown",
        "patterns": [
            "shutdown",
            "shut down system",
            "turn off pc",
            "power off"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "restart",
        "patterns": [
            "restart",
            "restart system",
            "reboot pc"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "volume_up",
        "patterns": [
            "increase volume",
            "volume up",
            "raise volume"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "volume_down",
        "patterns": [
            "decrease volume",
            "volume down",
            "lower volume"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "mute_volume",
        "patterns": [
            "mute",
            "mute volume",
            "silence sound"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "screenshot",
        "patterns": [
            "take screenshot",
            "capture screen",
            "take a screenshot"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "cpu_usage",
        "patterns": [
            "cpu usage",
            "cpu status",
            "processor usage"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "ram_usage",
        "patterns": [
            "ram usage",
            "memory usage",
            "ram status"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "gpu_usage",
        "patterns": [
            "gpu usage",
            "graphics usage",
            "gpu status",
            "graphics card usage"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "battery_status",
        "patterns": [
            "battery",
            "battery percentage",
            "battery level",
            "battery status"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "disk_space",
        "patterns": [
            "disk space",
            "storage",
            "free space"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "network_status",
        "patterns": [
            "network status",
            "internet status",
            "am i connected to internet"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "open_explorer",
        "patterns": [
            "open file explorer",
            "open explorer",
            "open files"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "open_settings",
        "patterns": [
            "open settings",
            "open system settings",
            "open windows settings"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "current_time",
        "patterns": [
            "what time is it",
            "current time",
            "tell me the time"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "current_date",
        "patterns": [
            "what is today's date",
            "current date",
            "tell me the date"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "play_video",
        "patterns": [
            "play video",
            "play video of",
            "play youtube video",
            "play",
            "play video on youtube"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },
    {
        "intent": "search_web",
        "patterns": [
            "search",
            "search for",
            "search web",
            "google",
            "google search"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    },

    # 🔥 NEW — LOCATION COMMAND
    {
        "intent": "set_location",
        "patterns": [
            "set my location to",
            "set location to",
            "change my location to",
            "my location is"
        ],
        "allowed_roles": [ROLE_USER, ROLE_ADMIN],
        "disabled": DEFAULT_DISABLED
    }
]

# ==============================
# INSERT / UPDATE LOGIC (SAFE)
# ==============================
def seed_commands():
    inserted = 0
    updated = 0

    for cmd in COMMANDS:
        existing = commands_col.find_one({"intent": cmd["intent"]})

        if existing:
            update_fields = {}
            needs_update = False

            if existing.get("allowed_roles") != cmd["allowed_roles"]:
                update_fields["allowed_roles"] = cmd["allowed_roles"]
                needs_update = True

            if "disabled" not in existing:
                update_fields["disabled"] = DEFAULT_DISABLED
                needs_update = True

            if needs_update:
                update_fields["updatedAt"] = datetime.utcnow()
                commands_col.update_one(
                    {"_id": existing["_id"]},
                    {"$set": update_fields}
                )
                updated += 1
                print(f"🔄 Updated: {cmd['intent']}")
            else:
                print(f"⚠️ Already exists: {cmd['intent']}")
            continue

        cmd["createdAt"] = datetime.utcnow()
        cmd["updatedAt"] = datetime.utcnow()
        commands_col.insert_one(cmd)
        inserted += 1
        print(f"✅ Inserted: {cmd['intent']}")

    print(f"\n🎉 Done. Inserted {inserted}, Updated {updated} commands.")

# ==============================
# RUN
# ==============================
if __name__ == "__main__":
    seed_commands()
