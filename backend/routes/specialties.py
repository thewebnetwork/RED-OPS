"""Specialty management routes - inline creation from User form"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from typing import List

from database import db
from utils.auth import require_roles, get_current_user
from utils.helpers import get_utc_now
from models.identity import SpecialtyCreate, SpecialtyResponse

router = APIRouter(prefix="/specialties", tags=["Specialties"])


async def build_specialty_response(specialty: dict) -> SpecialtyResponse:
    """Build SpecialtyResponse with user count"""
    user_count = await db.users.count_documents({"specialty_id": specialty["id"], "active": True})
    return SpecialtyResponse(
        id=specialty["id"],
        name=specialty["name"],
        description=specialty.get("description"),
        icon=specialty.get("icon"),
        color=specialty.get("color"),
        active=specialty.get("active", True),
        user_count=user_count,
        created_at=specialty["created_at"]
    )


@router.post("", response_model=SpecialtyResponse)
async def create_specialty(
    specialty_data: SpecialtyCreate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Create a new specialty (Admin only - inline from User form)"""
    # Check for duplicate name (case-insensitive)
    existing = await db.specialties.find_one({
        "name": {"$regex": f"^{specialty_data.name}$", "$options": "i"},
        "active": True
    })
    if existing:
        raise HTTPException(status_code=400, detail="Specialty with this name already exists")
    
    specialty = {
        "id": str(uuid.uuid4()),
        "name": specialty_data.name,
        "description": specialty_data.description,
        "icon": specialty_data.icon,
        "color": specialty_data.color,
        "active": True,
        "created_at": get_utc_now()
    }
    
    await db.specialties.insert_one(specialty)
    return await build_specialty_response(specialty)


@router.get("", response_model=List[SpecialtyResponse])
async def list_specialties(current_user: dict = Depends(get_current_user)):
    """List all active specialties"""
    specialties = await db.specialties.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(500)
    return [await build_specialty_response(s) for s in specialties]


@router.get("/all", response_model=List[SpecialtyResponse])
async def list_all_specialties(current_user: dict = Depends(require_roles(["Administrator"]))):
    """List all specialties including inactive (Admin only)"""
    specialties = await db.specialties.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return [await build_specialty_response(s) for s in specialties]


@router.get("/{specialty_id}", response_model=SpecialtyResponse)
async def get_specialty(specialty_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific specialty"""
    specialty = await db.specialties.find_one({"id": specialty_id}, {"_id": 0})
    if not specialty:
        raise HTTPException(status_code=404, detail="Specialty not found")
    return await build_specialty_response(specialty)


@router.delete("/{specialty_id}")
async def delete_specialty(
    specialty_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Delete a specialty (Admin only) - sets users to 'Unassigned'"""
    specialty = await db.specialties.find_one({"id": specialty_id}, {"_id": 0})
    if not specialty:
        raise HTTPException(status_code=404, detail="Specialty not found")
    
    # Check user count
    user_count = await db.users.count_documents({"specialty_id": specialty_id, "active": True})
    
    # Soft delete the specialty
    await db.specialties.update_one(
        {"id": specialty_id},
        {"$set": {"active": False, "deleted_at": get_utc_now()}}
    )
    
    # Set affected users to null specialty
    if user_count > 0:
        await db.users.update_many(
            {"specialty_id": specialty_id},
            {"$set": {"specialty_id": None, "specialty_name": None}}
        )
    
    return {
        "message": "Specialty deleted",
        "affected_users": user_count
    }
