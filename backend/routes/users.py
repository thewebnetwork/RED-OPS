"""User management routes (Admin only)"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, List

from database import db
from utils.auth import require_roles, get_current_user
from utils.helpers import hash_password, get_utc_now

router = APIRouter(prefix="/users", tags=["Users"])


# ============== MODELS ==============

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    team_id: Optional[str] = None
    force_password_change: bool = False
    force_otp_setup: bool = False


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    team_id: Optional[str] = None
    active: Optional[bool] = None
    force_password_change: Optional[bool] = None
    force_otp_setup: Optional[bool] = None


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


# ============== ROUTES ==============

@router.post("", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new user (Admin only)"""
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Verify role exists
    role = await db.roles.find_one({"name": user_data.role, "active": True})
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Verify team exists if provided
    if user_data.team_id:
        team = await db.teams.find_one({"id": user_data.team_id, "active": True})
        if not team:
            raise HTTPException(status_code=400, detail="Invalid team")
    
    user = {
        "id": str(uuid.uuid4()),
        "name": user_data.name,
        "email": user_data.email.lower(),
        "password": hash_password(user_data.password),
        "role": user_data.role,
        "team_id": user_data.team_id,
        "active": True,
        "force_password_change": user_data.force_password_change,
        "force_otp_setup": user_data.force_otp_setup,
        "otp_verified": False,
        "created_at": get_utc_now()
    }
    
    await db.users.insert_one(user)
    return await build_user_response(user)


@router.get("", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(require_roles(["Admin"]))):
    """List all users (Admin only)"""
    users = await db.users.find({"active": True}, {"_id": 0, "password": 0}).to_list(1000)
    return [await build_user_response(u) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Get a specific user by ID (Admin only)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await build_user_response(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update a user (Admin only)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_dict = {k: v for k, v in user_data.model_dump().items() if v is not None}
    
    if "email" in update_dict:
        update_dict["email"] = update_dict["email"].lower()
        existing = await db.users.find_one({"email": update_dict["email"], "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
    
    if "password" in update_dict:
        update_dict["password"] = hash_password(update_dict["password"])
    
    if "role" in update_dict:
        role = await db.roles.find_one({"name": update_dict["role"], "active": True})
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role")
    
    if "team_id" in update_dict and update_dict["team_id"]:
        team = await db.teams.find_one({"id": update_dict["team_id"], "active": True})
        if not team:
            raise HTTPException(status_code=400, detail="Invalid team")
    
    if update_dict:
        await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return await build_user_response(updated)


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Soft delete a user (Admin only)"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted"}
