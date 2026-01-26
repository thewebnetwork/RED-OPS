"""Authentication routes"""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, EmailStr
from typing import Optional

from database import db
from config import RESET_TOKEN_EXPIRE_HOURS, FRONTEND_URL
from utils.auth import get_current_user
from utils.helpers import (
    hash_password, verify_password, create_access_token, get_utc_now
)
from services.email import send_password_reset_email as svc_send_password_reset_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ============== MODELS ==============

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    active: bool
    avatar: Optional[str] = None
    force_password_change: bool = False
    force_otp_setup: bool = False
    otp_verified: bool = False
    created_at: str


class LoginResponse(BaseModel):
    token: str
    user: UserResponse


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ============== HELPERS ==============

async def build_user_response(user: dict) -> UserResponse:
    """Build UserResponse with team info"""
    team_name = None
    if user.get("team_id"):
        team = await db.teams.find_one({"id": user["team_id"]}, {"_id": 0, "name": 1})
        team_name = team["name"] if team else None
    
    return UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        team_id=user.get("team_id"),
        team_name=team_name,
        active=user.get("active", True),
        avatar=user.get("avatar"),
        force_password_change=user.get("force_password_change", False),
        force_otp_setup=user.get("force_otp_setup", False),
        otp_verified=user.get("otp_verified", False),
        created_at=user["created_at"]
    )


async def send_password_reset_email(to_email: str, user_name: str, reset_link: str):
    """Send password reset email"""
    subject = "Reset Your Password - Red Ribbon Ops Portal"
    body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
            .button {{ display: inline-block; background: #DC2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
            .footer {{ margin-top: 20px; font-size: 12px; color: #6b7280; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">Red Ribbon Ops Portal</h1>
            </div>
            <div class="content">
                <h2>Password Reset Request</h2>
                <p>Hi {user_name},</p>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <p style="text-align: center;">
                    <a href="{reset_link}" class="button" style="color: white;">Reset Password</a>
                </p>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px; font-size: 14px;">
                    {reset_link}
                </p>
                <p><strong>This link will expire in 1 hour.</strong></p>
                <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                <div class="footer">
                    <p>This is an automated message from Red Ribbon Ops Portal. Please do not reply to this email.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    await svc_send_password_reset_email(to_email, subject, body)


# ============== ROUTES ==============

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Authenticate user and return JWT token"""
    user = await db.users.find_one({"email": request.email.lower()}, {"_id": 0})
    if not user or not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("active", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    user_response = await build_user_response(user)
    return LoginResponse(token=token, user=user_response)


@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return await build_user_response(user)


@router.patch("/profile", response_model=UserResponse)
async def update_profile(profile_data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update current user's profile"""
    update_dict = {k: v for k, v in profile_data.model_dump().items() if v is not None}
    if "email" in update_dict:
        update_dict["email"] = update_dict["email"].lower()
        existing = await db.users.find_one({"email": update_dict["email"], "id": {"$ne": current_user["id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
    
    if update_dict:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_dict})
    
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return await build_user_response(updated)


@router.post("/change-password")
async def change_password(password_data: PasswordChange, current_user: dict = Depends(get_current_user)):
    """Change current user's password"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not verify_password(password_data.current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password": hash_password(password_data.new_password)}}
    )
    return {"message": "Password changed successfully"}


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    """Request a password reset link"""
    user = await db.users.find_one({"email": request.email.lower()}, {"_id": 0})
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account exists with this email, a password reset link has been sent."}
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
    
    # Store reset token in database
    await db.password_resets.delete_many({"user_id": user["id"]})
    await db.password_resets.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "token": reset_token,
        "expires_at": expires_at.isoformat(),
        "used": False,
        "created_at": get_utc_now()
    })
    
    # Build reset link
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    
    # Send email in background
    background_tasks.add_task(
        send_password_reset_email,
        user["email"],
        user["name"],
        reset_link
    )
    
    return {"message": "If an account exists with this email, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using token from email"""
    reset_record = await db.password_resets.find_one({
        "token": request.token,
        "used": False
    }, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    expires_at = datetime.fromisoformat(reset_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    await db.users.update_one(
        {"id": reset_record["user_id"]},
        {"$set": {"password": hash_password(request.new_password)}}
    )
    
    await db.password_resets.update_one(
        {"token": request.token},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password has been reset successfully"}


@router.get("/verify-reset-token")
async def verify_reset_token(token: str):
    """Verify if a reset token is valid"""
    reset_record = await db.password_resets.find_one({
        "token": token,
        "used": False
    }, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    expires_at = datetime.fromisoformat(reset_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    user = await db.users.find_one({"id": reset_record["user_id"]}, {"_id": 0, "email": 1})
    
    return {"valid": True, "email": user["email"] if user else None}
