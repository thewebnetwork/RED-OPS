"""
Project Templates — pre-built project flows with phases, tasks, and checklists.
Templates can be applied to create a real project + tasks for a client.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user, require_roles

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/project-templates", tags=["Project Templates"])


# ============== MODELS ==============

class TemplateTask(BaseModel):
    title: str
    description: Optional[str] = None
    phase: str
    day_offset: Optional[int] = None
    duration_days: Optional[int] = 1
    assignee_role: Optional[str] = None
    sop_reference: Optional[str] = None
    is_client_visible: bool = False
    checklist: Optional[List[str]] = []


class ProjectTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    offer_type: str
    phases: List[str]
    tasks: List[TemplateTask]


# ============== SEED DATA ==============

RRM_TEMPLATE_ID = "rrm-media-client-template-v1"


async def seed_rrm_template():
    """Seed the RRM Media Client template if it doesn't exist."""
    existing = await db.project_templates.find_one({"id": RRM_TEMPLATE_ID})
    if existing:
        return

    from scripts.seed_rrm_template import RRM_MEDIA_CLIENT_TEMPLATE
    await db.project_templates.insert_one(RRM_MEDIA_CLIENT_TEMPLATE)
    logger.info("Seeded RRM Media Client template")


# ============== ENDPOINTS ==============

@router.get("")
async def list_templates(
    current_user: dict = Depends(get_current_user)
):
    """List all project templates."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")

    # Seed on first access
    await seed_rrm_template()

    templates = await db.project_templates.find(
        {"$or": [{"org_id": org_id}, {"is_global": True}]},
        {"_id": 0}
    ).to_list(100)
    return templates


@router.post("")
async def create_template(
    data: ProjectTemplateCreate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Create a custom project template."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "is_global": False,
        "name": data.name,
        "description": data.description,
        "offer_type": data.offer_type,
        "phases": data.phases,
        "tasks": [t.dict() for t in data.tasks],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.project_templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Delete a custom template. Cannot delete global/seeded templates."""
    tpl = await db.project_templates.find_one({"id": template_id}, {"_id": 0, "is_global": 1})
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    if tpl.get("is_global"):
        raise HTTPException(status_code=403, detail="Cannot delete built-in templates")

    await db.project_templates.delete_one({"id": template_id})
    return {"success": True}


@router.post("/{template_id}/apply")
async def apply_template(
    template_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create a real project + tasks from a template."""
    template = await db.project_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    client_id = body.get("client_id")
    client_name = body.get("client_name", "")
    start_date_str = body.get("start_date")

    try:
        start_date = datetime.fromisoformat(start_date_str.replace("Z", "+00:00")) if start_date_str else datetime.now(timezone.utc)
    except (ValueError, TypeError):
        start_date = datetime.now(timezone.utc)

    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    now = datetime.now(timezone.utc)

    # Create the project
    project_id = str(uuid.uuid4())
    project = {
        "id": project_id,
        "org_id": org_id,
        "name": f"{template['name']} — {client_name}".strip(" —"),
        "description": template.get("description"),
        "project_type": "custom",
        "status": "active",
        "priority": "high",
        "client_id": client_id,
        "client_name": client_name,
        "client_visible": True,
        "template_id": template_id,
        "offer_type": template.get("offer_type"),
        "phases": template.get("phases", []),
        "start_date": start_date.isoformat(),
        "due_date": (start_date + timedelta(days=120)).isoformat(),
        "team_member_ids": [],
        "milestones": [],
        "payment_status": "not_applicable",
        "tags": ["from-template"],
        "created_by_user_id": current_user["id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.projects.insert_one(project)

    # Create tasks from template
    tasks_created = 0
    for task_def in template.get("tasks", []):
        due_date = None
        if task_def.get("day_offset") is not None:
            due_date = (start_date + timedelta(days=task_def["day_offset"])).isoformat()

        task = {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "project_id": project_id,
            "parent_task_id": None,
            "blocked_by": [],
            "request_id": None,
            "title": task_def["title"],
            "description": task_def.get("description") or "",
            "status": "todo",
            "priority": "medium",
            "assignee_user_id": None,
            "client_id": client_id,
            "client_name": client_name,
            "created_by_user_id": current_user["id"],
            "visibility": "both" if task_def.get("is_client_visible") else "internal",
            "task_type": "request_generated",
            "due_at": due_date,
            "position": 1000.0 + tasks_created * 100,
            "created_source": "system",
            "completed_at": None,
            "phase": task_def.get("phase", ""),
            "sop_reference": task_def.get("sop_reference"),
            "assignee_role": task_def.get("assignee_role"),
            "checklist": [{"text": item, "done": False} for item in (task_def.get("checklist") or [])],
            "created_at": now,
            "updated_at": now,
        }
        await db.tasks.insert_one(task)
        tasks_created += 1

    project.pop("_id", None)
    return {
        "project": project,
        "tasks_created": tasks_created,
        "phases": template.get("phases", []),
    }
