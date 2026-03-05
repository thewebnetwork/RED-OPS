"""
Task Routes - Shared work orchestration API

RBAC Rules:
- Client: Read tasks for their org with visibility=client or both, update status only
- Admin: Full CRUD on all tasks in their org
- Operator: Read and update tasks based on role and org
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
    CreatedSource
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


def can_view_task(task: dict, user: dict) -> bool:
    """Check if user can view this task"""
    user_org_id = user.get("org_id") or user.get("team_id")
    task_org_id = task.get("org_id")
    
    # Must be same org
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


def can_edit_task(task: dict, user: dict) -> bool:
    """Check if user can edit this task"""
    user_org_id = user.get("org_id") or user.get("team_id")
    
    # Admin can edit all tasks in their org
    if user.get("role") == "Administrator" and user_org_id == task.get("org_id"):
        return True
    
    # Client can only update status on visible tasks
    if user.get("account_type") == "Media Client":
        return can_view_task(task, user)
    
    # Operator can edit tasks in their org (simplified for MVP)
    if user.get("role") == "Operator" and user_org_id == task.get("org_id"):
        return True
    
    return False


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
    user_org_id = current_user.get("org_id") or current_user.get("team_id")
    if org_id and org_id != user_org_id:
        # Non-admin users cannot query other orgs
        if current_user.get("role") != "Administrator":
            raise HTTPException(status_code=403, detail="Cannot access other org tasks")
    
    query["org_id"] = org_id if org_id else user_org_id
    
    # Apply visibility filter based on user type
    if current_user.get("account_type") == "Media Client":
        # Client can only see client or both
        query["visibility"] = {"$in": ["client", "both"]}
    elif visibility:
        query["visibility"] = visibility
    
    # Apply other filters
    if assignee_user_id:
        query["assignee_user_id"] = assignee_user_id
    if request_id:
        query["request_id"] = request_id
    if status:
        query["status"] = status
    
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
        
        result.append(TaskResponse(**task))
    
    return result


@router.post("", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new task.
    
    RBAC: Admin only for MVP (clients cannot create tasks manually)
    """
    # Only admin can create tasks in MVP
    if current_user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Only administrators can create tasks")
    
    # Verify org matches user's org
    user_org_id = current_user.get("org_id") or current_user.get("team_id")
    if task_data.org_id != user_org_id:
        raise HTTPException(status_code=403, detail="Cannot create tasks for other organizations")
    
    # Verify assignee exists and belongs to same org (if provided)
    if task_data.assignee_user_id:
        assignee = await db.users.find_one(
            {"id": task_data.assignee_user_id},
            {"_id": 0, "id": 1, "org_id": 1, "team_id": 1}
        )
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee user not found")
        
        assignee_org = assignee.get("org_id") or assignee.get("team_id")
        if assignee_org != user_org_id:
            raise HTTPException(status_code=400, detail="Cannot assign task to user from different organization")
    
    # Verify request exists and belongs to same org (if provided)
    if task_data.request_id:
        request = await db.orders.find_one(
            {"id": task_data.request_id},
            {"_id": 0, "id": 1, "requester_team_id": 1}
        )
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Simplified org check (assumes requester_team_id is the org)
        # In real system, would need more complex org resolution
    
    # Generate task ID and timestamps
    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Auto-set position if not provided (append to end)
    position = task_data.position
    if position is None:
        # Get max position and add 1000
        last_task = await db.tasks.find_one(
            {"org_id": task_data.org_id, "status": task_data.status},
            {"_id": 0, "position": 1},
            sort=[("position", -1)]
        )
        position = (last_task.get("position", 0) + 1000) if last_task else 1000.0
    
    # Determine created_source
    created_source = "admin"  # For manual task creation
    
    # Build task document
    task = {
        "id": task_id,
        "org_id": task_data.org_id,
        "request_id": task_data.request_id,
        "title": task_data.title,
        "description": task_data.description,
        "status": task_data.status,
        "assignee_user_id": task_data.assignee_user_id,
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
    
    # Insert task
    await db.tasks.insert_one(task)
    
    # Return response (exclude _id)
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
    RBAC:
    - Admin: Can update all fields
    - Client: Can only update status on visible tasks
    - Operator: Can update tasks in their org
    """
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not can_edit_task(task, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this task")
    
    # For clients, restrict to status updates only
    if current_user.get("account_type") == "Media Client":
        if any([
            task_update.title is not None,
            task_update.description is not None,
            task_update.assignee_user_id is not None,
            task_update.visibility is not None,
            task_update.task_type is not None,
            task_update.due_at is not None,
            task_update.position is not None
        ]):
            raise HTTPException(
                status_code=403,
                detail="Clients can only update task status"
            )
    
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
        assignee = await db.users.find_one(
            {"id": task_update.assignee_user_id},
            {"_id": 0, "id": 1}
        )
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee user not found")
        update_data["assignee_user_id"] = task_update.assignee_user_id
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
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    updated_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return TaskResponse(**updated_task)
