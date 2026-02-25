import re

def extract_time_place(text: str):
    patterns = [
        r"time in (.+)",
        r"time at (.+)",
        r"current time in (.+)",
        r"what is the time in (.+)",
        r"time of (.+)"
    ]

    text = text.lower().strip()

    for p in patterns:
        m = re.search(p, text)
        if m:
            return m.group(1).strip()

    return None
