"""
Task Generator Service - Auto-creates tasks from request lifecycle events.

Deterministic, idempotent, no pool/routing concepts.

Flow:
1. A request event fires (e.g. request_created, delivered)
2. Generator finds matching templates for the event + service
3. Dedup check: skip if (request_id, template_id, trigger_event) already exists
4. Resolve assignee from assign_target_type
5. Insert task linked to request_id
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from database import db

logger = logging.getLogger(__name__)

# ─── Seed templates ───────────────────────────────────────────────
# These are loaded into the task_templates collection on first run.
# service_id="_default" applies to all services.

SEED_TEMPLATES = [
    # ── request_created ──────────────────────────────────────────
    {
        "id": "tpl-req-created-review-brief",
        "service_id": "_default",
        "trigger_event": "request_created",
        "title_template": "Review brief for {request_code}",
        "visibility": "internal",
        "task_type": "request_generated",
        "default_status": "todo",
        "assign_target_type": "unassigned",
        "due_offset_hours": 4,
        "active": True,
    },
    {
        "id": "tpl-req-created-confirm-receipt",
        "service_id": "_default",
        "trigger_event": "request_created",
        "title_template": "Confirm receipt of {request_code}",
        "visibility": "client",
        "task_type": "request_generated",
        "default_status": "todo",
        "assign_target_type": "client",
        "due_offset_hours": None,
        "active": True,
    },
    # ── Video-specific on creation ───────────────────────────────
    {
        "id": "tpl-video60-check-footage",
        "service_id": "video-editing-60s",
        "trigger_event": "request_created",
        "title_template": "Check raw footage for {request_code}",
        "visibility": "internal",
        "task_type": "request_generated",
        "default_status": "todo",
        "assign_target_type": "unassigned",
        "due_offset_hours": 8,
        "active": True,
    },
    {
        "id": "tpl-longform-check-footage",
        "service_id": "long-form-youtube",
        "trigger_event": "request_created",
        "title_template": "Review footage and assets for {request_code}",
        "visibility": "internal",
        "task_type": "request_generated",
        "default_status": "todo",
        "assign_target_type": "unassigned",
        "due_offset_hours": 12,
        "active": True,
    },
    # ── status_changed_to_doing ──────────────────────────────────
    {
        "id": "tpl-doing-notify-client",
        "service_id": "_default",
        "trigger_event": "status_changed_to_doing",
        "title_template": "Work started on {request_code} - notify client",
        "visibility": "internal",
        "task_type": "follow_up",
        "default_status": "todo",
        "assign_target_type": "request_owner",
        "due_offset_hours": None,
        "active": True,
    },
    # ── status_changed_to_review ─────────────────────────────────
    {
        "id": "tpl-review-client-approval",
        "service_id": "_default",
        "trigger_event": "status_changed_to_review",
        "title_template": "Review and approve {request_code}",
        "visibility": "client",
        "task_type": "approval",
        "default_status": "todo",
        "assign_target_type": "client",
        "due_offset_hours": 48,
        "active": True,
    },
    # ── revision_requested ───────────────────────────────────────
    {
        "id": "tpl-revision-apply-changes",
        "service_id": "_default",
        "trigger_event": "revision_requested",
        "title_template": "Apply revision notes for {request_code}",
        "visibility": "internal",
        "task_type": "request_generated",
        "default_status": "todo",
        "assign_target_type": "internal",
        "due_offset_hours": 24,
        "active": True,
    },
    {
        "id": "tpl-revision-client-feedback",
        "service_id": "_default",
        "trigger_event": "revision_requested",
        "title_template": "Provide revision details for {request_code}",
        "visibility": "client",
        "task_type": "follow_up",
        "default_status": "todo",
        "assign_target_type": "client",
        "due_offset_hours": None,
        "active": True,
    },
    # ── delivered ────────────────────────────────────────────────
    {
        "id": "tpl-delivered-final-review",
        "service_id": "_default",
        "trigger_event": "delivered",
        "title_template": "Final review of {request_code} delivery",
        "visibility": "client",
        "task_type": "approval",
        "default_status": "todo",
        "assign_target_type": "client",
        "due_offset_hours": 72,
        "active": True,
    },
]


async def ensure_seed_templates():
    """Insert seed templates if the collection is empty."""
    count = await db.task_templates.count_documents({})
    if count == 0:
        await db.task_templates.insert_many(SEED_TEMPLATES)
        logger.info(f"Seeded {len(SEED_TEMPLATES)} task templates")


def _render_title(template_str: str, order: dict) -> str:
    """Simple variable substitution for title templates."""
    return (
        template_str
        .replace("{request_title}", order.get("title") or "Untitled")
        .replace("{request_code}", order.get("order_code") or "???")
    )


async def _resolve_assignee(assign_target: str, order: dict) -> str | None:
    """Determine the assignee_user_id from assign_target_type."""
    if assign_target == "client":
        return order.get("requester_id")
    if assign_target == "request_owner":
        return order.get("editor_id") or order.get("requester_id")
    if assign_target == "internal":
        return order.get("editor_id")
    return None  # unassigned


async def _get_next_position(org_id: str, status: str) -> float:
    """Get the next position value for a column."""
    last = await db.tasks.find_one(
        {"org_id": org_id, "status": status},
        {"_id": 0, "position": 1},
        sort=[("position", -1)],
    )
    return (last.get("position", 0) + 1000) if last else 1000.0


def _resolve_service_id(order: dict) -> str | None:
    """Map an order's category to a service_id from RRM_SERVICES."""
    # Map category L1 names → service ids (simplified for MVP)
    cat_name = (order.get("category_l1_name") or "").lower()
    title = (order.get("title") or "").lower()

    if "video" in cat_name:
        if "60s" in title or "reel" in title:
            return "video-editing-60s"
        if "stor" in title:
            return "short-form-stories"
        if "long" in title or "youtube" in title:
            return "long-form-youtube"
        return "video-editing-60s"  # default video
    if "graphic" in cat_name:
        if "thumbnail" in title:
            return "thumbnail-design"
        return "social-media-graphics"
    if "copy" in cat_name or "content" in cat_name:
        return "content-writing"
    if "email" in cat_name:
        return "email-campaigns"
    if "crm" in cat_name or "website" in cat_name:
        return "website-updates"
    return None


async def generate_tasks_for_event(
    trigger_event: str,
    order: dict,
    triggered_by_user: dict,
):
    """
    Core generator. Called from order lifecycle hooks.

    1. Seeds templates on first call.
    2. Finds matching templates (_default + service-specific).
    3. Dedup: skips if (request_id, template_id, trigger_event) exists.
    4. Creates tasks.
    """
    try:
        await ensure_seed_templates()

        request_id = order.get("id")
        org_id = order.get("requester_team_id") or triggered_by_user.get("team_id") or triggered_by_user.get("org_id")
        if not org_id:
            logger.warning(f"No org_id for order {request_id}, skipping task generation")
            return []

        service_id = _resolve_service_id(order)
        logger.info(f"Generating tasks: event={trigger_event} request={request_id} service={service_id} org={org_id}")

        # Find matching templates: _default + service-specific
        template_query = {
            "trigger_event": trigger_event,
            "active": True,
            "service_id": {"$in": ["_default"] + ([service_id] if service_id else [])},
        }
        templates = await db.task_templates.find(template_query, {"_id": 0}).to_list(50)

        created_tasks = []
        now = datetime.now(timezone.utc)

        for tpl in templates:
            # Dedup check
            exists = await db.tasks.find_one({
                "request_id": request_id,
                "template_id": tpl["id"],
                "trigger_event": trigger_event,
            }, {"_id": 0, "id": 1})
            if exists:
                continue

            title = _render_title(tpl["title_template"], order)
            assignee_id = await _resolve_assignee(tpl["assign_target_type"], order)
            status = tpl.get("default_status", "todo")
            position = await _get_next_position(org_id, status)

            due_at = None
            if tpl.get("due_offset_hours"):
                due_at = now + timedelta(hours=tpl["due_offset_hours"])

            task = {
                "id": str(uuid.uuid4()),
                "org_id": org_id,
                "request_id": request_id,
                "title": title,
                "description": None,
                "status": status,
                "assignee_user_id": assignee_id,
                "created_by_user_id": triggered_by_user.get("id", "system"),
                "visibility": tpl["visibility"],
                "task_type": tpl["task_type"],
                "due_at": due_at,
                "position": position,
                "created_source": "system",
                "template_id": tpl["id"],
                "trigger_event": trigger_event,
                "completed_at": None,
                "created_at": now,
                "updated_at": now,
            }
            await db.tasks.insert_one(task)
            created_tasks.append(task["id"])
            logger.info(f"Auto-created task '{title}' for request {order.get('order_code')}")

        return created_tasks
    except Exception as e:
        logger.error(f"Task generation failed for event={trigger_event}: {e}", exc_info=True)
        return []


async def complete_open_tasks_for_request(request_id: str):
    """
    On delivery/close, mark open tasks linked to this request as done.
    Only affects system-generated tasks (created_source=system).
    """
    now = datetime.now(timezone.utc)
    result = await db.tasks.update_many(
        {
            "request_id": request_id,
            "created_source": "system",
            "status": {"$nin": ["done"]},
        },
        {"$set": {
            "status": "done",
            "completed_at": now,
            "updated_at": now,
        }},
    )
    if result.modified_count:
        logger.info(f"Auto-completed {result.modified_count} tasks for request {request_id}")
    return result.modified_count
