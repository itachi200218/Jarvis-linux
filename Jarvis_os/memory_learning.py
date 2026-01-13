from chatHistory.chathistory import load

def get_learned_fact(user_name, key):
    chats = load(user_name)

    # search newest first (latest fact wins)
    for convo in reversed(chats):
        for fact in convo.get("facts", []):
            if fact.get("key") == key:
                return fact.get("value")

    return None
