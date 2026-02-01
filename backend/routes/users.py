"""User management routes (Admin only) - Updated with new identity model

Identity Model:
- Role: Administrator, Operator, Standard User (permissions only)
- Account Type: Partner, Media Client, Internal Staff, Vendor/Freelancer
- Specialties: What the user does (multiple allowed, at least one required)
- Team: Optional grouping
- Subscription Plan: For Partners only (Core, Engage, Lead-to-Cash, Scale)
- Access Controls: Module-level permissions with overrides
"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Dict, Any

from database import db
from utils.auth import require_roles, get_current_user
from utils.helpers import hash_password, get_utc_now
from models.identity import (
    DEFAULT_PERMISSIONS, PERMISSION_MODULES, 
    ACCOUNT_TYPES, SUBSCRIPTION_PLANS, SYSTEM_ROLES
)

router = APIRouter(prefix="/users", tags=["Users"])


# ============== MODELS ==============

class SpecialtyEntry(BaseModel):
    """Represents a user's specialty assignment"""
    specialty_id: str
    is_primary: bool = False


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # Administrator, Operator, or Standard User
    account_type: str  # Partner, Media Client, Internal Staff, Vendor/Freelancer
    # Multi-specialty support (new)
    specialty_ids: Optional[List[str]] = None  # Array of specialty IDs
    primary_specialty_id: Optional[str] = None  # Which one is primary
    # Legacy single specialty (backwards compatibility)
    specialty_id: Optional[str] = None  # Still accepted for backwards compatibility
    team_id: Optional[str] = None
    subscription_plan_id: Optional[str] = None  # Required if account_type = Partner
    dashboard_type_id: Optional[str] = None  # Assigned dashboard template
    permission_overrides: Optional[Dict[str, Dict[str, bool]]] = None
    force_password_change: bool = True
    force_otp_setup: bool = True
    send_welcome_email: bool = True  # Send welcome email with temp password
    can_pick: bool = True  # Whether user can pick from pools (user-level override)
    pool_access: str = "both"  # none, pool1, pool2, both - which pools user can access
    
    @field_validator('specialty_ids', mode='before')
    @classmethod
    def ensure_specialty_ids_list(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            return [v] if v else None
        return v


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    account_type: Optional[str] = None
    # Multi-specialty support (new)
    specialty_ids: Optional[List[str]] = None  # Array of specialty IDs
    primary_specialty_id: Optional[str] = None  # Which one is primary
    # Legacy single specialty (backwards compatibility)
    specialty_id: Optional[str] = None  # Still accepted for backwards compatibility
    team_id: Optional[str] = None
    subscription_plan_id: Optional[str] = None
    dashboard_type_id: Optional[str] = None  # Assigned dashboard template
    can_pick: Optional[bool] = None  # Whether user can pick from pools
    permission_overrides: Optional[Dict[str, Dict[str, bool]]] = None
    active: Optional[bool] = None
    force_password_change: Optional[bool] = None
    force_otp_setup: Optional[bool] = None
    
    @field_validator('specialty_ids', mode='before')
    @classmethod
    def ensure_specialty_ids_list(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            return [v] if v else None
        return v


class SpecialtyInfo(BaseModel):
    """Specialty info for display"""
    id: str
    name: str
    is_primary: bool = False


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    account_type: Optional[str] = None
    # Multi-specialty support (new)
    specialty_ids: List[str] = []  # Array of specialty IDs
    specialties: List[SpecialtyInfo] = []  # Full specialty info with names
    primary_specialty_id: Optional[str] = None
    # Legacy single specialty (backwards compatibility) - returns primary or first
    specialty_id: Optional[str] = None
    specialty_name: Optional[str] = None
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    subscription_plan_id: Optional[str] = None
    subscription_plan_name: Optional[str] = None
    dashboard_type_id: Optional[str] = None  # Assigned dashboard template
    dashboard_type_name: Optional[str] = None
    # Legacy field - maps to subscription_plan_id
    access_tier_id: Optional[str] = None
    access_tier_name: Optional[str] = None
    permissions: Dict[str, Dict[str, bool]] = {}
    permission_overrides: Optional[Dict[str, Dict[str, bool]]] = None
    active: bool
    avatar: Optional[str] = None
    force_password_change: bool = False
    force_otp_setup: bool = False
    otp_verified: bool = False
    can_pick: bool = True  # Whether user can pick from pools
    created_at: str


# ============== HELPERS ==============

def get_effective_permissions(role: str, overrides: Optional[Dict] = None) -> Dict[str, Dict[str, bool]]:
    """Calculate effective permissions from role defaults + overrides"""
    # Start with role defaults (fallback to Standard User if role not found)
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
    """Build UserResponse with related info - supports multi-specialty"""
    # Get team name
    team_name = None
    if user.get("team_id"):
        team = await db.teams.find_one({"id": user["team_id"]}, {"_id": 0, "name": 1})
        team_name = team["name"] if team else None
    
    # Handle multi-specialty (new) and legacy single specialty
    specialty_ids = user.get("specialty_ids", [])
    primary_specialty_id = user.get("primary_specialty_id")
    
    # Migration: if user has old specialty_id but no specialty_ids, convert
    if not specialty_ids and user.get("specialty_id"):
        specialty_ids = [user["specialty_id"]]
        primary_specialty_id = user["specialty_id"]
    
    # Build specialties list with names
    specialties = []
    for spec_id in specialty_ids:
        specialty = await db.specialties.find_one({"id": spec_id}, {"_id": 0, "id": 1, "name": 1})
        if specialty:
            specialties.append(SpecialtyInfo(
                id=specialty["id"],
                name=specialty["name"],
                is_primary=(spec_id == primary_specialty_id)
            ))
    
    # For backwards compatibility: specialty_id returns primary or first
    legacy_specialty_id = primary_specialty_id or (specialty_ids[0] if specialty_ids else None)
    legacy_specialty_name = None
    if legacy_specialty_id:
        for s in specialties:
            if s.id == legacy_specialty_id:
                legacy_specialty_name = s.name
                break
        # Fallback to user's stored name or look up
        if not legacy_specialty_name:
            legacy_specialty_name = user.get("specialty_name")
        if not legacy_specialty_name:
            spec = await db.specialties.find_one({"id": legacy_specialty_id}, {"_id": 0, "name": 1})
            legacy_specialty_name = spec["name"] if spec else None
    
    # Get subscription plan name (also populate legacy access_tier fields)
    subscription_plan_name = user.get("subscription_plan_name")
    subscription_plan_id = user.get("subscription_plan_id") or user.get("access_tier_id")
    if not subscription_plan_name and subscription_plan_id:
        plan = await db.subscription_plans.find_one({"id": subscription_plan_id}, {"_id": 0, "name": 1})
        if not plan:
            # Fallback to access_tiers for legacy data
            plan = await db.access_tiers.find_one({"id": subscription_plan_id}, {"_id": 0, "name": 1})
        subscription_plan_name = plan["name"] if plan else None
    
    # Calculate effective permissions
    permissions = get_effective_permissions(
        user.get("role", "Standard User"),
        user.get("permission_overrides")
    )
    
    # Get dashboard type name
    dashboard_type_id = user.get("dashboard_type_id")
    dashboard_type_name = None
    if dashboard_type_id:
        dashboard = await db.dashboards.find_one({"id": dashboard_type_id}, {"_id": 0, "name": 1})
        dashboard_type_name = dashboard["name"] if dashboard else None
    
    return UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        account_type=user.get("account_type"),
        # Multi-specialty fields
        specialty_ids=specialty_ids,
        specialties=specialties,
        primary_specialty_id=primary_specialty_id,
        # Legacy single specialty fields (for backwards compatibility)
        specialty_id=legacy_specialty_id,
        specialty_name=legacy_specialty_name,
        team_id=user.get("team_id"),
        team_name=team_name,
        subscription_plan_id=subscription_plan_id,
        subscription_plan_name=subscription_plan_name,
        dashboard_type_id=dashboard_type_id,
        dashboard_type_name=dashboard_type_name,
        # Legacy fields - map to subscription plan
        access_tier_id=subscription_plan_id,
        access_tier_name=subscription_plan_name,
        permissions=permissions,
        permission_overrides=user.get("permission_overrides"),
        active=user.get("active", True),
        avatar=user.get("avatar"),
        force_password_change=user.get("force_password_change", False),
        force_otp_setup=user.get("force_otp_setup", False),
        otp_verified=user.get("otp_verified", False),
        can_pick=user.get("can_pick", True),  # Default to True for existing users
        created_at=user["created_at"]
    )


# ============== IDENTITY CONFIG ROUTES ==============

@router.get("/identity-config")
async def get_identity_config(current_user: dict = Depends(get_current_user)):
    """Get identity model configuration (roles, account types, etc.)"""
    return {
        "roles": SYSTEM_ROLES,
        "account_types": ACCOUNT_TYPES,
        "subscription_plans": SUBSCRIPTION_PLANS
    }


@router.get("/permissions/modules")
async def get_permission_modules(current_user: dict = Depends(require_roles(["Administrator"]))):
    """Get list of all permission modules and actions"""
    return {
        "modules": PERMISSION_MODULES,
        "default_permissions": DEFAULT_PERMISSIONS
    }


# ============== USER CRUD ROUTES ==============

@router.post("", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_roles(["Administrator"]))):
    """Create a new user (Admin only) - supports multiple specialties"""
    from services.email import send_account_created_email
    
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Verify role is valid
    if user_data.role not in SYSTEM_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(SYSTEM_ROLES)}")
    
    # Verify account type is valid
    if user_data.account_type not in ACCOUNT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid account type. Must be one of: {', '.join(ACCOUNT_TYPES)}")
    
    # Handle multi-specialty vs legacy single specialty
    specialty_ids = user_data.specialty_ids or []
    primary_specialty_id = user_data.primary_specialty_id
    
    # Backwards compatibility: if specialty_id provided but not specialty_ids, use it
    if not specialty_ids and user_data.specialty_id:
        specialty_ids = [user_data.specialty_id]
        primary_specialty_id = user_data.specialty_id
    
    # Specialty validation - only required for account types that can pick/execute work
    # Media Clients are requesters, they don't need specialties
    requires_specialty = user_data.account_type != "Media Client"
    if requires_specialty and not specialty_ids:
        raise HTTPException(status_code=400, detail="At least one specialty is required for this account type")
    
    # Verify all specialties exist (if any provided)
    specialty_names = []
    for spec_id in specialty_ids:
        specialty = await db.specialties.find_one({"id": spec_id, "active": True})
        if not specialty:
            raise HTTPException(status_code=400, detail=f"Invalid or inactive specialty: {spec_id}")
        specialty_names.append(specialty["name"])
    
    # Set primary if not specified (only if specialties are provided)
    if specialty_ids:
        if not primary_specialty_id:
            primary_specialty_id = specialty_ids[0]
        elif primary_specialty_id not in specialty_ids:
            raise HTTPException(status_code=400, detail="Primary specialty must be one of the selected specialties")
    else:
        primary_specialty_id = None
    
    # Get primary specialty name for legacy field
    primary_specialty_name = None
    if primary_specialty_id:
        primary_specialty = await db.specialties.find_one({"id": primary_specialty_id}, {"_id": 0, "name": 1})
        primary_specialty_name = primary_specialty["name"] if primary_specialty else (specialty_names[0] if specialty_names else None)
    
    # Verify team exists if provided
    team_name = None
    if user_data.team_id:
        team = await db.teams.find_one({"id": user_data.team_id, "active": True})
        if not team:
            raise HTTPException(status_code=400, detail="Invalid team")
        team_name = team["name"]
    
    # Verify subscription plan if account type is Partner
    subscription_plan_name = None
    if user_data.account_type == "Partner":
        if not user_data.subscription_plan_id:
            raise HTTPException(status_code=400, detail="Subscription plan is required for Partners")
        plan = await db.subscription_plans.find_one({"id": user_data.subscription_plan_id, "active": True})
        if not plan:
            raise HTTPException(status_code=400, detail="Invalid subscription plan")
        subscription_plan_name = plan["name"]
    
    # Store the plain password for email before hashing
    plain_password = user_data.password
    
    user = {
        "id": str(uuid.uuid4()),
        "name": user_data.name,
        "email": user_data.email.lower(),
        "password": hash_password(user_data.password),
        "role": user_data.role,
        "account_type": user_data.account_type,
        # Multi-specialty fields (new)
        "specialty_ids": specialty_ids,
        "primary_specialty_id": primary_specialty_id,
        # Legacy single specialty fields (for backwards compatibility)
        "specialty_id": primary_specialty_id,
        "specialty_name": primary_specialty_name,
        "team_id": user_data.team_id,
        "team_name": team_name,
        "subscription_plan_id": user_data.subscription_plan_id,
        "subscription_plan_name": subscription_plan_name,
        "dashboard_type_id": user_data.dashboard_type_id,  # Dashboard assignment
        # Legacy field for backwards compatibility
        "access_tier_id": user_data.subscription_plan_id,
        "access_tier_name": subscription_plan_name,
        "permission_overrides": user_data.permission_overrides,
        "active": True,
        "can_pick": user_data.can_pick,  # User-level pool picking permission
        "force_password_change": user_data.force_password_change,
        "force_otp_setup": user_data.force_otp_setup,
        "otp_verified": False,
        "created_at": get_utc_now()
    }
    
    await db.users.insert_one(user)
    
    # Send welcome email with credentials
    if user_data.send_welcome_email:
        try:
            await send_account_created_email(
                to_email=user_data.email.lower(),
                user_name=user_data.name,
                temp_password=plain_password,
                role=user_data.role
            )
        except Exception as e:
            # Log but don't fail the user creation
            import logging
            logging.error(f"Failed to send welcome email: {e}")
    
    return await build_user_response(user)


@router.get("", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(require_roles(["Administrator", "Operator"]))):
    """List all active users"""
    users = await db.users.find({"active": True}, {"_id": 0, "password": 0}).to_list(1000)
    return [await build_user_response(u) for u in users]


@router.get("/all", response_model=List[UserResponse])
async def list_all_users(current_user: dict = Depends(require_roles(["Administrator"]))):
    """List all users including inactive (Admin only)"""
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [await build_user_response(u) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(require_roles(["Administrator", "Operator"]))):
    """Get a specific user by ID"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await build_user_response(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(require_roles(["Administrator"]))):
    """Update a user (Admin only) - supports multiple specialties"""
    from services.email import send_account_disabled_email, send_account_reactivated_email
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_dict = {k: v for k, v in user_data.model_dump().items() if v is not None}
    
    # Track if active status is changing for email notifications
    was_active = user.get("active", True)
    new_active = update_dict.get("active")
    
    if "email" in update_dict:
        update_dict["email"] = update_dict["email"].lower()
        existing = await db.users.find_one({"email": update_dict["email"], "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
    
    if "password" in update_dict:
        update_dict["password"] = hash_password(update_dict["password"])
    
    if "role" in update_dict:
        if update_dict["role"] not in SYSTEM_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(SYSTEM_ROLES)}")
    
    if "account_type" in update_dict:
        if update_dict["account_type"] not in ACCOUNT_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid account type. Must be one of: {', '.join(ACCOUNT_TYPES)}")
    
    # Handle multi-specialty update
    if "specialty_ids" in update_dict:
        specialty_ids = update_dict["specialty_ids"]
        if specialty_ids:
            # Verify all specialties exist
            for spec_id in specialty_ids:
                specialty = await db.specialties.find_one({"id": spec_id, "active": True})
                if not specialty:
                    raise HTTPException(status_code=400, detail=f"Invalid or inactive specialty: {spec_id}")
            
            # Handle primary specialty
            primary_specialty_id = update_dict.get("primary_specialty_id")
            if not primary_specialty_id:
                # Keep existing primary if it's in the new list, otherwise use first
                existing_primary = user.get("primary_specialty_id") or user.get("specialty_id")
                if existing_primary and existing_primary in specialty_ids:
                    primary_specialty_id = existing_primary
                else:
                    primary_specialty_id = specialty_ids[0]
            elif primary_specialty_id not in specialty_ids:
                raise HTTPException(status_code=400, detail="Primary specialty must be one of the selected specialties")
            
            update_dict["primary_specialty_id"] = primary_specialty_id
            
            # Update legacy fields for backwards compatibility
            primary_specialty = await db.specialties.find_one({"id": primary_specialty_id}, {"_id": 0, "name": 1})
            update_dict["specialty_id"] = primary_specialty_id
            update_dict["specialty_name"] = primary_specialty["name"] if primary_specialty else None
    
    # Handle legacy single specialty update (backwards compatibility)
    elif "specialty_id" in update_dict and update_dict["specialty_id"]:
        specialty = await db.specialties.find_one({"id": update_dict["specialty_id"], "active": True})
        if not specialty:
            raise HTTPException(status_code=400, detail="Invalid or inactive specialty")
        update_dict["specialty_name"] = specialty["name"]
        # Also update multi-specialty fields
        update_dict["specialty_ids"] = [update_dict["specialty_id"]]
        update_dict["primary_specialty_id"] = update_dict["specialty_id"]
    
    # Handle primary_specialty_id update without specialty_ids change
    if "primary_specialty_id" in update_dict and "specialty_ids" not in update_dict:
        existing_specialty_ids = user.get("specialty_ids", [])
        if not existing_specialty_ids and user.get("specialty_id"):
            existing_specialty_ids = [user["specialty_id"]]
        
        if update_dict["primary_specialty_id"] and update_dict["primary_specialty_id"] not in existing_specialty_ids:
            raise HTTPException(status_code=400, detail="Primary specialty must be one of the user's specialties")
        
        if update_dict["primary_specialty_id"]:
            primary_specialty = await db.specialties.find_one({"id": update_dict["primary_specialty_id"]}, {"_id": 0, "name": 1})
            update_dict["specialty_id"] = update_dict["primary_specialty_id"]
            update_dict["specialty_name"] = primary_specialty["name"] if primary_specialty else None
    
    # Handle team update
    if "team_id" in update_dict:
        if update_dict["team_id"]:
            team = await db.teams.find_one({"id": update_dict["team_id"], "active": True})
            if not team:
                raise HTTPException(status_code=400, detail="Invalid team")
            update_dict["team_name"] = team["name"]
        else:
            update_dict["team_name"] = None
    
    # Handle subscription plan update
    new_account_type = update_dict.get("account_type", user.get("account_type"))
    if "subscription_plan_id" in update_dict or new_account_type == "Partner":
        if new_account_type == "Partner":
            plan_id = update_dict.get("subscription_plan_id") or user.get("subscription_plan_id")
            if not plan_id:
                raise HTTPException(status_code=400, detail="Subscription plan is required for Partners")
            plan = await db.subscription_plans.find_one({"id": plan_id, "active": True})
            if not plan:
                raise HTTPException(status_code=400, detail="Invalid subscription plan")
            update_dict["subscription_plan_name"] = plan["name"]
            # Legacy fields
            update_dict["access_tier_id"] = plan_id
            update_dict["access_tier_name"] = plan["name"]
        elif "subscription_plan_id" in update_dict:
            # Non-Partner accounts don't need subscription plans
            update_dict["subscription_plan_id"] = None
            update_dict["subscription_plan_name"] = None
            update_dict["access_tier_id"] = None
            update_dict["access_tier_name"] = None
    
    if update_dict:
        await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    # Send email notifications for account status changes
    if new_active is not None and was_active != new_active:
        try:
            if new_active:
                # Account reactivated
                await send_account_reactivated_email(
                    to_email=user["email"],
                    user_name=user["name"],
                    reactivated_by=current_user.get("name", "Administrator")
                )
            else:
                # Account disabled
                await send_account_disabled_email(
                    to_email=user["email"],
                    user_name=user["name"],
                    disabled_by=current_user.get("name", "Administrator")
                )
        except Exception as e:
            import logging
            logging.error(f"Failed to send account status email: {e}")
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return await build_user_response(updated_user)


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_roles(["Administrator"]))):
    """Soft delete a user (Admin only)"""
    from services.email import send_account_disabled_email
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    await db.users.update_one({"id": user_id}, {"$set": {"active": False}})
    
    # Send account disabled email
    try:
        await send_account_disabled_email(
            to_email=user["email"],
            user_name=user["name"],
            disabled_by=current_user.get("name", "Administrator")
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to send account disabled email: {e}")
    
    return {"message": "User deactivated"}


@router.post("/{user_id}/restore")
async def restore_user(user_id: str, current_user: dict = Depends(require_roles(["Administrator"]))):
    """Restore a deactivated user (Admin only)"""
    from services.email import send_account_reactivated_email
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"active": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Send reactivation email
    try:
        await send_account_reactivated_email(
            to_email=user["email"],
            user_name=user["name"],
            reactivated_by=current_user.get("name", "Administrator")
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to send account reactivation email: {e}")
    
    return {"message": "User restored"}



# ============== MIGRATION ENDPOINT ==============

@router.post("/migrate/single-to-multi-specialty")
async def migrate_single_to_multi_specialty(current_user: dict = Depends(require_roles(["Administrator"]))):
    """
    Migrate users from single specialty_id to multi-specialty (specialty_ids array).
    This is a one-time migration that:
    - Finds all users with specialty_id but no specialty_ids
    - Creates specialty_ids array with that single specialty
    - Sets primary_specialty_id to the existing specialty_id
    """
    import logging
    
    # Find users that need migration (have specialty_id but no specialty_ids)
    users_to_migrate = await db.users.find({
        "specialty_id": {"$exists": True, "$ne": None},
        "$or": [
            {"specialty_ids": {"$exists": False}},
            {"specialty_ids": None},
            {"specialty_ids": []}
        ]
    }, {"_id": 0, "id": 1, "name": 1, "specialty_id": 1}).to_list(10000)
    
    migrated_count = 0
    for user in users_to_migrate:
        try:
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {
                    "specialty_ids": [user["specialty_id"]],
                    "primary_specialty_id": user["specialty_id"]
                }}
            )
            migrated_count += 1
        except Exception as e:
            logging.error(f"Failed to migrate user {user['id']}: {e}")
    
    return {
        "message": "Migration complete",
        "users_found": len(users_to_migrate),
        "users_migrated": migrated_count
    }
