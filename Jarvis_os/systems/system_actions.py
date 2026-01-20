# system_actions.py
import os
import psutil
import subprocess
import socket
import shutil
import pyautogui
import platform
import webbrowser
import urllib.parse
from datetime import datetime
import webbrowser
import urllib.parse
OS_NAME = platform.system()

# ==============================
# SYSTEM ACTIONS (DO ONLY)
# ==============================

def open_chrome():
    if OS_NAME == "Windows":
        subprocess.Popen(["cmd", "/c", "start", "chrome"])
    elif OS_NAME == "Linux":
        webbrowser.open("https://www.google.com")
    elif OS_NAME == "Darwin":
        subprocess.Popen(["open", "-a", "Google Chrome"])
    return "Opening Chrome."

def open_vscode():
    subprocess.Popen(["code"])
    return "Opening Visual Studio Code."

def shutdown_system():
    if OS_NAME == "Windows":
        subprocess.Popen(["shutdown", "/s", "/t", "5"])
    elif OS_NAME == "Linux":
        subprocess.Popen(["shutdown", "-h", "now"], stderr=subprocess.DEVNULL)
    return "Shutting down the system."

def restart_system():
    if OS_NAME == "Windows":
        subprocess.Popen(["shutdown", "/r", "/t", "5"])
    elif OS_NAME == "Linux":
        subprocess.Popen(["reboot"], stderr=subprocess.DEVNULL)
    return "Restarting the system."

def increase_volume(steps: int = 10):
    for _ in range(steps):
        pyautogui.press("volumeup")
    return f"Volume increased by {steps}."

def decrease_volume(steps: int = 10):
    for _ in range(steps):
        pyautogui.press("volumedown")
    return f"Volume decreased by {steps}."

def mute_volume():
    pyautogui.press("volumemute")
    return "Volume muted."

def take_screenshot():
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    path = os.path.join(desktop, "Jarvis", "Screenshots")
    os.makedirs(path, exist_ok=True)

    filename = f"jarvis_screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    full_path = os.path.join(path, filename)

    pyautogui.screenshot(full_path)
    return f"Screenshot saved at {full_path}"

def open_explorer():
    if OS_NAME == "Windows":
        subprocess.Popen(["explorer"])
    elif OS_NAME == "Linux":
        subprocess.Popen(["xdg-open", os.path.expanduser("~")])
    elif OS_NAME == "Darwin":
        subprocess.Popen(["open", os.path.expanduser("~")])
    return "Opening file explorer."

def open_settings():
    if OS_NAME == "Windows":
        subprocess.Popen(["cmd", "/c", "start", "ms-settings:"])
        return "Opening system settings."
    return "Settings not supported on this OS."

# ==============================
# MEDIA / WEB ACTIONS (NEW)
# ==============================

def play_video(query: str):
    """
    Intelligent music/video handler for desktop.

    Behavior:
    - "play music" → YouTube home
    - "play some song" → YouTube home
    - "play nenu nuvvantu" → YouTube search (high relevance)
    """

    query = query.lower().strip()

    # 🎯 Generic music requests
    GENERIC_REQUESTS = {
        "", "music", "song", "songs",
        "some music", "some song",
        "anything", "something", "random"
    }

    # 🧹 Remove filler words
    FILLER_WORDS = {
        "play", "song", "songs", "music",
        "video", "videos", "please", "for"
    }

    # Normalize query
    words = [w for w in query.split() if w not in FILLER_WORDS]
    clean_query = " ".join(words)

    # 🎧 Generic request → YouTube home
    if not clean_query or clean_query in GENERIC_REQUESTS:
        webbrowser.open("https://www.youtube.com")
        return "Playing some music."

    # 🎵 Specific song → improve first result relevance
    smart_query = f"{clean_query} official audio"

    q = urllib.parse.quote(smart_query)
    url = f"https://www.youtube.com/results?search_query={q}"
    webbrowser.open(url)

    return f"Playing {clean_query}."

def search_web(query: str):
    """
    Google search using default browser.
    """
    q = urllib.parse.quote(query)
    url = f"https://www.google.com/search?q={q}"
    webbrowser.open(url)
    return f"Searching web for {query}."
def set_location_route(destination: str):
    dest = urllib.parse.quote(destination)
    url = f"https://www.google.com/maps/dir/?api=1&destination={dest}"
    webbrowser.open(url)
    return f"Setting route to {destination}."
# ==============================
# SYSTEM INFO (READ ONLY)
# ==============================

def cpu_usage():
    return f"CPU usage is {psutil.cpu_percent(interval=1)} percent."

def ram_usage():
    r = psutil.virtual_memory()
    return f"You are using {round(r.used / 1e9, 2)} GB out of {round(r.total / 1e9, 2)} GB."

def battery_status():
    b = psutil.sensors_battery()
    if b:
        return f"Battery level is {b.percent} percent."
    return "Battery information unavailable."

def disk_space():
    t, _, f = shutil.disk_usage("/")
    return f"{round(f / 1e9, 2)} GB free out of {round(t / 1e9, 2)} GB."

def network_status():
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=2)
        return "Internet is connected."
    except:
        return "No internet connection."

def gpu_usage():
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=utilization.gpu",
             "--format=csv,noheader,nounits"]
        )
        return f"GPU usage is {out.decode().strip()} percent."
    except:
        return "GPU usage information is unavailable."
