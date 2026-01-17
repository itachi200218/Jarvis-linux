import os
import hashlib
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
# PASSWORD CONTEXT
# ==============================
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

# ==============================
# 🔐 PASSWORD NORMALIZATION
# ==============================
def _normalize_password(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).digest()

def hash_password(password: str) -> str:
    return pwd_context.hash(_normalize_password(password))

def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(
            _normalize_password(password),
            hashed_password
        )
    except ValueError:
        # backward compatibility for OLD users
        try:
            return pwd_context.verify(
                password.encode("utf-8")[:72],
                hashed_password
            )
        except Exception:
            return False

def needs_password_upgrade(password: str, hashed_password: str) -> bool:
    try:
        pwd_context.verify(
            _normalize_password(password),
            hashed_password
        )
        return False
    except Exception:
        return True

# ==============================
# JWT TOKEN
# ==============================
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire, "type": "access"})

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

        email = payload.get("sub")
        token_type = payload.get("type")

        if email is None or token_type != "access":
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = users_collection.find_one({"email": email})
    if not user:
        raise credentials_exception

    return user
