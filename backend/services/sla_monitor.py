"""SLA monitoring and alerting service"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List
from .notifications import create_notification
from .email import send_email_notification, send_pool_assignment_email


async def check_pool_transitions(db):
    """
    Check for tickets that have transitioned from Pool 1 to Pool 2 (after 24 hours).
    Notify Vendors/Freelancers about newly available tickets.
    """
    now = datetime.now(timezone.utc)
    twenty_four_hours_ago = now - timedelta(hours=24)
    
    # Find Open tickets that entered Pool 1 more than 24 hours ago
    # and haven't been notified for Pool 2 yet
    pool_2_tickets = await db.orders.find({
        "status": "Open",
        "editor_id": None,
        "pool_entered_at": {"$exists": True, "$lte": twenty_four_hours_ago.isoformat()},
        "pool_2_notified": {"$ne": True}
    }, {"_id": 0}).to_list(100)
    
    if not pool_2_tickets:
        return {"notified": 0}
    
    # Get all active Vendors/Freelancers
    vendors = await db.users.find(
        {"account_type": "Vendor/Freelancer", "active": True},
        {"_id": 0, "email": 1, "name": 1}
    ).to_list(100)
    
    notified_count = 0
    
    for ticket in pool_2_tickets:
        # Mark as notified first to avoid duplicates
        await db.orders.update_one(
            {"id": ticket["id"]},
            {"$set": {"pool_2_notified": True}}
        )
        
        # Notify each vendor
        for vendor in vendors:
            try:
                await send_pool_assignment_email(
                    vendor["email"],
                    vendor["name"],
                    ticket["order_code"],
                    ticket.get("title", ""),
                    ticket.get("priority_or_severity", "Normal"),
                    ticket.get("category_l2_name") or ticket.get("category_l1_name") or "General",
                    "Vendor Pool (Pool 2)",
                    ticket["id"]
                )
                notified_count += 1
            except Exception as e:
                logging.error(f"Failed to notify vendor {vendor['email']} about ticket {ticket['order_code']}: {e}")
    
    return {"notified": notified_count, "tickets": len(pool_2_tickets), "vendors": len(vendors)}


async def check_sla_breaches(db):
    """
    Check all open orders for SLA breaches and warnings.
    This should be called periodically (e.g., every 15 minutes via a background task).
    Also triggers the escalation engine for configured policies.
    """
    now = datetime.now(timezone.utc)
    
    # Find orders that are not closed/delivered and have SLA deadlines
    open_orders = await db.orders.find({
        "status": {"$nin": ["Delivered", "Closed"]},
        "sla_deadline": {"$exists": True, "$ne": None}
    }, {"_id": 0}).to_list(1000)
    
    breached_orders = []
    warning_orders = []
    
    for order in open_orders:
        try:
            deadline_str = order.get("sla_deadline")
            if not deadline_str:
                continue
                
            deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
            
            # Check if already breached
            if now > deadline:
                # Check if we already sent a breach notification
                existing_breach = await db.sla_alerts.find_one({
                    "order_id": order["id"],
                    "alert_type": "breach"
                })
                
                if not existing_breach:
                    breached_orders.append(order)
                    await create_sla_alert(db, order, "breach", deadline)
            
            # Check if within warning threshold (4 hours before deadline)
            elif now > deadline - timedelta(hours=4):
                # Check if we already sent a warning notification
                existing_warning = await db.sla_alerts.find_one({
                    "order_id": order["id"],
                    "alert_type": "warning"
                })
                
                if not existing_warning:
                    warning_orders.append(order)
                    await create_sla_alert(db, order, "warning", deadline)
                    
        except Exception as e:
            logging.error(f"Error checking SLA for order {order.get('id')}: {e}")
    
    # Trigger escalation engine
    try:
        from .escalation_engine import check_and_process_escalations
        await check_and_process_escalations()
    except Exception as e:
        logging.error(f"Error running escalation engine: {e}")
    
    return {
        "breached": len(breached_orders),
        "warnings": len(warning_orders),
        "checked": len(open_orders)
    }


async def create_sla_alert(db, order: dict, alert_type: str, deadline: datetime):
    """Create an SLA alert and send notifications"""
    alert_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    alert = {
        "id": alert_id,
        "order_id": order["id"],
        "order_code": order.get("order_code"),
        "alert_type": alert_type,  # "warning" or "breach"
        "sla_deadline": deadline.isoformat(),
        "triggered_at": now.isoformat(),
        "acknowledged": False,
        "acknowledged_by": None,
        "acknowledged_at": None
    }
    
    await db.sla_alerts.insert_one(alert)
    
    # Determine who to notify
    order_code = order.get("order_code", "Unknown")
    order_title = order.get("title", "Untitled")
    
    if alert_type == "breach":
        title = f"⚠️ SLA Breached - {order_code}"
        message = f"SLA has been breached for ticket {order_code} '{order_title}'. The deadline was {deadline.strftime('%Y-%m-%d %H:%M')} UTC."
    else:
        hours_remaining = (deadline - now).total_seconds() / 3600
        title = f"⏰ SLA Warning - {order_code}"
        message = f"SLA deadline approaching for ticket {order_code} '{order_title}'. Only {hours_remaining:.1f} hours remaining until deadline."
    
    # Notify assigned editor if exists
    if order.get("editor_id"):
        await create_notification(
            db,
            order["editor_id"],
            f"sla_{alert_type}",
            title,
            message,
            order["id"]
        )
    
    # Always notify admins for breaches
    if alert_type == "breach":
        admins = await db.users.find({"role": {"$in": ["Administrator", "Admin"]}, "active": True}, {"_id": 0}).to_list(100)
        for admin in admins:
            await create_notification(
                db,
                admin["id"],
                "sla_breach",
                title,
                message,
                order["id"]
            )
            
            # Also send email to admins for breaches
            await send_email_notification(
                admin["email"],
                f"[URGENT] {title}",
                f"""
                An SLA breach has occurred:
                
                Ticket: {order_code}
                Title: {order_title}
                Deadline: {deadline.strftime('%Y-%m-%d %H:%M')} UTC
                Status: {order.get('status', 'Unknown')}
                Assigned To: {order.get('editor_name', 'Unassigned')}
                
                Please take immediate action.
                
                Red Ops System
                """
            )
    
    return alert


async def get_sla_alerts(db, order_id: str = None, alert_type: str = None, 
                         acknowledged: bool = None, limit: int = 100) -> List[dict]:
    """Get SLA alerts with optional filters"""
    query = {}
    
    if order_id:
        query["order_id"] = order_id
    if alert_type:
        query["alert_type"] = alert_type
    if acknowledged is not None:
        query["acknowledged"] = acknowledged
    
    alerts = await db.sla_alerts.find(query, {"_id": 0}).sort("triggered_at", -1).to_list(limit)
    return alerts


async def acknowledge_sla_alert(db, alert_id: str, user_id: str) -> dict:
    """Acknowledge an SLA alert"""
    result = await db.sla_alerts.update_one(
        {"id": alert_id},
        {"$set": {
            "acknowledged": True,
            "acknowledged_by": user_id,
            "acknowledged_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        return None
    
    return await db.sla_alerts.find_one({"id": alert_id}, {"_id": 0})


async def get_sla_statistics(db) -> dict:
    """Get SLA statistics for dashboard"""
    now = datetime.now(timezone.utc)
    
    # Count orders by SLA status
    open_orders = await db.orders.find({
        "status": {"$nin": ["Delivered", "Closed"]},
        "sla_deadline": {"$exists": True, "$ne": None}
    }, {"_id": 0}).to_list(1000)
    
    on_track = 0
    at_risk = 0
    breached = 0
    
    for order in open_orders:
        try:
            deadline = datetime.fromisoformat(order["sla_deadline"].replace('Z', '+00:00'))
            if now > deadline:
                breached += 1
            elif now > deadline - timedelta(hours=4):
                at_risk += 1
            else:
                on_track += 1
        except:
            pass
    
    # Count alerts
    total_alerts = await db.sla_alerts.count_documents({})
    unacknowledged = await db.sla_alerts.count_documents({"acknowledged": False})
    breaches_today = await db.sla_alerts.count_documents({
        "alert_type": "breach",
        "triggered_at": {"$gte": now.replace(hour=0, minute=0, second=0).isoformat()}
    })
    
    return {
        "orders": {
            "on_track": on_track,
            "at_risk": at_risk,
            "breached": breached,
            "total_open": len(open_orders)
        },
        "alerts": {
            "total": total_alerts,
            "unacknowledged": unacknowledged,
            "breaches_today": breaches_today
        }
    }
