from utils.text_utils import normalize_text

MAP_PHRASES = [
    "google maps",
    "maps",
    "map"
]

WEB_PHRASES = [
    "search",
    "find",
    "google"
]

VIDEO_PHRASES = [
    "play",
    "watch",
    "youtube"
]

FILLER_WORDS = {
    "for", "on", "in", "of", "the"
}


def extract_search_query(text: str):
    text = normalize_text(text)

    if not text:
        return None, None

    intent = None

    # --- INTENT DETECTION ---
    if any(p in text for p in MAP_PHRASES):
        intent = "search_maps"
    elif any(p in text for p in VIDEO_PHRASES):
        intent = "play_video"
    elif any(p in text for p in WEB_PHRASES):
        intent = "search_web"
    else:
        return None, None

    # --- REMOVE INTENT PHRASES ---
    for phrase in MAP_PHRASES + WEB_PHRASES + VIDEO_PHRASES:
        text = text.replace(phrase, "")

    # --- CLEAN LEFTOVER WORDS ---
    words = [
        w for w in text.split()
        if w not in FILLER_WORDS
    ]

    query = " ".join(words).strip()

    if not query:
        return intent, None

    return intent, query
