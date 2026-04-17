"""Dashboard Management - Templates, Widgets, and Builder API"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uuid

from database import db
from utils.auth import get_current_user, require_admin
from utils.tenancy import resolve_org_id

router = APIRouter(prefix="/dashboards", tags=["Dashboard Management"])


# ============== PERMISSION DEFAULTS ==============

# These match the defaults in users.py - ideally should be imported from a shared module
DEFAULT_PERMISSIONS = {
    "Administrator": {
        "dashboard": {"view": True},
        "orders": {"view": True, "create": True, "edit": True, "delete": True, "export": True, "pick": True, "assign": True},
        "users": {"view": True, "create": True, "edit": True, "delete": True},
        "teams": {"view": True, "create": True, "edit": True, "delete": True},
        "settings": {"view": True, "edit": True},
        "reports": {"view": True, "export": True},
    },
    "Operator": {
        "dashboard": {"view": True},
        "orders": {"view": True, "create": True, "edit": True, "pick": True, "assign": True},
        "teams": {"view": True, "create": True, "edit": True},
        "reports": {"view": True, "export": True},
    },
    "Standard User": {
        "dashboard": {"view": True},
        "orders": {"view": True, "create": True},
        "reports": {"view": True},
    }
}


def get_effective_permissions(role: str, overrides: Optional[Dict] = None) -> Dict[str, Dict[str, bool]]:
    """Calculate effective permissions from role defaults + overrides"""
    base_permissions = DEFAULT_PERMISSIONS.get(role, DEFAULT_PERMISSIONS["Standard User"]).copy()
    
    effective = {}
    for module, actions in base_permissions.items():
        effective[module] = actions.copy()
    
    if overrides:
        for module, actions in overrides.items():
            if module in effective:
                for action, value in actions.items():
                    if action in effective[module]:
                        effective[module][action] = value
    
    return effective


# ============== MODELS ==============

class WidgetConfig(BaseModel):
    id: str
    widget_type: str  # kpi_card, chart, ticket_list, etc.
    title: str
    config: Dict[str, Any] = {}  # Widget-specific configuration
    size: str = "medium"  # small (4 cols), medium (6 cols), large (12 cols)
    position: int = 0  # Order in the dashboard
    required_permissions: List[str] = []  # Permissions needed to view this widget


class DashboardCreate(BaseModel):
    name: str
    description: str = ""
    widgets: List[WidgetConfig] = []
    is_system: bool = False  # System dashboards can't be deleted


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    widgets: Optional[List[WidgetConfig]] = None


class DashboardResponse(BaseModel):
    id: str
    name: str
    description: str
    widgets: List[Dict[str, Any]]
    is_system: bool
    is_default_for: Optional[str] = None  # Role/account type this is default for
    created_by: Optional[str] = None
    created_at: str


# ============== WIDGET LIBRARY ==============

WIDGET_LIBRARY = [
    # KPI Cards
    {
        "id": "kpi_status_open",
        "widget_type": "kpi_card",
        "title": "Open Tickets",
        "category": "KPI Cards",
        "description": "Count of open tickets",
        "config": {"metric": "open", "icon": "Inbox", "color": "bg-blue-500"},
        "default_size": "small",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "kpi_status_in_progress",
        "widget_type": "kpi_card",
        "title": "In Progress",
        "category": "KPI Cards",
        "description": "Count of tickets in progress",
        "config": {"metric": "in_progress", "icon": "Clock", "color": "bg-amber-500"},
        "default_size": "small",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "kpi_status_pending",
        "widget_type": "kpi_card",
        "title": "Pending Review",
        "category": "KPI Cards",
        "description": "Count of tickets pending review",
        "config": {"metric": "pending_review", "icon": "AlertCircle", "color": "bg-purple-500"},
        "default_size": "small",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "kpi_status_delivered",
        "widget_type": "kpi_card",
        "title": "Delivered",
        "category": "KPI Cards",
        "description": "Count of delivered tickets",
        "config": {"metric": "delivered", "icon": "CheckCircle2", "color": "bg-emerald-500"},
        "default_size": "small",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "kpi_status_closed",
        "widget_type": "kpi_card",
        "title": "Closed",
        "category": "KPI Cards",
        "description": "Count of closed tickets",
        "config": {"metric": "closed", "icon": "CheckCircle2", "color": "bg-slate-500"},
        "default_size": "small",
        "required_permissions": ["dashboard.view"]
    },
    # SLA Cards
    {
        "id": "kpi_sla_on_track",
        "widget_type": "kpi_card",
        "title": "SLA On Track",
        "category": "SLA Status",
        "description": "Tickets meeting SLA",
        "config": {"metric": "sla_on_track", "icon": "CheckCircle2", "color": "bg-emerald-500"},
        "default_size": "small",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "kpi_sla_at_risk",
        "widget_type": "kpi_card",
        "title": "SLA At Risk",
        "category": "SLA Status",
        "description": "Tickets at risk of breaching SLA",
        "config": {"metric": "sla_at_risk", "icon": "Clock", "color": "bg-amber-500"},
        "default_size": "small",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "kpi_sla_breached",
        "widget_type": "kpi_card",
        "title": "SLA Breached",
        "category": "SLA Status",
        "description": "Tickets that breached SLA",
        "config": {"metric": "sla_breached", "icon": "AlertTriangle", "color": "bg-red-500"},
        "default_size": "small",
        "required_permissions": ["dashboard.view"]
    },
    # Pool Cards
    {
        "id": "kpi_pool1_available",
        "widget_type": "kpi_card",
        "title": "Pool 1 Available",
        "category": "Pool Status",
        "description": "Opportunities in Pool 1",
        "config": {"metric": "pool1_available", "icon": "Layers", "color": "bg-indigo-500"},
        "default_size": "small",
        "required_permissions": ["orders.pick"]
    },
    {
        "id": "kpi_pool2_available",
        "widget_type": "kpi_card",
        "title": "Pool 2 Available",
        "category": "Pool Status",
        "description": "Opportunities in Pool 2",
        "config": {"metric": "pool2_available", "icon": "Layers", "color": "bg-pink-500"},
        "default_size": "small",
        "required_permissions": ["orders.pick"]
    },
    {
        "id": "kpi_pool1_pickups",
        "widget_type": "kpi_card",
        "title": "Pool 1 Pickups (30d)",
        "category": "Pool Status",
        "description": "Pool 1 pickups in last 30 days",
        "config": {"metric": "pool1_pickups_30d", "icon": "TrendingUp", "color": "bg-indigo-500"},
        "default_size": "small",
        "required_permissions": ["orders.pick"]
    },
    {
        "id": "kpi_avg_pick_time",
        "widget_type": "kpi_card",
        "title": "Avg Pick Time (P1)",
        "category": "Pool Status",
        "description": "Average time to pick from Pool 1",
        "config": {"metric": "avg_time_to_pick_pool1_hours", "icon": "Clock", "color": "bg-indigo-500", "suffix": "h"},
        "default_size": "small",
        "required_permissions": ["orders.view"]
    },
    # Workload Cards
    {
        "id": "kpi_working_on",
        "widget_type": "kpi_card",
        "title": "Tickets Working On",
        "category": "My Workload",
        "description": "Tickets I'm currently working on",
        "config": {"metric": "tickets_working_on", "icon": "Clock", "color": "bg-amber-500"},
        "default_size": "small",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "kpi_waiting_on_me",
        "widget_type": "kpi_card",
        "title": "Waiting on Me",
        "category": "My Workload",
        "description": "Tickets waiting for my action",
        "config": {"metric": "tickets_waiting_on_me", "icon": "AlertCircle", "color": "bg-red-500"},
        "default_size": "small",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "kpi_recently_delivered",
        "widget_type": "kpi_card",
        "title": "Delivered (7d)",
        "category": "My Workload",
        "description": "Tickets delivered in last 7 days",
        "config": {"metric": "recently_delivered_7d", "icon": "CheckCircle2", "color": "bg-emerald-500"},
        "default_size": "small",
        "required_permissions": ["dashboard.view"]
    },
    # Charts
    {
        "id": "chart_status_volume",
        "widget_type": "chart",
        "title": "Ticket Volume by Status",
        "category": "Charts",
        "description": "Stacked area chart of ticket volume over time",
        "config": {"chart_type": "area", "data_source": "status_volume", "days": 30},
        "default_size": "large",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "chart_category_volume",
        "widget_type": "chart",
        "title": "Top Categories",
        "category": "Charts",
        "description": "Bar chart of tickets by category",
        "config": {"chart_type": "bar", "data_source": "category_volume", "days": 30},
        "default_size": "medium",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "chart_sla_trend",
        "widget_type": "chart",
        "title": "SLA Trend",
        "category": "Charts",
        "description": "Line chart of SLA status over time",
        "config": {"chart_type": "line", "data_source": "sla_trend", "days": 30},
        "default_size": "medium",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "chart_pool_routing",
        "widget_type": "chart",
        "title": "Pool Routing",
        "category": "Charts",
        "description": "Pool routing effectiveness",
        "config": {"chart_type": "pie", "data_source": "pool_routing", "days": 30},
        "default_size": "medium",
        "required_permissions": ["orders.view"]
    },
    # Ticket Lists
    {
        "id": "list_working_on",
        "widget_type": "ticket_list",
        "title": "Tickets I'm Working On",
        "category": "Ticket Lists",
        "description": "List of tickets assigned to me",
        "config": {"list_type": "working_on", "limit": 10},
        "default_size": "large",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "list_waiting_on_me",
        "widget_type": "ticket_list",
        "title": "Tickets Waiting on Me",
        "category": "Ticket Lists",
        "description": "Tickets needing my action",
        "config": {"list_type": "waiting_on_me", "limit": 10},
        "default_size": "large",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "list_pending_review",
        "widget_type": "ticket_list",
        "title": "Pending Review",
        "category": "Ticket Lists",
        "description": "Tickets pending review",
        "config": {"list_type": "pending_review", "limit": 10},
        "default_size": "large",
        "required_permissions": ["dashboard.view"]
    },
    {
        "id": "list_recently_delivered",
        "widget_type": "ticket_list",
        "title": "Recently Delivered",
        "category": "Ticket Lists",
        "description": "Recently delivered tickets",
        "config": {"list_type": "recently_delivered", "limit": 10},
        "default_size": "large",
        "required_permissions": ["dashboard.view"]
    },
    # Announcements
    {
        "id": "announcements_summary",
        "widget_type": "announcements",
        "title": "Announcements",
        "category": "Other",
        "description": "Active announcements summary",
        "config": {"limit": 5},
        "default_size": "medium",
        "required_permissions": ["dashboard.view"]
    },
]

# Default dashboard templates
DEFAULT_DASHBOARDS = [
    {
        "id": "admin_executive",
        "name": "Admin Executive Dashboard",
        "description": "Full visibility dashboard for administrators with all KPIs, analytics, and operational insights",
        "is_system": True,
        "is_default_for": "Administrator",
        "widgets": [
            {"id": "w1", "widget_type": "kpi_card", "title": "Open", "config": {"metric": "open", "icon": "Inbox", "color": "bg-blue-500"}, "size": "small", "position": 0, "required_permissions": ["dashboard.view"]},
            {"id": "w2", "widget_type": "kpi_card", "title": "In Progress", "config": {"metric": "in_progress", "icon": "Clock", "color": "bg-amber-500"}, "size": "small", "position": 1, "required_permissions": ["dashboard.view"]},
            {"id": "w3", "widget_type": "kpi_card", "title": "Pending Review", "config": {"metric": "pending_review", "icon": "AlertCircle", "color": "bg-purple-500"}, "size": "small", "position": 2, "required_permissions": ["dashboard.view"]},
            {"id": "w4", "widget_type": "kpi_card", "title": "Delivered", "config": {"metric": "delivered", "icon": "CheckCircle2", "color": "bg-emerald-500"}, "size": "small", "position": 3, "required_permissions": ["dashboard.view"]},
            {"id": "w5", "widget_type": "kpi_card", "title": "Closed", "config": {"metric": "closed", "icon": "CheckCircle2", "color": "bg-slate-500"}, "size": "small", "position": 4, "required_permissions": ["dashboard.view"]},
            {"id": "w6", "widget_type": "kpi_card", "title": "SLA On Track", "config": {"metric": "sla_on_track", "icon": "CheckCircle2", "color": "bg-emerald-500"}, "size": "small", "position": 5, "required_permissions": ["dashboard.view"]},
            {"id": "w7", "widget_type": "kpi_card", "title": "SLA At Risk", "config": {"metric": "sla_at_risk", "icon": "Clock", "color": "bg-amber-500"}, "size": "small", "position": 6, "required_permissions": ["dashboard.view"]},
            {"id": "w8", "widget_type": "kpi_card", "title": "SLA Breached", "config": {"metric": "sla_breached", "icon": "AlertTriangle", "color": "bg-red-500"}, "size": "small", "position": 7, "required_permissions": ["dashboard.view"]},
            {"id": "w9", "widget_type": "kpi_card", "title": "Pool 1 Available", "config": {"metric": "pool1_available", "icon": "Layers", "color": "bg-indigo-500"}, "size": "small", "position": 8, "required_permissions": ["orders.pick"]},
            {"id": "w10", "widget_type": "kpi_card", "title": "Pool 2 Available", "config": {"metric": "pool2_available", "icon": "Layers", "color": "bg-pink-500"}, "size": "small", "position": 9, "required_permissions": ["orders.pick"]},
            {"id": "w11", "widget_type": "kpi_card", "title": "Pool 1 Pickups (30d)", "config": {"metric": "pool1_pickups_30d", "icon": "TrendingUp", "color": "bg-indigo-500"}, "size": "small", "position": 10, "required_permissions": ["orders.pick"]},
            {"id": "w12", "widget_type": "kpi_card", "title": "Avg Pick Time P1", "config": {"metric": "avg_time_to_pick_pool1_hours", "icon": "Clock", "color": "bg-indigo-500", "suffix": "h"}, "size": "small", "position": 11, "required_permissions": ["orders.view"]},
            {"id": "w13", "widget_type": "chart", "title": "Ticket Volume by Status (30 days)", "config": {"chart_type": "area", "data_source": "status_volume", "days": 30}, "size": "large", "position": 12, "required_permissions": ["dashboard.view"]},
            {"id": "w14", "widget_type": "chart", "title": "Top Categories", "config": {"chart_type": "bar", "data_source": "category_volume", "days": 30}, "size": "medium", "position": 13, "required_permissions": ["dashboard.view"]},
            {"id": "w15", "widget_type": "chart", "title": "SLA Trend (30 days)", "config": {"chart_type": "line", "data_source": "sla_trend", "days": 30}, "size": "medium", "position": 14, "required_permissions": ["dashboard.view"]},
            {"id": "w16", "widget_type": "chart", "title": "Pool Routing (30 days)", "config": {"chart_type": "pie", "data_source": "pool_routing", "days": 30}, "size": "medium", "position": 15, "required_permissions": ["orders.view"]},
            {"id": "w17", "widget_type": "ticket_list", "title": "Tickets Waiting Action", "config": {"list_type": "waiting_on_me", "limit": 10}, "size": "medium", "position": 16, "required_permissions": ["dashboard.view"]},
            {"id": "w18", "widget_type": "ticket_list", "title": "Recently Delivered (7 days)", "config": {"list_type": "recently_delivered", "limit": 10}, "size": "medium", "position": 17, "required_permissions": ["dashboard.view"]},
            {"id": "w19", "widget_type": "announcements", "title": "Announcements", "config": {"limit": 5}, "size": "medium", "position": 18, "required_permissions": ["dashboard.view"]},
        ]
    },
    {
        "id": "resolver_operator",
        "name": "Resolver / Operator Dashboard",
        "description": "Work-focused dashboard for internal staff with personal workload and SLA tracking",
        "is_system": True,
        "is_default_for": "Internal Staff",
        "widgets": [
            {"id": "w1", "widget_type": "kpi_card", "title": "Working On", "config": {"metric": "tickets_working_on", "icon": "Clock", "color": "bg-amber-500"}, "size": "small", "position": 0, "required_permissions": ["dashboard.view"]},
            {"id": "w2", "widget_type": "kpi_card", "title": "Waiting on Me", "config": {"metric": "tickets_waiting_on_me", "icon": "AlertCircle", "color": "bg-red-500"}, "size": "small", "position": 1, "required_permissions": ["dashboard.view"]},
            {"id": "w3", "widget_type": "kpi_card", "title": "Pending Review", "config": {"metric": "tickets_pending_review", "icon": "Eye", "color": "bg-purple-500"}, "size": "small", "position": 2, "required_permissions": ["dashboard.view"]},
            {"id": "w4", "widget_type": "kpi_card", "title": "Delivered (7d)", "config": {"metric": "recently_delivered_7d", "icon": "CheckCircle2", "color": "bg-emerald-500"}, "size": "small", "position": 3, "required_permissions": ["dashboard.view"]},
            {"id": "w5", "widget_type": "kpi_card", "title": "SLA On Track", "config": {"metric": "sla_on_track", "icon": "CheckCircle2", "color": "bg-emerald-500"}, "size": "small", "position": 4, "required_permissions": ["dashboard.view"]},
            {"id": "w6", "widget_type": "kpi_card", "title": "SLA At Risk", "config": {"metric": "sla_at_risk", "icon": "Clock", "color": "bg-amber-500"}, "size": "small", "position": 5, "required_permissions": ["dashboard.view"]},
            {"id": "w7", "widget_type": "kpi_card", "title": "Pool 1 Available", "config": {"metric": "pool1_available", "icon": "Layers", "color": "bg-indigo-500"}, "size": "small", "position": 6, "required_permissions": ["orders.pick"]},
            {"id": "w8", "widget_type": "kpi_card", "title": "Pool 2 Available", "config": {"metric": "pool2_available", "icon": "Layers", "color": "bg-pink-500"}, "size": "small", "position": 7, "required_permissions": ["orders.pick"]},
            {"id": "w9", "widget_type": "ticket_list", "title": "Tickets I'm Working On", "config": {"list_type": "working_on", "limit": 10}, "size": "large", "position": 8, "required_permissions": ["dashboard.view"]},
            {"id": "w10", "widget_type": "ticket_list", "title": "Tickets Waiting on Me", "config": {"list_type": "waiting_on_me", "limit": 10}, "size": "large", "position": 9, "required_permissions": ["dashboard.view"]},
            {"id": "w11", "widget_type": "ticket_list", "title": "Recently Delivered", "config": {"list_type": "recently_delivered", "limit": 10}, "size": "large", "position": 10, "required_permissions": ["dashboard.view"]},
        ]
    },
    {
        "id": "partner_vendor",
        "name": "Partner / Vendor Dashboard",
        "description": "Opportunity-focused dashboard for partners and vendors with pool visibility",
        "is_system": True,
        "is_default_for": "Partner",
        "widgets": [
            {"id": "w1", "widget_type": "kpi_card", "title": "Working On", "config": {"metric": "tickets_working_on", "icon": "Clock", "color": "bg-amber-500"}, "size": "small", "position": 0, "required_permissions": ["dashboard.view"]},
            {"id": "w2", "widget_type": "kpi_card", "title": "Waiting on Me", "config": {"metric": "tickets_waiting_on_me", "icon": "AlertCircle", "color": "bg-red-500"}, "size": "small", "position": 1, "required_permissions": ["dashboard.view"]},
            {"id": "w3", "widget_type": "kpi_card", "title": "Pending Review", "config": {"metric": "tickets_pending_review", "icon": "Eye", "color": "bg-purple-500"}, "size": "small", "position": 2, "required_permissions": ["dashboard.view"]},
            {"id": "w4", "widget_type": "kpi_card", "title": "Delivered (7d)", "config": {"metric": "recently_delivered_7d", "icon": "CheckCircle2", "color": "bg-emerald-500"}, "size": "small", "position": 3, "required_permissions": ["dashboard.view"]},
            {"id": "w5", "widget_type": "kpi_card", "title": "Pool 1 Available", "config": {"metric": "pool1_available", "icon": "Layers", "color": "bg-indigo-500"}, "size": "medium", "position": 4, "required_permissions": ["orders.pick"]},
            {"id": "w6", "widget_type": "kpi_card", "title": "Pool 2 Available", "config": {"metric": "pool2_available", "icon": "Layers", "color": "bg-pink-500"}, "size": "medium", "position": 5, "required_permissions": ["orders.pick"]},
            {"id": "w7", "widget_type": "ticket_list", "title": "Tickets I'm Working On", "config": {"list_type": "working_on", "limit": 10}, "size": "large", "position": 6, "required_permissions": ["dashboard.view"]},
            {"id": "w8", "widget_type": "ticket_list", "title": "Tickets Waiting on Me", "config": {"list_type": "waiting_on_me", "limit": 10}, "size": "large", "position": 7, "required_permissions": ["dashboard.view"]},
            {"id": "w9", "widget_type": "ticket_list", "title": "Recently Delivered", "config": {"list_type": "recently_delivered", "limit": 10}, "size": "medium", "position": 8, "required_permissions": ["dashboard.view"]},
        ]
    },
    {
        "id": "requester_client",
        "name": "Requester / Client Dashboard",
        "description": "Requester-focused dashboard showing only submitted tickets and their status",
        "is_system": True,
        "is_default_for": "Media Client",
        "widgets": [
            {"id": "w1", "widget_type": "kpi_card", "title": "Open", "config": {"metric": "open", "icon": "Inbox", "color": "bg-blue-500"}, "size": "small", "position": 0, "required_permissions": ["dashboard.view"]},
            {"id": "w2", "widget_type": "kpi_card", "title": "In Progress", "config": {"metric": "in_progress", "icon": "Clock", "color": "bg-amber-500"}, "size": "small", "position": 1, "required_permissions": ["dashboard.view"]},
            {"id": "w3", "widget_type": "kpi_card", "title": "Pending Review", "config": {"metric": "pending_review", "icon": "Eye", "color": "bg-purple-500"}, "size": "small", "position": 2, "required_permissions": ["dashboard.view"]},
            {"id": "w4", "widget_type": "kpi_card", "title": "Delivered", "config": {"metric": "delivered", "icon": "CheckCircle2", "color": "bg-emerald-500"}, "size": "small", "position": 3, "required_permissions": ["dashboard.view"]},
            {"id": "w5", "widget_type": "kpi_card", "title": "SLA On Track", "config": {"metric": "sla_on_track", "icon": "CheckCircle2", "color": "bg-emerald-500"}, "size": "small", "position": 4, "required_permissions": ["dashboard.view"]},
            {"id": "w6", "widget_type": "kpi_card", "title": "SLA At Risk", "config": {"metric": "sla_at_risk", "icon": "Clock", "color": "bg-amber-500"}, "size": "small", "position": 5, "required_permissions": ["dashboard.view"]},
            {"id": "w7", "widget_type": "kpi_card", "title": "SLA Breached", "config": {"metric": "sla_breached", "icon": "AlertTriangle", "color": "bg-red-500"}, "size": "small", "position": 6, "required_permissions": ["dashboard.view"]},
            {"id": "w8", "widget_type": "ticket_list", "title": "Pending Your Review", "config": {"list_type": "pending_review", "limit": 10}, "size": "large", "position": 7, "required_permissions": ["dashboard.view"]},
            {"id": "w9", "widget_type": "ticket_list", "title": "My Active Tickets", "config": {"list_type": "working_on", "limit": 10}, "size": "large", "position": 8, "required_permissions": ["dashboard.view"]},
            {"id": "w10", "widget_type": "ticket_list", "title": "Recently Delivered", "config": {"list_type": "recently_delivered", "limit": 10}, "size": "large", "position": 9, "required_permissions": ["dashboard.view"]},
        ]
    }
]


# ============== HELPER FUNCTIONS ==============

async def ensure_default_dashboards():
    """Ensure default dashboard templates exist"""
    for dashboard in DEFAULT_DASHBOARDS:
        existing = await db.dashboards.find_one({"id": dashboard["id"]})
        if not existing:
            dashboard_doc = {
                **dashboard,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system"
            }
            await db.dashboards.insert_one(dashboard_doc)


def filter_widgets_by_permissions(widgets: List[Dict], user_permissions: Dict) -> List[Dict]:
    """Filter widgets based on user permissions (auto-hide unauthorized widgets)"""
    filtered = []
    for widget in widgets:
        required_perms = widget.get("required_permissions", [])
        has_all_perms = True
        
        for perm in required_perms:
            parts = perm.split(".")
            if len(parts) == 2:
                module, action = parts
                if not user_permissions.get(module, {}).get(action, False):
                    has_all_perms = False
                    break
        
        if has_all_perms:
            filtered.append(widget)
    
    return filtered


# ============== ENDPOINTS ==============

@router.get("/list")
async def list_dashboards(current_user: dict = Depends(get_current_user)):
    """List dashboards available to the caller: built-in templates + any
    dashboards scoped to their org. Never leaks other orgs' custom dashboards."""
    await ensure_default_dashboards()

    org_id = resolve_org_id(current_user)
    # Built-in templates don't have an org_id; org-specific dashboards do.
    dashboards = await db.dashboards.find(
        {"$or": [{"org_id": {"$in": [None, ""]}}, {"org_id": {"$exists": False}}, {"org_id": org_id}]},
        {"_id": 0}
    ).to_list(None)
    return {"dashboards": dashboards}


@router.get("/widgets")
async def get_widget_library(current_user: dict = Depends(require_admin)):
    """Get available widget library (Admin only)"""
    # Group widgets by category
    categories = {}
    for widget in WIDGET_LIBRARY:
        cat = widget.get("category", "Other")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(widget)
    
    return {
        "widgets": WIDGET_LIBRARY,
        "categories": categories
    }


@router.get("/user-dashboard")
async def get_user_dashboard(current_user: dict = Depends(get_current_user)):
    """Get the dashboard assigned to the current user"""
    await ensure_default_dashboards()
    
    dashboard_type_id = current_user.get("dashboard_type_id")
    
    # Calculate effective permissions from role + overrides
    user_permissions = get_effective_permissions(
        current_user.get("role", "Standard User"),
        current_user.get("permission_overrides")
    )
    
    if dashboard_type_id:
        # User has explicit assignment
        dashboard = await db.dashboards.find_one({"id": dashboard_type_id}, {"_id": 0})
        if dashboard:
            # Filter widgets by user permissions
            dashboard["widgets"] = filter_widgets_by_permissions(
                dashboard.get("widgets", []),
                user_permissions
            )
            return {"dashboard": dashboard, "assigned": True}
    
    # No explicit assignment - return None (frontend should prompt user or show default)
    return {"dashboard": None, "assigned": False, "message": "No dashboard assigned. Please contact admin."}


@router.get("/{dashboard_id}")
async def get_dashboard(dashboard_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific dashboard by ID"""
    await ensure_default_dashboards()
    
    dashboard = await db.dashboards.find_one({"id": dashboard_id}, {"_id": 0})
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # Calculate effective permissions from role + overrides
    user_permissions = get_effective_permissions(
        current_user.get("role", "Standard User"),
        current_user.get("permission_overrides")
    )
    
    # Filter widgets by user permissions
    dashboard["widgets"] = filter_widgets_by_permissions(
        dashboard.get("widgets", []),
        user_permissions
    )
    
    return dashboard


@router.post("")
async def create_dashboard(data: DashboardCreate, current_user: dict = Depends(require_admin)):
    """Create a new dashboard template (Admin only)"""
    dashboard_id = str(uuid.uuid4())
    
    dashboard = {
        "id": dashboard_id,
        "name": data.name,
        "description": data.description,
        "widgets": [w.dict() for w in data.widgets],
        "is_system": False,  # Custom dashboards are never system dashboards
        "is_default_for": None,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.dashboards.insert_one(dashboard)
    
    return {"id": dashboard_id, "message": "Dashboard created successfully"}


@router.put("/{dashboard_id}")
async def update_dashboard(
    dashboard_id: str, 
    data: DashboardUpdate, 
    current_user: dict = Depends(require_admin)
):
    """Update a dashboard template (Admin only)"""
    dashboard = await db.dashboards.find_one({"id": dashboard_id})
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.widgets is not None:
        update_data["widgets"] = [w.dict() for w in data.widgets]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.dashboards.update_one({"id": dashboard_id}, {"$set": update_data})
    
    # Return the updated dashboard
    updated = await db.dashboards.find_one({"id": dashboard_id}, {"_id": 0})
    return updated


@router.delete("/{dashboard_id}")
async def delete_dashboard(dashboard_id: str, current_user: dict = Depends(require_admin)):
    """Delete a custom dashboard (Admin only, cannot delete system dashboards)"""
    dashboard = await db.dashboards.find_one({"id": dashboard_id})
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    if dashboard.get("is_system", False):
        raise HTTPException(status_code=400, detail="Cannot delete system dashboard")
    
    # Check if any users have this dashboard assigned
    users_with_dashboard = await db.users.count_documents({"dashboard_type_id": dashboard_id})
    if users_with_dashboard > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete dashboard: {users_with_dashboard} user(s) have this dashboard assigned"
        )
    
    await db.dashboards.delete_one({"id": dashboard_id})
    
    return {"message": "Dashboard deleted successfully"}


@router.post("/{dashboard_id}/clone")
async def clone_dashboard(
    dashboard_id: str, 
    name: str = Query(..., description="Name for the cloned dashboard"),
    current_user: dict = Depends(require_admin)
):
    """Clone an existing dashboard (Admin only)"""
    source = await db.dashboards.find_one({"id": dashboard_id}, {"_id": 0})
    if not source:
        raise HTTPException(status_code=404, detail="Source dashboard not found")
    
    new_id = str(uuid.uuid4())
    
    cloned = {
        "id": new_id,
        "name": name,
        "description": f"Cloned from: {source['name']}",
        "widgets": source.get("widgets", []),
        "is_system": False,
        "is_default_for": None,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Generate new widget IDs
    for i, widget in enumerate(cloned["widgets"]):
        widget["id"] = f"w{i+1}_{uuid.uuid4().hex[:8]}"
    
    await db.dashboards.insert_one(cloned)
    
    return {"id": new_id, "message": "Dashboard cloned successfully"}


@router.get("/{dashboard_id}/preview")
async def preview_dashboard_as_role(
    dashboard_id: str,
    role: str = Query(..., description="Role to preview as (Administrator, Operator, Standard User)"),
    current_user: dict = Depends(require_admin)
):
    """Preview a dashboard as a specific role (Admin only)"""
    await ensure_default_dashboards()
    
    dashboard = await db.dashboards.find_one({"id": dashboard_id}, {"_id": 0})
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # Get role permissions from default permissions
    role_permissions = get_effective_permissions(role, None)
    
    # Filter widgets by role permissions
    filtered_widgets = filter_widgets_by_permissions(
        dashboard.get("widgets", []),
        role_permissions
    )
    
    return {
        "dashboard": {
            **dashboard,
            "widgets": filtered_widgets
        },
        "preview_role": role,
        "original_widget_count": len(dashboard.get("widgets", [])),
        "visible_widget_count": len(filtered_widgets)
    }
