"""Dashboard and statistics routes"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import normalize_order, is_sla_breached

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


class OrderResponse(BaseModel):
    id: str
    order_code: str
    request_type: str
    requester_id: str
    requester_name: str
    requester_email: str
    editor_id: Optional[str] = None
    editor_name: Optional[str] = None
    title: str
    category_l1_id: Optional[str] = None
    category_l1_name: Optional[str] = None
    category_l2_id: Optional[str] = None
    category_l2_name: Optional[str] = None
    status: str
    priority: str
    description: str
    video_script: Optional[str] = None
    reference_links: Optional[str] = None
    footage_links: Optional[str] = None
    music_preference: Optional[str] = None
    delivery_format: Optional[str] = None
    special_instructions: Optional[str] = None
    close_reason: Optional[str] = None
    closed_at: Optional[str] = None
    sla_deadline: str
    is_sla_breached: bool
    created_at: str
    updated_at: str
    picked_at: Optional[str] = None
    delivered_at: Optional[str] = None


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


# ============== HELPER FUNCTIONS ==============

async def get_role_by_name(role_name: str):
    """Get role document by name"""
    return await db.roles.find_one({"name": role_name}, {"_id": 0})


def enrich_orders(orders):
    """Enrich orders with is_sla_breached flag"""
    result = []
    for o in orders:
        o = normalize_order(o)
        result.append(OrderResponse(
            **o,
            is_sla_breached=is_sla_breached(o.get('sla_deadline', ''), o.get('status', ''))
        ))
    return result


# ============== EDITOR/REQUESTER DASHBOARDS ==============

@router.get("/editor")
async def get_editor_dashboard(current_user: dict = Depends(get_current_user)):
    """Dashboard for service providers who can pick orders"""
    # Check if user's role can pick orders
    role = await get_role_by_name(current_user["role"])
    if not role or not role.get("can_pick_orders"):
        raise HTTPException(status_code=403, detail="Your role cannot pick orders")
    
    now = datetime.now(timezone.utc).isoformat()
    
    new_orders = await db.orders.find({"status": "Open"}, {"_id": 0}).sort("created_at", 1).to_list(100)
    in_progress = await db.orders.find({"editor_id": current_user["id"], "status": "In Progress", "last_responded_at": None}, {"_id": 0}).to_list(100)
    pending_review = await db.orders.find({"editor_id": current_user["id"], "status": "Pending"}, {"_id": 0}).to_list(100)
    responded = await db.orders.find({"editor_id": current_user["id"], "status": "In Progress", "last_responded_at": {"$ne": None}}, {"_id": 0}).to_list(100)
    delivered = await db.orders.find({"editor_id": current_user["id"], "status": "Delivered"}, {"_id": 0}).sort("delivered_at", -1).limit(20).to_list(20)
    sla_breaching = await db.orders.find({"editor_id": current_user["id"], "status": {"$ne": "Delivered"}, "sla_deadline": {"$lt": now}}, {"_id": 0}).to_list(100)
    
    return {
        "new_orders": enrich_orders(new_orders),
        "in_progress": enrich_orders(in_progress),
        "pending_review": enrich_orders(pending_review),
        "responded": enrich_orders(responded),
        "delivered": enrich_orders(delivered),
        "sla_breaching": enrich_orders(sla_breaching)
    }


@router.get("/requester")
async def get_requester_dashboard(current_user: dict = Depends(require_roles(["Requester"]))):
    """Dashboard for requesters"""
    open_orders = await db.orders.find({"requester_id": current_user["id"], "status": "Open"}, {"_id": 0}).to_list(100)
    in_progress = await db.orders.find({"requester_id": current_user["id"], "status": "In Progress"}, {"_id": 0}).to_list(100)
    needs_review = await db.orders.find({"requester_id": current_user["id"], "status": "Pending"}, {"_id": 0}).to_list(100)
    delivered = await db.orders.find({"requester_id": current_user["id"], "status": "Delivered"}, {"_id": 0}).sort("delivered_at", -1).limit(20).to_list(20)
    
    return {
        "open_orders": enrich_orders(open_orders),
        "in_progress": enrich_orders(in_progress),
        "needs_review": enrich_orders(needs_review),
        "delivered": enrich_orders(delivered)
    }
