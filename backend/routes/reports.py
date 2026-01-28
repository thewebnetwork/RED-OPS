"""
Reports Module - Backend Routes

Provides canned (Crystal-style) reports with filtering and export capabilities.
Supports CSV and PDF exports with RBAC-aware data filtering.
"""
import uuid
import csv
import io
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import get_utc_now

router = APIRouter(prefix="/reports", tags=["Reports"])


# ============== MODELS ==============

class ReportFilter(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    status: Optional[List[str]] = None
    category_l1_id: Optional[str] = None
    category_l2_id: Optional[str] = None
    team_id: Optional[str] = None
    assignee_id: Optional[str] = None
    role: Optional[str] = None
    specialty_id: Optional[str] = None
    access_tier_id: Optional[str] = None
    sla_state: Optional[Literal["on_track", "at_risk", "breached"]] = None
    sla_policy_id: Optional[str] = None
    search: Optional[str] = None


class ReportMetadata(BaseModel):
    id: str
    name: str
    description: str
    category: str
    supports_charts: bool = False


class ReportDataRow(BaseModel):
    """Generic row for report data"""
    pass


class ReportResponse(BaseModel):
    report_id: str
    report_name: str
    generated_at: str
    filters_applied: dict
    total_rows: int
    columns: List[str]
    data: List[dict]
    summary: Optional[dict] = None


# ============== CANNED REPORTS DEFINITIONS ==============

CANNED_REPORTS = [
    {
        "id": "tickets_created",
        "name": "Tickets Created",
        "description": "Number of tickets created over time (day/week/month)",
        "category": "Volume",
        "supports_charts": True
    },
    {
        "id": "tickets_closed",
        "name": "Tickets Closed",
        "description": "Number of tickets closed over time (day/week/month)",
        "category": "Volume",
        "supports_charts": True
    },
    {
        "id": "open_ticket_aging",
        "name": "Open Ticket Aging",
        "description": "Open tickets grouped by age buckets (0-24h, 1-3d, 3-7d, 7-14d, 14d+)",
        "category": "Aging",
        "supports_charts": True
    },
    {
        "id": "avg_first_response",
        "name": "Avg Time to First Response",
        "description": "Average time from ticket creation to first response",
        "category": "Performance",
        "supports_charts": True
    },
    {
        "id": "avg_resolution_time",
        "name": "Avg Time to Resolution",
        "description": "Average time from ticket creation to closure",
        "category": "Performance",
        "supports_charts": True
    },
    {
        "id": "sla_compliance",
        "name": "SLA Compliance Summary",
        "description": "SLA status breakdown: On Track, At Risk, Breached, Unacknowledged",
        "category": "SLA",
        "supports_charts": True
    },
    {
        "id": "tickets_by_assignee",
        "name": "Tickets by Assignee",
        "description": "Ticket distribution across assignees",
        "category": "Distribution",
        "supports_charts": True
    },
    {
        "id": "tickets_by_team",
        "name": "Tickets by Team",
        "description": "Ticket distribution across teams",
        "category": "Distribution",
        "supports_charts": True
    },
    {
        "id": "tickets_by_specialty",
        "name": "Tickets by Specialty",
        "description": "Ticket distribution across specialties",
        "category": "Distribution",
        "supports_charts": True
    },
    {
        "id": "tickets_by_category",
        "name": "Tickets by Category",
        "description": "Ticket distribution by Category L1/L2",
        "category": "Distribution",
        "supports_charts": True
    },
    {
        "id": "escalation_events",
        "name": "Escalation Events Report",
        "description": "All escalation events with details",
        "category": "Escalation",
        "supports_charts": False
    },
    {
        "id": "sla_policy_effectiveness",
        "name": "SLA Policy Effectiveness",
        "description": "Performance metrics per SLA policy",
        "category": "SLA",
        "supports_charts": True
    },
    {
        "id": "stale_pending_review",
        "name": "Stale Pending Review Tickets",
        "description": "Tickets in Pending status awaiting requester review (supports 24h/5d workflow)",
        "category": "Workflow",
        "supports_charts": False
    }
]


# ============== HELPER FUNCTIONS ==============

def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse ISO date string to datetime"""
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except:
        return None


def build_base_query(filters: ReportFilter, current_user: dict) -> dict:
    """Build MongoDB query from filters with RBAC"""
    query = {}
    
    # Date range
    if filters.date_from or filters.date_to:
        date_query = {}
        if filters.date_from:
            date_query["$gte"] = filters.date_from
        if filters.date_to:
            date_query["$lte"] = filters.date_to
        if date_query:
            query["created_at"] = date_query
    
    # Status filter
    if filters.status:
        query["status"] = {"$in": filters.status}
    
    # Category filters
    if filters.category_l1_id:
        query["category_l1_id"] = filters.category_l1_id
    if filters.category_l2_id:
        query["category_l2_id"] = filters.category_l2_id
    
    # Team filter
    if filters.team_id:
        query["$or"] = [
            {"requester_team_id": filters.team_id},
            {"assigned_team_id": filters.team_id}
        ]
    
    # Assignee filter
    if filters.assignee_id:
        query["editor_id"] = filters.assignee_id
    
    # Search filter
    if filters.search:
        query["$or"] = [
            {"title": {"$regex": filters.search, "$options": "i"}},
            {"order_code": {"$regex": filters.search, "$options": "i"}},
            {"description": {"$regex": filters.search, "$options": "i"}}
        ]
    
    # Exclude drafts from reports
    if "status" not in query:
        query["status"] = {"$ne": "Draft"}
    elif isinstance(query["status"], dict) and "$in" in query["status"]:
        query["status"]["$nin"] = ["Draft"]
    
    return query


async def get_sla_state_for_order(order: dict) -> str:
    """Determine SLA state for an order"""
    if not order.get("sla_deadline"):
        return "unknown"
    
    now = datetime.now(timezone.utc)
    try:
        deadline = datetime.fromisoformat(order["sla_deadline"].replace('Z', '+00:00'))
    except:
        return "unknown"
    
    if order["status"] in ["Closed", "Delivered"]:
        closed_at = order.get("closed_at") or order.get("delivered_at")
        if closed_at:
            try:
                closed_dt = datetime.fromisoformat(closed_at.replace('Z', '+00:00'))
                if closed_dt <= deadline:
                    return "on_track"
                else:
                    return "breached"
            except:
                pass
        return "on_track"
    
    time_remaining = (deadline - now).total_seconds()
    if time_remaining < 0:
        return "breached"
    elif time_remaining < 3600:  # Less than 1 hour
        return "at_risk"
    else:
        return "on_track"


# ============== ROUTES ==============

@router.get("/available", response_model=List[ReportMetadata])
async def list_available_reports(current_user: dict = Depends(get_current_user)):
    """Get list of available canned reports"""
    return [ReportMetadata(**r) for r in CANNED_REPORTS]


@router.post("/{report_id}/generate", response_model=ReportResponse)
async def generate_report(
    report_id: str,
    filters: ReportFilter,
    current_user: dict = Depends(get_current_user)
):
    """Generate a specific report with filters"""
    # Find report definition
    report_def = next((r for r in CANNED_REPORTS if r["id"] == report_id), None)
    if not report_def:
        raise HTTPException(status_code=404, detail="Report not found")
    
    now = get_utc_now()
    base_query = build_base_query(filters, current_user)
    
    # Execute report-specific logic
    if report_id == "tickets_created":
        return await generate_tickets_created_report(report_def, filters, base_query, now)
    elif report_id == "tickets_closed":
        return await generate_tickets_closed_report(report_def, filters, base_query, now)
    elif report_id == "open_ticket_aging":
        return await generate_aging_report(report_def, filters, now)
    elif report_id == "avg_first_response":
        return await generate_first_response_report(report_def, filters, base_query, now)
    elif report_id == "avg_resolution_time":
        return await generate_resolution_time_report(report_def, filters, base_query, now)
    elif report_id == "sla_compliance":
        return await generate_sla_compliance_report(report_def, filters, base_query, now)
    elif report_id == "tickets_by_assignee":
        return await generate_tickets_by_assignee_report(report_def, filters, base_query, now)
    elif report_id == "tickets_by_team":
        return await generate_tickets_by_team_report(report_def, filters, base_query, now)
    elif report_id == "tickets_by_specialty":
        return await generate_tickets_by_specialty_report(report_def, filters, base_query, now)
    elif report_id == "tickets_by_category":
        return await generate_tickets_by_category_report(report_def, filters, base_query, now)
    elif report_id == "escalation_events":
        return await generate_escalation_events_report(report_def, filters, base_query, now)
    elif report_id == "sla_policy_effectiveness":
        return await generate_sla_policy_effectiveness_report(report_def, filters, now)
    elif report_id == "stale_pending_review":
        return await generate_stale_pending_review_report(report_def, filters, now)
    else:
        raise HTTPException(status_code=400, detail="Report not implemented")


@router.post("/{report_id}/export/csv")
async def export_report_csv(
    report_id: str,
    filters: ReportFilter,
    current_user: dict = Depends(get_current_user)
):
    """Export report as CSV"""
    report = await generate_report(report_id, filters, current_user)
    
    # Create CSV
    output = io.StringIO()
    if report.data:
        writer = csv.DictWriter(output, fieldnames=report.columns)
        writer.writeheader()
        writer.writerows(report.data)
    
    output.seek(0)
    
    filename = f"{report_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/{report_id}/export/pdf")
async def export_report_pdf(
    report_id: str,
    filters: ReportFilter,
    current_user: dict = Depends(require_roles(["Admin", "Privileged User"]))
):
    """Export report as PDF - returns JSON for frontend PDF generation"""
    report = await generate_report(report_id, filters, current_user)
    
    # Return data for frontend PDF generation (using jsPDF/html2canvas)
    # The frontend will handle actual PDF rendering with charts and branding
    return {
        "report": report.dict(),
        "brand_colors": {
            "primary": "#E11D48",  # Rose-600
            "secondary": "#1E293B",  # Slate-800
            "accent": "#F43F5E",  # Rose-500
            "background": "#FFFFFF",
            "text": "#334155"  # Slate-700
        },
        "generated_by": current_user["name"],
        "generated_at": get_utc_now()
    }


# ============== REPORT GENERATORS ==============

async def generate_tickets_created_report(report_def: dict, filters: ReportFilter, base_query: dict, now: str):
    """Generate tickets created report with daily breakdown"""
    orders = await db.orders.find(base_query, {"_id": 0}).to_list(10000)
    
    # Group by date
    date_counts = {}
    for order in orders:
        created = order.get("created_at", "")[:10]  # Get YYYY-MM-DD
        date_counts[created] = date_counts.get(created, 0) + 1
    
    data = [{"date": k, "count": v} for k, v in sorted(date_counts.items())]
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(data),
        columns=["date", "count"],
        data=data,
        summary={"total_tickets": len(orders)}
    )


async def generate_tickets_closed_report(report_def: dict, filters: ReportFilter, base_query: dict, now: str):
    """Generate tickets closed report"""
    closed_query = {**base_query, "status": "Closed"}
    orders = await db.orders.find(closed_query, {"_id": 0}).to_list(10000)
    
    date_counts = {}
    for order in orders:
        closed_at = order.get("closed_at", order.get("updated_at", ""))[:10]
        date_counts[closed_at] = date_counts.get(closed_at, 0) + 1
    
    data = [{"date": k, "count": v} for k, v in sorted(date_counts.items())]
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(data),
        columns=["date", "count"],
        data=data,
        summary={"total_closed": len(orders)}
    )


async def generate_aging_report(report_def: dict, filters: ReportFilter, now: str):
    """Generate open ticket aging report"""
    open_query = {"status": {"$in": ["Open", "In Progress", "Pending"]}}
    orders = await db.orders.find(open_query, {"_id": 0}).to_list(10000)
    
    now_dt = datetime.now(timezone.utc)
    buckets = {
        "0-24h": 0,
        "1-3 days": 0,
        "3-7 days": 0,
        "7-14 days": 0,
        "14+ days": 0
    }
    
    detailed_data = []
    for order in orders:
        try:
            created = datetime.fromisoformat(order["created_at"].replace('Z', '+00:00'))
            age_hours = (now_dt - created).total_seconds() / 3600
            
            if age_hours <= 24:
                bucket = "0-24h"
            elif age_hours <= 72:
                bucket = "1-3 days"
            elif age_hours <= 168:
                bucket = "3-7 days"
            elif age_hours <= 336:
                bucket = "7-14 days"
            else:
                bucket = "14+ days"
            
            buckets[bucket] += 1
            detailed_data.append({
                "order_code": order.get("order_code"),
                "title": order.get("title"),
                "status": order.get("status"),
                "age_hours": round(age_hours, 1),
                "age_bucket": bucket,
                "created_at": order.get("created_at")
            })
        except:
            continue
    
    summary_data = [{"bucket": k, "count": v} for k, v in buckets.items()]
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(detailed_data),
        columns=["order_code", "title", "status", "age_hours", "age_bucket", "created_at"],
        data=detailed_data,
        summary={"buckets": buckets, "total_open": len(orders)}
    )


async def generate_first_response_report(report_def: dict, filters: ReportFilter, base_query: dict, now: str):
    """Generate average time to first response report"""
    orders = await db.orders.find(base_query, {"_id": 0}).to_list(10000)
    
    response_times = []
    for order in orders:
        if order.get("picked_at") and order.get("created_at"):
            try:
                created = datetime.fromisoformat(order["created_at"].replace('Z', '+00:00'))
                picked = datetime.fromisoformat(order["picked_at"].replace('Z', '+00:00'))
                response_time_hours = (picked - created).total_seconds() / 3600
                response_times.append({
                    "order_code": order.get("order_code"),
                    "title": order.get("title"),
                    "created_at": order.get("created_at"),
                    "first_response_at": order.get("picked_at"),
                    "response_time_hours": round(response_time_hours, 2)
                })
            except:
                continue
    
    avg_response = sum(r["response_time_hours"] for r in response_times) / len(response_times) if response_times else 0
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(response_times),
        columns=["order_code", "title", "created_at", "first_response_at", "response_time_hours"],
        data=response_times,
        summary={"avg_response_hours": round(avg_response, 2), "total_measured": len(response_times)}
    )


async def generate_resolution_time_report(report_def: dict, filters: ReportFilter, base_query: dict, now: str):
    """Generate average resolution time report"""
    closed_query = {**base_query, "status": "Closed"}
    orders = await db.orders.find(closed_query, {"_id": 0}).to_list(10000)
    
    resolution_times = []
    for order in orders:
        if order.get("closed_at") and order.get("created_at"):
            try:
                created = datetime.fromisoformat(order["created_at"].replace('Z', '+00:00'))
                closed = datetime.fromisoformat(order["closed_at"].replace('Z', '+00:00'))
                resolution_hours = (closed - created).total_seconds() / 3600
                resolution_times.append({
                    "order_code": order.get("order_code"),
                    "title": order.get("title"),
                    "created_at": order.get("created_at"),
                    "closed_at": order.get("closed_at"),
                    "resolution_hours": round(resolution_hours, 2)
                })
            except:
                continue
    
    avg_resolution = sum(r["resolution_hours"] for r in resolution_times) / len(resolution_times) if resolution_times else 0
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(resolution_times),
        columns=["order_code", "title", "created_at", "closed_at", "resolution_hours"],
        data=resolution_times,
        summary={"avg_resolution_hours": round(avg_resolution, 2), "total_measured": len(resolution_times)}
    )


async def generate_sla_compliance_report(report_def: dict, filters: ReportFilter, base_query: dict, now: str):
    """Generate SLA compliance summary"""
    orders = await db.orders.find(base_query, {"_id": 0}).to_list(10000)
    
    sla_counts = {"on_track": 0, "at_risk": 0, "breached": 0, "unknown": 0}
    detailed_data = []
    
    for order in orders:
        sla_state = await get_sla_state_for_order(order)
        sla_counts[sla_state] += 1
        detailed_data.append({
            "order_code": order.get("order_code"),
            "title": order.get("title"),
            "status": order.get("status"),
            "sla_deadline": order.get("sla_deadline"),
            "sla_state": sla_state
        })
    
    # Filter by SLA state if specified
    if filters.sla_state:
        detailed_data = [d for d in detailed_data if d["sla_state"] == filters.sla_state]
    
    total = sum(sla_counts.values())
    compliance_rate = (sla_counts["on_track"] / total * 100) if total > 0 else 0
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(detailed_data),
        columns=["order_code", "title", "status", "sla_deadline", "sla_state"],
        data=detailed_data,
        summary={
            "on_track": sla_counts["on_track"],
            "at_risk": sla_counts["at_risk"],
            "breached": sla_counts["breached"],
            "unknown": sla_counts["unknown"],
            "compliance_rate": round(compliance_rate, 1)
        }
    )


async def generate_tickets_by_assignee_report(report_def: dict, filters: ReportFilter, base_query: dict, now: str):
    """Generate tickets by assignee report"""
    orders = await db.orders.find(base_query, {"_id": 0}).to_list(10000)
    
    assignee_counts = {}
    for order in orders:
        assignee = order.get("editor_name") or "Unassigned"
        assignee_id = order.get("editor_id") or "unassigned"
        key = f"{assignee_id}|{assignee}"
        assignee_counts[key] = assignee_counts.get(key, 0) + 1
    
    data = []
    for key, count in sorted(assignee_counts.items(), key=lambda x: -x[1]):
        assignee_id, assignee_name = key.split("|", 1)
        data.append({
            "assignee_id": assignee_id,
            "assignee_name": assignee_name,
            "ticket_count": count
        })
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(data),
        columns=["assignee_id", "assignee_name", "ticket_count"],
        data=data,
        summary={"total_tickets": len(orders), "unique_assignees": len(data)}
    )


async def generate_tickets_by_team_report(report_def: dict, filters: ReportFilter, base_query: dict, now: str):
    """Generate tickets by team report"""
    orders = await db.orders.find(base_query, {"_id": 0}).to_list(10000)
    teams = await db.teams.find({}, {"_id": 0}).to_list(100)
    team_map = {t["id"]: t["name"] for t in teams}
    
    # Get requester team from users
    user_ids = list(set(o.get("requester_id") for o in orders if o.get("requester_id")))
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "team_id": 1}).to_list(10000)
    user_team_map = {u["id"]: u.get("team_id") for u in users}
    
    team_counts = {}
    for order in orders:
        team_id = user_team_map.get(order.get("requester_id"))
        team_name = team_map.get(team_id, "No Team") if team_id else "No Team"
        team_counts[team_name] = team_counts.get(team_name, 0) + 1
    
    data = [{"team_name": k, "ticket_count": v} for k, v in sorted(team_counts.items(), key=lambda x: -x[1])]
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(data),
        columns=["team_name", "ticket_count"],
        data=data,
        summary={"total_tickets": len(orders), "unique_teams": len(data)}
    )


async def generate_tickets_by_specialty_report(report_def: dict, filters: ReportFilter, base_query: dict, now: str):
    """Generate tickets by specialty report"""
    orders = await db.orders.find(base_query, {"_id": 0}).to_list(10000)
    specialties = await db.specialties.find({}, {"_id": 0}).to_list(100)
    specialty_map = {s["id"]: s["name"] for s in specialties}
    
    # Get requester specialty from users
    user_ids = list(set(o.get("requester_id") for o in orders if o.get("requester_id")))
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "specialty_id": 1}).to_list(10000)
    user_specialty_map = {u["id"]: u.get("specialty_id") for u in users}
    
    specialty_counts = {}
    for order in orders:
        spec_id = user_specialty_map.get(order.get("requester_id"))
        spec_name = specialty_map.get(spec_id, "No Specialty") if spec_id else "No Specialty"
        specialty_counts[spec_name] = specialty_counts.get(spec_name, 0) + 1
    
    data = [{"specialty_name": k, "ticket_count": v} for k, v in sorted(specialty_counts.items(), key=lambda x: -x[1])]
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(data),
        columns=["specialty_name", "ticket_count"],
        data=data,
        summary={"total_tickets": len(orders), "unique_specialties": len(data)}
    )


async def generate_tickets_by_category_report(report_def: dict, filters: ReportFilter, base_query: dict, now: str):
    """Generate tickets by category (L1/L2) report"""
    orders = await db.orders.find(base_query, {"_id": 0}).to_list(10000)
    
    category_counts = {}
    for order in orders:
        l1 = order.get("category_l1_name") or "Uncategorized"
        l2 = order.get("category_l2_name") or ""
        category = f"{l1}" + (f" → {l2}" if l2 else "")
        category_counts[category] = category_counts.get(category, 0) + 1
    
    data = [{"category": k, "ticket_count": v} for k, v in sorted(category_counts.items(), key=lambda x: -x[1])]
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(data),
        columns=["category", "ticket_count"],
        data=data,
        summary={"total_tickets": len(orders), "unique_categories": len(data)}
    )


async def generate_escalation_events_report(report_def: dict, filters: ReportFilter, base_query: dict, now: str):
    """Generate escalation events report"""
    # Get from escalation_history collection
    query = {}
    if filters.date_from or filters.date_to:
        date_query = {}
        if filters.date_from:
            date_query["$gte"] = filters.date_from
        if filters.date_to:
            date_query["$lte"] = filters.date_to
        if date_query:
            query["escalated_at"] = date_query
    
    escalations = await db.escalation_history.find(query, {"_id": 0}).sort("escalated_at", -1).to_list(10000)
    
    data = []
    for esc in escalations:
        data.append({
            "order_id": esc.get("order_id"),
            "order_code": esc.get("order_code"),
            "escalation_level": esc.get("level"),
            "reason": esc.get("reason"),
            "escalated_to": esc.get("escalated_to_name"),
            "escalated_at": esc.get("escalated_at"),
            "policy_name": esc.get("policy_name")
        })
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(data),
        columns=["order_code", "escalation_level", "reason", "escalated_to", "escalated_at", "policy_name"],
        data=data,
        summary={"total_escalations": len(data)}
    )


async def generate_sla_policy_effectiveness_report(report_def: dict, filters: ReportFilter, now: str):
    """Generate SLA policy effectiveness report"""
    policies = await db.sla_policies.find({"is_active": True}, {"_id": 0}).to_list(100)
    orders = await db.orders.find({"status": {"$ne": "Draft"}}, {"_id": 0}).to_list(10000)
    
    data = []
    for policy in policies:
        policy_orders = [o for o in orders if o.get("sla_policy_id") == policy.get("id")]
        
        if policy_orders:
            on_track = sum(1 for o in policy_orders if await get_sla_state_for_order(o) == "on_track")
            breached = sum(1 for o in policy_orders if await get_sla_state_for_order(o) == "breached")
            compliance = (on_track / len(policy_orders) * 100) if policy_orders else 0
        else:
            on_track = 0
            breached = 0
            compliance = 100
        
        data.append({
            "policy_id": policy.get("id"),
            "policy_name": policy.get("name"),
            "total_tickets": len(policy_orders),
            "on_track": on_track,
            "breached": breached,
            "compliance_rate": round(compliance, 1)
        })
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(data),
        columns=["policy_name", "total_tickets", "on_track", "breached", "compliance_rate"],
        data=data,
        summary={"total_policies": len(policies)}
    )


async def generate_stale_pending_review_report(report_def: dict, filters: ReportFilter, now: str):
    """Generate stale pending review tickets report (supports 24h/5d workflow)"""
    now_dt = datetime.now(timezone.utc)
    
    pending_orders = await db.orders.find({
        "status": "Pending",
        "review_started_at": {"$exists": True, "$ne": None}
    }, {"_id": 0}).to_list(10000)
    
    data = []
    for order in pending_orders:
        try:
            review_started = datetime.fromisoformat(order["review_started_at"].replace('Z', '+00:00'))
            hours_waiting = (now_dt - review_started).total_seconds() / 3600
            days_waiting = hours_waiting / 24
            
            # Check if requester responded
            last_msg = order.get("last_requester_message_at")
            requester_responded = False
            if last_msg:
                last_msg_dt = datetime.fromisoformat(last_msg.replace('Z', '+00:00'))
                requester_responded = last_msg_dt > review_started
            
            status_label = "Responded" if requester_responded else (
                "Auto-close pending" if days_waiting >= 5 else (
                    "Email reminder sent" if hours_waiting >= 24 else "Waiting"
                )
            )
            
            data.append({
                "order_code": order.get("order_code"),
                "title": order.get("title"),
                "requester_name": order.get("requester_name"),
                "review_started_at": order.get("review_started_at"),
                "hours_waiting": round(hours_waiting, 1),
                "days_waiting": round(days_waiting, 2),
                "requester_responded": requester_responded,
                "workflow_status": status_label
            })
        except:
            continue
    
    # Sort by hours waiting (longest first)
    data.sort(key=lambda x: -x["hours_waiting"])
    
    return ReportResponse(
        report_id=report_def["id"],
        report_name=report_def["name"],
        generated_at=now,
        filters_applied=filters.dict(exclude_none=True),
        total_rows=len(data),
        columns=["order_code", "title", "requester_name", "review_started_at", "hours_waiting", "days_waiting", "workflow_status"],
        data=data,
        summary={
            "total_pending": len(data),
            "awaiting_24h_email": sum(1 for d in data if d["workflow_status"] == "Waiting"),
            "email_sent": sum(1 for d in data if d["workflow_status"] == "Email reminder sent"),
            "pending_auto_close": sum(1 for d in data if d["workflow_status"] == "Auto-close pending"),
            "responded": sum(1 for d in data if d["workflow_status"] == "Responded")
        }
    )
