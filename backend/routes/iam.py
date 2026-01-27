"""IAM Routes - Manage Roles and Account Types (Admin only)"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict

from database import db
from utils.auth import require_roles
from utils.helpers import get_utc_now

router = APIRouter(prefix="/iam", tags=["IAM"])


# ============== MODELS ==============

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: Optional[Dict[str, Dict[str, bool]]] = None
    color: Optional[str] = "#6366F1"


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[Dict[str, Dict[str, bool]]] = None
    color: Optional[str] = None
    active: Optional[bool] = None


class RoleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    permissions: Dict[str, Dict[str, bool]] = {}
    color: Optional[str] = "#6366F1"
    is_system: bool = False
    active: bool = True
    user_count: int = 0
    created_at: str


class AccountTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#6366F1"
    requires_subscription: bool = False


class AccountTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    requires_subscription: Optional[bool] = None
    active: Optional[bool] = None


class AccountTypeResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#6366F1"
    requires_subscription: bool = False
    is_system: bool = False
    active: bool = True
    user_count: int = 0
    created_at: str


# ============== ROLE ROUTES ==============

@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(current_user: dict = Depends(require_roles(["Administrator"]))):
    """List all roles"""
    roles = await db.roles.find({"active": {"$ne": False}}, {"_id": 0}).to_list(100)
    
    # Enrich with user counts
    for role in roles:
        count = await db.users.count_documents({"role": role["name"], "active": True})
        role["user_count"] = count
    
    return [RoleResponse(**r) for r in roles]


@router.get("/roles/all", response_model=List[RoleResponse])
async def list_all_roles(current_user: dict = Depends(require_roles(["Administrator"]))):
    """List all roles including inactive"""
    roles = await db.roles.find({}, {"_id": 0}).to_list(100)
    
    for role in roles:
        count = await db.users.count_documents({"role": role["name"], "active": True})
        role["user_count"] = count
    
    return [RoleResponse(**r) for r in roles]


@router.post("/roles", response_model=RoleResponse)
async def create_role(
    role_data: RoleCreate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Create a new role"""
    # Check for duplicate name
    existing = await db.roles.find_one({"name": role_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Role with this name already exists")
    
    role = {
        "id": str(uuid.uuid4()),
        "name": role_data.name,
        "description": role_data.description,
        "permissions": role_data.permissions or {},
        "color": role_data.color or "#6366F1",
        "is_system": False,
        "active": True,
        "created_at": get_utc_now()
    }
    
    await db.roles.insert_one(role)
    role["user_count"] = 0
    return RoleResponse(**role)


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Get a specific role"""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    role["user_count"] = await db.users.count_documents({"role": role["name"], "active": True})
    return RoleResponse(**role)


@router.patch("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    role_data: RoleUpdate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Update a role"""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # System roles cannot have their name changed
    if role.get("is_system") and role_data.name and role_data.name != role["name"]:
        raise HTTPException(status_code=400, detail="Cannot rename system roles")
    
    update_dict = {k: v for k, v in role_data.model_dump().items() if v is not None}
    
    # Check for name collision
    if "name" in update_dict:
        existing = await db.roles.find_one({"name": update_dict["name"], "id": {"$ne": role_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Role with this name already exists")
        
        # Update users with old role name to new name
        old_name = role["name"]
        new_name = update_dict["name"]
        if old_name != new_name:
            await db.users.update_many(
                {"role": old_name},
                {"$set": {"role": new_name}}
            )
    
    if update_dict:
        await db.roles.update_one({"id": role_id}, {"$set": update_dict})
    
    updated_role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    updated_role["user_count"] = await db.users.count_documents({"role": updated_role["name"], "active": True})
    return RoleResponse(**updated_role)


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Delete a role (soft delete). Cannot delete if users are assigned."""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # System roles cannot be deleted
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    # Check for users with this role
    user_count = await db.users.count_documents({"role": role["name"], "active": True})
    if user_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete role with {user_count} assigned users. Reassign users first."
        )
    
    await db.roles.update_one({"id": role_id}, {"$set": {"active": False}})
    return {"message": "Role deleted successfully"}


# ============== ACCOUNT TYPE ROUTES ==============

@router.get("/account-types", response_model=List[AccountTypeResponse])
async def list_account_types(current_user: dict = Depends(require_roles(["Administrator"]))):
    """List all account types"""
    account_types = await db.account_types.find({"active": {"$ne": False}}, {"_id": 0}).to_list(100)
    
    # Enrich with user counts
    for at in account_types:
        count = await db.users.count_documents({"account_type": at["name"], "active": True})
        at["user_count"] = count
    
    return [AccountTypeResponse(**at) for at in account_types]


@router.get("/account-types/all", response_model=List[AccountTypeResponse])
async def list_all_account_types(current_user: dict = Depends(require_roles(["Administrator"]))):
    """List all account types including inactive"""
    account_types = await db.account_types.find({}, {"_id": 0}).to_list(100)
    
    for at in account_types:
        count = await db.users.count_documents({"account_type": at["name"], "active": True})
        at["user_count"] = count
    
    return [AccountTypeResponse(**at) for at in account_types]


@router.post("/account-types", response_model=AccountTypeResponse)
async def create_account_type(
    at_data: AccountTypeCreate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Create a new account type"""
    # Check for duplicate name
    existing = await db.account_types.find_one({"name": at_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Account type with this name already exists")
    
    account_type = {
        "id": str(uuid.uuid4()),
        "name": at_data.name,
        "description": at_data.description,
        "color": at_data.color or "#6366F1",
        "requires_subscription": at_data.requires_subscription,
        "is_system": False,
        "active": True,
        "created_at": get_utc_now()
    }
    
    await db.account_types.insert_one(account_type)
    account_type["user_count"] = 0
    return AccountTypeResponse(**account_type)


@router.get("/account-types/{at_id}", response_model=AccountTypeResponse)
async def get_account_type(
    at_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Get a specific account type"""
    at = await db.account_types.find_one({"id": at_id}, {"_id": 0})
    if not at:
        raise HTTPException(status_code=404, detail="Account type not found")
    
    at["user_count"] = await db.users.count_documents({"account_type": at["name"], "active": True})
    return AccountTypeResponse(**at)


@router.patch("/account-types/{at_id}", response_model=AccountTypeResponse)
async def update_account_type(
    at_id: str,
    at_data: AccountTypeUpdate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Update an account type"""
    at = await db.account_types.find_one({"id": at_id}, {"_id": 0})
    if not at:
        raise HTTPException(status_code=404, detail="Account type not found")
    
    # System types cannot have their name changed
    if at.get("is_system") and at_data.name and at_data.name != at["name"]:
        raise HTTPException(status_code=400, detail="Cannot rename system account types")
    
    update_dict = {k: v for k, v in at_data.model_dump().items() if v is not None}
    
    # Check for name collision
    if "name" in update_dict:
        existing = await db.account_types.find_one({"name": update_dict["name"], "id": {"$ne": at_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Account type with this name already exists")
        
        # Update users with old account type name to new name
        old_name = at["name"]
        new_name = update_dict["name"]
        if old_name != new_name:
            await db.users.update_many(
                {"account_type": old_name},
                {"$set": {"account_type": new_name}}
            )
    
    if update_dict:
        await db.account_types.update_one({"id": at_id}, {"$set": update_dict})
    
    updated_at = await db.account_types.find_one({"id": at_id}, {"_id": 0})
    updated_at["user_count"] = await db.users.count_documents({"account_type": updated_at["name"], "active": True})
    return AccountTypeResponse(**updated_at)


@router.delete("/account-types/{at_id}")
async def delete_account_type(
    at_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Delete an account type (soft delete). Cannot delete if users are assigned."""
    at = await db.account_types.find_one({"id": at_id}, {"_id": 0})
    if not at:
        raise HTTPException(status_code=404, detail="Account type not found")
    
    # System types cannot be deleted
    if at.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system account types")
    
    # Check for users with this account type
    user_count = await db.users.count_documents({"account_type": at["name"], "active": True})
    if user_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete account type with {user_count} assigned users. Reassign users first."
        )
    
    await db.account_types.update_one({"id": at_id}, {"$set": {"active": False}})
    return {"message": "Account type deleted successfully"}


# ============== SEED DEFAULT DATA ==============

@router.post("/seed-defaults")
async def seed_default_iam_data(current_user: dict = Depends(require_roles(["Administrator"]))):
    """Seed default roles and account types if not exists"""
    from models.identity import SYSTEM_ROLES, ACCOUNT_TYPES, DEFAULT_PERMISSIONS
    
    results = {"roles_created": 0, "account_types_created": 0}
    
    # Seed default roles
    for role_name in SYSTEM_ROLES:
        existing = await db.roles.find_one({"name": role_name})
        if not existing:
            role = {
                "id": str(uuid.uuid4()),
                "name": role_name,
                "description": f"System role: {role_name}",
                "permissions": DEFAULT_PERMISSIONS.get(role_name, {}),
                "color": {"Administrator": "#DC2626", "Operator": "#2563EB", "Standard User": "#10B981"}.get(role_name, "#6366F1"),
                "is_system": True,
                "active": True,
                "created_at": get_utc_now()
            }
            await db.roles.insert_one(role)
            results["roles_created"] += 1
    
    # Seed default account types
    default_account_types = {
        "Partner": {"description": "Business partners with subscription plans", "color": "#8B5CF6", "requires_subscription": True},
        "Media Client": {"description": "Media service clients (A La Carte)", "color": "#06B6D4", "requires_subscription": False},
        "Internal Staff": {"description": "Company employees", "color": "#F97316", "requires_subscription": False},
        "Vendor/Freelancer": {"description": "External contractors", "color": "#10B981", "requires_subscription": False}
    }
    
    for at_name, config in default_account_types.items():
        existing = await db.account_types.find_one({"name": at_name})
        if not existing:
            account_type = {
                "id": str(uuid.uuid4()),
                "name": at_name,
                "description": config["description"],
                "color": config["color"],
                "requires_subscription": config["requires_subscription"],
                "is_system": True,
                "active": True,
                "created_at": get_utc_now()
            }
            await db.account_types.insert_one(account_type)
            results["account_types_created"] += 1
    
    return results
