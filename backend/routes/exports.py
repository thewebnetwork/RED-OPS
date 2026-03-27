"""
CSV Export Routes

Provides CSV download for key collections: tasks, orders, clients, time entries.
Admin/Operator only.
"""
import csv
import io
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional

from database import db
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exports", tags=["Exports"])


def make_csv_response(rows: list, columns: list, filename: str) -> StreamingResponse:
    """Build a CSV StreamingResponse from rows and column names."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/tasks")
async def export_tasks(
    current_user: dict = Depends(get_current_user)
):
    """Export all tasks as CSV. Admin/Operator only."""
    if current_user.get("role") not in ["Administrator", "Admin", "Operator"]:
        raise HTTPException(status_code=403, detail="Admin or Operator access required")

    tasks = await db.tasks.find({"parent_task_id": {"$in": [None, ""]}}, {"_id": 0}).sort("created_at", -1).to_list(5000)

    rows = []
    for t in tasks:
        # Resolve names
        assignee_name = ""
        if t.get("assignee_user_id"):
            u = await db.users.find_one({"id": t["assignee_user_id"]}, {"_id": 0, "name": 1, "full_name": 1})
            assignee_name = (u.get("full_name") or u.get("name", "")) if u else ""

        rows.append({
            "id": t.get("id"),
            "title": t.get("title"),
            "status": t.get("status"),
            "priority": t.get("priority"),
            "assignee": assignee_name,
            "project_id": t.get("project_id", ""),
            "due_date": str(t.get("due_at", ""))[:10] if t.get("due_at") else "",
            "created_at": str(t.get("created_at", ""))[:10],
            "completed_at": str(t.get("completed_at", ""))[:10] if t.get("completed_at") else "",
        })

    columns = ["id", "title", "status", "priority", "assignee", "project_id", "due_date", "created_at", "completed_at"]
    now = datetime.now(timezone.utc).strftime("%Y%m%d")
    return make_csv_response(rows, columns, f"tasks_export_{now}.csv")


@router.get("/orders")
async def export_orders(
    current_user: dict = Depends(get_current_user)
):
    """Export all orders as CSV. Admin/Operator only."""
    if current_user.get("role") not in ["Administrator", "Admin", "Operator"]:
        raise HTTPException(status_code=403, detail="Admin or Operator access required")

    orders = await db.orders.find({"deleted": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(5000)

    rows = []
    for o in orders:
        rows.append({
            "order_code": o.get("order_code"),
            "title": o.get("title"),
            "status": o.get("status"),
            "priority": o.get("priority"),
            "requester": o.get("requester_name", ""),
            "assigned_to": o.get("editor_name", ""),
            "service": o.get("service_name", ""),
            "created_at": str(o.get("created_at", ""))[:10],
            "delivered_at": str(o.get("delivered_at", ""))[:10] if o.get("delivered_at") else "",
            "sla_deadline": str(o.get("sla_deadline", ""))[:10] if o.get("sla_deadline") else "",
        })

    columns = ["order_code", "title", "status", "priority", "requester", "assigned_to", "service", "created_at", "delivered_at", "sla_deadline"]
    now = datetime.now(timezone.utc).strftime("%Y%m%d")
    return make_csv_response(rows, columns, f"orders_export_{now}.csv")


@router.get("/clients")
async def export_clients(
    current_user: dict = Depends(get_current_user)
):
    """Export all Media Client users as CSV. Admin/Operator only."""
    if current_user.get("role") not in ["Administrator", "Admin", "Operator"]:
        raise HTTPException(status_code=403, detail="Admin or Operator access required")

    users = await db.users.find(
        {"account_type": "Media Client", "active": {"$ne": False}},
        {"_id": 0, "password": 0}
    ).to_list(1000)

    rows = []
    for u in users:
        rows.append({
            "id": u.get("id"),
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "company": u.get("company_name", ""),
            "phone": u.get("phone", ""),
            "industry": u.get("industry", ""),
            "plan": u.get("subscription_plan_name", ""),
            "active": "Yes" if u.get("active") is not False else "No",
            "created_at": str(u.get("created_at", ""))[:10],
        })

    columns = ["id", "name", "email", "company", "phone", "industry", "plan", "active", "created_at"]
    now = datetime.now(timezone.utc).strftime("%Y%m%d")
    return make_csv_response(rows, columns, f"clients_export_{now}.csv")


@router.get("/time-entries")
async def export_time_entries(
    period: Optional[str] = Query(None, description="YYYY-MM to filter by month"),
    current_user: dict = Depends(get_current_user)
):
    """Export time entries as CSV. Admin/Operator only."""
    if current_user.get("role") not in ["Administrator", "Admin", "Operator"]:
        raise HTTPException(status_code=403, detail="Admin or Operator access required")

    query = {}
    if period:
        query["date"] = {"$regex": f"^{period}"}

    entries = await db.time_entries.find(query, {"_id": 0}).sort("date", -1).to_list(10000)

    rows = []
    for e in entries:
        # Resolve user and task names
        user_name = ""
        u = await db.users.find_one({"id": e.get("user_id")}, {"_id": 0, "name": 1, "full_name": 1})
        if u:
            user_name = u.get("full_name") or u.get("name", "")

        task_title = ""
        t = await db.tasks.find_one({"id": e.get("task_id")}, {"_id": 0, "title": 1})
        if t:
            task_title = t.get("title", "")

        rows.append({
            "date": e.get("date"),
            "user": user_name,
            "task": task_title,
            "hours": e.get("hours"),
            "description": e.get("description", ""),
        })

    columns = ["date", "user", "task", "hours", "description"]
    now = datetime.now(timezone.utc).strftime("%Y%m%d")
    return make_csv_response(rows, columns, f"time_entries_export_{now}.csv")
