"""Role management routes"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Literal

from database import db
from utils.auth import require_roles, get_current_user
from utils.helpers import get_utc_now

router = APIRouter(prefix="/roles", tags=["Roles"])


# ============== MODELS ==============

class RoleCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    role_type: Literal["system", "service_provider", "custom"] = "custom"
    icon: Optional[str] = None
    color: Optional[str] = None
    can_pick_orders: bool = False
    can_create_orders: bool = False


class RoleUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    can_pick_orders: Optional[bool] = None
    can_create_orders: Optional[bool] = None
    active: Optional[bool] = None


class RoleResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str] = None
    role_type: str
    icon: Optional[str] = None
    color: Optional[str] = None
    can_pick_orders: bool
    can_create_orders: bool
    active: bool
    created_at: str


# ============== ROUTES ==============

@router.post("", response_model=RoleResponse)
async def create_role(role_data: RoleCreate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new role (Admin only)"""
    # Check for duplicate name
    existing = await db.roles.find_one({"name": role_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Role with this name already exists")
    
    role = {
        "id": str(uuid.uuid4()),
        "name": role_data.name,
        "display_name": role_data.display_name,
        "description": role_data.description,
        "role_type": role_data.role_type,
        "icon": role_data.icon,
        "color": role_data.color,
        "can_pick_orders": role_data.can_pick_orders,
        "can_create_orders": role_data.can_create_orders,
        "active": True,
        "created_at": get_utc_now()
    }
    
    await db.roles.insert_one(role)
    return RoleResponse(**role)


@router.get("", response_model=List[RoleResponse])
async def list_roles(current_user: dict = Depends(get_current_user)):
    """List all active roles"""
    roles = await db.roles.find({"active": True}, {"_id": 0}).to_list(100)
    return [RoleResponse(**r) for r in roles]


@router.get("/all", response_model=List[RoleResponse])
async def list_all_roles(current_user: dict = Depends(require_roles(["Admin"]))):
    """List all roles including inactive (Admin only)"""
    roles = await db.roles.find({}, {"_id": 0}).to_list(100)
    return [RoleResponse(**r) for r in roles]


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(role_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific role"""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return RoleResponse(**role)


@router.patch("/{role_id}", response_model=RoleResponse)
async def update_role(role_id: str, role_data: RoleUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update a role (Admin only)"""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Don't allow modifying system roles' core properties
    if role.get("role_type") == "system" and role_data.active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate system roles")
    
    update_dict = {k: v for k, v in role_data.model_dump().items() if v is not None}
    
    if update_dict:
        await db.roles.update_one({"id": role_id}, {"$set": update_dict})
    
    updated = await db.roles.find_one({"id": role_id}, {"_id": 0})
    return RoleResponse(**updated)


@router.delete("/{role_id}")
async def delete_role(role_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Soft delete a role (Admin only)"""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.get("role_type") == "system":
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    # Check if any users are using this role
    users_with_role = await db.users.count_documents({"role": role["name"], "active": True})
    if users_with_role > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role: {users_with_role} users are assigned to this role")
    
    await db.roles.update_one({"id": role_id}, {"$set": {"active": False}})
    return {"message": "Role deleted"}
