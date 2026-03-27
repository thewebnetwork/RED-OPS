"""
Task Template Service

Auto-creates a standard set of tasks when a new client is onboarded.
Templates are defined here and created in the tasks collection.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from database import db

logger = logging.getLogger(__name__)

# Default tasks created for every new Media Client
NEW_CLIENT_TASK_TEMPLATES = [
    {"title": "Send client welcome email + login credentials", "priority": "high", "offset_days": 0},
    {"title": "Collect brand assets (logo, colors, fonts, photos)", "priority": "high", "offset_days": 1},
    {"title": "Collect ad account access (Meta Business Manager)", "priority": "high", "offset_days": 1},
    {"title": "Set up GHL pipeline and booking calendar", "priority": "medium", "offset_days": 2},
    {"title": "Build and launch initial Meta ad campaign", "priority": "high", "offset_days": 3},
    {"title": "Schedule kickoff strategy call", "priority": "medium", "offset_days": 2},
    {"title": "Create landing page or review existing", "priority": "medium", "offset_days": 4},
    {"title": "First week performance check-in", "priority": "medium", "offset_days": 7},
    {"title": "Send first ad performance report", "priority": "medium", "offset_days": 14},
    {"title": "30-day strategy review and optimization plan", "priority": "low", "offset_days": 30},
]


async def create_tasks_for_new_client(
    client_id: str,
    client_name: str,
    created_by: str,
    org_id: str,
) -> int:
    """
    Create default onboarding tasks for a new client.
    Returns the number of tasks created.
    """
    now = datetime.now(timezone.utc)
    tasks = []

    for i, tmpl in enumerate(NEW_CLIENT_TASK_TEMPLATES):
        due_at = (now + timedelta(days=tmpl["offset_days"])).isoformat()
        tasks.append({
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "project_id": None,
            "parent_task_id": None,
            "blocked_by": [],
            "request_id": None,
            "title": tmpl["title"],
            "description": f"Auto-created for new client: {client_name}",
            "status": "todo",
            "priority": tmpl["priority"],
            "assignee_user_id": None,
            "client_id": client_id,
            "client_name": client_name,
            "created_by_user_id": created_by,
            "visibility": "internal",
            "task_type": "request_generated",
            "due_at": due_at,
            "position": 1000.0 + i * 100,
            "created_source": "system",
            "completed_at": None,
            "created_at": now,
            "updated_at": now,
        })

    if tasks:
        await db.tasks.insert_many(tasks)

    logger.info(f"Created {len(tasks)} onboarding tasks for client {client_name} ({client_id})")
    return len(tasks)
