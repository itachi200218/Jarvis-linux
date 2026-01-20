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
# FUZZY MATCH
# ==============================
def find_intent(command: str):
    command = normalize_text(command)
    best_intent, best_score = None, 0

    for doc in commands_col.find():
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
# COMMAND ROUTER (FINAL)
# ==============================
def handle_command(command, user_role="guest", user_name=None, chat_id=None):

    raw = command.strip().lower()
    intent = "unknown"
    confidence = 0
    response = "I am not sure."
   # ==============================
    # 🧑 NAME UPDATE (ADD THIS FIRST)
    # ==============================
    if user_name:
        match = re.search(r"my name is (.+)", raw)
        if match:
            new_name = match.group(1).strip().title()
            set_fact(user_name, "name", new_name)

            response = f"Nice to meet you, {new_name} 😊"
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
            speak_async(response)
            return {
                "reply": response,
                "intent": "fact_update",
                "confidence": 100
            }
        
# ==============================
# 🔁 ONLY LIKE (replace list)  ← MOVE HERE
# ==============================
    if user_name:
        only = detect_only_like(user_name, raw)
        if only:
            response = f"Got it 👍 I’ll remember that you only like {only}."
            speak_async(response)
            return {
                "reply": response,
                "intent": "fact_replace",
                "confidence": 100
            }

    # ==============================
    # 🗑️ FACT REMOVAL (likes / dislikes) ← MOVE HERE
    # ==============================
    if user_name:
        removal = detect_fact_removal(user_name, raw)
        if removal:
            response = f"Okay 👍 I removed {removal['value']} from your {removal['key']}."
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
        speak_async(response)
        return {
            "reply": response,
            "intent": "wake",
            "confidence": 100
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
                speak_async(response)
                return {
                    "reply": response,
                    "intent": "fact_recall",
                    "confidence": 100
                }
            # ❌ no else → fall through
# ==============================
# 📍 SET DEFAULT LOCATION
# ==============================
    location_value = extract_location_set(raw)

    if location_value:
        # 🚫 GUEST BLOCK
        if user_role == "guest":
            response = "Please log in to use location commands."
            speak_async(response)
            return {
                "reply": response,
                "intent": "guest_restricted",
                "confidence": 100
            }

        # ✅ LOGGED-IN USER
        set_fact(user_name, "default_location", location_value)

        # 🔥 OPEN MAPS IN ROUTE MODE
        set_location_route(location_value)

        response = f"Okay 👍 I’ve set your location to {location_value.title()}."
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
        speak_async(response)
        return {
            "reply": response,
            "intent": "time_place",
            "confidence": 100
        }

# ==============================
# 🎥 MEDIA COMMAND HANDLER (EARLY) ✅
# ==============================
    media_intent, query = extract_search_query(raw)

    # 🔥 FORCE MAPS FOR LOCATION QUERIES
 # 🔥 FORCE MAPS FOR LOCATION QUERIES
    raw_words = set(raw.split())

    if raw_words & LOCATION_KEYWORDS:

        media_intent = "search_maps"

        saved_location = None
        if user_name:
            saved_location = get_fact(user_name, "default_location")

        clean_query = raw.replace("search", "").strip()

        if saved_location:
            query = f"{clean_query} near {saved_location}"
        else:
            query = clean_query

    if media_intent in MEDIA_INTENTS:
        if user_role == "guest":
            response = "Please log in to use media commands."
            speak_async(response)
            return {
                "reply": response,
                "intent": "guest_restricted",
                "confidence": 100
            }

        if not query:
            response = "What should I search for?"
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

        speak_async(response)
        return {
            "reply": response,
            "intent": media_intent,
            "confidence": 100
        }

# ==============================
# INTENT DETECTION (ONCE)
# ==============================
    detected_intent, score = find_intent(command)
    # ==============================
    # 4️⃣ SYSTEM COMMAND HANDLER
    # ==============================
  

    if detected_intent in SYSTEM_INTENTS:
        if user_role == "guest":
            response = "Please log in to use system commands."
            speak_async(response)
            return {
                "reply": response,
                "intent": "guest_restricted",
                "confidence": score
            }

        if detected_intent in {"volume_up", "volume_down"}:
            steps = extract_number(command, default=10)
            response = execute_system_intent(detected_intent, steps)
        else:
            response = execute_system_intent(detected_intent)

        speak_async(response)
        return {
            "reply": response,
            "intent": detected_intent,
            "confidence": score
        }

     # ==============================
# SILENT LEARNING (EARLY) ✅
# ==============================
    if user_name:
        learn_fact(user_name, raw)

# ==============================
# 6️⃣ MEMORY / AI FALLBACK (FINAL)
# ==============================
    past_chats = load(user_name) if user_name else []
    past_answer, past_confidence = find_past_answer(past_chats, command)

    BAD_ANSWERS = {
        "I am not sure.",
        "I don't know.",
        "Sorry, I can't help with that."
    }

    if past_answer and past_confidence >= 80 and past_answer not in BAD_ANSWERS:
        response = past_answer
        intent = "memory_recall"
        confidence = past_confidence
    else:
        memory_summary = get_memory_summary(user_name) if user_name else ""
        response = get_ai_response(command, memory_summary)
        intent = "ai_fallback"
        confidence = 0

    # ==============================
    # SAVE CHAT
    # ==============================
    if user_role == "user" and user_name and chat_id:
        add_message(chat_id, user_name, "user", command)
        add_message(chat_id, user_name, "jarvis", response)

    speak_async(response)
    return {
        "reply": response,
        "intent": intent,
        "confidence": confidence
    }
