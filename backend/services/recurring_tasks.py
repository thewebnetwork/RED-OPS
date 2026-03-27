"""
Recurring Task Service

Creates tasks on a schedule (daily, weekly, monthly).
Stored in recurring_task_rules collection. Checked by a background loop.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from database import db

logger = logging.getLogger(__name__)


async def create_recurring_rule(
    title: str,
    frequency: str,  # "daily", "weekly", "monthly"
    org_id: str,
    created_by: str,
    assignee_user_id: str = None,
    priority: str = "medium",
    client_id: str = None,
    client_name: str = None,
    project_id: str = None,
    description: str = None,
) -> dict:
    """Create a recurring task rule."""
    now = datetime.now(timezone.utc).isoformat()
    rule = {
        "id": str(uuid.uuid4()),
        "title": title,
        "description": description,
        "frequency": frequency,
        "org_id": org_id,
        "assignee_user_id": assignee_user_id,
        "client_id": client_id,
        "client_name": client_name,
        "project_id": project_id,
        "priority": priority,
        "created_by": created_by,
        "active": True,
        "last_created_at": None,
        "created_at": now,
    }
    await db.recurring_task_rules.insert_one(rule)
    rule.pop("_id", None)
    return rule


async def check_and_create_recurring_tasks():
    """
    Check all active recurring rules and create tasks if due.
    Should be called periodically (e.g. every hour from the SLA monitor loop).
    """
    rules = await db.recurring_task_rules.find({"active": True}, {"_id": 0}).to_list(500)
    now = datetime.now(timezone.utc)
    created_count = 0

    for rule in rules:
        last = rule.get("last_created_at")
        if last:
            last_dt = datetime.fromisoformat(last.replace("Z", "+00:00")) if isinstance(last, str) else last
        else:
            last_dt = None

        should_create = False
        if not last_dt:
            should_create = True
        elif rule["frequency"] == "daily" and (now - last_dt).days >= 1:
            should_create = True
        elif rule["frequency"] == "weekly" and (now - last_dt).days >= 7:
            should_create = True
        elif rule["frequency"] == "monthly" and (now - last_dt).days >= 28:
            should_create = True

        if should_create:
            task = {
                "id": str(uuid.uuid4()),
                "org_id": rule["org_id"],
                "project_id": rule.get("project_id"),
                "parent_task_id": None,
                "blocked_by": [],
                "request_id": None,
                "title": rule["title"],
                "description": rule.get("description") or f"Recurring task ({rule['frequency']})",
                "status": "todo",
                "priority": rule.get("priority", "medium"),
                "assignee_user_id": rule.get("assignee_user_id"),
                "client_id": rule.get("client_id"),
                "client_name": rule.get("client_name"),
                "created_by_user_id": rule["created_by"],
                "visibility": "internal",
                "task_type": "request_generated",
                "due_at": (now + timedelta(days=1 if rule["frequency"] == "daily" else 7 if rule["frequency"] == "weekly" else 30)).isoformat(),
                "position": 1000.0,
                "created_source": "system",
                "completed_at": None,
                "created_at": now,
                "updated_at": now,
            }
            await db.tasks.insert_one(task)
            await db.recurring_task_rules.update_one(
                {"id": rule["id"]},
                {"$set": {"last_created_at": now.isoformat()}}
            )
            created_count += 1

    if created_count > 0:
        logger.info(f"Created {created_count} recurring task(s)")
    return created_count
