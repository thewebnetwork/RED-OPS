"""Unified SLA & Escalation Policy routes"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List

from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import get_utc_now

logger = logging.getLogger(__name__)

from models.sla_policy import (
    SLAPolicyCreate,
    SLAPolicyUpdate,
    SLAPolicyResponse,
    MonitoringOrderResponse,
    EscalationHistoryResponse
)

router = APIRouter(prefix="/sla-policies", tags=["SLA & Escalation Policies"])


# ============== HELPER FUNCTIONS ==============

async def get_scope_names(scope: dict) -> dict:
    """Populate name fields for scope IDs"""
    result = {**scope}
    
    # Role names
    if scope.get("role_ids"):
        names = []
        for role_id in scope["role_ids"]:
            role = await db.roles.find_one({"id": role_id}, {"_id": 0, "name": 1})
            if role:
                names.append(role["name"])
        result["role_names"] = names
    
    # Team names
    if scope.get("team_ids"):
        names = []
        for team_id in scope["team_ids"]:
            team = await db.teams.find_one({"id": team_id}, {"_id": 0, "name": 1})
            if team:
                names.append(team["name"])
        result["team_names"] = names
    
    # Specialty names
    if scope.get("specialty_ids"):
        names = []
        for specialty_id in scope["specialty_ids"]:
            specialty = await db.specialties.find_one({"id": specialty_id}, {"_id": 0, "name": 1})
            if specialty:
                names.append(specialty["name"])
        result["specialty_names"] = names
    
    # Access Tier names
    if scope.get("access_tier_ids"):
        names = []
        for tier_id in scope["access_tier_ids"]:
            tier = await db.access_tiers.find_one({"id": tier_id}, {"_id": 0, "name": 1})
            if tier:
                names.append(tier["name"])
        result["access_tier_names"] = names
    
    return result


async def get_orders_count_for_policy(policy_id: str) -> int:
    """Count orders that have this policy applied"""
    return await db.orders.count_documents({
        "sla_policy_id": policy_id,
        "status": {"$nin": ["Delivered", "Closed"]}
    })


def policy_to_response(policy: dict, orders_count: int = 0) -> SLAPolicyResponse:
    """Convert policy dict to response model"""
    return SLAPolicyResponse(
        id=policy["id"],
        name=policy["name"],
        description=policy.get("description"),
        scope=policy.get("scope", {}),
        sla_rules=policy.get("sla_rules", {}),
        thresholds=policy.get("thresholds", {}),
        escalation_levels=policy.get("escalation_levels", []),
        is_active=policy.get("is_active", True),
        orders_count=orders_count,
        created_at=policy.get("created_at", ""),
        created_by_name=policy.get("created_by_name"),
        updated_at=policy.get("updated_at")
    )


def calculate_time_remaining(deadline_str: str) -> tuple:
    """Calculate time remaining until deadline"""
    if not deadline_str:
        return None, None
    
    try:
        deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        diff = deadline - now
        
        total_minutes = int(diff.total_seconds() / 60)
        
        if total_minutes <= 0:
            return "Breached", total_minutes
        
        days = diff.days
        hours = diff.seconds // 3600
        minutes = (diff.seconds % 3600) // 60
        
        if days > 0:
            return f"{days}d {hours}h", total_minutes
        elif hours > 0:
            return f"{hours}h {minutes}m", total_minutes
        else:
            return f"{minutes}m", total_minutes
    except (ValueError, TypeError):
        return None, None


def get_sla_status(deadline_str: str, at_risk_minutes: int = 240) -> str:
    """Determine SLA status based on deadline"""
    if not deadline_str:
        return "unknown"
    
    try:
        deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        
        if now > deadline:
            return "breached"
        elif now > deadline - timedelta(minutes=at_risk_minutes):
            return "at_risk"
        else:
            return "on_track"
    except (ValueError, TypeError):
        return "unknown"


# ============== POLICY CRUD ROUTES ==============

@router.post("", response_model=SLAPolicyResponse)
async def create_sla_policy(
    policy_data: SLAPolicyCreate,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Create a new SLA & Escalation policy"""
    existing = await db.sla_policies.find_one({"name": policy_data.name, "is_active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Policy with this name already exists")
    
    now = get_utc_now()
    
    # Populate scope names
    scope_with_names = await get_scope_names(policy_data.scope.model_dump())
    
    policy = {
        "id": str(uuid.uuid4()),
        "name": policy_data.name,
        "description": policy_data.description,
        "scope": scope_with_names,
        "sla_rules": policy_data.sla_rules.model_dump(),
        "thresholds": policy_data.thresholds.model_dump(),
        "escalation_levels": [level.model_dump() for level in policy_data.escalation_levels],
        "is_active": policy_data.is_active,
        "created_at": now,
        "created_by_id": current_user["id"],
        "created_by_name": current_user["name"]
    }
    
    await db.sla_policies.insert_one(policy)
    
    return policy_to_response(policy, 0)


@router.get("", response_model=List[SLAPolicyResponse])
async def list_sla_policies(
    active_only: bool = True,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """List all SLA & Escalation policies"""
    query = {}
    if active_only:
        query["is_active"] = True
    
    policies = await db.sla_policies.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    
    results = []
    for policy in policies:
        orders_count = await get_orders_count_for_policy(policy["id"])
        results.append(policy_to_response(policy, orders_count))
    
    return results


@router.get("/{policy_id}", response_model=SLAPolicyResponse)
async def get_sla_policy(
    policy_id: str,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Get a specific SLA & Escalation policy"""
    policy = await db.sla_policies.find_one({"id": policy_id}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    orders_count = await get_orders_count_for_policy(policy_id)
    return policy_to_response(policy, orders_count)


@router.put("/{policy_id}", response_model=SLAPolicyResponse)
async def update_sla_policy(
    policy_id: str,
    policy_data: SLAPolicyUpdate,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Update an SLA & Escalation policy"""
    policy = await db.sla_policies.find_one({"id": policy_id}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    update_dict = {}
    for key, value in policy_data.model_dump().items():
        if value is not None:
            if key == "scope":
                update_dict[key] = await get_scope_names(value)
            elif key == "sla_rules":
                update_dict[key] = value
            elif key == "thresholds":
                update_dict[key] = value
            elif key == "escalation_levels":
                update_dict[key] = [l if isinstance(l, dict) else l.model_dump() for l in value]
            else:
                update_dict[key] = value
    
    update_dict["updated_at"] = get_utc_now()
    update_dict["updated_by_id"] = current_user["id"]
    update_dict["updated_by_name"] = current_user["name"]
    
    await db.sla_policies.update_one({"id": policy_id}, {"$set": update_dict})
    
    updated = await db.sla_policies.find_one({"id": policy_id}, {"_id": 0})
    orders_count = await get_orders_count_for_policy(policy_id)
    return policy_to_response(updated, orders_count)


@router.delete("/{policy_id}")
async def delete_sla_policy(
    policy_id: str,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Soft delete an SLA & Escalation policy"""
    result = await db.sla_policies.update_one(
        {"id": policy_id},
        {"$set": {"is_active": False, "updated_at": get_utc_now()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    return {"message": "Policy deleted"}


# ============== MONITORING ROUTES ==============

@router.get("/monitoring/at-risk", response_model=List[MonitoringOrderResponse])
async def get_at_risk_orders(
    limit: int = 50,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Get orders that are at risk of SLA breach"""
    now = datetime.now(timezone.utc)
    
    # Get all active policies to check their at_risk thresholds
    policies = await db.sla_policies.find({"is_active": True}, {"_id": 0}).to_list(100)
    policy_map = {p["id"]: p for p in policies}
    
    # Default at-risk threshold: 4 hours (240 minutes)
    default_at_risk = 240
    
    orders = await db.orders.find({
        "status": {"$nin": ["Delivered", "Closed"]},
        "sla_deadline": {"$exists": True, "$ne": None},
        "is_sla_breached": {"$ne": True}
    }, {"_id": 0}).sort("sla_deadline", 1).to_list(500)
    
    at_risk_orders = []
    for order in orders:
        policy = policy_map.get(order.get("sla_policy_id"))
        at_risk_minutes = default_at_risk
        if policy and policy.get("thresholds", {}).get("at_risk_minutes"):
            at_risk_minutes = policy["thresholds"]["at_risk_minutes"]
        
        status = get_sla_status(order.get("sla_deadline"), at_risk_minutes)
        if status == "at_risk":
            time_remaining, time_remaining_min = calculate_time_remaining(order.get("sla_deadline"))
            at_risk_orders.append(MonitoringOrderResponse(
                id=order["id"],
                order_code=order.get("order_code", ""),
                title=order.get("title", ""),
                status=order.get("status", ""),
                priority=order.get("priority", "Normal"),
                sla_deadline=order.get("sla_deadline"),
                sla_status="at_risk",
                time_remaining=time_remaining,
                time_remaining_minutes=time_remaining_min,
                policy_id=order.get("sla_policy_id"),
                policy_name=policy["name"] if policy else None,
                current_escalation_level=order.get("current_escalation_level", 0),
                assigned_to=order.get("editor_name"),
                requester_name=order.get("requester_name", "Unknown"),
                created_at=order.get("created_at", "")
            ))
            if len(at_risk_orders) >= limit:
                break
    
    return at_risk_orders


@router.get("/monitoring/breached", response_model=List[MonitoringOrderResponse])
async def get_breached_orders(
    limit: int = 50,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Get orders that have breached SLA"""
    orders = await db.orders.find({
        "status": {"$nin": ["Delivered", "Closed"]},
        "is_sla_breached": True
    }, {"_id": 0}).sort("sla_deadline", 1).limit(limit).to_list(limit)
    
    # Get policies for name lookup
    policies = await db.sla_policies.find({"is_active": True}, {"_id": 0}).to_list(100)
    policy_map = {p["id"]: p for p in policies}
    
    results = []
    for order in orders:
        policy = policy_map.get(order.get("sla_policy_id"))
        time_remaining, time_remaining_min = calculate_time_remaining(order.get("sla_deadline"))
        results.append(MonitoringOrderResponse(
            id=order["id"],
            order_code=order.get("order_code", ""),
            title=order.get("title", ""),
            status=order.get("status", ""),
            priority=order.get("priority", "Normal"),
            sla_deadline=order.get("sla_deadline"),
            sla_status="breached",
            time_remaining=time_remaining,
            time_remaining_minutes=time_remaining_min,
            policy_id=order.get("sla_policy_id"),
            policy_name=policy["name"] if policy else None,
            current_escalation_level=order.get("current_escalation_level", 0),
            assigned_to=order.get("editor_name"),
            requester_name=order.get("requester_name", "Unknown"),
            created_at=order.get("created_at", "")
        ))
    
    return results


@router.get("/monitoring/history", response_model=List[EscalationHistoryResponse])
async def get_escalation_history(
    order_id: Optional[str] = None,
    policy_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Get escalation history log"""
    query = {}
    if order_id:
        query["order_id"] = order_id
    if policy_id:
        query["policy_id"] = policy_id
    
    history = await db.escalation_history.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [EscalationHistoryResponse(**h) for h in history]


@router.post("/monitoring/history/{escalation_id}/acknowledge")
async def acknowledge_escalation(
    escalation_id: str,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Acknowledge an escalation"""
    result = await db.escalation_history.update_one(
        {"id": escalation_id},
        {"$set": {
            "acknowledged": True,
            "acknowledged_by_id": current_user["id"],
            "acknowledged_by_name": current_user["name"],
            "acknowledged_at": get_utc_now()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Escalation not found")
    
    return {"message": "Escalation acknowledged"}


@router.get("/monitoring/stats")
async def get_monitoring_stats(current_user: dict = Depends(require_roles(["Admin"]))):
    """Get SLA monitoring statistics"""
    now = datetime.now(timezone.utc)
    
    # Active orders
    active_query = {"status": {"$nin": ["Delivered", "Closed"]}}
    total_active = await db.orders.count_documents(active_query)
    
    # Breached orders
    breached_count = await db.orders.count_documents({
        **active_query,
        "is_sla_breached": True
    })
    
    # At risk (within 4 hours of deadline)
    warning_threshold = now + timedelta(hours=4)
    at_risk_count = await db.orders.count_documents({
        **active_query,
        "is_sla_breached": {"$ne": True},
        "sla_deadline": {"$lte": warning_threshold.isoformat(), "$gt": now.isoformat()}
    })
    
    # On track
    on_track_count = total_active - breached_count - at_risk_count
    
    # Escalations today
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    escalations_today = await db.escalation_history.count_documents({
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    # Unacknowledged escalations
    unacknowledged = await db.escalation_history.count_documents({
        "acknowledged": False
    })
    
    # Active policies
    active_policies = await db.sla_policies.count_documents({"is_active": True})
    
    return {
        "orders": {
            "total_active": total_active,
            "on_track": on_track_count,
            "at_risk": at_risk_count,
            "breached": breached_count
        },
        "escalations": {
            "today": escalations_today,
            "unacknowledged": unacknowledged
        },
        "policies": {
            "active": active_policies
        }
    }


# ============== POLICY APPLICATION ROUTES ==============

@router.post("/apply/{policy_id}/order/{order_id}")
async def apply_policy_to_order(
    policy_id: str,
    order_id: str,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Manually apply a policy to an order"""
    policy = await db.sla_policies.find_one({"id": policy_id, "is_active": True}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Calculate new SLA deadline based on policy
    sla_minutes = policy.get("sla_rules", {}).get("duration_minutes", 1440)  # Default 24 hours
    now = datetime.now(timezone.utc)
    deadline = now + timedelta(minutes=sla_minutes)
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "sla_policy_id": policy_id,
            "sla_policy_name": policy["name"],
            "sla_deadline": deadline.isoformat(),
            "is_sla_breached": False,
            "current_escalation_level": 0
        }}
    )
    
    return {
        "message": "Policy applied",
        "policy_name": policy["name"],
        "sla_deadline": deadline.isoformat()
    }


# ============== TRIGGER CHECK ==============

@router.post("/check")
async def trigger_policy_check(current_user: dict = Depends(require_roles(["Admin"]))):
    """Manually trigger SLA policy check (for testing)"""
    from services.sla_policy_engine import check_and_process_policies
    result = await check_and_process_policies()
    return {"message": "Policy check completed", **result}
