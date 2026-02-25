import os
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime

# ==============================
# LOAD ENV
# ==============================
load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("MONGO_DB", "Jarvis")
USERS_COLLECTION = "users"

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
users_col = db[USERS_COLLECTION]

# ==============================
# MIGRATION LOGIC
# ==============================
def migrate_guest_to_user():
    print("🔍 Searching for users with role='guest' ...")

    result = users_col.update_many(
        { "role": "guest" },
        {
            "$set": {
                "role": "user",
                "updated_at": datetime.utcnow()
            }
        }
    )

    print(f"🔄 Updated users: {result.modified_count}")
    print("✅ Migration complete.")

# ==============================
# RUN
# ==============================
if __name__ == "__main__":
    migrate_guest_to_user()
