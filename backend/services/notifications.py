"""Notification services"""
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from .sse import publish
from .slack_service import send_slack_notification
from utils.tenancy import resolve_org_id

logger = logging.getLogger(__name__)

async def create_notification(db, user_id: str, type: str, title: str, message: str, related_order_id: str = None):
    """Create a notification for a user, push via SSE, and optionally send to Slack."""
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type,
        "title": title,
        "message": message,
        "related_order_id": related_order_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    # Push to SSE subscribers for real-time delivery
    await publish(user_id, {"_id": 0, **{k: v for k, v in notification.items() if k != "_id"}})

    # Send to Slack if configured (non-blocking)
    try:
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "org_id": 1, "team_id": 1, "id": 1})
        if user:
            org_id = resolve_org_id(user)
            slack = await db.integrations.find_one(
                {"org_id": org_id, "provider": "slack_webhook", "status": "connected"}
            )
            if slack and slack.get("config", {}).get("webhook_url"):
                asyncio.create_task(
                    send_slack_notification(slack["config"]["webhook_url"], message, title)
                )
    except Exception as e:
        logger.debug(f"Slack hook skipped: {e}")

    return notification


async def notify_status_change(db, order: dict, old_status: str, new_status: str, changed_by: dict):
    """Send notifications when order status changes"""
    order_code = order.get('order_code', 'Unknown')
    title = order.get('title', 'Untitled')
    
    # Notify requester about status changes
    if order.get("requester_id") and changed_by["id"] != order["requester_id"]:
        await create_notification(
            db,
            order["requester_id"],
            "status_change",
            f"Order {new_status}",
            f"Your request {order_code} '{title}' has been updated to '{new_status}'",
            order['id']
        )
    
    # Notify assigned editor about certain status changes
    if order.get("editor_id") and changed_by["id"] != order["editor_id"]:
        if new_status in ["Pending", "Closed"]:
            await create_notification(
                db,
                order["editor_id"],
                "status_change",
                f"Order {new_status}",
                f"Order {order_code} you're working on has been set to '{new_status}'",
                order['id']
            )
