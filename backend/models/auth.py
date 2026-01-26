from pydantic import BaseModel, EmailStr
from typing import Optional
from .user import UserResponse


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    token: str
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar: Optional[str] = None  # Base64 encoded image
