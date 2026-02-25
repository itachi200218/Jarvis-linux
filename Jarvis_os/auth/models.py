from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str

    # ✅ TIMESTAMP (AUTO SET BY BACKEND)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    name: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
