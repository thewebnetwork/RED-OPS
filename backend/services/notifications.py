"""Notification services"""
import uuid
from datetime import datetime, timezone

async def create_notification(db, user_id: str, type: str, title: str, message: str, related_order_id: str = None):
    """Create a notification for a user"""
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type,
        "title": title,
        "message": message,
        "related_order_id": related_order_id,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
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
