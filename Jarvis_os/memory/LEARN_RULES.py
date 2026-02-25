# ==============================
# 🧠 SMART LEARNING RULES (ADVANCED & SAFE)
# ==============================

LEARN_RULES = [

    # ─────────────────────────────
    # 👤 NAME (EXPLICIT ONLY)
    # ─────────────────────────────
    (r"\bmy name is ([a-zA-Z ]{2,})", "name"),
    (r"\bi am called ([a-zA-Z ]{2,})", "name"),
    (r"\bpeople call me ([a-zA-Z ]{2,})", "name"),

    # ─────────────────────────────
    # 🎂 AGE
    # ─────────────────────────────
    (r"\bmy age is (\d{1,3})", "age"),
    (r"\bi am (\d{1,3}) years? old", "age"),
    (r"\bage is (\d{1,3})", "age"),

    # ─────────────────────────────
    # 📍 LOCATION
    # ─────────────────────────────
    (r"\bi live in ([a-zA-Z ]{2,})", "location"),
    (r"\bi stay (?:in|at) ([a-zA-Z ]{2,})", "location"),
    (r"\bi am from ([a-zA-Z ]{2,})", "location"),
    (r"\bmy location is ([a-zA-Z ]{2,})", "location"),

    # ─────────────────────────────
    # 🎭 ROLE / PROFESSION (RESTRICTED)
    # ─────────────────────────────
    (r"\bi work as (.+)", "role"),
    (r"\bmy role is (.+)", "role"),
    (r"\bmy profession is (.+)", "role"),
    (r"\bi work in (.+)", "role"),
    (r"\bi am a[n]? (developer|engineer|student|designer|programmer|tester|analyst)", "role"),

  # ─────────────────────────────
# 🧑‍💻 SKILLS (MULTI-VALUE)
# ─────────────────────────────
(r"\bmy skills are (.+)", "skills"),
(r"\bmy skills include (.+)", "skills"),
(r"\bi have skills in (.+)", "skills"),
(r"\bi know (.+)", "skills"),
(r"\bi am skilled in (.+)", "skills"),
(r"\bi am learning (.+)", "skills"),

  # ─────────────────────────────
# 🛠️ TOOLS / TECHNOLOGY (MULTI-VALUE)
# ─────────────────────────────
(r"\bi use (.+)", "tools"),
(r"\bi work with (.+)", "tools"),
(r"\bi work on (.+)", "tools"),
(r"\btools i use are (.+)", "tools"),
(r"\bthe tools i use are (.+)", "tools"),
(r"\bmy tools are (.+)", "tools"),
(r"\bmy primary tools are (.+)", "tools"),
(r"\bi am familiar with (.+)", "tools"),
(r"\bi have worked with (.+)", "tools"),
(r"\bi use tools like (.+)", "tools"),
(r"\bi use software like (.+)", "tools"),
(r"\bi use technologies like (.+)", "tools"),
# ─────────────────────────────
# 🎯 CAREER GOAL
# ─────────────────────────────
(r"\bmy career goal is (.+)", "career_goal"),
(r"\bmy goal is to become a[n]? (.+)", "career_goal"),
(r"\bi want to become a[n]? (.+)", "career_goal"),
(r"\bi aim to be a[n]? (.+)", "career_goal"),
(r"\bi aspire to be a[n]? (.+)", "career_goal"),
(r"\bi dream of becoming a[n]? (.+)", "career_goal"),
(r"\bi am working towards becoming a[n]? (.+)", "career_goal"),

# ─────────────────────────────
# 📍 JOB LOCATION PREFERENCE
# ─────────────────────────────
(r"\bi want a job in (.+)", "preferred_job_location"),
(r"\bi am looking for a job in (.+)", "preferred_job_location"),
(r"\bi want to work in (.+)", "preferred_job_location"),
(r"\bi prefer to work in (.+)", "preferred_job_location"),
(r"\bmy preferred job location is (.+)", "preferred_job_location"),
(r"\bmy preferred work location is (.+)", "preferred_job_location"),
(r"\bmy job location preference is (.+)", "preferred_job_location"),

# ─────────────────────────────
# 🧠 LEARNING STYLE
# ─────────────────────────────
(r"\bi learn best by (.+)", "learning_style"),
(r"\bmy learning style is (.+)", "learning_style"),
(r"\bi prefer learning by (.+)", "learning_style"),
(r"\bi learn better by (.+)", "learning_style"),
(r"\bi learn best through (.+)", "learning_style"),
(r"\bi understand things better by (.+)", "learning_style"),
(r"\bi prefer to learn through (.+)", "learning_style"),

    # ─────────────────────────────
    # ❤️ LIKES (MULTI-VALUE)
    # ─────────────────────────────
    (r"\bi like (.+)", "likes"),
    (r"\bi love (.+)", "likes"),
    (r"\bi enjoy (.+)", "likes"),
    (r"\bi prefer (.+)", "likes"),
    (r"\bmy favorite (?:food|thing|item)? is (.+)", "likes"),
    (r"\bi am into (.+)", "likes"),

    # ─────────────────────────────
    # 💔 DISLIKES (MULTI-VALUE)
    # ─────────────────────────────
    (r"\bi dislike (.+)", "dislikes"),
    (r"\bi hate (.+)", "dislikes"),
    (r"\bi dont like (.+)", "dislikes"),
    (r"\bi do not like (.+)", "dislikes"),
    (r"\bi avoid (.+)", "dislikes"),
]
