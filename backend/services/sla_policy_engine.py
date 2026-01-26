"""Unified SLA & Escalation Policy Engine"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from database import db
from services.notifications import create_notification
from services.email import send_email_notification


async def check_and_process_policies():
    """
    Main policy engine: Check all orders against their SLA policies
    and execute escalation actions when triggers are met.
    """
    now = datetime.now(timezone.utc)
    
    # Get all active policies
    policies = await db.sla_policies.find({"is_active": True}, {"_id": 0}).to_list(100)
    policy_map = {p["id"]: p for p in policies}
    
    # Find orders that are not closed/delivered and have SLA deadlines
    open_orders = await db.orders.find({
        "status": {"$nin": ["Delivered", "Closed"]},
        "sla_deadline": {"$exists": True, "$ne": None}
    }, {"_id": 0}).to_list(1000)
    
    processed_count = 0
    escalations_created = 0
    breaches_detected = 0
    at_risk_detected = 0
    
    for order in open_orders:
        try:
            deadline_str = order.get("sla_deadline")
            if not deadline_str:
                continue
            
            deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
            policy_id = order.get("sla_policy_id")
            policy = policy_map.get(policy_id) if policy_id else None
            
            # Get at-risk threshold (default 4 hours / 240 minutes)
            at_risk_minutes = 240
            if policy and policy.get("thresholds", {}).get("at_risk_minutes"):
                at_risk_minutes = policy["thresholds"]["at_risk_minutes"]
            
            # Determine SLA status
            is_breached = now > deadline
            is_at_risk = not is_breached and now > deadline - timedelta(minutes=at_risk_minutes)
            
            # Update breach status if changed
            if is_breached and not order.get("is_sla_breached"):
                await db.orders.update_one(
                    {"id": order["id"]},
                    {"$set": {"is_sla_breached": True}}
                )
                breaches_detected += 1
            
            if is_at_risk:
                at_risk_detected += 1
            
            # Process escalation levels if policy exists
            if policy and policy.get("escalation_levels"):
                escalation_result = await process_escalation_levels(
                    order, policy, is_at_risk, is_breached, now, deadline
                )
                if escalation_result:
                    escalations_created += 1
            
            processed_count += 1
            
        except Exception as e:
            logging.error(f"Error processing order {order.get('id')}: {e}")
    
    return {
        "processed": processed_count,
        "breaches_detected": breaches_detected,
        "at_risk_detected": at_risk_detected,
        "escalations_created": escalations_created
    }


async def process_escalation_levels(
    order: dict,
    policy: dict,
    is_at_risk: bool,
    is_breached: bool,
    now: datetime,
    deadline: datetime
) -> bool:
    """Process escalation levels for an order"""
    current_level = order.get("current_escalation_level", 0)
    escalation_levels = policy.get("escalation_levels", [])
    
    # Sort levels by level number
    sorted_levels = sorted(escalation_levels, key=lambda x: x.get("level", 0))
    
    for level in sorted_levels:
        level_num = level.get("level", 0)
        if level_num <= current_level:
            continue  # Already processed this level
        
        trigger = level.get("trigger")
        delay_minutes = level.get("delay_minutes", 0)
        
        should_trigger = False
        
        if trigger == "at_risk" and is_at_risk:
            should_trigger = True
        elif trigger == "breach" and is_breached:
            should_trigger = True
        elif trigger == "breach_plus_minutes" and is_breached:
            # Check if enough time has passed since breach
            breach_duration = (now - deadline).total_seconds() / 60
            if breach_duration >= delay_minutes:
                should_trigger = True
        
        if should_trigger:
            # Check cooldown - don't trigger same level twice in cooldown period
            cooldown_minutes = 30  # Default cooldown
            existing = await db.escalation_history.find_one({
                "order_id": order["id"],
                "policy_id": policy["id"],
                "level": level_num,
                "created_at": {"$gte": (now - timedelta(minutes=cooldown_minutes)).isoformat()}
            })
            
            if existing:
                continue  # Cooldown active
            
            # Execute escalation
            await execute_escalation_level(order, policy, level, trigger, now)
            
            # Update order's current escalation level
            await db.orders.update_one(
                {"id": order["id"]},
                {"$set": {"current_escalation_level": level_num}}
            )
            
            return True
    
    return False


async def execute_escalation_level(
    order: dict,
    policy: dict,
    level: dict,
    trigger: str,
    now: datetime
):
    """Execute all actions for an escalation level"""
    actions = level.get("actions", [])
    actions_taken = []
    
    for action in actions:
        action_type = action.get("type")
        action_result = await execute_action(order, action, now)
        actions_taken.append({
            "type": action_type,
            "result": action_result
        })
    
    # Create escalation history entry
    history_entry = {
        "id": str(uuid.uuid4()),
        "order_id": order["id"],
        "order_code": order.get("order_code", ""),
        "policy_id": policy["id"],
        "policy_name": policy["name"],
        "level": level.get("level", 0),
        "level_name": level.get("name", f"Level {level.get('level', 0)}"),
        "trigger_type": trigger,
        "actions_taken": actions_taken,
        "acknowledged": False,
        "created_at": now.isoformat()
    }
    
    await db.escalation_history.insert_one(history_entry)
    
    logging.info(f"Escalation triggered for order {order.get('order_code')}: "
                 f"Policy={policy['name']}, Level={level.get('level')}, Trigger={trigger}")


async def execute_action(order: dict, action: dict, now: datetime) -> dict:
    """Execute a single escalation action"""
    action_type = action.get("type")
    result = {"success": False, "message": ""}
    
    try:
        if action_type == "notify_users":
            user_ids = action.get("target_user_ids", [])
            message = action.get("notification_message", "SLA escalation triggered")
            message = format_message(message, order)
            
            for user_id in user_ids:
                await create_notification(
                    db, user_id, "escalation",
                    f"SLA Escalation - {order.get('order_code')}",
                    message, order["id"]
                )
            result = {"success": True, "notified_users": len(user_ids)}
        
        elif action_type == "notify_role":
            role_id = action.get("target_role_id")
            role_name = action.get("target_role_name")
            message = action.get("notification_message", "SLA escalation triggered")
            message = format_message(message, order)
            
            users = await db.users.find({"role": role_name, "active": True}, {"_id": 0}).to_list(100)
            for user in users:
                await create_notification(
                    db, user["id"], "escalation",
                    f"SLA Escalation - {order.get('order_code')}",
                    message, order["id"]
                )
            result = {"success": True, "notified_users": len(users), "role": role_name}
        
        elif action_type == "notify_team":
            team_id = action.get("target_team_id")
            message = action.get("notification_message", "SLA escalation triggered")
            message = format_message(message, order)
            
            team = await db.teams.find_one({"id": team_id}, {"_id": 0})
            if team:
                member_ids = team.get("members", [])
                users = await db.users.find({"id": {"$in": member_ids}, "active": True}, {"_id": 0}).to_list(100)
                for user in users:
                    await create_notification(
                        db, user["id"], "escalation",
                        f"SLA Escalation - {order.get('order_code')}",
                        message, order["id"]
                    )
                result = {"success": True, "notified_users": len(users), "team": team.get("name")}
        
        elif action_type == "escalate_to_role":
            role_id = action.get("target_role_id")
            role_name = action.get("target_role_name")
            message = action.get("notification_message", "Ticket escalated to your role")
            message = format_message(message, order)
            
            users = await db.users.find({"role": role_name, "active": True}, {"_id": 0}).to_list(100)
            for user in users:
                await create_notification(
                    db, user["id"], "escalation",
                    f"⚠️ Escalated - {order.get('order_code')}",
                    message, order["id"]
                )
                # Also send email for escalations
                await send_email_notification(
                    user["email"],
                    f"[ESCALATION] Ticket {order.get('order_code')} Escalated",
                    f"Ticket {order.get('order_code')} has been escalated.\n\n{message}"
                )
            result = {"success": True, "escalated_to_role": role_name, "users_notified": len(users)}
        
        elif action_type == "escalate_to_team":
            team_id = action.get("target_team_id")
            team_name = action.get("target_team_name")
            message = action.get("notification_message", "Ticket escalated to your team")
            message = format_message(message, order)
            
            team = await db.teams.find_one({"id": team_id}, {"_id": 0})
            if team:
                member_ids = team.get("members", [])
                users = await db.users.find({"id": {"$in": member_ids}, "active": True}, {"_id": 0}).to_list(100)
                for user in users:
                    await create_notification(
                        db, user["id"], "escalation",
                        f"⚠️ Escalated - {order.get('order_code')}",
                        message, order["id"]
                    )
                result = {"success": True, "escalated_to_team": team.get("name"), "users_notified": len(users)}
        
        elif action_type == "reassign":
            target_role_id = action.get("target_role_id")
            target_team_id = action.get("target_team_id")
            
            # Find a user to reassign to
            target_user = None
            if target_role_id:
                role = await db.roles.find_one({"id": target_role_id}, {"_id": 0})
                if role:
                    target_user = await db.users.find_one({
                        "role": role["name"],
                        "active": True,
                        "id": {"$ne": order.get("editor_id")}
                    }, {"_id": 0})
            
            if target_user:
                await db.orders.update_one(
                    {"id": order["id"]},
                    {"$set": {
                        "editor_id": target_user["id"],
                        "editor_name": target_user["name"]
                    }}
                )
                await create_notification(
                    db, target_user["id"], "assignment",
                    f"Ticket Reassigned - {order.get('order_code')}",
                    f"Ticket {order.get('order_code')} has been reassigned to you due to escalation.",
                    order["id"]
                )
                result = {"success": True, "reassigned_to": target_user["name"]}
            else:
                result = {"success": False, "message": "No available user to reassign"}
        
        elif action_type == "change_priority":
            new_priority = action.get("new_priority")
            if new_priority:
                await db.orders.update_one(
                    {"id": order["id"]},
                    {"$set": {"priority": new_priority}}
                )
                result = {"success": True, "new_priority": new_priority}
        
        elif action_type == "send_email":
            # Send email to specified recipients
            subject = action.get("email_subject", f"SLA Alert - {order.get('order_code')}")
            body = action.get("email_body", "SLA escalation triggered")
            body = format_message(body, order)
            
            # Send to assigned editor if exists
            if order.get("editor_id"):
                user = await db.users.find_one({"id": order["editor_id"]}, {"_id": 0})
                if user:
                    await send_email_notification(user["email"], subject, body)
            
            result = {"success": True, "email_sent": True}
        
        elif action_type == "webhook":
            # Trigger webhook (implementation depends on webhook service)
            url = action.get("webhook_url")
            method = action.get("webhook_method", "POST")
            if url:
                # Import webhook service
                try:
                    from services.webhooks import trigger_webhook
                    webhook_result = await trigger_webhook(url, method, {
                        "order_id": order["id"],
                        "order_code": order.get("order_code"),
                        "event": "sla_escalation",
                        "timestamp": now.isoformat()
                    })
                    result = {"success": True, "webhook_triggered": url}
                except Exception as e:
                    result = {"success": False, "message": str(e)}
        
        else:
            result = {"success": False, "message": f"Unknown action type: {action_type}"}
    
    except Exception as e:
        result = {"success": False, "message": str(e)}
        logging.error(f"Error executing action {action_type}: {e}")
    
    return result


def format_message(template: str, order: dict) -> str:
    """Format message template with order data"""
    return template.format(
        order_code=order.get("order_code", ""),
        title=order.get("title", ""),
        status=order.get("status", ""),
        priority=order.get("priority", ""),
        requester=order.get("requester_name", ""),
        assigned_to=order.get("editor_name", "Unassigned")
    )


async def auto_apply_policy_to_order(order_id: str, order: dict = None):
    """
    Automatically apply the most relevant SLA policy to an order
    based on the order's role, team, or specialty.
    """
    if not order:
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        return None
    
    # Get all active policies
    policies = await db.sla_policies.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    # Find matching policy based on scope
    best_policy = None
    best_score = 0
    
    for policy in policies:
        scope = policy.get("scope", {})
        score = 0
        
        # Check role match
        if scope.get("role_ids") and order.get("editor_role_id") in scope["role_ids"]:
            score += 3
        
        # Check team match
        if scope.get("team_ids") and order.get("team_id") in scope["team_ids"]:
            score += 2
        
        # Check specialty match (via user's specialty)
        if scope.get("specialty_ids"):
            editor_id = order.get("editor_id")
            if editor_id:
                editor = await db.users.find_one({"id": editor_id}, {"_id": 0, "specialty_id": 1})
                if editor and editor.get("specialty_id") in scope["specialty_ids"]:
                    score += 1
        
        # Empty scope = applies to all
        if not scope.get("role_ids") and not scope.get("team_ids") and not scope.get("specialty_ids"):
            if not best_policy:  # Use as fallback
                score = 0.5
        
        if score > best_score:
            best_score = score
            best_policy = policy
    
    if best_policy:
        # Apply the policy
        sla_minutes = best_policy.get("sla_rules", {}).get("duration_minutes", 1440)
        now = datetime.now(timezone.utc)
        deadline = now + timedelta(minutes=sla_minutes)
        
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "sla_policy_id": best_policy["id"],
                "sla_policy_name": best_policy["name"],
                "sla_deadline": deadline.isoformat(),
                "is_sla_breached": False,
                "current_escalation_level": 0
            }}
        )
        
        return best_policy
    
    return None
