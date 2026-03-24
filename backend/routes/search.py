"""Global search across orders, tasks, projects, clients, files."""
import asyncio
from fastapi import APIRouter, Depends, Query
from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/search", tags=["Search"])


async def _empty():
    return []


@router.get("")
async def global_search(
    q: str = Query(..., min_length=2, max_length=100),
    current_user: dict = Depends(get_current_user)
):
    """Search across orders, tasks, projects, users, files. Returns max 5 per type."""
    regex = {"$regex": q, "$options": "i"}
    role = current_user.get("role", "")
    user_id = current_user["id"]
    is_admin = role in ["Administrator", "Admin", "Operator"]

    # Build role-scoped base queries
    order_query = {"deleted": {"$ne": True}, "$or": [{"title": regex}, {"order_code": regex}, {"service_name": regex}]}
    task_query = {"$or": [{"title": regex}, {"description": regex}]}
    project_query = {"$or": [{"name": regex}, {"description": regex}]}

    if not is_admin:
        order_query["requester_id"] = user_id
        task_query = {"$and": [
            {"$or": [{"assigned_to_id": user_id}, {"created_by_id": user_id}]},
            {"$or": [{"title": regex}, {"description": regex}]}
        ]}
        project_query = {"$and": [
            {"$or": [{"client_id": user_id}, {"team_members.user_id": user_id}]},
            {"$or": [{"name": regex}, {"description": regex}]}
        ]}

    # Run all searches in parallel
    orders_q, tasks_q, projects_q, users_q, files_q = await asyncio.gather(
        db.orders.find(order_query, {"_id": 0, "id": 1, "order_code": 1, "title": 1, "status": 1})
            .sort("updated_at", -1).limit(5).to_list(5),
        db.tasks.find(task_query, {"_id": 0, "id": 1, "title": 1, "status": 1})
            .sort("updated_at", -1).limit(5).to_list(5),
        db.projects.find(project_query, {"_id": 0, "id": 1, "name": 1, "status": 1, "client_name": 1})
            .sort("updated_at", -1).limit(5).to_list(5),
        db.users.find({"$or": [{"name": regex}, {"email": regex}], "active": True},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1})
            .limit(5).to_list(5) if is_admin else _empty(),
        db.order_files.find({"$or": [{"label": regex}, {"original_filename": regex}]},
            {"_id": 0, "id": 1, "order_id": 1, "label": 1, "original_filename": 1})
            .limit(5).to_list(5),
    )

    results = []
    for o in orders_q:
        results.append({
            "type": "order", "id": o["id"],
            "title": f"{o.get('order_code', '')} — {o.get('title', '')}",
            "subtitle": o.get("status", ""),
            "url": f"/orders/{o['id']}"
        })
    for t in tasks_q:
        results.append({
            "type": "task", "id": t["id"],
            "title": t.get("title", ""),
            "subtitle": t.get("status", ""),
            "url": "/tasks"
        })
    for p in projects_q:
        results.append({
            "type": "project", "id": p["id"],
            "title": p.get("name", ""),
            "subtitle": p.get("client_name", p.get("status", "")),
            "url": f"/projects/{p['id']}"
        })
    for u in users_q:
        results.append({
            "type": "user", "id": u["id"],
            "title": u.get("name", ""),
            "subtitle": u.get("email", ""),
            "url": f"/clients/{u['id']}" if u.get("role") == "Media Client" else "/users"
        })
    for f_doc in files_q:
        results.append({
            "type": "file", "id": f_doc["id"],
            "title": f_doc.get("original_filename") or f_doc.get("label", ""),
            "subtitle": "",
            "url": f"/orders/{f_doc.get('order_id', '')}"
        })

    return {"query": q, "results": results, "total": len(results)}
