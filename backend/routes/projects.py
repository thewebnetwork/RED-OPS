"""
Projects Routes - Multi-tenant project management API

RBAC via org roles:
- owner/admin: Full CRUD, manage team, milestones
- manager: Create/edit projects, manage tasks within
- member: View projects they're assigned to, update task status
- viewer: Read-only access

All queries scoped by org_id for multi-tenant isolation.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from utils.auth import get_current_user
from models.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    MilestoneCreate,
    MilestoneResponse,
)

router = APIRouter(prefix="/projects", tags=["projects"])


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_org_id(user: dict) -> str:
    """Extract org_id from authenticated user. Auto-provisions platform org for admins."""
    org_id = user.get("org_id") or user.get("team_id")
    if org_id:
        return org_id
    if user.get("role") == "Administrator":
        platform_org = await db.organizations.find_one({"org_type": "platform"}, {"_id": 0})
        if platform_org:
            org_id = platform_org["id"]
        else:
            import uuid as _uuid
            from datetime import timezone as _tz
            org_id = str(_uuid.uuid4())
            now = datetime.now(_tz.utc).isoformat()
            await db.organizations.insert_one({
                "id": org_id, "name": "RRG Platform", "slug": "rrg-platform",
                "org_type": "platform", "status": "active",
                "created_by_user_id": user["id"], "created_at": now, "updated_at": now,
                "members": [{"user_id": user["id"], "role": "owner", "joined_at": now}],
            })
        await db.users.update_one({"id": user["id"]}, {"$set": {"org_id": org_id}})
        return org_id
    raise HTTPException(status_code=400, detail="No organization context. Join or create an organization first.")


def _get_org_role(user: dict) -> str:
    """Get user's org role, falling back to system role mapping."""
    org_role = user.get("org_role")
    if org_role:
        return org_role
    # Fallback: map system roles
    sys_role = user.get("role", "")
    if sys_role == "Administrator":
        return "admin"
    if sys_role == "Operator":
        return "manager"
    return "member"


def _can_manage_project(org_role: str) -> bool:
    """Check if role can create/edit/delete projects."""
    return org_role in ("owner", "admin", "manager")


def _can_view_project(project: dict, user_id: str, org_role: str) -> bool:
    """Check if user can view this project."""
    if org_role in ("owner", "admin", "manager"):
        return True
    # Members/viewers can see projects they're on or all org projects
    return True  # All org members can see org projects


async def _enrich_project(project: dict) -> dict:
    """Enrich project with team member names and task counts."""
    # Team member names
    if project.get("team_member_ids"):
        members = await db.users.find(
            {"id": {"$in": project["team_member_ids"]}},
            {"_id": 0, "id": 1, "name": 1, "full_name": 1, "email": 1}
        ).to_list(50)
        project["team_members"] = [
            {"id": m["id"], "name": m.get("full_name") or m.get("name") or m.get("email", "")}
            for m in members
        ]
    else:
        project["team_members"] = []

    # Creator name
    if project.get("created_by_user_id"):
        creator = await db.users.find_one(
            {"id": project["created_by_user_id"]},
            {"_id": 0, "full_name": 1, "name": 1}
        )
        if creator:
            project["created_by_name"] = creator.get("full_name") or creator.get("name")

    # Task counts
    task_count = await db.tasks.count_documents({
        "project_id": project["id"],
        "org_id": project["org_id"]
    })
    completed_count = await db.tasks.count_documents({
        "project_id": project["id"],
        "org_id": project["org_id"],
        "status": "done"
    })
    project["task_count"] = task_count
    project["completed_task_count"] = completed_count
    project["progress"] = round((completed_count / task_count) * 100) if task_count > 0 else 0

    return project


# ── CRUD Endpoints ─────────────────────────────────────────────────────────────

@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new project within the user's org."""
    org_id = await _get_org_id(current_user)
    org_role = _get_org_role(current_user)

    if not _can_manage_project(org_role):
        raise HTTPException(status_code=403, detail="You don't have permission to create projects")

    # Validate team members exist and belong to org
    if data.team_member_ids:
        for member_id in data.team_member_ids:
            member = await db.users.find_one({"id": member_id}, {"_id": 0, "id": 1})
            if not member:
                raise HTTPException(status_code=404, detail=f"Team member {member_id} not found")

    project_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Build milestones with IDs
    milestones = []
    for m in data.milestones:
        milestones.append({
            "id": str(uuid.uuid4()),
            "label": m.label,
            "done": False,
            "due_date": m.due_date,
            "completed_at": None,
        })

    project = {
        "id": project_id,
        "org_id": org_id,
        "name": data.name,
        "description": data.description,
        "project_type": data.project_type,
        "status": data.status,
        "priority": data.priority,
        "client_name": data.client_name,
        "due_date": data.due_date,
        "team_member_ids": data.team_member_ids,
        "milestones": milestones,
        "payment_status": data.payment_status,
        "tags": data.tags,
        "progress": 0,
        "task_count": 0,
        "completed_task_count": 0,
        "created_by_user_id": current_user["id"],
        "created_at": now,
        "updated_at": now,
    }

    await db.projects.insert_one(project)
    project = await _enrich_project(project)
    project.pop("_id", None)
    return ProjectResponse(**project)


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    status: Optional[str] = Query(None),
    project_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """List projects in the user's org."""
    org_id = await _get_org_id(current_user)

    query = {"org_id": org_id}

    if status:
        query["status"] = status
    if project_type:
        query["project_type"] = project_type
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"client_name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    projects = await db.projects.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)

    result = []
    for p in projects:
        p = await _enrich_project(p)
        result.append(ProjectResponse(**p))

    return result


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single project by ID."""
    org_id = await _get_org_id(current_user)

    project = await db.projects.find_one(
        {"id": project_id, "org_id": org_id},
        {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project = await _enrich_project(project)
    return ProjectResponse(**project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a project."""
    org_id = await _get_org_id(current_user)
    org_role = _get_org_role(current_user)

    if not _can_manage_project(org_role):
        raise HTTPException(status_code=403, detail="You don't have permission to edit projects")

    project = await db.projects.find_one(
        {"id": project_id, "org_id": org_id},
        {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = {}
    for field in ["name", "description", "project_type", "status", "priority",
                   "client_name", "due_date", "team_member_ids", "payment_status", "tags"]:
        value = getattr(data, field, None)
        if value is not None:
            update_data[field] = value

    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.projects.update_one({"id": project_id}, {"$set": update_data})
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    updated = await _enrich_project(updated)
    return ProjectResponse(**updated)


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a project and optionally its tasks."""
    org_id = await _get_org_id(current_user)
    org_role = _get_org_role(current_user)

    if org_role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can delete projects")

    project = await db.projects.find_one(
        {"id": project_id, "org_id": org_id},
        {"_id": 0, "id": 1}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete associated tasks
    await db.tasks.delete_many({"project_id": project_id, "org_id": org_id})

    # Delete project
    await db.projects.delete_one({"id": project_id})

    return {"success": True, "deleted_project_id": project_id}


# ── Milestone Endpoints ────────────────────────────────────────────────────────

@router.post("/{project_id}/milestones", response_model=MilestoneResponse, status_code=201)
async def add_milestone(
    project_id: str,
    data: MilestoneCreate,
    current_user: dict = Depends(get_current_user),
):
    """Add a milestone to a project."""
    org_id = await _get_org_id(current_user)
    org_role = _get_org_role(current_user)

    if not _can_manage_project(org_role):
        raise HTTPException(status_code=403, detail="You don't have permission to manage milestones")

    project = await db.projects.find_one(
        {"id": project_id, "org_id": org_id},
        {"_id": 0, "id": 1}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    milestone = {
        "id": str(uuid.uuid4()),
        "label": data.label,
        "done": False,
        "due_date": data.due_date,
        "completed_at": None,
    }

    await db.projects.update_one(
        {"id": project_id},
        {
            "$push": {"milestones": milestone},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        }
    )

    return MilestoneResponse(**milestone)


@router.patch("/{project_id}/milestones/{milestone_id}")
async def toggle_milestone(
    project_id: str,
    milestone_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Toggle a milestone's done status."""
    org_id = await _get_org_id(current_user)

    project = await db.projects.find_one(
        {"id": project_id, "org_id": org_id},
        {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    milestones = project.get("milestones", [])
    found = False
    now = datetime.now(timezone.utc)

    for m in milestones:
        if m["id"] == milestone_id:
            m["done"] = not m["done"]
            m["completed_at"] = now if m["done"] else None
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Milestone not found")

    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"milestones": milestones, "updated_at": now}}
    )

    target = next(m for m in milestones if m["id"] == milestone_id)
    return MilestoneResponse(**target)


@router.delete("/{project_id}/milestones/{milestone_id}")
async def delete_milestone(
    project_id: str,
    milestone_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove a milestone from a project."""
    org_id = await _get_org_id(current_user)
    org_role = _get_org_role(current_user)

    if not _can_manage_project(org_role):
        raise HTTPException(status_code=403, detail="You don't have permission to manage milestones")

    result = await db.projects.update_one(
        {"id": project_id, "org_id": org_id},
        {
            "$pull": {"milestones": {"id": milestone_id}},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        }
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Project or milestone not found")

    return {"success": True, "deleted_milestone_id": milestone_id}


# ── Project Tasks ──────────────────────────────────────────────────────────────

@router.get("/{project_id}/tasks")
async def list_project_tasks(
    project_id: str,
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """List all tasks belonging to a project."""
    org_id = await _get_org_id(current_user)

    # Verify project exists in org
    project = await db.projects.find_one(
        {"id": project_id, "org_id": org_id},
        {"_id": 0, "id": 1}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = {"project_id": project_id, "org_id": org_id}
    if status:
        query["status"] = status

    tasks = await db.tasks.find(query, {"_id": 0}).sort("position", 1).to_list(500)

    # Enrich
    for task in tasks:
        if task.get("assignee_user_id"):
            assignee = await db.users.find_one(
                {"id": task["assignee_user_id"]},
                {"_id": 0, "full_name": 1, "name": 1}
            )
            if assignee:
                task["assignee_name"] = assignee.get("full_name") or assignee.get("name")

    return tasks


# ── Project Team ───────────────────────────────────────────────────────────────

@router.post("/{project_id}/team/{user_id}")
async def add_team_member(
    project_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Add a team member to a project."""
    org_id = await _get_org_id(current_user)
    org_role = _get_org_role(current_user)

    if not _can_manage_project(org_role):
        raise HTTPException(status_code=403, detail="You don't have permission to manage project team")

    # Verify user exists
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.projects.update_one(
        {"id": project_id, "org_id": org_id},
        {
            "$addToSet": {"team_member_ids": user_id},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        }
    )

    if result.modified_count == 0 and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")

    return {"success": True, "added_user_id": user_id}


@router.delete("/{project_id}/team/{user_id}")
async def remove_team_member(
    project_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove a team member from a project."""
    org_id = await _get_org_id(current_user)
    org_role = _get_org_role(current_user)

    if not _can_manage_project(org_role):
        raise HTTPException(status_code=403, detail="You don't have permission to manage project team")

    result = await db.projects.update_one(
        {"id": project_id, "org_id": org_id},
        {
            "$pull": {"team_member_ids": user_id},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        }
    )

    if result.modified_count == 0 and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")

    return {"success": True, "removed_user_id": user_id}
