# system_actions.py
import os
import psutil
import subprocess
import socket
import shutil
import pyautogui
import platform
from datetime import datetime

OS_NAME = platform.system()

# ==============================
# SYSTEM ACTIONS
# ==============================

def open_chrome():
    if OS_NAME == "Windows":
        subprocess.Popen("start chrome", shell=True)
    else:
        subprocess.Popen(["google-chrome"])
    return "Opening Chrome."

def open_vscode():
    subprocess.Popen(["code"])
    return "Opening Visual Studio Code."

def shutdown_system():
    if OS_NAME == "Windows":
        subprocess.Popen("shutdown /s /t 5", shell=True)
    else:
        subprocess.Popen(["shutdown", "-h", "now"])
    return "Shutting down the system."

def restart_system():
    if OS_NAME == "Windows":
        subprocess.Popen("shutdown /r /t 5", shell=True)
    else:
        subprocess.Popen(["reboot"])
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

    file = f"jarvis_screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    full_path = os.path.join(path, file)

    if OS_NAME == "Windows":
        pyautogui.screenshot(full_path)
    else:
        subprocess.run(["gnome-screenshot", "-f", full_path], check=True)

    return f"Screenshot saved at {full_path}"

def open_explorer():
    if OS_NAME == "Windows":
        subprocess.Popen("explorer", shell=True)
    else:
        subprocess.Popen(["xdg-open", os.path.expanduser("~")])
    return "Opening file explorer."

def open_settings():
    if OS_NAME == "Windows":
        subprocess.Popen("start ms-settings:", shell=True)
        return "Opening system settings."
    return "Settings not supported on this OS."

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
    if b:
        return f"Battery level is {b.percent} percent."
    return "Battery information unavailable."

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
