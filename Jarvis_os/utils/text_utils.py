# utils/text_utils.py
import re

POLITE_WORDS = {
    "please", "can", "could", "would",
    "you", "tell"
}

def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", "", text)

    words = text.split()
    words = [w for w in words if w not in POLITE_WORDS]

    return " ".join(words)
