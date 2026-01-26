"""Escalation policy management routes"""
import uuid
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List

from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import get_utc_now
from models.escalation import (
    EscalationPolicyCreate,
    EscalationPolicyUpdate,
    EscalationPolicyResponse,
    EscalationHistoryEntry,
    EscalatedOrderResponse,
    AcknowledgeEscalation
)
from services.escalation_engine import get_escalated_orders_summary, check_and_process_escalations

router = APIRouter(prefix="/escalation", tags=["Escalation"])


# ============== HELPER FUNCTIONS ==============

async def get_category_names(category_ids: List[str], collection_name: str) -> List[str]:
    """Get category names from IDs"""
    if not category_ids:
        return []
    
    collection = db.categories_l1 if collection_name == "l1" else db.categories_l2
    names = []
    for cat_id in category_ids:
        cat = await collection.find_one({"id": cat_id}, {"_id": 0, "name": 1})
        if cat:
            names.append(cat["name"])
    return names


def policy_to_response(policy: dict, l1_names: List[str], l2_names: List[str]) -> EscalationPolicyResponse:
    """Convert policy dict to response model"""
    return EscalationPolicyResponse(
        id=policy["id"],
        name=policy["name"],
        description=policy.get("description"),
        trigger=policy.get("trigger", "both"),
        category_l1_ids=policy.get("category_l1_ids", []),
        category_l1_names=l1_names,
        category_l2_ids=policy.get("category_l2_ids", []),
        category_l2_names=l2_names,
        priorities=policy.get("priorities", []),
        levels=policy.get("levels", []),
        cooldown_minutes=policy.get("cooldown_minutes", 30),
        is_active=policy.get("is_active", True),
        created_at=policy.get("created_at", ""),
        updated_at=policy.get("updated_at")
    )


# ============== POLICY CRUD ROUTES ==============

@router.post("/policies", response_model=EscalationPolicyResponse)
async def create_escalation_policy(
    policy_data: EscalationPolicyCreate,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Create a new escalation policy"""
    # Check for duplicate name
    existing = await db.escalation_policies.find_one({"name": policy_data.name, "is_active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Policy with this name already exists")
    
    now = get_utc_now()
    
    # Convert levels to dicts
    levels_data = [level.model_dump() for level in policy_data.levels]
    
    policy = {
        "id": str(uuid.uuid4()),
        "name": policy_data.name,
        "description": policy_data.description,
        "trigger": policy_data.trigger.value,
        "category_l1_ids": policy_data.category_l1_ids,
        "category_l2_ids": policy_data.category_l2_ids,
        "priorities": policy_data.priorities,
        "levels": levels_data,
        "cooldown_minutes": policy_data.cooldown_minutes,
        "is_active": policy_data.is_active,
        "created_at": now,
        "created_by_id": current_user["id"],
        "created_by_name": current_user["name"]
    }
    
    await db.escalation_policies.insert_one(policy)
    
    # Get category names for response
    l1_names = await get_category_names(policy_data.category_l1_ids, "l1")
    l2_names = await get_category_names(policy_data.category_l2_ids, "l2")
    
    return policy_to_response(policy, l1_names, l2_names)


@router.get("/policies", response_model=List[EscalationPolicyResponse])
async def list_escalation_policies(
    active_only: bool = True,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """List all escalation policies"""
    query = {}
    if active_only:
        query["is_active"] = True
    
    policies = await db.escalation_policies.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    
    results = []
    for policy in policies:
        l1_names = await get_category_names(policy.get("category_l1_ids", []), "l1")
        l2_names = await get_category_names(policy.get("category_l2_ids", []), "l2")
        results.append(policy_to_response(policy, l1_names, l2_names))
    
    return results


@router.get("/policies/{policy_id}", response_model=EscalationPolicyResponse)
async def get_escalation_policy(
    policy_id: str,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Get a specific escalation policy"""
    policy = await db.escalation_policies.find_one({"id": policy_id}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    l1_names = await get_category_names(policy.get("category_l1_ids", []), "l1")
    l2_names = await get_category_names(policy.get("category_l2_ids", []), "l2")
    
    return policy_to_response(policy, l1_names, l2_names)


@router.put("/policies/{policy_id}", response_model=EscalationPolicyResponse)
async def update_escalation_policy(
    policy_id: str,
    policy_data: EscalationPolicyUpdate,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Update an escalation policy"""
    policy = await db.escalation_policies.find_one({"id": policy_id}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    update_dict = {}
    for key, value in policy_data.model_dump().items():
        if value is not None:
            if key == "trigger":
                update_dict[key] = value.value if hasattr(value, 'value') else value
            elif key == "levels":
                update_dict[key] = [l.model_dump() if hasattr(l, 'model_dump') else l for l in value]
            else:
                update_dict[key] = value
    
    update_dict["updated_at"] = get_utc_now()
    update_dict["updated_by_id"] = current_user["id"]
    update_dict["updated_by_name"] = current_user["name"]
    
    await db.escalation_policies.update_one({"id": policy_id}, {"$set": update_dict})
    
    updated = await db.escalation_policies.find_one({"id": policy_id}, {"_id": 0})
    l1_names = await get_category_names(updated.get("category_l1_ids", []), "l1")
    l2_names = await get_category_names(updated.get("category_l2_ids", []), "l2")
    
    return policy_to_response(updated, l1_names, l2_names)


@router.delete("/policies/{policy_id}")
async def delete_escalation_policy(
    policy_id: str,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Soft delete an escalation policy"""
    result = await db.escalation_policies.update_one(
        {"id": policy_id},
        {"$set": {"is_active": False, "updated_at": get_utc_now()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    return {"message": "Policy deleted"}


# ============== ESCALATED ORDERS ROUTES ==============

@router.get("/orders", response_model=List[EscalatedOrderResponse])
async def get_escalated_orders(
    level: Optional[int] = None,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Get all currently escalated orders"""
    summaries = await get_escalated_orders_summary()
    
    if level:
        summaries = [s for s in summaries if s["current_escalation_level"] == level]
    
    return [EscalatedOrderResponse(**s) for s in summaries]


@router.get("/orders/count")
async def get_escalated_orders_count(current_user: dict = Depends(require_roles(["Admin"]))):
    """Get count of escalated orders by level"""
    summaries = await get_escalated_orders_summary()
    
    counts = {"total": len(summaries), "by_level": {}}
    for s in summaries:
        level = s["current_escalation_level"]
        counts["by_level"][level] = counts["by_level"].get(level, 0) + 1
    
    return counts


# ============== ESCALATION HISTORY ROUTES ==============

@router.get("/history/{order_id}", response_model=List[EscalationHistoryEntry])
async def get_order_escalation_history(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get escalation history for a specific order"""
    history = await db.escalation_history.find(
        {"order_id": order_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return [EscalationHistoryEntry(**h) for h in history]


@router.post("/history/{escalation_id}/acknowledge")
async def acknowledge_escalation(
    escalation_id: str,
    ack_data: AcknowledgeEscalation,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Acknowledge an escalation"""
    result = await db.escalation_history.update_one(
        {"id": escalation_id},
        {"$set": {
            "acknowledged": True,
            "acknowledged_by_id": current_user["id"],
            "acknowledged_by_name": current_user["name"],
            "acknowledged_at": get_utc_now(),
            "acknowledgment_notes": ack_data.notes
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Escalation not found")
    
    return {"message": "Escalation acknowledged"}


# ============== MANUAL TRIGGER ==============

@router.post("/check")
async def trigger_escalation_check(current_user: dict = Depends(require_roles(["Admin"]))):
    """Manually trigger escalation check (for testing)"""
    await check_and_process_escalations()
    return {"message": "Escalation check completed"}


# ============== STATS ==============

@router.get("/stats")
async def get_escalation_stats(current_user: dict = Depends(require_roles(["Admin"]))):
    """Get escalation statistics"""
    # Total escalations today
    from datetime import datetime, timezone, timedelta
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_today = await db.escalation_history.count_documents({
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    # Total escalations this week
    week_start = today_start - timedelta(days=today_start.weekday())
    total_week = await db.escalation_history.count_documents({
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    # Acknowledged vs unacknowledged
    unacknowledged = await db.escalation_history.count_documents({
        "acknowledged": False
    })
    
    # By trigger type
    sla_warning_count = await db.escalation_history.count_documents({
        "trigger_type": "sla_warning"
    })
    sla_breach_count = await db.escalation_history.count_documents({
        "trigger_type": "sla_breach"
    })
    
    # Active policies
    active_policies = await db.escalation_policies.count_documents({"is_active": True})
    
    # Currently escalated orders
    escalated_orders = await db.orders.count_documents({
        "current_escalation_level": {"$exists": True, "$gt": 0},
        "status": {"$in": ["Open", "In Progress", "Pending"]}
    })
    
    return {
        "escalations_today": total_today,
        "escalations_this_week": total_week,
        "unacknowledged": unacknowledged,
        "by_trigger": {
            "sla_warning": sla_warning_count,
            "sla_breach": sla_breach_count
        },
        "active_policies": active_policies,
        "currently_escalated_orders": escalated_orders
    }
