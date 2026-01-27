"""Subscription Plans management routes (Admin only)

Subscription Plans are for Partners only:
- Core
- Engage  
- Lead-to-Cash
- Scale
"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel

from database import db
from utils.auth import require_roles, get_current_user
from utils.helpers import get_utc_now

router = APIRouter(prefix="/subscription-plans", tags=["Subscription Plans"])


# ============== MODELS ==============

class SubscriptionPlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price_monthly: Optional[float] = None
    price_yearly: Optional[float] = None
    features: Optional[List[str]] = None
    sort_order: int = 0


class SubscriptionPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_monthly: Optional[float] = None
    price_yearly: Optional[float] = None
    features: Optional[List[str]] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None


class SubscriptionPlanResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    price_monthly: Optional[float] = None
    price_yearly: Optional[float] = None
    features: Optional[List[str]] = None
    sort_order: int
    active: bool
    user_count: int = 0
    created_at: str


# ============== ROUTES ==============

@router.get("", response_model=List[SubscriptionPlanResponse])
async def list_subscription_plans(current_user: dict = Depends(get_current_user)):
    """List all active subscription plans"""
    plans = await db.subscription_plans.find({"active": True}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    
    # Get user counts
    for plan in plans:
        count = await db.users.count_documents({"subscription_plan_id": plan["id"], "active": True})
        plan["user_count"] = count
    
    return [SubscriptionPlanResponse(**p) for p in plans]


@router.get("/all", response_model=List[SubscriptionPlanResponse])
async def list_all_subscription_plans(current_user: dict = Depends(require_roles(["Administrator"]))):
    """List all subscription plans including inactive (Admin only)"""
    plans = await db.subscription_plans.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    
    for plan in plans:
        count = await db.users.count_documents({"subscription_plan_id": plan["id"]})
        plan["user_count"] = count
    
    return [SubscriptionPlanResponse(**p) for p in plans]


@router.post("", response_model=SubscriptionPlanResponse)
async def create_subscription_plan(
    plan_data: SubscriptionPlanCreate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Create a new subscription plan (Admin only)"""
    # Check for duplicate name
    existing = await db.subscription_plans.find_one({"name": plan_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Subscription plan with this name already exists")
    
    plan = {
        "id": str(uuid.uuid4()),
        "name": plan_data.name,
        "description": plan_data.description,
        "price_monthly": plan_data.price_monthly,
        "price_yearly": plan_data.price_yearly,
        "features": plan_data.features or [],
        "sort_order": plan_data.sort_order,
        "active": True,
        "created_at": get_utc_now()
    }
    
    await db.subscription_plans.insert_one(plan)
    return SubscriptionPlanResponse(**plan, user_count=0)


@router.get("/{plan_id}", response_model=SubscriptionPlanResponse)
async def get_subscription_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific subscription plan"""
    plan = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    
    count = await db.users.count_documents({"subscription_plan_id": plan_id})
    return SubscriptionPlanResponse(**plan, user_count=count)


@router.patch("/{plan_id}", response_model=SubscriptionPlanResponse)
async def update_subscription_plan(
    plan_id: str,
    plan_data: SubscriptionPlanUpdate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Update a subscription plan (Admin only)"""
    plan = await db.subscription_plans.find_one({"id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    
    update_dict = {k: v for k, v in plan_data.model_dump().items() if v is not None}
    
    if "name" in update_dict:
        existing = await db.subscription_plans.find_one({"name": update_dict["name"], "id": {"$ne": plan_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Subscription plan with this name already exists")
    
    if update_dict:
        await db.subscription_plans.update_one({"id": plan_id}, {"$set": update_dict})
        # Update name in users if changed
        if "name" in update_dict:
            await db.users.update_many(
                {"subscription_plan_id": plan_id},
                {"$set": {"subscription_plan_name": update_dict["name"], "access_tier_name": update_dict["name"]}}
            )
    
    updated = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
    count = await db.users.count_documents({"subscription_plan_id": plan_id})
    return SubscriptionPlanResponse(**updated, user_count=count)


@router.delete("/{plan_id}")
async def delete_subscription_plan(plan_id: str, current_user: dict = Depends(require_roles(["Administrator"]))):
    """Soft delete a subscription plan (Admin only)"""
    plan = await db.subscription_plans.find_one({"id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    
    # Check if any active users have this plan
    user_count = await db.users.count_documents({"subscription_plan_id": plan_id, "active": True})
    if user_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete plan with {user_count} active users")
    
    await db.subscription_plans.update_one({"id": plan_id}, {"$set": {"active": False}})
    return {"message": "Subscription plan deactivated"}
