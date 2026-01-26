"""Escalation engine service - processes escalation rules and triggers actions"""
import uuid
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import httpx

from database import db
from utils.helpers import get_utc_now
from services.email import send_email_notification

logger = logging.getLogger(__name__)


async def create_notification(user_id: str, type: str, title: str, message: str, related_order_id: str = None):
    """Create a notification for a user"""
    import uuid
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type,
        "title": title,
        "message": message,
        "related_order_id": related_order_id,
        "is_read": False,
        "created_at": get_utc_now()
    }
    await db.notifications.insert_one(notification)
    return notification


async def get_applicable_policies(order: dict) -> List[dict]:
    """Find all active escalation policies that apply to an order"""
    policies = await db.escalation_policies.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    applicable = []
    for policy in policies:
        # Check category filters
        if policy.get("category_l1_ids") and order.get("category_l1_id"):
            if order["category_l1_id"] not in policy["category_l1_ids"]:
                continue
        
        if policy.get("category_l2_ids") and order.get("category_l2_id"):
            if order["category_l2_id"] not in policy["category_l2_ids"]:
                continue
        
        # Check priority filter
        if policy.get("priorities"):
            if order.get("priority") not in policy["priorities"]:
                continue
        
        applicable.append(policy)
    
    return applicable


async def check_cooldown(order_id: str, policy_id: str, cooldown_minutes: int) -> bool:
    """Check if we're in cooldown period for this order/policy combo"""
    cooldown_threshold = datetime.now(timezone.utc) - timedelta(minutes=cooldown_minutes)
    
    recent_escalation = await db.escalation_history.find_one({
        "order_id": order_id,
        "policy_id": policy_id,
        "created_at": {"$gte": cooldown_threshold.isoformat()}
    })
    
    return recent_escalation is not None


async def get_current_escalation_level(order_id: str, policy_id: str) -> int:
    """Get the highest escalation level reached for this order/policy"""
    escalations = await db.escalation_history.find({
        "order_id": order_id,
        "policy_id": policy_id
    }, {"_id": 0, "level": 1}).sort("level", -1).limit(1).to_list(1)
    
    return escalations[0]["level"] if escalations else 0


async def get_next_available_team_member(team_id: str, exclude_user_id: str = None) -> Optional[dict]:
    """Get next available team member for reassignment"""
    query = {
        "team_ids": team_id,
        "active": True
    }
    if exclude_user_id:
        query["id"] = {"$ne": exclude_user_id}
    
    # Get team members sorted by workload (fewest in-progress orders)
    members = await db.users.find(query, {"_id": 0}).to_list(100)
    
    if not members:
        return None
    
    # Calculate workload for each member
    member_workloads = []
    for member in members:
        workload = await db.orders.count_documents({
            "editor_id": member["id"],
            "status": {"$in": ["Open", "In Progress"]}
        })
        member_workloads.append((member, workload))
    
    # Sort by workload (ascending) and return the one with least work
    member_workloads.sort(key=lambda x: x[1])
    return member_workloads[0][0] if member_workloads else None


async def get_users_by_role(role_id: str) -> List[dict]:
    """Get all active users with a specific role"""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0, "name": 1})
    if not role:
        return []
    
    users = await db.users.find({
        "role": role["name"],
        "active": True
    }, {"_id": 0}).to_list(100)
    
    return users


async def execute_escalation_action(action: dict, order: dict, level: dict, policy: dict) -> dict:
    """Execute a single escalation action and return result"""
    action_type = action.get("type")
    result = {
        "type": action_type,
        "success": False,
        "details": {}
    }
    
    try:
        if action_type == "notify_user":
            # Send in-app notification to specific user
            user_id = action.get("target_user_id")
            if user_id:
                message = level.get("notify_message", f"Order {order['order_code']} has been escalated to Level {level['level']}: {level['name']}")
                message = message.replace("{order_code}", order.get("order_code", ""))
                message = message.replace("{title}", order.get("title", ""))
                message = message.replace("{level}", str(level["level"]))
                message = message.replace("{level_name}", level.get("name", ""))
                
                await create_notification(
                    user_id=user_id,
                    type="escalation",
                    title=f"🚨 Escalation Level {level['level']}: {order['order_code']}",
                    message=message,
                    related_order_id=order["id"]
                )
                result["success"] = True
                result["details"]["notified_user"] = action.get("target_user_name")
        
        elif action_type == "notify_role":
            # Send notification to all users with a role
            role_id = action.get("target_role_id")
            users = await get_users_by_role(role_id)
            
            message = level.get("notify_message", f"Order {order['order_code']} escalated to Level {level['level']}")
            notified = []
            
            for user in users:
                await create_notification(
                    user_id=user["id"],
                    type="escalation",
                    title=f"🚨 Escalation: {order['order_code']}",
                    message=message,
                    related_order_id=order["id"]
                )
                notified.append(user["name"])
            
            result["success"] = True
            result["details"]["notified_users"] = notified
            result["details"]["role"] = action.get("target_role_name")
        
        elif action_type == "reassign_user":
            # Reassign to specific user
            user_id = action.get("target_user_id")
            user_name = action.get("target_user_name")
            
            if user_id:
                await db.orders.update_one(
                    {"id": order["id"]},
                    {"$set": {
                        "editor_id": user_id,
                        "editor_name": user_name,
                        "updated_at": get_utc_now()
                    }}
                )
                result["success"] = True
                result["details"]["reassigned_to"] = user_name
        
        elif action_type == "reassign_team":
            # Reassign to next available team member
            team_id = action.get("target_team_id")
            next_member = await get_next_available_team_member(team_id, order.get("editor_id"))
            
            if next_member:
                await db.orders.update_one(
                    {"id": order["id"]},
                    {"$set": {
                        "editor_id": next_member["id"],
                        "editor_name": next_member["name"],
                        "updated_at": get_utc_now()
                    }}
                )
                result["success"] = True
                result["details"]["reassigned_to"] = next_member["name"]
                result["details"]["team"] = action.get("target_team_name")
            else:
                result["details"]["error"] = "No available team member found"
        
        elif action_type == "change_priority":
            # Change order priority
            new_priority = action.get("new_priority")
            if new_priority:
                await db.orders.update_one(
                    {"id": order["id"]},
                    {"$set": {
                        "priority": new_priority,
                        "updated_at": get_utc_now()
                    }}
                )
                result["success"] = True
                result["details"]["new_priority"] = new_priority
        
        elif action_type == "send_email":
            # Send email notification
            subject = action.get("email_subject", f"Escalation Alert: {order['order_code']}")
            body = action.get("email_body", f"Order {order['order_code']} has been escalated.")
            
            # Replace placeholders
            subject = subject.replace("{order_code}", order.get("order_code", ""))
            subject = subject.replace("{title}", order.get("title", ""))
            body = body.replace("{order_code}", order.get("order_code", ""))
            body = body.replace("{title}", order.get("title", ""))
            body = body.replace("{level}", str(level["level"]))
            body = body.replace("{level_name}", level.get("name", ""))
            body = body.replace("{priority}", order.get("priority", ""))
            body = body.replace("{status}", order.get("status", ""))
            
            # Get recipients based on target
            recipients = []
            if action.get("target_user_id"):
                user = await db.users.find_one({"id": action["target_user_id"]}, {"_id": 0, "email": 1})
                if user:
                    recipients.append(user["email"])
            elif action.get("target_role_id"):
                users = await get_users_by_role(action["target_role_id"])
                recipients = [u["email"] for u in users]
            
            for email in recipients:
                try:
                    await send_email_notification(email, subject, body)
                except Exception as e:
                    logger.error(f"Failed to send escalation email: {e}")
            
            result["success"] = len(recipients) > 0
            result["details"]["emails_sent"] = len(recipients)
        
        elif action_type == "webhook":
            # Call external webhook
            url = action.get("webhook_url")
            method = action.get("webhook_method", "POST")
            headers = action.get("webhook_headers", {})
            body_template = action.get("webhook_body_template", "{}")
            
            # Build body with order data
            body_str = body_template.replace("{order_id}", order.get("id", ""))
            body_str = body_str.replace("{order_code}", order.get("order_code", ""))
            body_str = body_str.replace("{title}", order.get("title", ""))
            body_str = body_str.replace("{status}", order.get("status", ""))
            body_str = body_str.replace("{priority}", order.get("priority", ""))
            body_str = body_str.replace("{level}", str(level["level"]))
            body_str = body_str.replace("{level_name}", level.get("name", ""))
            body_str = body_str.replace("{policy_name}", policy.get("name", ""))
            
            async with httpx.AsyncClient(timeout=30) as client:
                if method.upper() == "POST":
                    response = await client.post(url, json=eval(body_str) if body_str.startswith("{") else body_str, headers=headers)
                elif method.upper() == "GET":
                    response = await client.get(url, headers=headers)
                else:
                    response = await client.request(method, url, headers=headers)
                
                result["success"] = response.status_code < 400
                result["details"]["status_code"] = response.status_code
                result["details"]["url"] = url
    
    except Exception as e:
        logger.error(f"Error executing escalation action {action_type}: {e}")
        result["details"]["error"] = str(e)
    
    return result


async def process_escalation(order: dict, trigger_type: str):
    """Process escalation for a single order"""
    order_id = order["id"]
    now = datetime.now(timezone.utc)
    
    # Get applicable policies
    policies = await get_applicable_policies(order)
    
    for policy in policies:
        # Check trigger type
        policy_trigger = policy.get("trigger", "both")
        if policy_trigger != "both" and policy_trigger != trigger_type:
            continue
        
        # Check cooldown
        cooldown = policy.get("cooldown_minutes", 30)
        if await check_cooldown(order_id, policy["id"], cooldown):
            logger.debug(f"Order {order_id} in cooldown for policy {policy['id']}")
            continue
        
        # Get current escalation level
        current_level = await get_current_escalation_level(order_id, policy["id"])
        
        # Determine which level to escalate to
        levels = sorted(policy.get("levels", []), key=lambda x: x["level"])
        
        # Calculate time since trigger (SLA deadline or warning time)
        sla_deadline_str = order.get("sla_deadline")
        if not sla_deadline_str:
            continue
        
        try:
            sla_deadline = datetime.fromisoformat(sla_deadline_str.replace('Z', '+00:00'))
        except:
            continue
        
        # For SLA warning, check 80% of time elapsed
        # For SLA breach, check time after deadline
        if trigger_type == "sla_warning":
            # Calculate warning time (80% to deadline)
            created_at_str = order.get("created_at", get_utc_now())
            try:
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            except:
                created_at = now
            
            total_time = (sla_deadline - created_at).total_seconds() / 60  # in minutes
            warning_threshold = created_at + timedelta(minutes=total_time * 0.8)
            minutes_since_trigger = (now - warning_threshold).total_seconds() / 60
        else:  # sla_breach
            minutes_since_trigger = (now - sla_deadline).total_seconds() / 60
        
        if minutes_since_trigger < 0:
            continue
        
        # Find the appropriate level based on time threshold
        target_level = None
        for level in levels:
            if level["level"] <= current_level:
                continue  # Skip already escalated levels
            
            if minutes_since_trigger >= level.get("time_threshold_minutes", 0):
                target_level = level
        
        if not target_level:
            continue
        
        logger.info(f"Escalating order {order['order_code']} to level {target_level['level']} ({target_level['name']})")
        
        # Execute all actions for this level
        actions_taken = []
        for action in target_level.get("actions", []):
            result = await execute_escalation_action(action, order, target_level, policy)
            actions_taken.append(result)
        
        # Record escalation in history
        history_entry = {
            "id": str(uuid.uuid4()),
            "order_id": order_id,
            "order_code": order.get("order_code"),
            "policy_id": policy["id"],
            "policy_name": policy["name"],
            "level": target_level["level"],
            "level_name": target_level["name"],
            "trigger_type": trigger_type,
            "actions_taken": actions_taken,
            "acknowledged": False,
            "created_at": get_utc_now()
        }
        await db.escalation_history.insert_one(history_entry)
        
        # Update order with escalation info
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "current_escalation_level": target_level["level"],
                "current_escalation_policy_id": policy["id"],
                "last_escalated_at": get_utc_now(),
                "updated_at": get_utc_now()
            }}
        )


async def check_and_process_escalations():
    """Main function to check all orders and process escalations"""
    now = datetime.now(timezone.utc)
    now_str = now.isoformat()
    
    # Get orders that are at risk (SLA warning - approaching deadline)
    # Calculate 80% threshold for each order
    open_orders = await db.orders.find({
        "status": {"$in": ["Open", "In Progress", "Pending"]},
        "sla_deadline": {"$exists": True}
    }, {"_id": 0}).to_list(1000)
    
    for order in open_orders:
        sla_deadline_str = order.get("sla_deadline")
        if not sla_deadline_str:
            continue
        
        try:
            sla_deadline = datetime.fromisoformat(sla_deadline_str.replace('Z', '+00:00'))
        except:
            continue
        
        # Check if SLA is breached
        if now > sla_deadline:
            await process_escalation(order, "sla_breach")
        else:
            # Check if at warning threshold (80% time elapsed)
            created_at_str = order.get("created_at", now_str)
            try:
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            except:
                created_at = now
            
            total_time = (sla_deadline - created_at).total_seconds()
            elapsed_time = (now - created_at).total_seconds()
            
            if total_time > 0 and (elapsed_time / total_time) >= 0.8:
                await process_escalation(order, "sla_warning")


async def get_escalated_orders_summary() -> List[dict]:
    """Get summary of all currently escalated orders"""
    now = datetime.now(timezone.utc)
    
    # Get orders with active escalations
    orders = await db.orders.find({
        "current_escalation_level": {"$exists": True, "$gt": 0},
        "status": {"$in": ["Open", "In Progress", "Pending"]}
    }, {"_id": 0}).to_list(100)
    
    summaries = []
    for order in orders:
        # Get the latest escalation history
        latest_escalation = await db.escalation_history.find_one(
            {"order_id": order["id"]},
            {"_id": 0}
        )
        if latest_escalation:
            latest_escalation = await db.escalation_history.find(
                {"order_id": order["id"]},
                {"_id": 0}
            ).sort("created_at", -1).limit(1).to_list(1)
            latest_escalation = latest_escalation[0] if latest_escalation else None
        
        # Calculate time in escalation
        escalated_at = latest_escalation.get("created_at") if latest_escalation else order.get("last_escalated_at")
        if escalated_at:
            try:
                escalated_dt = datetime.fromisoformat(escalated_at.replace('Z', '+00:00'))
                delta = now - escalated_dt
                hours = int(delta.total_seconds() // 3600)
                minutes = int((delta.total_seconds() % 3600) // 60)
                time_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"
            except:
                time_str = "Unknown"
        else:
            time_str = "Unknown"
        
        summaries.append({
            "order_id": order["id"],
            "order_code": order.get("order_code"),
            "order_title": order.get("title"),
            "order_status": order.get("status"),
            "order_priority": order.get("priority"),
            "current_escalation_level": order.get("current_escalation_level", 0),
            "current_level_name": latest_escalation.get("level_name") if latest_escalation else "Unknown",
            "policy_name": latest_escalation.get("policy_name") if latest_escalation else "Unknown",
            "escalated_at": escalated_at or "Unknown",
            "time_in_escalation": time_str,
            "assigned_to": order.get("editor_name"),
            "requester_name": order.get("requester_name", "Unknown")
        })
    
    return summaries
