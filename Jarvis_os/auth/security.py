import os
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
from jose import jwt, JWTError
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from auth.database import users_collection

# ==============================
# LOAD ENV
# ==============================
load_dotenv()

# ==============================
# JWT CONFIG
# ==============================
SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET is not set in .env")

# ==============================
# PASSWORD CONTEXT (FIXED)
# ==============================
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

# ==============================
# 🔐 PASSWORD HELPERS (CORRECT)
# ==============================
def hash_password(password: str) -> str:
    """
    Hash password using bcrypt (NO pre-hashing).
    """
    return pwd_context.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verify password using bcrypt.
    """
    return pwd_context.verify(password, hashed_password)

def needs_password_upgrade(hashed_password: str) -> bool:
    """
    Check if hash needs rehashing (cost upgrade, etc).
    """
    return pwd_context.needs_update(hashed_password)

# ==============================
# JWT TOKEN
# ==============================
def create_access_token(data: dict) -> str:
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({
        "exp": expire,
        "type": "access"
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

# ==============================
# OAUTH2
# ==============================
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ==============================
# 🔐 TOKEN → USER
# ==============================
def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        email: str = payload.get("sub")
        token_type: str = payload.get("type")

        if email is None or token_type != "access":
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = users_collection.find_one({"email": email})
    if not user:
        raise credentials_exception

    return user
