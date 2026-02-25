import time
from datetime import datetime, timedelta
from auth.database import users_collection

TIMEOUT = timedelta(seconds=10)  # adjust if needed

def start_presence_watcher():
    print("🟢 Presence watcher started")

    while True:
        now = datetime.utcnow()

        users_collection.update_many(
            {
                "online": True,
                "last_seen_at": {"$lt": now - TIMEOUT}
            },
            {
                "$set": {"online": False}
            }
        )

        time.sleep(5)  # run every 5 seconds
