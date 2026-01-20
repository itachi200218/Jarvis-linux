import re

def extract_location_set(text: str):
    text = text.lower().strip()

    patterns = [
        # explicit set
        r"set location to (.+)",
        r"set my location to (.+)",
        r"change location to (.+)",
        r"update location to (.+)",

        # short / casual
        r"location to (.+)",
        r"location (.+)",

        # personal phrasing
        r"my location is (.+)",
        r"my location (.+)",

        # navigation-style language
        r"go to (.+)",
        r"move to (.+)",
        r"shift location to (.+)",

        # assignment style
        r"location = (.+)",
        r"location: (.+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()

    return None
