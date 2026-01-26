"""SLA monitoring routes"""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

from database import db
from utils.auth import require_roles, get_current_user
from utils.helpers import get_utc_now
from config import SLA_WARNING_HOURS, SLA_DAYS

router = APIRouter(prefix="/sla", tags=["SLA"])


# ============== ROUTES ==============

@router.get("/stats")
async def get_sla_stats(current_user: dict = Depends(require_roles(["Admin"]))):
    """Get SLA statistics"""
    now = datetime.now(timezone.utc)
    warning_threshold = now + timedelta(hours=SLA_WARNING_HOURS)
    
    # Total active orders (not delivered/closed)
    active_query = {"status": {"$nin": ["Delivered", "Closed"]}}
    total_active = await db.orders.count_documents(active_query)
    
    # Breached orders
    breached_count = await db.orders.count_documents({
        **active_query,
        "is_sla_breached": True
    })
    
    # At risk (within warning threshold)
    at_risk_count = await db.orders.count_documents({
        **active_query,
        "is_sla_breached": False,
        "sla_deadline": {"$lte": warning_threshold.isoformat(), "$gt": now.isoformat()}
    })
    
    # On track
    on_track_count = total_active - breached_count - at_risk_count
    
    # Get recent breaches for the last 30 days
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    recent_breaches = await db.orders.count_documents({
        "is_sla_breached": True,
        "created_at": {"$gte": thirty_days_ago}
    })
    
    return {
        "total_active": total_active,
        "breached": breached_count,
        "at_risk": at_risk_count,
        "on_track": on_track_count,
        "breach_rate": round((breached_count / total_active * 100) if total_active > 0 else 0, 1),
        "recent_breaches_30d": recent_breaches,
        "sla_days": SLA_DAYS,
        "warning_hours": SLA_WARNING_HOURS
    }


@router.get("/alerts")
async def get_sla_alerts(
    status: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Get SLA alerts (breached and at-risk orders)"""
    query = {}
    if status:
        query["status"] = status
    
    alerts = await db.sla_alerts.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return alerts


@router.get("/breached-orders")
async def get_breached_orders(
    limit: int = 50,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Get list of SLA breached orders"""
    orders = await db.orders.find(
        {"is_sla_breached": True, "status": {"$nin": ["Delivered", "Closed"]}},
        {"_id": 0}
    ).sort("sla_deadline", 1).limit(limit).to_list(limit)
    
    return orders


@router.get("/at-risk-orders")
async def get_at_risk_orders(
    limit: int = 50,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Get list of orders at risk of SLA breach"""
    now = datetime.now(timezone.utc)
    warning_threshold = now + timedelta(hours=SLA_WARNING_HOURS)
    
    orders = await db.orders.find(
        {
            "is_sla_breached": False,
            "status": {"$nin": ["Delivered", "Closed"]},
            "sla_deadline": {
                "$lte": warning_threshold.isoformat(),
                "$gt": now.isoformat()
            }
        },
        {"_id": 0}
    ).sort("sla_deadline", 1).limit(limit).to_list(limit)
    
    return orders


@router.patch("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Acknowledge an SLA alert"""
    result = await db.sla_alerts.update_one(
        {"id": alert_id},
        {"$set": {
            "acknowledged": True,
            "acknowledged_by": current_user["id"],
            "acknowledged_at": get_utc_now()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert acknowledged"}


@router.delete("/alerts/{alert_id}")
async def dismiss_alert(alert_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Dismiss/delete an SLA alert"""
    result = await db.sla_alerts.delete_one({"id": alert_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert dismissed"}


@router.get("/settings")
async def get_sla_settings(current_user: dict = Depends(require_roles(["Admin"]))):
    """Get current SLA settings"""
    return {
        "sla_days": SLA_DAYS,
        "warning_hours": SLA_WARNING_HOURS,
        "auto_escalation_enabled": False,  # Future feature
        "escalation_threshold_hours": 24  # Future feature
    }
