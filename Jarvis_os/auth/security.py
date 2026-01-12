import os
import hashlib
from datetime import datetime, timedelta

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
    raise RuntimeError("JWT_SECRET is not set")

# ==============================
# PASSWORD CONTEXT
# ==============================
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

# ==============================
# 🔐 PASSWORD NORMALIZATION (FIX)
# ==============================
def _normalize_password(password: str) -> bytes:
    """
    bcrypt max = 72 bytes.
    We SHA-256 first to make it FIXED 32 bytes.
    This works everywhere (Linux, Windows, Docker).
    """
    return hashlib.sha256(password.encode("utf-8")).digest()

def hash_password(password: str) -> str:
    return pwd_context.hash(_normalize_password(password))

def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(_normalize_password(password), hashed)

# ==============================
# JWT TOKEN
# ==============================
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

# ==============================
# 🔐 TOKEN → USER
# ==============================
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

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
        email = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = users_collection.find_one({"email": email})
    if not user:
        raise credentials_exception

    return user
