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
        # workflows engine archived (Sprint 1) — no writers, collection orphaned
        stats["total_workflows"] = 0
        
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

@router.get("/my-work")
async def get_my_work_dashboard(current_user: dict = Depends(get_current_user)):
    """
    Unified dashboard for ALL roles showing:
    - Tickets I'm working on (assigned to me, in progress)
    - Tickets delivered (that I resolved)
    - My submitted tickets count (tickets I created)
    """
    user_id = current_user["id"]
    
    # Tickets I'm working on (assigned to me, not delivered/closed)
    working_on = await db.orders.find(
        {"editor_id": user_id, "status": {"$in": ["In Progress", "Pending"]}},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    # Tickets I've delivered
    delivered = await db.orders.find(
        {"editor_id": user_id, "status": "Delivered"},
        {"_id": 0}
    ).sort("delivered_at", -1).limit(20).to_list(20)
    
    # Count of tickets I submitted (my requests)
    my_submitted_count = await db.orders.count_documents(
        {"requester_id": user_id, "status": {"$ne": "Draft"}}
    )
    
    return {
        "working_on": enrich_orders(working_on),
        "delivered": enrich_orders(delivered),
        "my_submitted_count": my_submitted_count
    }


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


@router.get("/agency")
async def get_agency_dashboard(current_user: dict = Depends(require_roles(["Administrator"]))):
    """
    Admin agency view with per-client sub-account data and aggregate metrics.
    Shows all active Media Client accounts with their health, stats, and recent events.
    """
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # ============ FETCH ALL ACTIVE MEDIA CLIENTS ============
    clients = await db.users.find(
        {"account_type": "Media Client", "active": True},
        {"_id": 0}
    ).to_list(1000)

    client_stats = []
    total_open_requests = 0
    total_active_projects = 0
    total_completed_projects = 0
    total_pending_deliveries = 0
    total_sla_breached = 0
    total_deliveries_mtd = 0
    all_response_times = []
    team_utilization_count = 0

    # ============ PROCESS EACH CLIENT ============
    for client in clients:
        client_id = client.get("id")
        client_name = client.get("name")

        # Count open_requests: orders where requester_id == client.id and status in ["Open", "In Progress", "Pending"]
        open_requests = await db.orders.count_documents({
            "requester_id": client_id,
            "status": {"$in": ["Open", "In Progress", "Pending"]}
        })

        # Count active_projects: projects where client_name == client.name and status in ["active", "planning"]
        active_projects = await db.projects.count_documents({
            "client_name": client_name,
            "status": {"$in": ["active", "planning"]}
        })

        # Count completed_projects: projects where client_name == client.name and status == "completed"
        completed_projects = await db.projects.count_documents({
            "client_name": client_name,
            "status": "completed"
        })

        # Count total_tasks: tasks where client_id == client.id or created_by_user_id == client.id
        total_tasks = await db.tasks.count_documents({
            "$or": [
                {"client_id": client_id},
                {"created_by_user_id": client_id}
            ]
        })

        # Count pending_deliveries: orders where requester_id == client.id and status == "Pending"
        pending_deliveries = await db.orders.count_documents({
            "requester_id": client_id,
            "status": "Pending"
        })

        # Count sla_breached: orders where requester_id == client.id, status not in ["Delivered","Closed"], and is_sla_breached == True
        sla_breached = await db.orders.count_documents({
            "requester_id": client_id,
            "status": {"$nin": ["Delivered", "Closed"]},
            "is_sla_breached": True
        })

        # Get last_activity_at: most recent updated_at from their orders, or their created_at if no orders
        last_orders = await db.orders.find(
            {"requester_id": client_id},
            {"_id": 0, "updated_at": 1}
        ).sort("updated_at", -1).limit(1).to_list(1)
        last_activity_at = last_orders[0].get("updated_at") if last_orders else client.get("created_at", now.isoformat())

        # Determine health: critical > at_risk > new > healthy
        if sla_breached > 0:
            health = "critical"
        elif open_requests > 5 or pending_deliveries > 3:
            health = "at_risk"
        elif client.get("created_at") and (now - datetime.fromisoformat(str(client["created_at"]).replace('Z', '+00:00'))).days <= 30 and open_requests == 0:
            health = "new"
        else:
            health = "healthy"

        client_stats.append({
            "id": client_id,
            "name": client_name,
            "email": client.get("email"),
            "avatar_url": client.get("avatar"),
            "account_type": client.get("account_type"),
            "created_at": client.get("created_at"),
            "last_activity_at": last_activity_at,
            "health": health,
            "stats": {
                "open_requests": open_requests,
                "active_projects": active_projects,
                "completed_projects": completed_projects,
                "total_tasks": total_tasks,
                "pending_deliveries": pending_deliveries,
                "sla_breached": sla_breached
            }
        })

        # Accumulate aggregate metrics
        total_open_requests += open_requests
        total_active_projects += active_projects
        total_completed_projects += completed_projects
        total_pending_deliveries += pending_deliveries
        total_sla_breached += sla_breached

    # ============ CALCULATE AGGREGATE METRICS ============

    # deliveries_mtd: count of delivered orders in current month
    total_deliveries_mtd = await db.orders.count_documents({
        "status": {"$in": ["Delivered", "Closed"]},
        "delivered_at": {"$gte": now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()}
    })

    # avg_response_hours: avg time between order created_at and picked_at for orders picked in last 30 days
    recent_picked_orders = await db.orders.find(
        {
            "picked_at": {"$gte": thirty_days_ago.isoformat()},
            "created_at": {"$exists": True}
        },
        {"_id": 0, "created_at": 1, "picked_at": 1}
    ).to_list(1000)

    if recent_picked_orders:
        response_times = []
        for order in recent_picked_orders:
            try:
                created = datetime.fromisoformat(order["created_at"].replace('Z', '+00:00'))
                picked = datetime.fromisoformat(order["picked_at"].replace('Z', '+00:00'))
                hours = (picked - created).total_seconds() / 3600
                response_times.append(hours)
            except (ValueError, KeyError):
                continue
        avg_response_hours = round(sum(response_times) / len(response_times), 1) if response_times else 0
    else:
        avg_response_hours = 0

    # team_utilization_pct: count users with role != "Media Client" that have at least one In Progress order, divided by total internal users, × 100
    internal_users_with_in_progress = await db.users.find(
        {
            "account_type": {"$ne": "Media Client"},
            "active": True
        },
        {"_id": 0, "id": 1}
    ).to_list(1000)

    internal_user_ids = [u["id"] for u in internal_users_with_in_progress]

    if internal_user_ids:
        in_progress_editors = await db.orders.find(
            {
                "editor_id": {"$in": internal_user_ids},
                "status": "In Progress"
            },
            {"_id": 0, "editor_id": 1}
        ).to_list(1000)

        busy_editor_ids = set(o.get("editor_id") for o in in_progress_editors if o.get("editor_id"))
        team_utilization_pct = round((len(busy_editor_ids) / len(internal_user_ids)) * 100, 1) if internal_user_ids else 0
    else:
        team_utilization_pct = 0

    # ============ FETCH RECENT EVENTS ============
    # Try notifications collection first
    events = []
    notifications = await db.notifications.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)

    if notifications:
        for notif in notifications:
            events.append({
                "type": notif.get("type", "notification"),
                "client_name": notif.get("client_name", ""),
                "client_id": notif.get("user_id", ""),
                "message": notif.get("message", notif.get("title", "")),
                "timestamp": notif.get("created_at", "")
            })
    else:
        # Fallback: build events from recent orders
        recent_orders = await db.orders.find(
            {},
            {"_id": 0, "requester_id": 1, "requester_name": 1, "title": 1, "status": 1, "created_at": 1, "updated_at": 1}
        ).sort("updated_at", -1).limit(5).to_list(5)

        for order in recent_orders:
            events.append({
                "type": "order_status_change",
                "client_name": order.get("requester_name", ""),
                "client_id": order.get("requester_id", ""),
                "message": f"Order '{order.get('title', '')}' status changed to {order.get('status', '')}",
                "timestamp": order.get("updated_at", "")
            })

    return {
        "aggregate": {
            "total_clients": len(clients),
            "active_clients": len([c for c in client_stats if c["health"] != "new"]),
            "total_open_requests": total_open_requests,
            "total_active_projects": total_active_projects,
            "deliveries_mtd": total_deliveries_mtd,
            "avg_response_hours": avg_response_hours,
            "sla_breached": total_sla_breached,
            "team_utilization_pct": team_utilization_pct
        },
        "clients": client_stats,
        "recent_events": events
    }


# ============== FINANCIAL STATS ==============

@router.get("/financial-stats")
async def get_financial_stats(current_user: dict = Depends(require_roles(["Administrator"]))):
    """Get financial/revenue metrics for admin dashboard"""
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_month_start = (start_of_month - timedelta(days=1)).replace(day=1)

    # Total active clients
    total_clients = await db.users.count_documents({"active": True})

    # New clients this month
    new_clients_mtd = await db.users.count_documents({
        "active": True,
        "created_at": {"$gte": start_of_month.isoformat()}
    })

    # Active subscribers (users with a subscription plan)
    active_subscribers = await db.users.count_documents({
        "active": True,
        "subscription_plan_id": {"$exists": True, "$ne": None}
    })

    # Compute MRR from active subscriptions
    plans = await db.subscription_plans.find({"active": True}, {"_id": 0}).to_list(100)
    plan_map = {p["id"]: p for p in plans}

    mrr = 0.0
    prev_mrr = 0.0
    users_with_plans = await db.users.find(
        {"active": True, "subscription_plan_id": {"$exists": True, "$ne": None}},
        {"subscription_plan_id": 1, "subscription_billing": 1, "_id": 0}
    ).to_list(1000)

    for u in users_with_plans:
        plan_id = u.get("subscription_plan_id")
        plan = plan_map.get(plan_id)
        if plan:
            billing = u.get("subscription_billing", "monthly")
            if billing == "yearly":
                mrr += (plan.get("price_yearly") or 0) / 12
            else:
                mrr += plan.get("price_monthly") or 0

    # Requests submitted this month
    requests_mtd = await db.orders.count_documents({
        "created_at": {"$gte": start_of_month.isoformat()}
    })

    # Requests submitted last month
    requests_prev = await db.orders.count_documents({
        "created_at": {
            "$gte": prev_month_start.isoformat(),
            "$lt": start_of_month.isoformat()
        }
    })

    # Delivered this month
    delivered_mtd = await db.orders.count_documents({
        "status": {"$in": ["Delivered", "Closed"]},
        "delivered_at": {"$gte": start_of_month.isoformat()}
    })

    return {
        "mrr": round(mrr, 2),
        "active_subscribers": active_subscribers,
        "total_clients": total_clients,
        "new_clients_mtd": new_clients_mtd,
        "requests_mtd": requests_mtd,
        "requests_prev_month": requests_prev,
        "delivered_mtd": delivered_mtd,
    }
