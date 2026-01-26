"""Access Tier management routes - inline creation from User form"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from typing import List

from database import db
from utils.auth import require_roles, get_current_user
from utils.helpers import get_utc_now
from models.identity import AccessTierCreate, AccessTierResponse

router = APIRouter(prefix="/access-tiers", tags=["Access Tiers"])


async def build_tier_response(tier: dict) -> AccessTierResponse:
    """Build AccessTierResponse with user count"""
    user_count = await db.users.count_documents({"access_tier_id": tier["id"], "active": True})
    return AccessTierResponse(
        id=tier["id"],
        name=tier["name"],
        description=tier.get("description"),
        sort_order=tier.get("sort_order", 0),
        active=tier.get("active", True),
        user_count=user_count,
        created_at=tier["created_at"]
    )


@router.post("", response_model=AccessTierResponse)
async def create_access_tier(
    tier_data: AccessTierCreate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Create a new access tier (Admin only - inline from User form)"""
    # Check for duplicate name (case-insensitive)
    existing = await db.access_tiers.find_one({
        "name": {"$regex": f"^{tier_data.name}$", "$options": "i"},
        "active": True
    })
    if existing:
        raise HTTPException(status_code=400, detail="Access tier with this name already exists")
    
    # Get next sort order if not provided
    sort_order = tier_data.sort_order
    if sort_order == 0:
        max_order = await db.access_tiers.find_one(
            {"active": True},
            {"_id": 0, "sort_order": 1},
            sort=[("sort_order", -1)]
        )
        sort_order = (max_order.get("sort_order", 0) + 1) if max_order else 1
    
    tier = {
        "id": str(uuid.uuid4()),
        "name": tier_data.name,
        "description": tier_data.description,
        "sort_order": sort_order,
        "active": True,
        "created_at": get_utc_now()
    }
    
    await db.access_tiers.insert_one(tier)
    return await build_tier_response(tier)


@router.get("", response_model=List[AccessTierResponse])
async def list_access_tiers(current_user: dict = Depends(get_current_user)):
    """List all active access tiers"""
    tiers = await db.access_tiers.find({"active": True}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return [await build_tier_response(t) for t in tiers]


@router.get("/all", response_model=List[AccessTierResponse])
async def list_all_access_tiers(current_user: dict = Depends(require_roles(["Administrator"]))):
    """List all access tiers including inactive (Admin only)"""
    tiers = await db.access_tiers.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return [await build_tier_response(t) for t in tiers]


@router.get("/{tier_id}", response_model=AccessTierResponse)
async def get_access_tier(tier_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific access tier"""
    tier = await db.access_tiers.find_one({"id": tier_id}, {"_id": 0})
    if not tier:
        raise HTTPException(status_code=404, detail="Access tier not found")
    return await build_tier_response(tier)


@router.delete("/{tier_id}")
async def delete_access_tier(
    tier_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Delete an access tier (Admin only) - sets users to 'Unassigned'"""
    tier = await db.access_tiers.find_one({"id": tier_id}, {"_id": 0})
    if not tier:
        raise HTTPException(status_code=404, detail="Access tier not found")
    
    # Check user count
    user_count = await db.users.count_documents({"access_tier_id": tier_id, "active": True})
    
    # Soft delete the tier
    await db.access_tiers.update_one(
        {"id": tier_id},
        {"$set": {"active": False, "deleted_at": get_utc_now()}}
    )
    
    # Set affected users to null tier
    if user_count > 0:
        await db.users.update_many(
            {"access_tier_id": tier_id},
            {"$set": {"access_tier_id": None, "access_tier_name": None}}
        )
    
    return {
        "message": "Access tier deleted",
        "affected_users": user_count
    }
