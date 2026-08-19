# ai_fallback.py

import os
import requests
from dotenv import load_dotenv
from typing import Optional

# Load environment variables
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
    """
    Detect generic/unhelpful AI responses.
    """
    text = text.lower()
    return any(pattern in text for pattern in BAD_AI_PATTERNS)


def get_ai_response(
    user_command: str,
    memory_summary: str = "",
    intent_context: Optional[str] = None,
) -> str:
    """
    AI fallback responder.

    Rules:
    - Memory is READ-ONLY
    - Intent context is SHORT-LIVED
    - AI continues the active task when context exists
    - Bad AI responses are discarded
    - Detailed API errors are logged for debugging
    """

    # -----------------------------
    # Validate API key
    # -----------------------------
    if not OPENROUTER_API_KEY:
        print("🔥 AI ERROR: OPENROUTER_API_KEY is not configured.")
        return CONFIG_ERROR_MSG

    try:

        # -----------------------------
        # System prompt
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

        # -----------------------------
        # OpenRouter request payload
        # -----------------------------
        payload = {
            "model": "openai/gpt-3.5-turbo",
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_command.strip(),
                },
            ],
            "temperature": 0.6,

            # Keep token usage below current OpenRouter credit limit
            "max_tokens": 2000,
        }

        # -----------------------------
        # API request
        # -----------------------------
        response = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )

        # -----------------------------
        # Debug non-200 responses
        # -----------------------------
        if response.status_code != 200:

            print("\n" + "=" * 60)
            print("🔥 OPENROUTER API ERROR")
            print("=" * 60)
            print("Status Code:", response.status_code)
            print("Response:", response.text)
            print("=" * 60 + "\n")

            return NETWORK_ERROR_MSG

        # -----------------------------
        # Parse JSON response
        # -----------------------------
        try:
            data = response.json()

        except ValueError as e:
            print("\n🔥 AI JSON ERROR:", repr(e))
            print("🔥 Raw Response:", response.text)
            return NETWORK_ERROR_MSG

        # -----------------------------
        # Extract AI content
        # -----------------------------
        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )

        # -----------------------------
        # Debug empty response
        # -----------------------------
        if not content:

            print("\n" + "=" * 60)
            print("🔥 AI EMPTY RESPONSE")
            print("=" * 60)
            print("OpenRouter Response:", data)
            print("=" * 60 + "\n")

            return EMPTY_RESPONSE_MSG

        # -----------------------------
        # Validate response length
        # -----------------------------
        if len(content) < 4:
            print("🔥 AI response too short:", repr(content))
            return EMPTY_RESPONSE_MSG

        # -----------------------------
        # Reject bad AI responses
        # -----------------------------
        if _is_bad_ai_response(content):
            print("⚠️ Bad AI response discarded:", repr(content))
            return EMPTY_RESPONSE_MSG

        # -----------------------------
        # Successful response
        # -----------------------------
        print("🤖 JARVIS AI response received successfully.")

        return content

    # -----------------------------
    # Timeout
    # -----------------------------
    except requests.exceptions.Timeout as e:

        print("\n" + "=" * 60)
        print("🔥 OPENROUTER TIMEOUT")
        print("=" * 60)
        print(repr(e))
        print("=" * 60 + "\n")

        return NETWORK_ERROR_MSG

    # -----------------------------
    # Connection error
    # -----------------------------
    except requests.exceptions.ConnectionError as e:

        print("\n" + "=" * 60)
        print("🔥 OPENROUTER CONNECTION ERROR")
        print("=" * 60)
        print(repr(e))
        print("=" * 60 + "\n")

        return NETWORK_ERROR_MSG

    # -----------------------------
    # Other request errors
    # -----------------------------
    except requests.exceptions.RequestException as e:

        print("\n" + "=" * 60)
        print("🔥 OPENROUTER REQUEST ERROR")
        print("=" * 60)
        print(repr(e))
        print("=" * 60 + "\n")

        return NETWORK_ERROR_MSG

    # -----------------------------
    # Unexpected exception
    # -----------------------------
    except Exception as e:

        print("\n" + "=" * 60)
        print("🔥 UNEXPECTED AI ERROR")
        print("=" * 60)
        print("Error Type:", type(e).__name__)
        print("Error:", repr(e))
        print("=" * 60 + "\n")

        return NETWORK_ERROR_MSG