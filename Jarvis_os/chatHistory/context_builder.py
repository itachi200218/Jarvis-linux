from chatHistory.chathistory import load

def build_chat_context(user_id: str, chat_id: str, limit: int = 6) -> str:
    chats = load(user_id)

    for convo in chats:
        if convo["id"] == chat_id:
            messages = convo["messages"][-limit:]
            lines = []
            for m in messages:
                role = "User" if m["role"] == "user" else "Assistant"
                lines.append(f"{role}: {m['text']}")
            return "\n".join(lines)

    return ""
