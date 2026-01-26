"""Role management routes - Simplified to 3 roles with permission matrix"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict

from database import db
from utils.auth import require_roles, get_current_user
from utils.helpers import get_utc_now
from models.identity import DEFAULT_PERMISSIONS, PERMISSION_MODULES

router = APIRouter(prefix="/roles", tags=["Roles"])


# ============== MODELS ==============

class RoleUpdate(BaseModel):
    """Update role permissions (only permissions can be modified)"""
    description: Optional[str] = None
    permissions: Optional[Dict[str, Dict[str, bool]]] = None


class RoleResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str] = None
    permissions: Dict[str, Dict[str, bool]]
    is_system: bool = True
    user_count: int = 0
    created_at: str


# ============== HELPERS ==============

async def build_role_response(role: dict) -> RoleResponse:
    """Build RoleResponse with user count"""
    user_count = await db.users.count_documents({"role": role["name"], "active": True})
    
    # Get permissions from DB or use defaults
    permissions = role.get("permissions") or DEFAULT_PERMISSIONS.get(role["name"], {})
    
    return RoleResponse(
        id=role["id"],
        name=role["name"],
        display_name=role.get("display_name", role["name"]),
        description=role.get("description"),
        permissions=permissions,
        is_system=True,
        user_count=user_count,
        created_at=role["created_at"]
    )


async def ensure_system_roles():
    """Ensure the 3 system roles exist in database"""
    system_roles = [
        {
            "name": "Administrator",
            "display_name": "Administrator",
            "description": "Full platform control - can manage all modules, users, and settings"
        },
        {
            "name": "Privileged User",
            "display_name": "Privileged User",
            "description": "Manager level access - can manage teams, view reports, create workflows, receive escalations"
        },
        {
            "name": "Standard User",
            "display_name": "Standard User",
            "description": "Basic access - can submit requests, pick orders, view dashboard"
        }
    ]
    
    for role_data in system_roles:
        existing = await db.roles.find_one({"name": role_data["name"]})
        if not existing:
            role = {
                "id": str(uuid.uuid4()),
                "name": role_data["name"],
                "display_name": role_data["display_name"],
                "description": role_data["description"],
                "permissions": DEFAULT_PERMISSIONS.get(role_data["name"], {}),
                "is_system": True,
                "active": True,
                "created_at": get_utc_now()
            }
            await db.roles.insert_one(role)


# ============== ROUTES ==============

@router.get("/permissions/modules")
async def get_permission_modules(current_user: dict = Depends(require_roles(["Administrator"]))):
    """Get list of all permission modules and their available actions"""
    return {
        "modules": PERMISSION_MODULES
    }


@router.get("", response_model=List[RoleResponse])
async def list_roles(current_user: dict = Depends(get_current_user)):
    """List all roles (only 3 system roles)"""
    # Ensure system roles exist
    await ensure_system_roles()
    
    # Only return the 3 system roles
    system_role_names = ["Administrator", "Privileged User", "Standard User"]
    roles = await db.roles.find(
        {"name": {"$in": system_role_names}, "active": True},
        {"_id": 0}
    ).to_list(10)
    
    return [await build_role_response(r) for r in roles]


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(role_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific role"""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return await build_role_response(role)


@router.get("/by-name/{role_name}", response_model=RoleResponse)
async def get_role_by_name(role_name: str, current_user: dict = Depends(get_current_user)):
    """Get a role by name"""
    role = await db.roles.find_one({"name": role_name}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return await build_role_response(role)


@router.patch("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    role_data: RoleUpdate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Update a role's permissions (Admin only)"""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    update_dict = {}
    
    if role_data.description is not None:
        update_dict["description"] = role_data.description
    
    if role_data.permissions is not None:
        # Validate permissions structure
        for module, actions in role_data.permissions.items():
            if module not in PERMISSION_MODULES:
                raise HTTPException(status_code=400, detail=f"Invalid module: {module}")
            for action in actions:
                if action not in PERMISSION_MODULES[module]["actions"]:
                    raise HTTPException(status_code=400, detail=f"Invalid action '{action}' for module '{module}'")
        
        update_dict["permissions"] = role_data.permissions
    
    if update_dict:
        update_dict["updated_at"] = get_utc_now()
        await db.roles.update_one({"id": role_id}, {"$set": update_dict})
    
    updated = await db.roles.find_one({"id": role_id}, {"_id": 0})
    return await build_role_response(updated)


@router.post("/reset-defaults/{role_id}")
async def reset_role_permissions(
    role_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Reset a role's permissions to defaults (Admin only)"""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    default_perms = DEFAULT_PERMISSIONS.get(role["name"])
    if not default_perms:
        raise HTTPException(status_code=400, detail="No default permissions defined for this role")
    
    await db.roles.update_one(
        {"id": role_id},
        {"$set": {"permissions": default_perms, "updated_at": get_utc_now()}}
    )
    
    return {"message": "Permissions reset to defaults"}
