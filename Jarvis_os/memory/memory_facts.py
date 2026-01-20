# memory/memory_facts.py
import re
from rapidfuzz import fuzz

from memory.fact_patterns import FACT_QUERY_PATTERNS
from memory.LEARN_RULES import LEARN_RULES
from memory.CASUAL_WORDS import CASUAL_WORDS
from memory.user_facts import load_user_facts, save_user_facts


# ==============================
# 🧹 NORMALIZE VALUE
# ==============================
def normalize_value(value: str) -> str:
    value = value.lower().strip()

    if value.isdigit():
        return value

    words = []
    for w in value.split():
        if w in CASUAL_WORDS:
            continue
        if not w.isalpha():
            continue
        words.append(w)

    return " ".join(words).title()


# ==============================
# ✂️ SPLIT MULTI-VALUE PREFERENCES
# ==============================
def split_preferences(text: str) -> list:
    """
    Intelligent splitter for skills, tools, likes.
    Handles:
    - 'java python react'
    - 'chicken biryani mutton biryani'
    - 'vs code git linux'
    """
    text = text.lower().strip()

    # normalize connectors
    text = re.sub(r"\band\b", ",", text)
    text = re.sub(r"\bwith\b", ",", text)

    # split on commas
    parts = [p.strip() for p in text.split(",") if p.strip()]

    items = []

    for part in parts:
        words = part.split()

        buffer = []
        for w in words:
            # join food names like "chicken biryani"
            if w in {"biryani", "rice", "curry"} and buffer:
                buffer[-1] = buffer[-1] + " " + w
            else:
                buffer.append(w)

        items.extend(buffer)

    # final cleanup
    cleaned = []
    for item in items:
        item = normalize_value(item)
        if len(item) >= 2:
            cleaned.append(item)

    return list(dict.fromkeys(cleaned))  # remove duplicates

# ==============================
# 🔁 UPSERT FACT (GLOBAL)
# ==============================
def upsert_fact(user: str, key: str, value: str):
    facts = load_user_facts(user)

    if key in {"likes", "dislikes", "skills", "tools"}:
        facts.setdefault(key, [])
        if value not in facts[key]:
            facts[key].append(value)
            save_user_facts(user, facts)
            return "added"
        return "unchanged"

    if facts.get(key) == value:
        return "unchanged"

    facts[key] = value
    save_user_facts(user, facts)
    return "updated"


# ==============================
# 🧠 LEARN FACT (SAFE)
# ==============================
def learn_fact(user_name: str, text: str):
    text = text.lower().strip()

    for pattern, key in LEARN_RULES:
        match = re.search(pattern, text)
        if match:
            raw_value = match.group(1)

            if key in {"likes", "dislikes", "skills", "tools"}:
                items = split_preferences(raw_value)
                for item in items:
                    upsert_fact(user_name, key, item)
                return {"key": key, "value": items, "action": "added"}

            clean_value = normalize_value(raw_value)
            action = upsert_fact(user_name, key, clean_value)
            return {"key": key, "value": clean_value, "action": action}

    return None

# ==============================
# 🗑️ REMOVE FROM LIST FACT
# ==============================
def remove_from_fact(user: str, key: str, value: str):
    facts = load_user_facts(user)

    if key not in facts or not isinstance(facts[key], list):
        return "not_found"

    if value in facts[key]:
        facts[key].remove(value)

        # clean empty list
        if not facts[key]:
            del facts[key]

        save_user_facts(user, facts)
        return "removed"

    return "not_found"


# ==============================
# 🧠 DETECT FACT REMOVAL
# ==============================
def detect_fact_removal(user_name: str, text: str):
    text = text.lower().strip()

    patterns = [
        r"remove (.+)",
        r"delete (.+)",
        r"i dont like (.+) anymore",
        r"i don't like (.+) anymore",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            value = normalize_value(match.group(1))

            # try likes first
            if remove_from_fact(user_name, "likes", value) == "removed":
                return {"key": "likes", "value": value}

            # then dislikes
            if remove_from_fact(user_name, "dislikes", value) == "removed":
                return {"key": "dislikes", "value": value}

    return None


# ==============================
# 🔁 ONLY LIKE (REPLACE LIST)
# ==============================
def detect_only_like(user_name: str, text: str):
    match = re.search(r"i only like (.+)", text.lower())
    if not match:
        return None

    value = normalize_value(match.group(1))
    facts = load_user_facts(user_name)

    facts["likes"] = [value]
    save_user_facts(user_name, facts)

    return value


# ==============================
# 🤖 AI-ASSISTED FACT SUGGESTION (SAFE)
# ==============================
def ai_suggest_facts(ai_text: str) -> list:
    suggestions = []
    text = ai_text.lower()

    if "full stack" in text and "developer" in text:
        suggestions.append({"key": "role", "value": "Full Stack Developer"})

    if "backend developer" in text:
        suggestions.append({"key": "role", "value": "Backend Developer"})

    if "frontend developer" in text:
        suggestions.append({"key": "role", "value": "Frontend Developer"})

    return suggestions


# ==============================
# 🔎 FACT QUESTION DETECTION
# ==============================
def detect_fact_query(text: str):
    text = text.lower().strip()
    best_score, best_key = 0, None

    for key, phrases in FACT_QUERY_PATTERNS.items():
        for phrase in phrases:
            score = fuzz.partial_ratio(text, phrase)
            if score >= 80 and score > best_score:
                best_score, best_key = score, key

    return best_key


# ==============================
# 📤 GET FACT (GLOBAL)
# ==============================
def get_fact(user_name: str, key: str):
    return load_user_facts(user_name).get(key)


# ==============================
# 🔁 EXPLICIT FACT UPDATE
# ==============================
def detect_explicit_update(user_name: str, text: str):
    text = text.lower().strip()

    for pattern in (
        r"change my (\w+) to (.+)",
        r"update my (\w+) to (.+)"
    ):
        match = re.search(pattern, text)
        if match:
            key = match.group(1)
            value = normalize_value(match.group(2))
            action = upsert_fact(user_name, key, value)
            return {
                "key": key,
                "value": value,
                "action": action
            }

    return None


# ==============================
# 📘 MEMORY SUMMARY (GLOBAL, READ-ONLY)
# ==============================
def get_memory_summary(user_name: str) -> str:
    facts = load_user_facts(user_name)
    if not facts:
        return ""

    return "; ".join(f"{k}: {v}" for k, v in facts.items())

# ==============================
# 📍 SET FACT EXPLICITLY (SAFE)
# ==============================
def set_fact(user_name: str, key: str, value: str):
    clean_value = normalize_value(value)
    return upsert_fact(user_name, key, clean_value)
