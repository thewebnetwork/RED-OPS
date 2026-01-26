"""User management routes (Admin only) - Updated with new identity model"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any

from database import db
from utils.auth import require_roles, get_current_user
from utils.helpers import hash_password, get_utc_now
from models.identity import DEFAULT_PERMISSIONS, PERMISSION_MODULES

router = APIRouter(prefix="/users", tags=["Users"])


# ============== MODELS ==============

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # Administrator, Privileged User, or Standard User
    team_id: Optional[str] = None
    specialty_id: Optional[str] = None
    access_tier_id: Optional[str] = None
    permission_overrides: Optional[Dict[str, Dict[str, bool]]] = None
    force_password_change: bool = False
    force_otp_setup: bool = False


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    team_id: Optional[str] = None
    specialty_id: Optional[str] = None
    access_tier_id: Optional[str] = None
    permission_overrides: Optional[Dict[str, Dict[str, bool]]] = None
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
    specialty_id: Optional[str] = None
    specialty_name: Optional[str] = None
    access_tier_id: Optional[str] = None
    access_tier_name: Optional[str] = None
    permissions: Dict[str, Dict[str, bool]] = {}
    permission_overrides: Optional[Dict[str, Dict[str, bool]]] = None
    active: bool
    avatar: Optional[str] = None
    force_password_change: bool = False
    force_otp_setup: bool = False
    otp_verified: bool = False
    created_at: str


# ============== HELPERS ==============

def get_effective_permissions(role: str, overrides: Optional[Dict] = None) -> Dict[str, Dict[str, bool]]:
    """Calculate effective permissions from role defaults + overrides"""
    # Start with role defaults
    base_permissions = DEFAULT_PERMISSIONS.get(role, DEFAULT_PERMISSIONS["Standard User"]).copy()
    
    # Deep copy to avoid mutation
    effective = {}
    for module, actions in base_permissions.items():
        effective[module] = actions.copy()
    
    # Apply overrides if any
    if overrides:
        for module, actions in overrides.items():
            if module in effective:
                for action, value in actions.items():
                    if action in effective[module]:
                        effective[module][action] = value
    
    return effective


async def build_user_response(user: dict) -> UserResponse:
    """Build UserResponse with related info"""
    # Get team name
    team_name = None
    if user.get("team_id"):
        team = await db.teams.find_one({"id": user["team_id"]}, {"_id": 0, "name": 1})
        team_name = team["name"] if team else None
    
    # Get specialty name
    specialty_name = user.get("specialty_name")
    if not specialty_name and user.get("specialty_id"):
        specialty = await db.specialties.find_one({"id": user["specialty_id"]}, {"_id": 0, "name": 1})
        specialty_name = specialty["name"] if specialty else None
    
    # Get access tier name
    access_tier_name = user.get("access_tier_name")
    if not access_tier_name and user.get("access_tier_id"):
        tier = await db.access_tiers.find_one({"id": user["access_tier_id"]}, {"_id": 0, "name": 1})
        access_tier_name = tier["name"] if tier else None
    
    # Calculate effective permissions
    permissions = get_effective_permissions(
        user.get("role", "Standard User"),
        user.get("permission_overrides")
    )
    
    return UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        team_id=user.get("team_id"),
        team_name=team_name,
        specialty_id=user.get("specialty_id"),
        specialty_name=specialty_name,
        access_tier_id=user.get("access_tier_id"),
        access_tier_name=access_tier_name,
        permissions=permissions,
        permission_overrides=user.get("permission_overrides"),
        active=user.get("active", True),
        avatar=user.get("avatar"),
        force_password_change=user.get("force_password_change", False),
        force_otp_setup=user.get("force_otp_setup", False),
        otp_verified=user.get("otp_verified", False),
        created_at=user["created_at"]
    )


# ============== ROUTES ==============

@router.get("/permissions/modules")
async def get_permission_modules(current_user: dict = Depends(require_roles(["Administrator"]))):
    """Get list of all permission modules and actions"""
    return {
        "modules": PERMISSION_MODULES,
        "default_permissions": DEFAULT_PERMISSIONS
    }


@router.post("", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_roles(["Administrator"]))):
    """Create a new user (Admin only)"""
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Verify role is one of the 3 allowed roles
    allowed_roles = ["Administrator", "Privileged User", "Standard User"]
    if user_data.role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(allowed_roles)}")
    
    # Verify team exists if provided
    team_name = None
    if user_data.team_id:
        team = await db.teams.find_one({"id": user_data.team_id, "active": True})
        if not team:
            raise HTTPException(status_code=400, detail="Invalid team")
        team_name = team["name"]
    
    # Verify specialty exists if provided
    specialty_name = None
    if user_data.specialty_id:
        specialty = await db.specialties.find_one({"id": user_data.specialty_id, "active": True})
        if not specialty:
            raise HTTPException(status_code=400, detail="Invalid specialty")
        specialty_name = specialty["name"]
    
    # Verify access tier exists if provided
    access_tier_name = None
    if user_data.access_tier_id:
        tier = await db.access_tiers.find_one({"id": user_data.access_tier_id, "active": True})
        if not tier:
            raise HTTPException(status_code=400, detail="Invalid access tier")
        access_tier_name = tier["name"]
    
    user = {
        "id": str(uuid.uuid4()),
        "name": user_data.name,
        "email": user_data.email.lower(),
        "password": hash_password(user_data.password),
        "role": user_data.role,
        "team_id": user_data.team_id,
        "team_name": team_name,
        "specialty_id": user_data.specialty_id,
        "specialty_name": specialty_name,
        "access_tier_id": user_data.access_tier_id,
        "access_tier_name": access_tier_name,
        "permission_overrides": user_data.permission_overrides,
        "active": True,
        "force_password_change": user_data.force_password_change,
        "force_otp_setup": user_data.force_otp_setup,
        "otp_verified": False,
        "created_at": get_utc_now()
    }
    
    await db.users.insert_one(user)
    return await build_user_response(user)


@router.get("", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(require_roles(["Administrator", "Privileged User"]))):
    """List all users"""
    users = await db.users.find({"active": True}, {"_id": 0, "password": 0}).to_list(1000)
    return [await build_user_response(u) for u in users]


@router.get("/all", response_model=List[UserResponse])
async def list_all_users(current_user: dict = Depends(require_roles(["Administrator"]))):
    """List all users including inactive (Admin only)"""
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [await build_user_response(u) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(require_roles(["Administrator", "Privileged User"]))):
    """Get a specific user by ID"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await build_user_response(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(require_roles(["Administrator"]))):
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
        allowed_roles = ["Administrator", "Privileged User", "Standard User"]
        if update_dict["role"] not in allowed_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(allowed_roles)}")
    
    if "team_id" in update_dict and update_dict["team_id"]:
        team = await db.teams.find_one({"id": update_dict["team_id"], "active": True})
        if not team:
            raise HTTPException(status_code=400, detail="Invalid team")
        update_dict["team_name"] = team["name"]
    elif "team_id" in update_dict and update_dict["team_id"] is None:
        update_dict["team_name"] = None
    
    if "specialty_id" in update_dict and update_dict["specialty_id"]:
        specialty = await db.specialties.find_one({"id": update_dict["specialty_id"], "active": True})
        if not specialty:
            raise HTTPException(status_code=400, detail="Invalid specialty")
        update_dict["specialty_name"] = specialty["name"]
    elif "specialty_id" in update_dict and update_dict["specialty_id"] is None:
        update_dict["specialty_name"] = None
    
    if "access_tier_id" in update_dict and update_dict["access_tier_id"]:
        tier = await db.access_tiers.find_one({"id": update_dict["access_tier_id"], "active": True})
        if not tier:
            raise HTTPException(status_code=400, detail="Invalid access tier")
        update_dict["access_tier_name"] = tier["name"]
    elif "access_tier_id" in update_dict and update_dict["access_tier_id"] is None:
        update_dict["access_tier_name"] = None
    
    if update_dict:
        update_dict["updated_at"] = get_utc_now()
        await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return await build_user_response(updated)


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_roles(["Administrator"]))):
    """Soft delete a user (Admin only)"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted"}
