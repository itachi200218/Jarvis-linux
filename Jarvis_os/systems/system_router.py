# systems/system_router.py
from .system_actions import *

SYSTEM_ACTIONS = {
    "open_chrome": open_chrome,
    "open_vscode": open_vscode,
    "shutdown": shutdown_system,
    "restart": restart_system,
    "volume_up": increase_volume,
    "volume_down": decrease_volume,
    "mute_volume": mute_volume,
    "screenshot": take_screenshot,
    "open_explorer": open_explorer,
    "open_settings": open_settings,

    "cpu_usage": cpu_usage,
    "ram_usage": ram_usage,
    "battery_status": battery_status,
    "disk_space": disk_space,
    "network_status": network_status,
    "gpu_usage": gpu_usage,
}

def execute_system_intent(intent: str, *args) -> str:
    """
    Executes system command based on intent.
    Returns a spoken-friendly response.
    """
    action = SYSTEM_ACTIONS.get(intent)

    if not action:
        return "System command not found."

    try:
        return action(*args)
    except Exception as e:
        print("❌ SYSTEM ACTION ERROR:", e)
        return "Failed to execute system command."
