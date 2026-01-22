# jarvis_core.py
import os
import re
import threading
import platform

from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
from rapidfuzz import fuzz

from ai_fallback import get_ai_response
from weather_service import get_weather
from time_service import get_time_from_timezone_db
from maps_service import get_distance
from location_service import get_current_location
from memory_reader import find_past_answer
from systems.system_router import execute_system_intent
from memory.memory_facts import detect_explicit_update

from chatHistory.chathistory import load, save, add_message
from memory.memory_facts import get_memory_summary
from utils.text_utils import normalize_text
from extractors.search_query_extractor import extract_search_query
from systems.system_actions import play_video, search_web, set_location_route
from config.location_keywords import LOCATION_KEYWORDS
from extractors.location_set_extractor import extract_location_set
from extractors.time_place_extractor import extract_time_place

# ==============================
# 🧠 PER-TAB MEMORY (IN-RAM)
# ==============================
TAB_MEMORY = {}

# =========
# memory
# =========
from memory.memory_facts import (
    learn_fact,
    get_fact,
    detect_fact_query,
    set_fact          # 👈 ADD THIS LINE
)

#===========
#memory remove
#============
from memory.memory_facts import (
    detect_fact_removal,
    detect_only_like
)

# ==============================
# LOAD ENV
# ==============================
load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("MONGO_DB")
COLLECTION_NAME = os.getenv("MONGO_COLLECTION")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
commands_col = db[COLLECTION_NAME]

OS_NAME = platform.system()

# ==============================
# 🔒 INTENT CACHE (LOAD ONCE)
# ==============================
COMMAND_CACHE = list(commands_col.find())

# ==============================
# 🔐 GUEST RESTRICTION
# ==============================
GUEST_ALLOWED_INTENTS = {
    "wake",
    "ai_fallback",
}

# ==============================
# 🔐 ROLE BASED ACCESS
# ==============================
AI_ONLY_INTENTS = {
    "wake",
    "weather",
    "time",
    "maps",
    "creator",
    "about_creator",
    "projects_of_creator",
    "ai_fallback",
    "current_time",
    "current_date",
}

SYSTEM_INTENTS = {
    "open_chrome",
    "open_vscode",
    "shutdown",
    "restart",
    "volume_up",
    "volume_down",
    "mute_volume",
    "screenshot",
    "cpu_usage",
    "ram_usage",
    "gpu_usage",
    "battery_status",
    "disk_space",
    "network_status",
    "open_explorer",
    "open_settings",
}
MEDIA_INTENTS = {
    "play_video",
    "search_web",
    "search_maps",   # 👈 NEW
}
# ==============================
# 🧠 SHORT-LIVED INTENT CONTEXT
# ==============================
def get_tab_context(chat_id):
    return TAB_MEMORY[chat_id]["context"]

def get_tab_messages(chat_id):
    return TAB_MEMORY[chat_id]["messages"]

# ==============================
# 🧠 CHEAP REASONING KEYWORDS
# ==============================
WEATHER_KEYWORDS = {"hot", "cold", "temperature", "weather"}
CPU_KEYWORDS = {"slow", "lag", "loud", "fan", "noise", "hang", "performance"}

# ==============================
# SPEECH (WINDOWS + LINUX)
# ==============================
def speak(text: str):
    print("🤖 Jarvis:", text)
    safe_text = text.replace('"', "'")

    if OS_NAME == "Windows":
        ps_script = f'''
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $synth.Rate = 0
        $synth.Volume = 100
        $synth.Speak("{safe_text}")
        '''
        import subprocess
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    else:
        import subprocess
        subprocess.run([
            "espeak",
            "-v", "en-us",
            "-s", "145",
            "-a", "180",
            safe_text
        ])

def speak_async(text: str):
    threading.Thread(target=speak, args=(text,), daemon=True).start()
# ==============================
# FUZZY MATCH (CACHED)
# ==============================
def find_intent(command: str):
    command = normalize_text(command)
    best_intent, best_score = None, 0

    for doc in COMMAND_CACHE:
        for pattern in doc.get("patterns", []):
            score = (
                fuzz.token_set_ratio(command, pattern) * 0.5 +
                fuzz.partial_ratio(command, pattern) * 0.3 +
                fuzz.ratio(command, pattern) * 0.2
            )
            if score > best_score:
                best_score = score
                best_intent = doc["intent"]

    return (best_intent, int(best_score)) if best_score >= 70 else (None, int(best_score))

# ==============================
# IDENTITY
# ==============================
IDENTITY_PHRASES = [
    "what is my name",
    "tell me my name",
    "who am i",
    "do you know my name",
    "say my name"
]

def is_identity_query(text: str) -> bool:
    text = normalize_text(text)
    for phrase in IDENTITY_PHRASES:
        score = (
            fuzz.token_set_ratio(text, phrase) * 0.6 +
            fuzz.partial_ratio(text, phrase) * 0.4
        )
        if score >= 70:
            return True
    return False
def force_language_guard(raw: str, chat_id: str) -> bool:
    if chat_id not in TAB_MEMORY:
        return False

    ctx = TAB_MEMORY[chat_id]["context"]

    return (
        ctx.get("topic") == "coding"
        and ctx.get("language") is not None
        and any(k in raw for k in ["code", "reverse", "palindrome", "search", "sort"])
    )

# ==============================
# CHEAP REASONING
# ==============================
def cheap_reasoning(raw: str):
    response_parts = []

    if any(word in raw for word in WEATHER_KEYWORDS):
        try:
            location = get_current_location()
            weather = get_weather(location)
            response_parts.append(weather)
        except:
            pass

    return " ".join(response_parts) if response_parts else None


# ==============================
# volume helper
# ==============================
def extract_number(text: str, default: int = 10) -> int:
    match = re.search(r"\b(\d+)\b", text)
    if match:
        return int(match.group(1))
    return default

# ==============================
# COMMAND DETECTION
# ==============================
def is_command(text: str) -> bool:
    words = text.split()
    return bool(words) and words[0] in COMMAND_VERBS


def detect_topic(text: str):
    if any(k in text for k in ["code", "program", "algorithm", "java", "python", "c++"]):
        return "coding"
    if any(k in text for k in ["travel", "trip", "visit", "place", "go"]):
        return "travel"
    if any(k in text for k in ["learn", "study", "explain", "what is", "how does"]):
        return "learning"
    return None

# ==============================
# HELPERS
# ==============================
def detect_language_switch(raw: str):
    LANG_MAP = {
        "java": "java",
        "python": "python",
        "py": "python",
        "c++": "c++",
        "cpp": "c++"
    }

    match = re.search(
        r"(change|convert|rewrite|give|now).*?\b(java|python|py|c\+\+|cpp)\b",
        raw
    )

    if match:
        return LANG_MAP[match.group(2)]
    return None


def detect_focus_switch(raw: str):
    DESTINATIONS = {
        "north india": "north india",
        "south india": "south india",
        "usa": "usa",
        "united states": "usa",
        "america": "usa",
        "india": "india"
    }
    for k, v in DESTINATIONS.items():
        if k in raw:
            return v
    return None


# ==============================
# COMMAND ROUTER (FINAL — CORRECT)
# ==============================
def handle_command(
    command,
    user_role="guest",
    user_name=None,
    chat_id=None,
    silent: bool = False
):

    # ==============================
    # INIT PER-TAB MEMORY
    # ==============================
    if chat_id not in TAB_MEMORY:
        TAB_MEMORY[chat_id] = {
            "messages": [],
            "context": {
                "topic": None,
                "language": None,
                "language_locked": False,
                "focus": None
            }
        }

    raw = command.strip().lower()
    ctx = TAB_MEMORY[chat_id]["context"]

    # ==============================
    # 🔁 EXPLICIT LANGUAGE SWITCH (ALWAYS OVERRIDES)
    # ==============================
    new_lang = detect_language_switch(raw)
    if new_lang:
        ctx["topic"] = "coding"
        ctx["language"] = new_lang
        ctx["language_locked"] = False   # 🔓 UNLOCK

        return {
            "reply": f"Okay 👍 Switching code to {new_lang}.",
            "intent": "language_switch",
            "confidence": 100
        }

    # ==============================
    # 🔒 PERMANENT LANGUAGE LOCK
    # ==============================
    if "all code" in raw or "all codes" in raw:
        match = re.search(r"(java|python|c\+\+|cpp)", raw)
        if match:
            lang = match.group(1)
            lang = "c++" if lang == "cpp" else lang

            ctx["topic"] = "coding"
            ctx["language"] = lang
            ctx["language_locked"] = True   # 🔒 LOCK

            return {
                "reply": f"Got it 👍 All code will be in {lang} for this tab.",
                "intent": "language_lock",
                "confidence": 100
            }

    # ==============================
    # 🧭 FOCUS SWITCH (TRAVEL / CHAT)
    # ==============================
    focus = detect_focus_switch(raw)
    if focus:
        ctx["focus"] = focus
        ctx["topic"] = "travel"

    # ==============================
    # 🔇 WINDOW TAB RESTRICTIONS
    # ==============================
    if silent:
        if is_identity_query(raw):
            return {
                "reply": "This information is only available in the main window.",
                "intent": "blocked",
                "confidence": 100
            }

        detected_intent, _ = find_intent(command)
        if detected_intent in SYSTEM_INTENTS:
            return {
                "reply": "System commands are disabled here.",
                "intent": "blocked",
                "confidence": 100
            }

        media_intent, _ = extract_search_query(raw)
        if media_intent in MEDIA_INTENTS:
            return {
                "reply": "Media commands are disabled here.",
                "intent": "blocked",
                "confidence": 100
            }

        # ==============================
        # ✅ AI RESPONSE (SMART)
        # ==============================
        topic = ctx.get("topic")
        language = ctx.get("language")
        locked = ctx.get("language_locked")
        focus = ctx.get("focus")

        intent_context = None

        # 🔒 STRICT ONLY IF LOCKED
        if topic == "coding" and language and locked:
            intent_context = (
                f"You MUST return code ONLY in {language}.\n"
                "DO NOT change language unless user explicitly asks.\n"
                "DO NOT explain unless asked.\n"
            )

        memory_summary = ""
        if focus:
            memory_summary = (
                f"The user is currently talking about {focus}.\n"
                "If they say 'there', it refers to this.\n"
                "Stay on this topic.\n"
            )

        response = get_ai_response(
            user_command=command,
            memory_summary=memory_summary,
            intent_context=intent_context
        )

        return {
            "reply": response,
            "intent": "ai_window",
            "confidence": 100
        }

        # # ==============================
        # # 🧠 CONTEXT-AWARE AI RESPONSE
        # # ==============================
        # topic = ctx.get("topic")
        # language = ctx.get("language")
        # focus = ctx.get("focus")

        # intent_context = None

        # # 🔐 HARD CODING ENFORCEMENT
        # if topic == "coding" and language:
        #     intent_context = (
        #         f"You are a STRICT programming assistant.\n"
        #         f"You MUST return code ONLY in {language}.\n"
        #         "DO NOT switch languages.\n"
        #         "DO NOT explain unless explicitly asked.\n"
        #     )

        # # 🌍 TRAVEL / GENERAL GROUNDING
        # elif focus:
        #     intent_context = (
        #         f"The conversation context is: {focus}\n"
        #         "Answer strictly based on this context.\n"
        #         "Do NOT introduce unrelated places or topics.\n"
        #     )

        # memory_summary = (
        #     f"Conversation so far: {focus}\n"
        #     "Continue naturally."
        #     if focus else ""
        # )

        # response = get_ai_response(
        #     user_command=command,
        #     memory_summary=memory_summary,
        #     intent_context=intent_context
        # )

        # # Save messages per tab
        # TAB_MEMORY[chat_id]["messages"].append({"role": "user", "text": raw})
        # TAB_MEMORY[chat_id]["messages"].append({"role": "jarvis", "text": response})

        # return {
        #     "reply": response,
        #     "intent": "ai_window",
        #     "confidence": 100
        # }

   # ==============================
    # 🧑 NAME UPDATE (ADD THIS FIRST)
    # ==============================
    if user_name:
        match = re.search(r"my name is (.+)", raw)
        if match:
            new_name = match.group(1).strip().title()
            set_fact(user_name, "name", new_name)

            response = f"Nice to meet you, {new_name} 😊"

            # 🔇 Speak ONLY if not silent (main Jarvis only)
            if not silent:
                speak_async(response)

            return {
                "reply": response,
                "intent": "name_update",
                "confidence": 100
            }
    # ==============================
    # 0️⃣ IDENTITY QUERY (who am I?)
    # ==============================
    if user_name and is_identity_query(raw):
        name = get_fact(user_name, "name")
        response = f"You are {name}." if name else "I don’t know your name yet."
        if not silent:
            speak_async(response)
        return {
            "reply": response,
            "intent": "identity",
            "confidence": 100
        }

    # ==============================
    # 1️⃣ EXPLICIT FACT UPDATE
    # ==============================
    if user_name:
        explicit = detect_explicit_update(user_name, raw)
        if explicit:
            response = f"Okay 👍 I updated your {explicit['key']}."
            if not silent:
                speak_async(response)
            return {
                "reply": response,
                "intent": "fact_update",
                "confidence": 100
            }

    # ==============================
    # 🔁 ONLY LIKE (replace list)
    # ==============================
    if user_name:
        only = detect_only_like(user_name, raw)
        if only:
            response = f"Got it 👍 I’ll remember that you only like {only}."
            if not silent:
                speak_async(response)
            return {
                "reply": response,
                "intent": "fact_replace",
                "confidence": 100
            }

    # ==============================
    # 🗑️ FACT REMOVAL
    # ==============================
    if user_name:
        removal = detect_fact_removal(user_name, raw)
        if removal:
            response = f"Okay 👍 I removed {removal['value']} from your {removal['key']}."
            if not silent:
                speak_async(response)
            return {
                "reply": response,
                "intent": "fact_remove",
                "confidence": 100
            }

    # ==============================
    # 3️⃣ GREETING / WAKE
    # ==============================
    if raw in {"hi", "hey", "hello", "hey jarvis", "jarvis"}:
        response = "Yes. How can I help you?"
        if not silent:
            speak_async(response)
        return {
            "reply": response,
            "intent": "wake",
            "confidence": 100
        }

    # ==============================
    # 🚫 BLOCK SYSTEM COMMANDS ONLY (SAFE)
    # ==============================
    if is_command(raw):
        detected_intent, score = find_intent(command)

        if detected_intent in SYSTEM_INTENTS:
            response = "That action is not allowed here."
            if not silent:
                speak_async(response)
            return {
                "reply": response,
                "intent": "blocked_system",
                "confidence": score
            }



    # ==============================
    # FACT QUESTIONS (RECALL)
    # ==============================
    if user_name:
        fact_key = detect_fact_query(raw)
        if fact_key:
            value = get_fact(user_name, fact_key)
            if value:
                response = f"Your {fact_key} is {value}."
                if not silent:
                    speak_async(response)
                return {
                    "reply": response,
                    "intent": "fact_recall",
                    "confidence": 100
                }

    # ==============================
    # 📍 SET DEFAULT LOCATION
    # ==============================
    location_value = extract_location_set(raw)

    if location_value:
        if user_role == "guest":
            response = "Please log in to use location commands."
            if not silent:
                speak_async(response)
            return {
                "reply": response,
                "intent": "guest_restricted",
                "confidence": 100
            }

        set_fact(user_name, "default_location", location_value)
        set_location_route(location_value)

        response = f"Okay 👍 I’ve set your location to {location_value.title()}."
        if not silent:
            speak_async(response)

        return {
            "reply": response,
            "intent": "set_location",
            "confidence": 100
        }

    # ==============================
    # ⏰ TIME BY LOCATION
    # ==============================
    place = extract_time_place(raw)

    if place:
        response = get_time_from_timezone_db(place)
        if not silent:
            speak_async(response)
        return {
            "reply": response,
            "intent": "time_place",
            "confidence": 100
        }
# ==============================
# 🎥 MEDIA COMMAND HANDLER
# ==============================
    media_intent, query = (None, None)

    # ✅ Detect media intent ONLY if it is a real command
    if is_command(raw):
        media_intent, query = extract_search_query(raw)

    raw_words = set(raw.split())

    # ✅ LOCATION keywords should ALSO respect command intent
    if is_command(raw) and (raw_words & LOCATION_KEYWORDS):
        media_intent = "search_maps"
        saved_location = get_fact(user_name, "default_location") if user_name else None
        clean_query = raw.replace("search", "").strip()
        query = f"{clean_query} near {saved_location}" if saved_location else clean_query

    # ✅ Execute media intent if valid
    if media_intent in MEDIA_INTENTS:

     
        if user_role == "guest":
            response = "Please log in to use media commands."
            if not silent:
                speak_async(response)
            return {
                "reply": response,
                "intent": "guest_restricted",
                "confidence": 100
            }

        if not query:
            response = "What should I search for?"
            if not silent:
                speak_async(response)
            return {
                "reply": response,
                "intent": "media_missing_query",
                "confidence": 100
            }

        if media_intent == "play_video":
            response = play_video(query)
        elif media_intent == "search_web":
            response = search_web(query)
        elif media_intent == "search_maps":
            response = search_maps(query)

        if not silent:
            speak_async(response)

        return {
            "reply": response,
            "intent": media_intent,
            "confidence": 100
        }

# ==============================
# SYSTEM COMMANDS
# ==============================
    detected_intent, score = find_intent(command)

    if detected_intent in SYSTEM_INTENTS:

       
        if user_role == "guest":
            response = "Please log in to use system commands."
            if not silent:
                speak_async(response)
            return {
                "reply": response,
                "intent": "guest_restricted",
                "confidence": score
            }

        response = (
            execute_system_intent(detected_intent, extract_number(command))
            if detected_intent in {"volume_up", "volume_down"}
            else execute_system_intent(detected_intent)
        )

        if not silent:
            speak_async(response)

        return {
            "reply": response,
            "intent": detected_intent,
            "confidence": score
        }

   # ==============================
# ⚡ CHEAP REASONING (BEFORE AI)
# ==============================
    cheap = cheap_reasoning(raw)
    if cheap:
        if not silent:
            speak_async(cheap)
        return {
            "reply": cheap,
            "intent": "cheap_reasoning",
            "confidence": 80
        }
# ==============================
# 🧠 PER-TAB CONTEXTUAL HANDLER
# ==============================
    tab_ctx = TAB_MEMORY[chat_id]["context"]

    topic = detect_topic(raw)

    # ✅ Set topic per tab
    if topic:
        tab_ctx["topic"] = topic

    # ✅ Lock programming language per tab
    if tab_ctx["topic"] == "coding":
        if "java" in raw:
            tab_ctx["language"] = "java"
        elif "python" in raw:
            tab_ctx["language"] = "python"
        elif "c++" in raw or "cpp" in raw:
            tab_ctx["language"] = "c++"

    # ✅ Use per-tab context for AI
    if tab_ctx["topic"] and (topic or len(raw.split()) <= 3):

        language = tab_ctx.get("language")
        topic = tab_ctx.get("topic")

        intent_context = (
            f"Current conversation topic: {topic}.\n"
            f"Programming language: {language or 'not specified'}.\n"
            "If a programming language is specified, ALL code MUST be in that language.\n"
            "Do NOT switch languages.\n"
            "Do NOT ask again for the programming language.\n"
            "Provide only the requested code unless explanation is explicitly asked.\n"
            "Continue the conversation naturally."
        )

        response = get_ai_response(
            user_command=raw,
            memory_summary=get_memory_summary(user_name) if user_name else "",
            intent_context=intent_context
        )

        # 🔒 Save to tab memory
        TAB_MEMORY[chat_id]["messages"].append({
            "role": "user",
            "text": raw
        })
        TAB_MEMORY[chat_id]["messages"].append({
            "role": "jarvis",
            "text": response
        })

        if not silent:
            speak_async(response)

        return {
            "reply": response,
            "intent": "contextual_ai",
            "confidence": 100
        }


# ==============================
# AI / MEMORY FALLBACK (LANGUAGE SAFE)
# ==============================

    ctx = TAB_MEMORY[chat_id]["context"]
    language = ctx.get("language")
    topic = ctx.get("topic")

    intent_context = None

    if topic == "coding" and language:
        intent_context = (
            "Programming task is active.\n"
            f"Programming language is {language}.\n"
            "ALL code MUST be written in that language.\n"
            "Do NOT switch languages.\n"
            "Do NOT ask for the programming language again.\n"
            "Provide only code unless explanation is explicitly asked."
        )

    response = get_ai_response(
        user_command=raw,
        memory_summary=get_memory_summary(user_name) if user_name else "",
        intent_context=intent_context
    )

    # save per-tab memory
    TAB_MEMORY[chat_id]["messages"].append({
        "role": "user",
        "text": raw
    })
    TAB_MEMORY[chat_id]["messages"].append({
        "role": "jarvis",
        "text": response
    })

    if not silent:
        speak_async(response)

    return {
        "reply": response,
        "intent": "ai_fallback",
        "confidence": 0
    }
