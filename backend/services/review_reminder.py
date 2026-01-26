"""
Review Reminder Service

Handles automated follow-ups for tickets in "Pending" (Needs Requester Review) status:
- 24h: Send email reminder if no requester response
- 5 days: Auto-close if no requester response

This runs as a background task alongside the SLA monitor.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from database import db
from config import REVIEW_REMINDER_HOURS, REVIEW_AUTO_CLOSE_DAYS, FRONTEND_URL
from services.notifications import create_notification
from services.email import send_email_notification

logger = logging.getLogger(__name__)


async def check_pending_reviews():
    """
    Check all orders in Pending status and process review reminders.
    Called periodically by the background task scheduler.
    """
    now = datetime.now(timezone.utc)
    
    # Find orders in Pending status with review_started_at set
    pending_orders = await db.orders.find({
        "status": "Pending",
        "review_started_at": {"$exists": True, "$ne": None}
    }, {"_id": 0}).to_list(1000)
    
    reminder_sent = 0
    auto_closed = 0
    
    for order in pending_orders:
        try:
            review_started = datetime.fromisoformat(order["review_started_at"].replace('Z', '+00:00'))
            last_requester_msg = None
            
            if order.get("last_requester_message_at"):
                last_requester_msg = datetime.fromisoformat(
                    order["last_requester_message_at"].replace('Z', '+00:00')
                )
            
            # Check if requester has responded since review started
            requester_responded = (
                last_requester_msg is not None and 
                last_requester_msg > review_started
            )
            
            if requester_responded:
                # Requester has responded, skip this order
                continue
            
            hours_since_review = (now - review_started).total_seconds() / 3600
            days_since_review = hours_since_review / 24
            
            # Check for auto-close (5 days)
            if days_since_review >= REVIEW_AUTO_CLOSE_DAYS:
                await auto_close_order(order, now)
                auto_closed += 1
                continue
            
            # Check for email reminder (24 hours)
            if hours_since_review >= REVIEW_REMINDER_HOURS:
                # Check if we already sent a reminder
                existing_reminder = await db.review_reminders.find_one({
                    "order_id": order["id"],
                    "reminder_type": "24h_email"
                })
                
                if not existing_reminder:
                    await send_review_reminder_email(order, now)
                    reminder_sent += 1
                    
        except Exception as e:
            logger.error(f"Error processing review reminder for order {order.get('id')}: {e}")
    
    logger.info(f"Review reminder check: {reminder_sent} reminders sent, {auto_closed} orders auto-closed")
    
    return {
        "checked": len(pending_orders),
        "reminders_sent": reminder_sent,
        "auto_closed": auto_closed
    }


async def send_review_reminder_email(order: dict, now: datetime):
    """Send 24-hour review reminder email to requester"""
    
    # Get requester details
    requester = await db.users.find_one({"id": order["requester_id"]}, {"_id": 0})
    if not requester:
        logger.warning(f"Requester not found for order {order['id']}")
        return
    
    order_code = order.get("order_code", "Unknown")
    order_title = order.get("title", "Untitled")
    order_link = f"{FRONTEND_URL}/orders/{order['id']}"
    
    subject = f"Action needed: your request {order_code} is pending review"
    body = f"""
Hello {requester.get('name', 'there')},

Your request is waiting for your review and response:

Ticket: {order_code}
Title: {order_title}

The resolver has submitted work for your review. Please review and provide feedback.

Click here to open your request:
{order_link}

If you don't respond within the next few days, this ticket may be automatically closed.

Best regards,
Red Ops System
"""
    
    try:
        await send_email_notification(requester["email"], subject, body)
        
        # Record that we sent this reminder
        await db.review_reminders.insert_one({
            "id": str(uuid.uuid4()),
            "order_id": order["id"],
            "order_code": order_code,
            "requester_id": order["requester_id"],
            "reminder_type": "24h_email",
            "sent_at": now.isoformat()
        })
        
        logger.info(f"Sent 24h review reminder email for order {order_code} to {requester['email']}")
        
    except Exception as e:
        logger.error(f"Failed to send review reminder email for order {order['id']}: {e}")


async def auto_close_order(order: dict, now: datetime):
    """Auto-close an order after 5 days of no requester response"""
    
    order_code = order.get("order_code", "Unknown")
    order_title = order.get("title", "Untitled")
    close_reason = "No requester response after 5 days (auto-closed by system)"
    
    # Update the order status
    await db.orders.update_one(
        {"id": order["id"]},
        {"$set": {
            "status": "Closed",
            "close_reason": close_reason,
            "closed_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    # Add a system note/message to the order timeline
    system_message = {
        "id": str(uuid.uuid4()),
        "order_id": order["id"],
        "author_user_id": "system",
        "author_name": "System",
        "author_role": "System",
        "message_body": f"⚠️ This ticket was automatically closed due to no requester response after 5 days. Close reason: {close_reason}",
        "created_at": now.isoformat(),
        "is_system_message": True
    }
    await db.order_messages.insert_one(system_message)
    
    # Send in-app notification to requester
    await create_notification(
        db,
        order["requester_id"],
        "order_auto_closed",
        f"Request {order_code} auto-closed",
        f"Your request '{order_title}' was automatically closed due to no response after 5 days.",
        order["id"]
    )
    
    # Send email notification to requester
    requester = await db.users.find_one({"id": order["requester_id"]}, {"_id": 0})
    if requester:
        order_link = f"{FRONTEND_URL}/orders/{order['id']}"
        
        subject = f"Request {order_code} has been automatically closed"
        body = f"""
Hello {requester.get('name', 'there')},

Your request has been automatically closed due to no response:

Ticket: {order_code}
Title: {order_title}
Close Reason: {close_reason}

If you still need assistance with this request, please create a new ticket or contact support.

You can view the closed request here:
{order_link}

Best regards,
Red Ops System
"""
        try:
            await send_email_notification(requester["email"], subject, body)
        except Exception as e:
            logger.error(f"Failed to send auto-close email for order {order['id']}: {e}")
    
    # Notify assigned editor if exists
    if order.get("editor_id"):
        await create_notification(
            db,
            order["editor_id"],
            "order_auto_closed",
            f"Order {order_code} auto-closed",
            f"Order '{order_title}' was automatically closed due to no requester response after 5 days.",
            order["id"]
        )
    
    # Record the auto-close event
    await db.review_reminders.insert_one({
        "id": str(uuid.uuid4()),
        "order_id": order["id"],
        "order_code": order_code,
        "requester_id": order["requester_id"],
        "reminder_type": "auto_close",
        "sent_at": now.isoformat()
    })
    
    logger.info(f"Auto-closed order {order_code} due to no requester response")
