from pydantic import BaseModel, EmailStr
from typing import Optional


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # Now dynamic - any role name
    team_id: Optional[str] = None  # Team assignment
    force_password_change: bool = False  # Force password change on next login
    force_otp_setup: bool = False  # Force OTP/2FA setup on next login


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None  # Now dynamic
    team_id: Optional[str] = None  # Team assignment
    active: Optional[bool] = None
    force_password_change: Optional[bool] = None  # Re-trigger password change
    force_otp_setup: Optional[bool] = None  # Re-trigger OTP setup


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    account_type: Optional[str] = None
    specialty_id: Optional[str] = None
    specialty_name: Optional[str] = None
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    subscription_plan_id: Optional[str] = None
    subscription_plan_name: Optional[str] = None
    # Legacy fields for backwards compatibility
    access_tier_id: Optional[str] = None
    access_tier_name: Optional[str] = None
    permissions: Optional[dict] = None
    active: bool
    avatar: Optional[str] = None
    force_password_change: bool = False
    force_otp_setup: bool = False
    otp_verified: bool = False
    created_at: str
