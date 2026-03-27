"""
Task Routes - Shared work orchestration API

RBAC Rules:
- Admin: Full CRUD on all tasks in their org, assign to anyone
- Internal Account Manager: Manage tasks for assigned client accounts
- Client: Create tasks (assign to self or AM), update own tasks, move visible tasks
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from utils.auth import get_current_user
from models.task import (
    TaskCreate,
    TaskUpdate,
    TaskReorder,
    TaskResponse,
    TaskStatus,
    TaskVisibility,
    CreatedSource,
    TaskCommentCreate,
    TaskCommentResponse,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_user_org_id(user: dict) -> str | None:
    """Get the effective org_id for a user, with fallback chain."""
    return user.get("org_id") or user.get("team_id") or user.get("id")


async def get_account_manager_id(user: dict) -> str | None:
    """Get the account_manager_id for a client user."""
    if user.get("account_type") != "Media Client":
        return None
    return user.get("account_manager_id")


async def get_managed_client_ids(user_id: str) -> list[str]:
    """Get list of client user IDs this user is account manager for."""
    clients = await db.users.find(
        {"account_manager_id": user_id, "account_type": "Media Client"},
        {"_id": 0, "id": 1}
    ).to_list(100)
    return [c["id"] for c in clients]


def is_account_manager(user: dict) -> bool:
    """Check if user is an internal staff who manages client accounts."""
    return (
        user.get("account_type") in ("Internal Staff", "Partner")
        and user.get("role") in ("Administrator", "Operator", "Standard User")
    )


def can_view_task(task: dict, user: dict, managed_client_ids: list = None) -> bool:
    """Check if user can view this task."""
    user_org_id = get_user_org_id(user)
    task_org_id = task.get("org_id")

    if user_org_id != task_org_id:
        return False

    # Admin/Internal can see all
    if user.get("role") == "Administrator" or user.get("account_type") == "Internal Staff":
        return True

    # Client can only see client or both visibility
    if user.get("account_type") == "Media Client":
        return task.get("visibility") in ["client", "both"]

    # Operator can see internal or both
    return task.get("visibility") in ["internal", "both"]


def can_edit_task(task: dict, user: dict, managed_client_ids: list = None) -> bool:
    """Check if user can edit this task."""
    user_org_id = get_user_org_id(user)

    if user.get("role") == "Administrator" and user_org_id == task.get("org_id"):
        return True

    # Account manager can edit tasks for their managed clients
    if managed_client_ids and is_account_manager(user):
        if task.get("org_id") == user_org_id:
            return True

    # Client can update status on visible tasks, or edit tasks they created
    if user.get("account_type") == "Media Client":
        return can_view_task(task, user)

    # Operator can edit tasks in their org
    if user.get("role") == "Operator" and user_org_id == task.get("org_id"):
        return True

    return False



@router.get("/client-assignments")
async def list_client_assignments(
    current_user: dict = Depends(get_current_user)
):
    """Admin only: List all clients with their account manager assignments."""
    if current_user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Admin only")
    org_id = get_user_org_id(current_user)
    clients = await db.users.find(
        {"team_id": org_id, "account_type": "Media Client", "active": {"$ne": False}},
        {"_id": 0, "id": 1, "name": 1, "full_name": 1, "email": 1, "account_manager_id": 1}
    ).to_list(200)
    internal_staff = await db.users.find(
        {"team_id": org_id, "account_type": "Internal Staff", "active": {"$ne": False}},
        {"_id": 0, "id": 1, "name": 1, "full_name": 1, "email": 1}
    ).to_list(200)
    result = []
    for c in clients:
        am_name = None
        am_id = c.get("account_manager_id")
        if am_id:
            am_user = next((s for s in internal_staff if s["id"] == am_id), None)
            if am_user:
                am_name = am_user.get("full_name") or am_user.get("name")
        result.append({
            "id": c["id"],
            "name": c.get("full_name") or c.get("name") or c.get("email"),
            "account_manager_id": am_id,
            "account_manager_name": am_name,
        })
    staff_list = [{"id": s["id"], "name": s.get("full_name") or s.get("name") or s.get("email")} for s in internal_staff]
    return {"clients": result, "internal_staff": staff_list}



@router.get("/templates")
async def list_task_templates(
    current_user: dict = Depends(get_current_user)
):
    """List all active task templates. Admin only."""
    if current_user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Admin only")
    from services.task_generator import ensure_seed_templates
    await ensure_seed_templates()
    templates = await db.task_templates.find({"active": True}, {"_id": 0}).to_list(100)
    return templates


@router.get("/account-manager/{client_user_id}")
async def get_account_manager(
    client_user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the account manager for a client user."""
    client = await db.users.find_one({"id": client_user_id}, {"_id": 0, "account_manager_id": 1, "account_type": 1})
    if not client:
        raise HTTPException(status_code=404, detail="User not found")
    am_id = client.get("account_manager_id")
    if not am_id:
        return {"account_manager": None}
    am = await db.users.find_one(
        {"id": am_id},
        {"_id": 0, "id": 1, "name": 1, "full_name": 1, "email": 1, "account_type": 1, "role": 1}
    )
    if not am:
        return {"account_manager": None}
    return {"account_manager": {
        "id": am["id"],
        "name": am.get("full_name") or am.get("name") or am.get("email"),
        "email": am.get("email"),
    }}


@router.patch("/account-manager/{client_user_id}")
async def set_account_manager(
    client_user_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    """Set the account manager for a client user. Admin only."""
    if current_user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Admin only")
    client = await db.users.find_one({"id": client_user_id}, {"_id": 0, "id": 1, "account_type": 1})
    if not client:
        raise HTTPException(status_code=404, detail="Client user not found")
    if client.get("account_type") != "Media Client":
        raise HTTPException(status_code=400, detail="Account managers can only be assigned to client accounts")
    am_id = body.get("account_manager_id")
    if am_id:
        am = await db.users.find_one({"id": am_id}, {"_id": 0, "id": 1, "account_type": 1})
        if not am:
            raise HTTPException(status_code=404, detail="Account manager user not found")
        if am.get("account_type") == "Media Client":
            raise HTTPException(status_code=400, detail="Account manager must be an internal team member")
    await db.users.update_one(
        {"id": client_user_id},
        {"$set": {"account_manager_id": am_id}}
    )
    return {"success": True, "client_user_id": client_user_id, "account_manager_id": am_id}


@router.get("/assignable-users")
async def list_assignable_users(
    current_user: dict = Depends(get_current_user)
):
    """
    Return the list of users the current user can assign tasks to.
    - Admin: all users in their org
    - Account Manager: themselves + their managed clients
    - Client: themselves + their account manager (if set)
    """
    user_org_id = get_user_org_id(current_user)
    result = []

    if current_user.get("role") == "Administrator":
        users = await db.users.find(
            {"team_id": user_org_id, "active": {"$ne": False}},
            {"_id": 0, "id": 1, "name": 1, "full_name": 1, "email": 1, "account_type": 1, "role": 1}
        ).to_list(200)
        for u in users:
            result.append({
                "id": u["id"],
                "name": u.get("full_name") or u.get("name") or u.get("email"),
                "email": u.get("email"),
                "account_type": u.get("account_type"),
                "role": u.get("role"),
            })

    elif current_user.get("account_type") == "Media Client":
        # Client can assign to self
        result.append({
            "id": current_user["id"],
            "name": current_user.get("full_name") or current_user.get("name") or current_user.get("email"),
            "email": current_user.get("email"),
            "account_type": "Media Client",
            "role": current_user.get("role"),
        })
        # + their account manager if set
        am_id = current_user.get("account_manager_id")
        if am_id:
            am = await db.users.find_one(
                {"id": am_id},
                {"_id": 0, "id": 1, "name": 1, "full_name": 1, "email": 1, "account_type": 1, "role": 1}
            )
            if am:
                result.append({
                    "id": am["id"],
                    "name": am.get("full_name") or am.get("name") or am.get("email"),
                    "email": am.get("email"),
                    "account_type": am.get("account_type"),
                    "role": am.get("role"),
                    "is_account_manager": True,
                })

    else:
        # Internal / Account Manager: self + managed clients
        result.append({
            "id": current_user["id"],
            "name": current_user.get("full_name") or current_user.get("name") or current_user.get("email"),
            "email": current_user.get("email"),
            "account_type": current_user.get("account_type"),
            "role": current_user.get("role"),
        })
        managed_ids = await get_managed_client_ids(current_user["id"])
        if managed_ids:
            clients = await db.users.find(
                {"id": {"$in": managed_ids}},
                {"_id": 0, "id": 1, "name": 1, "full_name": 1, "email": 1, "account_type": 1}
            ).to_list(100)
            for c in clients:
                result.append({
                    "id": c["id"],
                    "name": c.get("full_name") or c.get("name") or c.get("email"),
                    "email": c.get("email"),
                    "account_type": c.get("account_type"),
                    "role": "Standard User",
                })
        # Also include other internal staff in the same org
        internal = await db.users.find(
            {"team_id": user_org_id, "account_type": "Internal Staff", "id": {"$ne": current_user["id"]}, "active": {"$ne": False}},
            {"_id": 0, "id": 1, "name": 1, "full_name": 1, "email": 1, "account_type": 1, "role": 1}
        ).to_list(100)
        for u in internal:
            result.append({
                "id": u["id"],
                "name": u.get("full_name") or u.get("name") or u.get("email"),
                "email": u.get("email"),
                "account_type": u.get("account_type"),
                "role": u.get("role"),
            })

    return result


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    org_id: Optional[str] = Query(None),
    assignee_user_id: Optional[str] = Query(None),
    visibility: Optional[TaskVisibility] = Query(None),
    request_id: Optional[str] = Query(None),
    status: Optional[TaskStatus] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    List tasks with filtering.
    
    RBAC:
    - Client: Only their org tasks with visibility=client or both
    - Admin: All tasks in their org
    - Operator: Tasks in their org based on visibility
    """
    query = {}

    # Enforce org filtering
    user_org_id = get_user_org_id(current_user)
    is_admin = current_user.get("role") == "Administrator"
    is_internal = current_user.get("account_type") == "Internal Staff"
    is_client = current_user.get("account_type") == "Media Client" or current_user.get("role") == "Media Client"

    if is_client:
        # Media Clients see only tasks they created or are assigned to (their own workspace)
        query["$or"] = [
            {"created_by_user_id": current_user["id"]},
            {"assignee_user_id": current_user["id"]},
            {"client_id": current_user["id"]},
        ]
    elif request_id and (is_admin or is_internal):
        # Admin/Internal querying by request_id can see tasks across orgs (linked tasks view)
        pass  # No org filter — they see all linked tasks for the request
    elif org_id and org_id != user_org_id:
        if not is_admin:
            raise HTTPException(status_code=403, detail="Cannot access other org tasks")
        query["org_id"] = org_id
    else:
        # Internal staff viewing task board: include tasks assigned to them + their org
        if is_internal and not request_id:
            query["$or"] = [
                {"org_id": user_org_id},
                {"assignee_user_id": current_user["id"]},
            ]
        else:
            query["org_id"] = user_org_id

    # Apply visibility filter based on user type (skip for clients — already scoped above)
    if is_client:
        pass  # Client scoping already handled above
    elif visibility:
        query["visibility"] = visibility
    
    # Apply other filters
    if assignee_user_id:
        query["assignee_user_id"] = assignee_user_id
    if request_id:
        query["request_id"] = request_id
    if status:
        query["status"] = status

    # Exclude subtasks from main list (they show nested under parent)
    query["parent_task_id"] = {"$in": [None, ""]}

    # Fetch tasks
    tasks = await db.tasks.find(query, {"_id": 0}).sort("position", 1).to_list(1000)
    
    # Enrich with user and request data (optional)
    result = []
    for task in tasks:
        # Enrich assignee name
        if task.get("assignee_user_id"):
            assignee = await db.users.find_one(
                {"id": task["assignee_user_id"]},
                {"_id": 0, "full_name": 1}
            )
            if assignee:
                task["assignee_name"] = assignee.get("full_name")
        
        # Enrich created by name
        if task.get("created_by_user_id"):
            creator = await db.users.find_one(
                {"id": task["created_by_user_id"]},
                {"_id": 0, "full_name": 1}
            )
            if creator:
                task["created_by_name"] = creator.get("full_name")
        
        # Enrich request title
        if task.get("request_id"):
            request = await db.orders.find_one(
                {"id": task["request_id"]},
                {"_id": 0, "title": 1}
            )
            if request:
                task["request_title"] = request.get("title")

        # Enrich project name
        if task.get("project_id"):
            proj = await db.projects.find_one(
                {"id": task["project_id"]},
                {"_id": 0, "name": 1}
            )
            if proj:
                task["project_name"] = proj.get("name")

        # Subtask counts
        subtask_count = await db.tasks.count_documents({"parent_task_id": task["id"]})
        completed_subtasks = await db.tasks.count_documents({"parent_task_id": task["id"], "status": "done"})
        task["subtask_count"] = subtask_count
        task["completed_subtask_count"] = completed_subtasks

        # Comment count
        comment_count = await db.task_comments.count_documents({"task_id": task["id"]})
        task["comment_count"] = comment_count

        # Enrich blocked_by with task details
        blocked_ids = task.get("blocked_by") or []
        if blocked_ids:
            blockers = await db.tasks.find(
                {"id": {"$in": blocked_ids}},
                {"_id": 0, "id": 1, "title": 1, "status": 1}
            ).to_list(50)
            task["blocked_by_tasks"] = blockers
        else:
            task["blocked_by_tasks"] = []

        result.append(TaskResponse(**task))

    return result


@router.post("", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new task.
    - Admin: can create any task in their org, assign to anyone
    - Account Manager: can create tasks in their org
    - Client: can create tasks with visibility=client, assign to self or AM only
    """
    user_org_id = get_user_org_id(current_user) or current_user.get("id")
    is_client = current_user.get("account_type") == "Media Client"

    # Auto-fill org_id from user if not provided
    effective_org_id = task_data.org_id or user_org_id

    # Verify org matches user's org (skip if admin)
    is_admin = current_user.get("role") == "Administrator"
    if not is_admin and effective_org_id != user_org_id:
        raise HTTPException(status_code=403, detail="Cannot create tasks for other organizations")

    # Client-specific restrictions
    if is_client:
        # Default visibility to 'client' for client-created tasks
        if not task_data.visibility or task_data.visibility == "internal":
            task_data.visibility = "client"

    # Verify assignee exists (if provided)
    if task_data.assignee_user_id:
        assignee = await db.users.find_one(
            {"id": task_data.assignee_user_id},
            {"_id": 0, "id": 1, "org_id": 1, "team_id": 1}
        )
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee user not found")
        if not is_client:
            assignee_org = assignee.get("org_id") or assignee.get("team_id")
            if assignee_org != user_org_id:
                raise HTTPException(status_code=400, detail="Cannot assign task to user from different organization")

    # Verify request exists (if provided)
    if task_data.request_id:
        request = await db.orders.find_one(
            {"id": task_data.request_id}, {"_id": 0, "id": 1}
        )
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")

    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    position = task_data.position
    if position is None:
        last_task = await db.tasks.find_one(
            {"org_id": effective_org_id, "status": task_data.status},
            {"_id": 0, "position": 1},
            sort=[("position", -1)]
        )
        position = (last_task.get("position", 0) + 1000) if last_task else 1000.0

    created_source = "client" if is_client else "admin"

    # Validate project_id if provided
    if task_data.project_id:
        if is_client:
            project = await db.projects.find_one(
                {"id": task_data.project_id, "created_by_user_id": current_user["id"]},
                {"_id": 0, "id": 1}
            )
        else:
            project = await db.projects.find_one(
                {"id": task_data.project_id, "org_id": effective_org_id},
                {"_id": 0, "id": 1}
            )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

    # Validate parent_task_id if provided (subtask)
    if task_data.parent_task_id:
        parent = await db.tasks.find_one(
            {"id": task_data.parent_task_id, "org_id": effective_org_id},
            {"_id": 0, "id": 1}
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent task not found")

    task = {
        "id": task_id,
        "org_id": effective_org_id,
        "project_id": task_data.project_id,
        "parent_task_id": task_data.parent_task_id,
        "blocked_by": task_data.blocked_by or [],
        "request_id": task_data.request_id,
        "title": task_data.title,
        "description": task_data.description,
        "status": task_data.status,
        "priority": task_data.priority if hasattr(task_data, 'priority') else "medium",
        "assignee_user_id": task_data.assignee_user_id,
        "client_id": task_data.client_id,
        "client_name": task_data.client_name,
        "created_by_user_id": current_user["id"],
        "visibility": task_data.visibility,
        "task_type": task_data.task_type,
        "due_at": task_data.due_at,
        "position": position,
        "created_source": created_source,
        "completed_at": None,
        "created_at": now,
        "updated_at": now
    }

    await db.tasks.insert_one(task)
    task_response = {k: v for k, v in task.items() if k != "_id"}
    return TaskResponse(**task_response)


@router.patch("/reorder", response_model=dict)
async def reorder_tasks(
    reorder_data: TaskReorder,
    current_user: dict = Depends(get_current_user)
):
    """
    Reorder a task by updating its position.
    Used for drag-and-drop Kanban board reordering.
    """
    task = await db.tasks.find_one({"id": reorder_data.task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not can_edit_task(task, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to reorder this task")
    await db.tasks.update_one(
        {"id": reorder_data.task_id},
        {"$set": {
            "position": reorder_data.new_position,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    return {"success": True, "task_id": reorder_data.task_id, "new_position": reorder_data.new_position}


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a task.
    - Admin: all fields
    - Account Manager: all fields on tasks in their org
    - Client: status on visible tasks; title/description/assignee on tasks they created
    """
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    managed_ids = await get_managed_client_ids(current_user["id"]) if is_account_manager(current_user) else []
    if not can_edit_task(task, current_user, managed_ids):
        raise HTTPException(status_code=403, detail="Not authorized to edit this task")

    is_client = current_user.get("account_type") == "Media Client"
    is_task_creator = task.get("created_by_user_id") == current_user["id"]

    # Client restrictions
    if is_client:
        non_status_fields = [
            task_update.visibility is not None,
            task_update.task_type is not None,
            task_update.position is not None,
        ]
        editable_by_creator = [
            task_update.title is not None,
            task_update.description is not None,
            task_update.assignee_user_id is not None,
            task_update.due_at is not None,
        ]
        # Always block visibility/type/position changes for clients
        if any(non_status_fields):
            raise HTTPException(status_code=403, detail="Clients cannot update these fields")
        # Title/desc/assignee/due only on tasks client created
        if any(editable_by_creator) and not is_task_creator:
            raise HTTPException(status_code=403, detail="Clients can only update status on tasks they didn't create")
        # Assignee must be self or AM
        if task_update.assignee_user_id is not None:
            am_id = current_user.get("account_manager_id")
            allowed = {current_user["id"]}
            if am_id:
                allowed.add(am_id)
            if task_update.assignee_user_id not in allowed and task_update.assignee_user_id != "":
                raise HTTPException(status_code=403, detail="You can only assign to yourself or your account manager")

    update_data = {}
    if task_update.title is not None:
        update_data["title"] = task_update.title
    if task_update.description is not None:
        update_data["description"] = task_update.description
    if task_update.status is not None:
        update_data["status"] = task_update.status
        if task_update.status == "done" and task.get("completed_at") is None:
            update_data["completed_at"] = datetime.now(timezone.utc)
        elif task_update.status != "done":
            update_data["completed_at"] = None
    if task_update.assignee_user_id is not None:
        if task_update.assignee_user_id != "":
            assignee = await db.users.find_one(
                {"id": task_update.assignee_user_id}, {"_id": 0, "id": 1}
            )
            if not assignee:
                raise HTTPException(status_code=404, detail="Assignee user not found")
        update_data["assignee_user_id"] = task_update.assignee_user_id if task_update.assignee_user_id != "" else None
    if task_update.visibility is not None:
        update_data["visibility"] = task_update.visibility
    if task_update.task_type is not None:
        update_data["task_type"] = task_update.task_type
    if task_update.due_at is not None:
        update_data["due_at"] = task_update.due_at
    if task_update.position is not None:
        update_data["position"] = task_update.position
    if task_update.completed_at is not None:
        update_data["completed_at"] = task_update.completed_at
    if task_update.client_id is not None:
        update_data["client_id"] = task_update.client_id
    if task_update.client_name is not None:
        update_data["client_name"] = task_update.client_name

    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    updated_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})

    # Enrich subtask and comment counts
    updated_task["subtask_count"] = await db.tasks.count_documents({"parent_task_id": task_id})
    updated_task["completed_subtask_count"] = await db.tasks.count_documents({"parent_task_id": task_id, "status": "done"})
    updated_task["comment_count"] = await db.task_comments.count_documents({"task_id": task_id})

    # Enrich blocked_by
    blocked_ids = updated_task.get("blocked_by") or []
    if blocked_ids:
        blockers = await db.tasks.find(
            {"id": {"$in": blocked_ids}},
            {"_id": 0, "id": 1, "title": 1, "status": 1}
        ).to_list(50)
        updated_task["blocked_by_tasks"] = blockers
    else:
        updated_task["blocked_by_tasks"] = []

    return TaskResponse(**updated_task)


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a task and its subtasks/comments.
    Admin/Owner can delete any task. Creators can delete their own.
    """
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_org_id = get_user_org_id(current_user)
    is_admin = current_user.get("role") == "Administrator"
    is_creator = task.get("created_by_user_id") == current_user["id"]
    same_org = task.get("org_id") == user_org_id

    if not same_org:
        raise HTTPException(status_code=403, detail="Cannot delete tasks from other organizations")

    if not is_admin and not is_creator:
        raise HTTPException(status_code=403, detail="Only admins or task creators can delete tasks")

    # Delete subtasks
    await db.tasks.delete_many({"parent_task_id": task_id})
    # Delete comments
    await db.task_comments.delete_many({"task_id": task_id})
    # Delete task
    await db.tasks.delete_one({"id": task_id})

    return {"success": True, "deleted_task_id": task_id}


# ── Task Comments ──────────────────────────────────────────────────────────────

@router.get("/{task_id}/comments", response_model=List[TaskCommentResponse])
async def list_task_comments(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List comments on a task."""
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0, "org_id": 1})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_org_id = get_user_org_id(current_user)
    if task.get("org_id") != user_org_id and current_user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Cannot access comments from other organizations")

    comments = await db.task_comments.find(
        {"task_id": task_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)

    # Enrich with user names
    for c in comments:
        user = await db.users.find_one(
            {"id": c["user_id"]},
            {"_id": 0, "full_name": 1, "name": 1}
        )
        if user:
            c["user_name"] = user.get("full_name") or user.get("name")

    return [TaskCommentResponse(**c) for c in comments]


@router.post("/{task_id}/comments", response_model=TaskCommentResponse, status_code=201)
async def add_task_comment(
    task_id: str,
    data: TaskCommentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a comment to a task."""
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0, "org_id": 1})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_org_id = get_user_org_id(current_user)
    if task.get("org_id") != user_org_id and current_user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Cannot comment on tasks from other organizations")

    comment = {
        "id": str(uuid.uuid4()),
        "task_id": task_id,
        "user_id": current_user["id"],
        "content": data.content,
        "created_at": datetime.now(timezone.utc),
    }

    await db.task_comments.insert_one(comment)

    # Update task's updated_at
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"updated_at": datetime.now(timezone.utc)}}
    )

    # Enrich
    comment["user_name"] = current_user.get("full_name") or current_user.get("name") or current_user.get("email")
    comment.pop("_id", None)

    return TaskCommentResponse(**comment)


@router.delete("/{task_id}/comments/{comment_id}")
async def delete_task_comment(
    task_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a comment. Only the comment author or admin can delete."""
    comment = await db.task_comments.find_one({"id": comment_id, "task_id": task_id}, {"_id": 0})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    is_admin = current_user.get("role") == "Administrator"
    is_author = comment.get("user_id") == current_user["id"]

    if not is_admin and not is_author:
        raise HTTPException(status_code=403, detail="Only the comment author or admin can delete comments")

    await db.task_comments.delete_one({"id": comment_id})
    return {"success": True, "deleted_comment_id": comment_id}


# ── Subtasks ───────────────────────────────────────────────────────────────────

@router.get("/{task_id}/subtasks")
async def list_subtasks(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List subtasks of a parent task."""
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0, "org_id": 1})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    subtasks = await db.tasks.find(
        {"parent_task_id": task_id},
        {"_id": 0}
    ).sort("position", 1).to_list(100)

    # Enrich
    for st in subtasks:
        if st.get("assignee_user_id"):
            assignee = await db.users.find_one(
                {"id": st["assignee_user_id"]},
                {"_id": 0, "full_name": 1, "name": 1}
            )
            if assignee:
                st["assignee_name"] = assignee.get("full_name") or assignee.get("name")

    return subtasks


# ── Task Dependencies (Blocked By) ───────────────────────────────────────────

@router.post("/{task_id}/block")
async def add_blocker(
    task_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    """Add a blocking dependency to a task."""
    blocked_by_id = body.get("blocked_by_id")
    if not blocked_by_id:
        raise HTTPException(status_code=400, detail="blocked_by_id is required")
    if blocked_by_id == task_id:
        raise HTTPException(status_code=400, detail="A task cannot block itself")

    task = await db.tasks.find_one({"id": task_id}, {"_id": 0, "org_id": 1, "blocked_by": 1})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    blocker = await db.tasks.find_one({"id": blocked_by_id}, {"_id": 0, "id": 1, "title": 1, "org_id": 1})
    if not blocker:
        raise HTTPException(status_code=404, detail="Blocking task not found")

    if not can_edit_task(task, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this task")

    existing = task.get("blocked_by") or []
    if blocked_by_id in existing:
        return {"success": True, "message": "Already blocked by this task"}

    await db.tasks.update_one(
        {"id": task_id},
        {
            "$addToSet": {"blocked_by": blocked_by_id},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        }
    )
    return {"success": True, "task_id": task_id, "blocked_by_id": blocked_by_id}


@router.delete("/{task_id}/block/{blocked_by_id}")
async def remove_blocker(
    task_id: str,
    blocked_by_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a blocking dependency from a task."""
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0, "org_id": 1})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not can_edit_task(task, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this task")

    await db.tasks.update_one(
        {"id": task_id},
        {
            "$pull": {"blocked_by": blocked_by_id},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        }
    )
    return {"success": True, "task_id": task_id, "removed_blocker": blocked_by_id}
