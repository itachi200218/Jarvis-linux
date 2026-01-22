# ai_fallback.py
import os
import requests
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# -----------------------------
# Safe fallback messages
# -----------------------------
CONFIG_ERROR_MSG = "My AI brain is not configured."
NETWORK_ERROR_MSG = "I encountered an issue accessing my AI intelligence."
EMPTY_RESPONSE_MSG = "I need a moment to think."

# Responses that should NEVER be reused or stored
BAD_AI_PATTERNS = [
    "something went wrong",
    "i encountered an issue",
    "i am not sure",
    "i don't know",
    "please clarify",
]


def _is_bad_ai_response(text: str) -> bool:
    text = text.lower()
    return any(pattern in text for pattern in BAD_AI_PATTERNS)


def get_ai_response(
    user_command: str,
    memory_summary: str = "",
    intent_context: Optional[str] = None,
) -> str:
    """
    AI fallback responder (stateless but context-aware).

    Rules:
    - Memory is READ-ONLY
    - Intent context is SHORT-LIVED (not stored permanently)
    - AI must continue the active task if context exists
    - Bad AI responses are discarded
    """

    if not OPENROUTER_API_KEY:
        return CONFIG_ERROR_MSG

    try:
        # -----------------------------
        # System prompt (STRICT)
        # -----------------------------
        system_prompt = (
            "You are JARVIS, a calm, confident, intelligent assistant. "
            "You must respect the active task context if provided. "
            "If the user gives a short or partial reply, "
            "treat it as a continuation of the active request. "
            "Never invent personal facts. "
            "Never ask repeated clarification questions. "
            "Do not mention system internals."
        )

        # -----------------------------
        # Inject active intent context
        # -----------------------------
        if intent_context:
            system_prompt += (
                "\n\nActive task context (important, system-controlled):\n"
                f"{intent_context}"
            )

        # -----------------------------
        # Inject memory (read-only)
        # -----------------------------
        if memory_summary:
            system_prompt += (
                "\n\nKnown user facts (read-only, do NOT modify):\n"
                f"{memory_summary}"
            )

        payload = {
            "model": "openai/gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_command.strip()},
            ],
            "temperature": 0.6,
        }

        response = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )

        if response.status_code != 200:
            return NETWORK_ERROR_MSG

        data = response.json()

        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )

        # -----------------------------
        # Validate AI output
        # -----------------------------
        if not content or len(content) < 4:
            return EMPTY_RESPONSE_MSG

        if _is_bad_ai_response(content):
            return EMPTY_RESPONSE_MSG

        return content

    except Exception:
        return NETWORK_ERROR_MSG
