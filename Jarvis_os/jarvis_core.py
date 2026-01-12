# jarvis_core.py
import os
import psutil
import subprocess
import socket
import shutil
import pyautogui
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

# ============
# chat history
# ============
from chatHistory.chathistory import add_message

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
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    else:
        subprocess.run([
            "espeak",
            "-v", "en-us",     # ⭐ BEST VOICE
            "-s", "145",       # speed (natural)
            "-a", "180",       # volume
            safe_text
        ])

def speak_async(text: str):
    threading.Thread(target=speak, args=(text,), daemon=True).start()

# ==============================
# NORMALIZE TEXT
# ==============================
STOP_WORDS = {
    "please", "can", "you", "tell", "me", "the",
    "a", "an", "is", "my", "what", "about"
}

def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    words = text.split()
    words = [w for w in words if w not in STOP_WORDS]
    return " ".join(words)

# ==============================
# SYSTEM ACTIONS (CROSS PLATFORM)
# ==============================
def open_chrome():
    if OS_NAME == "Windows":
        subprocess.Popen("start chrome", shell=True)
    else:
        subprocess.Popen(["google-chrome"])

def open_vscode():
    subprocess.Popen(["code"])

def shutdown_system():
    if OS_NAME == "Windows":
        subprocess.Popen("shutdown /s /t 5", shell=True)
    else:
        subprocess.Popen(["shutdown", "-h", "now"])

def restart_system():
    if OS_NAME == "Windows":
        subprocess.Popen("shutdown /r /t 5", shell=True)
    else:
        subprocess.Popen(["reboot"])

def increase_volume():
    for _ in range(10):
        pyautogui.press("volumeup")

def decrease_volume():
    for _ in range(10):
        pyautogui.press("volumedown")

def mute_volume():
    pyautogui.press("volumemute")

def take_screenshot():
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    path = os.path.join(desktop, "Jarvis", "Screenshots")
    os.makedirs(path, exist_ok=True)

    file = f"jarvis_screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    full = os.path.join(path, file)
    pyautogui.screenshot(full)
    return full

def open_explorer():
    if OS_NAME == "Windows":
        subprocess.Popen("explorer", shell=True)
    else:
        subprocess.Popen(["xdg-open", os.path.expanduser("~")])

def open_settings():
    if OS_NAME == "Windows":
        subprocess.Popen("start ms-settings:", shell=True)

# ==============================
# SYSTEM INFO
# ==============================
def cpu_usage():
    return f"CPU usage is {psutil.cpu_percent(interval=1)} percent."

def ram_usage():
    r = psutil.virtual_memory()
    return f"You are using {round(r.used/1e9,2)} GB out of {round(r.total/1e9,2)} GB."

def battery_status():
    b = psutil.sensors_battery()
    return f"Battery level is {b.percent} percent." if b else "Battery info unavailable."

def disk_space():
    t, _, f = shutil.disk_usage("/")
    return f"{round(f/1e9,2)} GB free out of {round(t/1e9,2)} GB."

def network_status():
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=2)
        return "Internet is connected."
    except:
        return "No internet connection."

def gpu_usage():
    try:
        out = subprocess.check_output(
            "nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits",
            shell=True
        )
        return f"GPU usage is {out.decode().strip()} percent."
    except:
        return "GPU usage information is unavailable."

def current_time():
    return datetime.now().strftime("The time is %I:%M %p.")

def current_date():
    return datetime.now().strftime("Today is %B %d, %Y.")

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

def cheap_reasoning(raw: str):
    response_parts = []

    if any(word in raw for word in WEATHER_KEYWORDS):
        try:
            location = get_current_location()
            weather = get_weather(location)
            response_parts.append(weather)
        except:
            pass

    if any(word in raw for word in CPU_KEYWORDS):
        response_parts.append(cpu_usage())

    return " ".join(response_parts) if response_parts else None

# ==============================
# COMMAND ROUTER
# ==============================
def handle_command(command, user_role="guest", user_name=None, chat_id=None):

    raw = command.strip().lower()
    intent = None
    confidence = 0
    response = "I am not sure."

    if is_identity_query(raw):
        response = f"Your name is {user_name}." if user_name else "You are currently using guest access."
        intent = "user_identity"
        confidence = 100

    elif raw in {"hello", "hey jarvis", "jarvis"}:
        response = "Yes. How can I help you?"
        intent = "wake"
        confidence = 100

    elif not raw:
        response = "I did not hear anything."

    else:
        smart_reply = cheap_reasoning(raw)

        if smart_reply:
            response = smart_reply
            intent = "context_reasoning"
            confidence = 90
        else:
            intent, confidence = find_intent(raw)

        if user_role == "guest" and intent in SYSTEM_INTENTS:
            response = "Guest access limited. Please sign in."

        elif intent == "open_chrome":
            open_chrome()
            response = "Opening Google Chrome."

        elif intent == "open_vscode":
            open_vscode()
            response = "Opening Visual Studio Code."

        elif intent == "shutdown":
            shutdown_system()
            response = "Shutting down the system."

        elif intent == "restart":
            restart_system()
            response = "Restarting the system."

        elif intent == "volume_up":
            increase_volume()
            response = "Increasing volume."

        elif intent == "volume_down":
            decrease_volume()
            response = "Decreasing volume."

        elif intent == "mute_volume":
            mute_volume()
            response = "Volume muted."

        elif intent == "current_time":
            response = current_time()

        elif intent == "current_date":
            response = current_date()

        else:
            response = get_ai_response(command)
            intent = "ai_fallback"
            confidence = 0

    if user_role == "user" and user_name and chat_id:
        add_message(chat_id, user_name, "user", command)
        add_message(chat_id, user_name, "jarvis", response)

    speak_async(response)

    return {
        "reply": response,
        "intent": intent,
        "confidence": confidence
    }
