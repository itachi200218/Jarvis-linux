# ai_fallback.py
import os
import requests
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

CONFIG_ERROR_MSG = "My AI brain is not configured."
NETWORK_ERROR_MSG = "I encountered an issue accessing my AI intelligence."
EMPTY_RESPONSE_MSG = "I need a moment to think."


def get_ai_response(user_command: str, memory_summary: str = "") -> str:
    """
    AI fallback responder.
    Memory is injected as READ-ONLY context.
    AI must NEVER write memory.
    """

    if not OPENROUTER_API_KEY:
        return CONFIG_ERROR_MSG

    try:
        system_prompt = (
            "You are Jarvis, a calm, confident, intelligent assistant. "
            "Respond naturally and clearly. "
            "Never invent personal facts. "
            "If unsure, ask for clarification."
        )

        if memory_summary:
            system_prompt += (
                "\n\nKnown user facts (read-only):\n"
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

        if not content or len(content) < 4:
            return EMPTY_RESPONSE_MSG

        return content

    except Exception:
        return NETWORK_ERROR_MSG
