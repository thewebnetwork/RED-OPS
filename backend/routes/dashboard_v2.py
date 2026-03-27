"""Dashboard V2 - Role-based dashboard with metrics and analytics"""
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from collections import defaultdict

from database import db
from utils.auth import get_current_user
from utils.helpers import normalize_order, is_sla_breached

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard/v2", tags=["Dashboard V2"])


# ============== MODELS ==============

class KPIMetrics(BaseModel):
    open: int = 0
    in_progress: int = 0
    pending_review: int = 0
    delivered: int = 0
    closed: int = 0


class SLAMetrics(BaseModel):
    on_track: int = 0
    at_risk: int = 0
    breached: int = 0


class PoolMetrics(BaseModel):
    pool1_available: int = 0
    pool2_available: int = 0
    pool1_pickups_30d: int = 0
    pool2_assignments_30d: int = 0
    avg_time_to_pick_pool1_hours: float = 0
    avg_time_to_pick_pool2_hours: float = 0
    expired_pool1_to_pool2_30d: int = 0


class WorkloadMetrics(BaseModel):
    tickets_working_on: int = 0
    tickets_waiting_on_me: int = 0
    tickets_pending_review: int = 0
    recently_delivered_7d: int = 0


class TrendDataPoint(BaseModel):
    date: str
    value: int


class ChartData(BaseModel):
    labels: List[str]
    datasets: List[Dict[str, Any]]


class DashboardMetricsResponse(BaseModel):
    role_type: str  # admin, operator, partner, vendor, media_client
    account_type: str
    can_see_pool1: bool
    can_see_pool2: bool
    can_see_global_stats: bool
    kpi: KPIMetrics
    sla: SLAMetrics
    pool: Optional[PoolMetrics] = None
    workload: WorkloadMetrics
    trends_7d: Dict[str, Any]  # Nested dict structure
    trends_30d: Dict[str, Any]  # Nested dict structure


# ============== HELPER FUNCTIONS ==============

def get_role_type(user: dict) -> str:
    """Determine user's dashboard role type"""
    role = user.get("role", "")
    account_type = user.get("account_type", "")
    
    if role in ["Administrator", "Admin"]:
        return "admin"
    elif account_type == "Media Client":
        return "media_client"
    elif account_type == "Vendor":
        return "vendor"
    elif account_type == "Partner":
        return "partner"
    elif account_type in ["Internal Staff", "Operator"]:
        return "operator"
    else:
        return "operator"  # Default to operator for standard users who can pick


def can_see_pools(role_type: str) -> tuple:
    """Return (can_see_pool1, can_see_pool2) based on role type"""
    if role_type == "admin":
        return (True, True)
    elif role_type == "partner":
        return (True, False)
    elif role_type == "vendor":
        return (False, True)
    elif role_type == "operator":
        return (True, True)  # Internal staff can see both
    else:
        return (False, False)  # Media clients see no pools


async def get_user_specialties(user: dict) -> List[str]:
    """Get user's specialty IDs"""
    return user.get("specialty_ids", [])


async def count_unread_messages_for_user(user_id: str) -> int:
    """Count tickets with unread messages for user"""
    # Get tickets assigned to user
    assigned_tickets = await db.orders.find(
        {"editor_id": user_id, "status": {"$nin": ["Delivered", "Closed"]}},
        {"_id": 0, "id": 1, "last_editor_message_at": 1, "last_requester_message_at": 1}
    ).to_list(None)
    
    unread_count = 0
    for ticket in assigned_tickets:
        # If requester sent a message after editor's last message (or editor never messaged)
        last_editor = ticket.get("last_editor_message_at")
        last_requester = ticket.get("last_requester_message_at")
        
        if last_requester:
            if not last_editor or last_requester > last_editor:
                unread_count += 1
    
    return unread_count


async def count_tickets_not_responded(user_id: str) -> int:
    """Count tickets assigned to user where they haven't responded"""
    # Tickets in progress where editor hasn't responded yet
    count = await db.orders.count_documents({
        "editor_id": user_id,
        "status": "In Progress",
        "$or": [
            {"last_editor_message_at": None},
            {"last_editor_message_at": {"$exists": False}}
        ]
    })
    return count


async def get_trend_data(query: dict, days: int) -> List[TrendDataPoint]:
    """Get daily trend data for the given query"""
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    trends = []
    for i in range(days):
        date = start_date + timedelta(days=i)
        next_date = date + timedelta(days=1)
        
        day_query = {
            **query,
            "created_at": {
                "$gte": date.isoformat(),
                "$lt": next_date.isoformat()
            }
        }
        
        count = await db.orders.count_documents(day_query)
        trends.append({
            "date": date.strftime("%Y-%m-%d"),
            "value": count
        })
    
    return trends


async def get_status_trends(base_query: dict, days: int) -> Dict[str, List[dict]]:
    """Get trends by status"""
    statuses = ["Open", "In Progress", "Pending", "Delivered", "Closed"]
    trends = {}
    
    now = datetime.now(timezone.utc)
    
    for status in statuses:
        trend_data = []
        for i in range(days):
            date = now - timedelta(days=days-i-1)
            
            # Count tickets in this status on this day (based on their state)
            if status == "Delivered":
                query = {
                    **base_query,
                    "delivered_at": {"$lte": date.isoformat()},
                    "status": {"$in": ["Delivered", "Closed"]}
                }
            else:
                query = {
                    **base_query,
                    "created_at": {"$lte": date.isoformat()},
                    "status": status
                }
            
            count = await db.orders.count_documents(query)
            trend_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "value": count
            })
        
        trends[status.lower().replace(" ", "_")] = trend_data
    
    return trends


async def get_sla_trends(base_query: dict, days: int) -> Dict[str, List[dict]]:
    """Get SLA status trends"""
    now = datetime.now(timezone.utc)
    
    on_track_data = []
    at_risk_data = []
    breached_data = []
    
    for i in range(days):
        date = now - timedelta(days=days-i-1)
        date_str = date.isoformat()
        
        # Active tickets on this day
        active_query = {
            **base_query,
            "created_at": {"$lte": date_str},
            "status": {"$nin": ["Delivered", "Closed"]}
        }
        
        # Calculate SLA status for each
        tickets = await db.orders.find(active_query, {"_id": 0, "sla_deadline": 1, "status": 1}).to_list(None)
        
        on_track = 0
        at_risk = 0
        breached = 0
        
        for t in tickets:
            deadline = t.get("sla_deadline", "")
            if deadline:
                try:
                    dl = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
                    hours_remaining = (dl - date).total_seconds() / 3600
                    
                    if hours_remaining < 0:
                        breached += 1
                    elif hours_remaining < 24:
                        at_risk += 1
                    else:
                        on_track += 1
                except (ValueError, TypeError):
                    on_track += 1

        on_track_data.append({"date": date.strftime("%Y-%m-%d"), "value": on_track})
        at_risk_data.append({"date": date.strftime("%Y-%m-%d"), "value": at_risk})
        breached_data.append({"date": date.strftime("%Y-%m-%d"), "value": breached})
    
    return {
        "on_track": on_track_data,
        "at_risk": at_risk_data,
        "breached": breached_data
    }


# ============== MAIN ENDPOINT ==============

@router.get("/metrics", response_model=DashboardMetricsResponse)
async def get_dashboard_metrics(current_user: dict = Depends(get_current_user)):
    """Get comprehensive dashboard metrics based on user role"""
    user_id = current_user["id"]
    role_type = get_role_type(current_user)
    account_type = current_user.get("account_type", "Internal Staff")
    can_pool1, can_pool2 = can_see_pools(role_type)
    can_see_global = role_type == "admin"
    user_specialties = await get_user_specialties(current_user)
    
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    
    # Build base query based on role
    if role_type == "admin":
        base_query = {}
    elif role_type == "media_client":
        # Media clients only see their submitted tickets
        base_query = {"requester_id": user_id}
    else:
        # Partners, Vendors, Operators see their assigned/picked tickets
        base_query = {"$or": [
            {"editor_id": user_id},
            {"requester_id": user_id}
        ]}
    
    # ============== KPI METRICS ==============
    kpi = KPIMetrics()
    
    if role_type == "admin":
        kpi.open = await db.orders.count_documents({"status": "Open"})
        kpi.in_progress = await db.orders.count_documents({"status": "In Progress"})
        kpi.pending_review = await db.orders.count_documents({"status": "Pending"})
        kpi.delivered = await db.orders.count_documents({"status": "Delivered"})
        kpi.closed = await db.orders.count_documents({"status": "Closed"})
    elif role_type == "media_client":
        kpi.open = await db.orders.count_documents({"requester_id": user_id, "status": "Open"})
        kpi.in_progress = await db.orders.count_documents({"requester_id": user_id, "status": "In Progress"})
        kpi.pending_review = await db.orders.count_documents({"requester_id": user_id, "status": "Pending"})
        kpi.delivered = await db.orders.count_documents({"requester_id": user_id, "status": "Delivered"})
        kpi.closed = await db.orders.count_documents({"requester_id": user_id, "status": "Closed"})
    else:
        # Operators/Partners/Vendors - show tickets they're working on
        kpi.open = await db.orders.count_documents({"editor_id": user_id, "status": "Open"})
        kpi.in_progress = await db.orders.count_documents({"editor_id": user_id, "status": "In Progress"})
        kpi.pending_review = await db.orders.count_documents({"editor_id": user_id, "status": "Pending"})
        kpi.delivered = await db.orders.count_documents({"editor_id": user_id, "status": "Delivered"})
        kpi.closed = await db.orders.count_documents({"editor_id": user_id, "status": "Closed"})
    
    # ============== SLA METRICS ==============
    sla = SLAMetrics()
    
    sla_query = base_query.copy() if role_type != "media_client" else {"requester_id": user_id}
    active_tickets = await db.orders.find(
        {**sla_query, "status": {"$nin": ["Delivered", "Closed"]}},
        {"_id": 0, "sla_deadline": 1, "status": 1}
    ).to_list(None)
    
    for t in active_tickets:
        deadline = t.get("sla_deadline", "")
        if deadline:
            try:
                dl = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
                hours_remaining = (dl - now).total_seconds() / 3600
                
                if hours_remaining < 0:
                    sla.breached += 1
                elif hours_remaining < 24:
                    sla.at_risk += 1
                else:
                    sla.on_track += 1
            except (ValueError, TypeError):
                sla.on_track += 1
    
    # ============== POOL METRICS ==============
    pool = None
    if can_pool1 or can_pool2:
        pool = PoolMetrics()
        
        if role_type == "admin":
            # Admin sees all pool stats
            pool.pool1_available = await db.orders.count_documents({
                "pool_stage": "POOL_1",
                "status": "Open"
            })
            pool.pool2_available = await db.orders.count_documents({
                "pool_stage": "POOL_2",
                "status": "Open"
            })
        else:
            # Filter by user's specialties
            if can_pool1 and user_specialties:
                pool.pool1_available = await db.orders.count_documents({
                    "pool_stage": "POOL_1",
                    "status": "Open",
                    "routing_specialty_id": {"$in": user_specialties}
                })
            if can_pool2 and user_specialties:
                pool.pool2_available = await db.orders.count_documents({
                    "pool_stage": "POOL_2",
                    "status": "Open",
                    "routing_specialty_id": {"$in": user_specialties}
                })
        
        # Pool pickups in last 30 days
        if role_type == "admin":
            pool.pool1_pickups_30d = await db.orders.count_documents({
                "picked_at": {"$gte": thirty_days_ago},
                "pool_stage": "POOL_1"
            })
            pool.pool2_assignments_30d = await db.orders.count_documents({
                "picked_at": {"$gte": thirty_days_ago},
                "pool_stage": "POOL_2"
            })
        else:
            pool.pool1_pickups_30d = await db.orders.count_documents({
                "editor_id": user_id,
                "picked_at": {"$gte": thirty_days_ago},
                "pool_stage": "POOL_1"
            })
            pool.pool2_assignments_30d = await db.orders.count_documents({
                "editor_id": user_id,
                "picked_at": {"$gte": thirty_days_ago},
                "pool_stage": "POOL_2"
            })
        
        # Calculate average time to pick (for admin)
        if role_type == "admin":
            # Pool 1 avg time
            pool1_picked = await db.orders.find({
                "picked_at": {"$gte": thirty_days_ago},
                "pool_stage": "POOL_1",
                "pool1_entered_at": {"$exists": True}
            }, {"_id": 0, "picked_at": 1, "pool1_entered_at": 1}).to_list(None)
            
            if pool1_picked:
                total_hours = 0
                for p in pool1_picked:
                    try:
                        entered = datetime.fromisoformat(p["pool1_entered_at"].replace("Z", "+00:00"))
                        picked = datetime.fromisoformat(p["picked_at"].replace("Z", "+00:00"))
                        total_hours += (picked - entered).total_seconds() / 3600
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Non-critical error parsing pool1 dates: {e}")
                pool.avg_time_to_pick_pool1_hours = round(total_hours / len(pool1_picked), 1)
            
            # Pool 2 avg time
            pool2_picked = await db.orders.find({
                "picked_at": {"$gte": thirty_days_ago},
                "pool_stage": "POOL_2",
                "pool2_entered_at": {"$exists": True}
            }, {"_id": 0, "picked_at": 1, "pool2_entered_at": 1}).to_list(None)
            
            if pool2_picked:
                total_hours = 0
                for p in pool2_picked:
                    try:
                        entered = datetime.fromisoformat(p["pool2_entered_at"].replace("Z", "+00:00"))
                        picked = datetime.fromisoformat(p["picked_at"].replace("Z", "+00:00"))
                        total_hours += (picked - entered).total_seconds() / 3600
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Non-critical error parsing pool2 dates: {e}")
                pool.avg_time_to_pick_pool2_hours = round(total_hours / len(pool2_picked), 1)
            
            # Expired Pool 1 -> Pool 2
            pool.expired_pool1_to_pool2_30d = await db.orders.count_documents({
                "pool_stage": "POOL_2",
                "pool1_expired_at": {"$gte": thirty_days_ago}
            })
    
    # ============== WORKLOAD METRICS ==============
    workload = WorkloadMetrics()
    
    if role_type != "media_client":
        # Tickets I'm working on (assigned OR picked)
        workload.tickets_working_on = await db.orders.count_documents({
            "editor_id": user_id,
            "status": {"$in": ["In Progress", "Pending"]}
        })
        
        # Tickets waiting on me = not responded + unread messages
        not_responded = await count_tickets_not_responded(user_id)
        unread_messages = await count_unread_messages_for_user(user_id)
        workload.tickets_waiting_on_me = not_responded + unread_messages
        
        # Pending review (as editor)
        workload.tickets_pending_review = await db.orders.count_documents({
            "editor_id": user_id,
            "status": "Pending"
        })
    else:
        # Media client - show their submitted tickets
        workload.tickets_working_on = await db.orders.count_documents({
            "requester_id": user_id,
            "status": {"$in": ["In Progress", "Open"]}
        })
        
        # Waiting on me for requester = needs review
        workload.tickets_waiting_on_me = await db.orders.count_documents({
            "requester_id": user_id,
            "status": "Pending"
        })
        
        workload.tickets_pending_review = await db.orders.count_documents({
            "requester_id": user_id,
            "status": "Pending"
        })
    
    # Recently delivered (last 7 days)
    if role_type == "media_client":
        workload.recently_delivered_7d = await db.orders.count_documents({
            "requester_id": user_id,
            "status": "Delivered",
            "delivered_at": {"$gte": seven_days_ago}
        })
    else:
        workload.recently_delivered_7d = await db.orders.count_documents({
            "editor_id": user_id,
            "status": "Delivered",
            "delivered_at": {"$gte": seven_days_ago}
        })
    
    # ============== TREND DATA ==============
    trends_7d = {}
    trends_30d = {}
    
    # For admin, get global trends; for others, get personal trends
    trend_query = {} if role_type == "admin" else base_query
    
    # Status trends
    trends_7d["status"] = await get_status_trends(trend_query, 7)
    trends_30d["status"] = await get_status_trends(trend_query, 30)
    
    # SLA trends
    trends_7d["sla"] = await get_sla_trends(trend_query, 7)
    trends_30d["sla"] = await get_sla_trends(trend_query, 30)
    
    return DashboardMetricsResponse(
        role_type=role_type,
        account_type=account_type,
        can_see_pool1=can_pool1,
        can_see_pool2=can_pool2,
        can_see_global_stats=can_see_global,
        kpi=kpi,
        sla=sla,
        pool=pool,
        workload=workload,
        trends_7d=trends_7d,
        trends_30d=trends_30d
    )


# ============== TICKETS LISTS ==============

@router.get("/tickets/working-on")
async def get_tickets_working_on(
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get tickets I'm working on (assigned or picked)"""
    user_id = current_user["id"]
    role_type = get_role_type(current_user)
    
    if role_type == "media_client":
        # Media clients see their submitted tickets that are in progress
        tickets = await db.orders.find(
            {"requester_id": user_id, "status": {"$in": ["Open", "In Progress"]}},
            {"_id": 0}
        ).sort("updated_at", -1).limit(limit).to_list(limit)
    else:
        tickets = await db.orders.find(
            {"editor_id": user_id, "status": {"$in": ["In Progress", "Pending"]}},
            {"_id": 0}
        ).sort("updated_at", -1).limit(limit).to_list(limit)
    
    # Enrich with SLA status
    enriched = []
    for t in tickets:
        t = normalize_order(t)
        t["is_sla_breached"] = is_sla_breached(t.get("sla_deadline", ""), t.get("status", ""))
        enriched.append(t)
    
    return {"tickets": enriched}


@router.get("/tickets/waiting-on-me")
async def get_tickets_waiting_on_me(
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get tickets waiting on my action (not responded + unread messages)"""
    user_id = current_user["id"]
    role_type = get_role_type(current_user)
    
    if role_type == "media_client":
        # Media clients - tickets pending their review
        tickets = await db.orders.find(
            {"requester_id": user_id, "status": "Pending"},
            {"_id": 0}
        ).sort("updated_at", -1).limit(limit).to_list(limit)
    else:
        # Find tickets where:
        # 1. Assigned to me but I haven't responded
        # 2. Has unread messages from requester
        not_responded = await db.orders.find(
            {
                "editor_id": user_id,
                "status": "In Progress",
                "$or": [
                    {"last_editor_message_at": None},
                    {"last_editor_message_at": {"$exists": False}}
                ]
            },
            {"_id": 0}
        ).to_list(None)
        
        # Get tickets with unread messages
        all_assigned = await db.orders.find(
            {
                "editor_id": user_id,
                "status": {"$nin": ["Delivered", "Closed"]},
                "last_requester_message_at": {"$exists": True, "$ne": None}
            },
            {"_id": 0}
        ).to_list(None)
        
        unread_tickets = []
        for t in all_assigned:
            last_editor = t.get("last_editor_message_at")
            last_requester = t.get("last_requester_message_at")
            if last_requester and (not last_editor or last_requester > last_editor):
                if t["id"] not in [nr["id"] for nr in not_responded]:
                    unread_tickets.append(t)
        
        tickets = not_responded + unread_tickets
        tickets = sorted(tickets, key=lambda x: x.get("updated_at", ""), reverse=True)[:limit]
    
    # Enrich
    enriched = []
    for t in tickets:
        t = normalize_order(t)
        t["is_sla_breached"] = is_sla_breached(t.get("sla_deadline", ""), t.get("status", ""))
        t["waiting_reason"] = "unread_message" if t.get("last_requester_message_at") else "not_responded"
        enriched.append(t)
    
    return {"tickets": enriched}


@router.get("/tickets/pending-review")
async def get_tickets_pending_review(
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get tickets pending review"""
    user_id = current_user["id"]
    role_type = get_role_type(current_user)
    
    if role_type == "media_client":
        # Media clients - tickets they submitted that are pending
        tickets = await db.orders.find(
            {"requester_id": user_id, "status": "Pending"},
            {"_id": 0}
        ).sort("updated_at", -1).limit(limit).to_list(limit)
    else:
        # Tickets I submitted that are pending OR tickets I'm resolving that are pending
        tickets = await db.orders.find(
            {
                "$or": [
                    {"editor_id": user_id, "status": "Pending"},
                    {"requester_id": user_id, "status": "Pending"}
                ]
            },
            {"_id": 0}
        ).sort("updated_at", -1).limit(limit).to_list(limit)
    
    enriched = []
    for t in tickets:
        t = normalize_order(t)
        t["is_sla_breached"] = is_sla_breached(t.get("sla_deadline", ""), t.get("status", ""))
        enriched.append(t)
    
    return {"tickets": enriched}


@router.get("/tickets/recently-delivered")
async def get_recently_delivered(
    days: int = Query(default=7, le=30),
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get recently delivered tickets"""
    user_id = current_user["id"]
    role_type = get_role_type(current_user)
    
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    if role_type == "admin":
        query = {"status": "Delivered", "delivered_at": {"$gte": cutoff}}
    elif role_type == "media_client":
        query = {"requester_id": user_id, "status": "Delivered", "delivered_at": {"$gte": cutoff}}
    else:
        query = {"editor_id": user_id, "status": "Delivered", "delivered_at": {"$gte": cutoff}}
    
    tickets = await db.orders.find(query, {"_id": 0}).sort("delivered_at", -1).limit(limit).to_list(limit)
    
    enriched = []
    for t in tickets:
        t = normalize_order(t)
        t["is_sla_breached"] = is_sla_breached(t.get("sla_deadline", ""), t.get("status", ""))
        enriched.append(t)
    
    return {"tickets": enriched}


# ============== CHART DATA ==============

@router.get("/charts/ticket-volume-by-status")
async def get_ticket_volume_by_status(
    days: int = Query(default=30, le=90),
    current_user: dict = Depends(get_current_user)
):
    """Get ticket volume by status over time (for charts)"""
    role_type = get_role_type(current_user)
    user_id = current_user["id"]
    
    base_query = {} if role_type == "admin" else {"$or": [{"editor_id": user_id}, {"requester_id": user_id}]}
    
    now = datetime.now(timezone.utc)
    data = []
    
    for i in range(days):
        date = now - timedelta(days=days-i-1)
        date_str = date.strftime("%Y-%m-%d")
        
        day_data = {"date": date_str}
        for status in ["Open", "In Progress", "Pending", "Delivered"]:
            count = await db.orders.count_documents({
                **base_query,
                "status": status,
                "created_at": {"$lte": date.isoformat()}
            })
            day_data[status.lower().replace(" ", "_")] = count
        
        data.append(day_data)
    
    return {"data": data}


@router.get("/charts/ticket-volume-by-category")
async def get_ticket_volume_by_category(
    days: int = Query(default=30, le=90),
    limit: int = Query(default=10, le=20),
    current_user: dict = Depends(get_current_user)
):
    """Get ticket volume by category (top N)"""
    role_type = get_role_type(current_user)
    user_id = current_user["id"]
    
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    base_query = {"created_at": {"$gte": cutoff}}
    if role_type != "admin":
        base_query["$or"] = [{"editor_id": user_id}, {"requester_id": user_id}]
    
    pipeline = [
        {"$match": base_query},
        {"$group": {"_id": "$category_l1_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]
    
    results = await db.orders.aggregate(pipeline).to_list(None)
    
    data = [{"category": r["_id"] or "Uncategorized", "count": r["count"]} for r in results]
    
    return {"data": data}


@router.get("/charts/pool-routing")
async def get_pool_routing_chart(
    days: int = Query(default=30, le=90),
    current_user: dict = Depends(get_current_user)
):
    """Get pool routing effectiveness data (Admin only)"""
    role_type = get_role_type(current_user)
    
    if role_type != "admin":
        return {"data": [], "message": "Admin only"}
    
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Pool 1 stats
    pool1_total = await db.orders.count_documents({
        "pool_stage": "POOL_1",
        "created_at": {"$gte": cutoff}
    })
    pool1_picked = await db.orders.count_documents({
        "pool_stage": "POOL_1",
        "picked_at": {"$gte": cutoff}
    })
    
    # Pool 2 stats
    pool2_total = await db.orders.count_documents({
        "pool_stage": "POOL_2",
        "created_at": {"$gte": cutoff}
    })
    pool2_picked = await db.orders.count_documents({
        "pool_stage": "POOL_2",
        "picked_at": {"$gte": cutoff}
    })
    
    # Expired from Pool 1 to Pool 2
    expired_to_pool2 = await db.orders.count_documents({
        "pool_stage": "POOL_2",
        "pool1_expired_at": {"$gte": cutoff}
    })
    
    return {
        "data": {
            "pool1": {"total": pool1_total, "picked": pool1_picked},
            "pool2": {"total": pool2_total, "picked": pool2_picked},
            "expired_pool1_to_pool2": expired_to_pool2
        }
    }
