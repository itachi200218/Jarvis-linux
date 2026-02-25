from rapidfuzz import fuzz

BAD_RESPONSES = {
    "something went wrong",
    "i encountered an issue accessing my ai intelligence"
}

def is_bad_response(text: str) -> bool:
    t = text.lower().strip()
    return any(bad in t for bad in BAD_RESPONSES)

def find_past_answer(chats, user_text, min_score=80):
    user_text = user_text.lower()
    best_answer = None
    best_score = 0

    for convo in reversed(chats):
        messages = convo.get("messages", [])

        for i in range(len(messages) - 1):
            u = messages[i]
            j = messages[i + 1]

            if u["role"] != "user" or j["role"] != "jarvis":
                continue

            if is_bad_response(j["text"]):
                continue  # 🚫 skip garbage memory

            score = fuzz.token_set_ratio(
                user_text, u["text"].lower()
            )

            if score > best_score:
                best_score = score
                best_answer = j["text"]

    if best_score >= min_score:
        return best_answer, best_score

    return None, 0
