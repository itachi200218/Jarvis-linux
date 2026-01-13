import re
from rapidfuzz import fuzz
from chatHistory.chathistory import load, save
from memory.fact_patterns import FACT_QUERY_PATTERNS

# ==============================
# 🧠 SMART LEARNING RULES
# ==============================
# memory/fact_patterns.py

LEARN_RULES = [
    # ==============================
    # 👤 PROFILE
    # ==============================
    (r"my name is (.+)", "name"),
    (r"i am called (.+)", "name"),
    (r"people call me (.+)", "name"),

    (r"my age is (\d+)", "age"),
    (r"i am (\d+) years old", "age"),
    (r"i am (\d+)", "age"),

    # ==============================
    # 📍 LOCATION
    # ==============================
    (r"i live in (.+)", "location"),
    (r"i stay at (.+)", "location"),
    (r"i stay in (.+)", "location"),
    (r"i am from (.+)", "location"),
    (r"my location is (.+)", "location"),

    # ==============================
    # 🎭 ROLE / IDENTITY
    # ==============================
    (r"i am a (.+)", "role"),
    (r"i am an (.+)", "role"),
    (r"my role is (.+)", "role"),
    (r"i work as (.+)", "role"),
    (r"i am working as (.+)", "role"),

    # ==============================
    # ❤️ LIKES / PREFERENCES
    # ==============================
    (r"i like (.+)", "likes"),
    (r"i love (.+)", "likes"),
    (r"i enjoy (.+)", "likes"),
    (r"my favorite food is (.+)", "likes"),
    (r"my liked one is (.+)", "likes"),
    (r"my like is (.+)", "likes"),

    # ==============================
    # 💔 DISLIKES
    # ==============================
    (r"i hate (.+)", "dislikes"),
    (r"i dislike (.+)", "dislikes"),
    (r"i dont like (.+)", "dislikes"),
]



# ==============================
# 🗣️ CASUAL WORDS TO IGNORE
# ==============================
CASUAL_WORDS = {
    "lol", "bro", "nah", "hey", "just",
    "only", "actually", "no", "not"
}

# ==============================
# 🔁 UPSERT FACT
# ==============================
def upsert_fact(chats, key, value):
    chats[0].setdefault("facts", [])

    for fact in chats[0]["facts"]:
        if fact["key"] == key:
            fact["value"] = value
            return "updated"

    chats[0]["facts"].append({
        "type": "profile",
        "key": key,
        "value": value
    })
    return "added"

# ==============================
# 🧠 LEARN FACT (STRICT)
# ==============================
def learn_fact(user_name: str, text: str):
    text = text.lower().strip()
    chats = load(user_name)

    if not chats:
        return None, None, None

    for pattern, key in LEARN_RULES:
        match = re.search(pattern, text)
        if match:
            value = match.group(1).strip()

            # remove casual words
            words = [w for w in value.split() if w not in CASUAL_WORDS]
            clean_value = " ".join(words).title()

            action = upsert_fact(chats, key, clean_value)
            save(user_name, chats)
            return key, clean_value, action

    return None, None, None

# ==============================
# 🔎 DETECT FACT QUESTION
# ==============================
def detect_fact_query(text: str):
    text = text.lower().strip()
    best_score = 0
    best_key = None

    for key, phrases in FACT_QUERY_PATTERNS.items():
        for phrase in phrases:
            score = fuzz.partial_ratio(text, phrase)
            if score > best_score and score >= 80:
                best_score = score
                best_key = key

    return best_key

# ==============================
# 📤 GET FACT VALUE
# ==============================
def get_fact(user_name: str, key: str):
    chats = load(user_name)

    for convo in reversed(chats):
        for fact in convo.get("facts", []):
            if fact.get("key") == key:
                return fact.get("value")

    return None

# ==============================
# 🔁 CASUAL FACT REFINEMENT
# ==============================
def detect_fact_refinement(user_name: str, text: str):
    """
    Handles:
    - its only pet dog
    - bro just dog
    - not dog lol
    """
    chats = load(user_name)
    if not chats:
        return None, None

    text = text.lower()

    if not any(x in text for x in ["only", "just", "not", "i mean"]):
        return None, None

    if "dog" in text:
        return "role", "Dog"

    return None, None

# ==============================
# 🔁 EXPLICIT FACT UPDATE (NEW)
# ==============================
def detect_explicit_update(user_name: str, text: str):
    """
    Handles:
    - change it to dog lol
    - change my role to dog
    - update my name to chiku
    """
    chats = load(user_name)
    if not chats:
        return None, None

    text = text.lower().strip()

    patterns = [
        r"change my (\w+) to (.+)",
        r"update my (\w+) to (.+)",
        r"change it to (.+)",
        r"make it (.+)"
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue

        if "my" in pattern:
            key = match.group(1)
            value = match.group(2)
        else:
            # infer last fact
            last_facts = chats[0].get("facts", [])
            if not last_facts:
                return None, None
            key = last_facts[-1]["key"]
            value = match.group(1)

        words = [w for w in value.split() if w not in CASUAL_WORDS]
        clean_value = " ".join(words).title()

        upsert_fact(chats, key, clean_value)
        save(user_name, chats)
        return key, clean_value

    return None, None
