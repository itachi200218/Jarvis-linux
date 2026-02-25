import json
import os

BASE_DIR = "memory/user_data"

def _path(user):
    return os.path.join(BASE_DIR, f"{user}_facts.json")

def load_user_facts(user):
    if not os.path.exists(_path(user)):
        return {}
    with open(_path(user), "r") as f:
        return json.load(f)

def save_user_facts(user, facts):
    os.makedirs(BASE_DIR, exist_ok=True)
    with open(_path(user), "w") as f:
        json.dump(facts, f, indent=2)
