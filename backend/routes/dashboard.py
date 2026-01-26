"""Dashboard and statistics routes"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ============== MODELS ==============

class DashboardStats(BaseModel):
    open_count: int
    in_progress_count: int
    pending_count: int
    delivered_count: int
    sla_breaching_count: int
    orders_responded_count: int = 0
    feature_requests_count: int = 0
    bug_reports_count: int = 0


# ============== ROUTES ==============

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard statistics for current user"""
    user_role = current_user["role"]
    user_id = current_user["id"]
    
    # Check if user's role can pick orders
    role_doc = await db.roles.find_one({"name": user_role}, {"_id": 0})
    can_pick_orders = role_doc.get("can_pick_orders", False) if role_doc else False
    
    # Base query depends on role
    if user_role == "Admin":
        # Admin sees all orders
        base_query = {}
    elif can_pick_orders:
        # Service providers see orders they're assigned to OR open orders
        base_query = {"$or": [{"editor_id": user_id}, {"editor_id": None, "status": "Open"}]}
    else:
        # Requesters see only their own orders
        base_query = {"requester_id": user_id}
    
    # Count by status
    open_count = await db.orders.count_documents({**base_query, "status": "Open"})
    in_progress_count = await db.orders.count_documents({**base_query, "status": "In Progress"})
    pending_count = await db.orders.count_documents({**base_query, "status": "Pending"})
    delivered_count = await db.orders.count_documents({**base_query, "status": "Delivered"})
    
    # SLA breaching count - only non-delivered/non-closed orders
    sla_breaching_count = await db.orders.count_documents({
        **base_query,
        "status": {"$nin": ["Delivered", "Closed"]},
        "is_sla_breached": True
    })
    
    # Additional counts for requesters
    orders_responded_count = 0
    feature_requests_count = 0
    bug_reports_count = 0
    
    if user_role == "Requester" or user_role == "Admin":
        query = {} if user_role == "Admin" else {"requester_id": user_id}
        feature_requests_count = await db.feature_requests.count_documents(query)
        bug_reports_count = await db.bug_reports.count_documents(query)
    
    return DashboardStats(
        open_count=open_count,
        in_progress_count=in_progress_count,
        pending_count=pending_count,
        delivered_count=delivered_count,
        sla_breaching_count=sla_breaching_count,
        orders_responded_count=orders_responded_count,
        feature_requests_count=feature_requests_count,
        bug_reports_count=bug_reports_count
    )


@router.get("/activity")
async def get_recent_activity(limit: int = 10, current_user: dict = Depends(get_current_user)):
    """Get recent activity for dashboard"""
    user_role = current_user["role"]
    user_id = current_user["id"]
    
    # Build query based on role
    if user_role == "Admin":
        query = {}
    else:
        query = {"$or": [{"requester_id": user_id}, {"editor_id": user_id}]}
    
    # Get recent orders with activity
    orders = await db.orders.find(
        query,
        {"_id": 0}
    ).sort("updated_at", -1).limit(limit).to_list(limit)
    
    return {"activity": orders}


@router.get("/quick-stats")
async def get_quick_stats(current_user: dict = Depends(get_current_user)):
    """Get quick statistics overview"""
    user_role = current_user["role"]
    
    stats = {
        "total_users": 0,
        "total_orders": 0,
        "total_workflows": 0,
        "active_announcements": 0
    }
    
    if user_role == "Admin":
        stats["total_users"] = await db.users.count_documents({"active": True})
        stats["total_orders"] = await db.orders.count_documents({})
        stats["total_workflows"] = await db.workflows.count_documents({"active": True})
        
        # Active announcements
        ann = await db.announcement_settings.find_one({"is_active": True}, {"_id": 0})
        stats["active_announcements"] = 1 if ann else 0
    
    return stats
