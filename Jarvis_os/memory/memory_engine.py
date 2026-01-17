# import re
# from rapidfuzz import fuzz
# from chatHistory.chathistory import load, save

# # ==============================
# # SMART LEARNING RULES
# # ==============================
# LEARN_RULES = [
#     # profile
#     (r"my name is (.+)", "name"),
#     (r"my age is (\d+)", "age"),
#     (r"i live in (.+)", "location"),
#     (r"i stay at (.+)", "location"),
#     (r"i am from (.+)", "location"),

#     # role / identity
#     (r"i am a (.+)", "role"),
#     (r"i am an (.+)", "role"),

#     # preferences
#     (r"i like (.+)", "likes"),
#     (r"i love (.+)", "likes"),
#     (r"i hate (.+)", "dislikes"),
# ]

# # ==============================
# # UPSERT FACT
# # ==============================
# def upsert_fact(chats, key, value):
#     chats[0].setdefault("facts", [])

#     for fact in chats[0]["facts"]:
#         if fact["key"] == key:
#             fact["value"] = value
#             return "updated"

#     chats[0]["facts"].append({
#         "type": "profile",
#         "key": key,
#         "value": value
#     })
#     return "added"

# # ==============================
# # LEARN FACT
# # ==============================
# def learn_fact(user_name: str, text: str):
#     text = text.lower().strip()
#     chats = load(user_name)

#     if not chats:
#         return None, None, None

#     for pattern, key in LEARN_RULES:
#         match = re.search(pattern, text)
#         if match:
#             value = match.group(1).strip().title()
#             action = upsert_fact(chats, key, value)
#             save(user_name, chats)
#             return key, value, action

#     return None, None, None

# # ==============================
# # ANSWER FACT QUESTION
# # ==============================
# def get_fact(user_name: str, question: str):
#     chats = load(user_name)
#     question = question.lower()

#     best_score = 0
#     best_value = None

#     for convo in chats:
#         for fact in convo.get("facts", []):
#             score = fuzz.partial_ratio(question, fact["key"])
#             if score > best_score and score >= 70:
#                 best_score = score
#                 best_value = fact["value"]

#     return best_value

# # ==============================
# # ABOUT MYSELF
# # ==============================
# def get_profile_summary(user_name: str):
#     chats = load(user_name)
#     profile = {}

#     for convo in chats:
#         for fact in convo.get("facts", []):
#             profile[fact["key"]] = fact["value"]

#     return profile
