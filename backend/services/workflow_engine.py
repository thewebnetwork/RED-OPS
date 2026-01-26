"""Workflow execution engine"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from .notifications import create_notification
from .webhooks import trigger_webhooks
from .email import send_email_notification


async def execute_workflow(db, workflow_id: str, trigger_event: str, context: dict):
    """
    Execute a workflow when triggered by an event.
    
    Args:
        db: Database connection
        workflow_id: ID of the workflow to execute
        trigger_event: The event that triggered this workflow (e.g., 'order.created')
        context: Context data containing order, user, and other relevant info
    """
    workflow = await db.workflows.find_one({
        "id": workflow_id,
        "$or": [{"is_active": True}, {"active": True}]
    }, {"_id": 0})
    if not workflow:
        logging.warning(f"Workflow {workflow_id} not found or inactive")
        return None
    
    execution_id = str(uuid.uuid4())
    execution_log = {
        "id": execution_id,
        "workflow_id": workflow_id,
        "workflow_name": workflow.get("name", "Unknown"),
        "trigger_event": trigger_event,
        "context": {
            "order_id": context.get("order", {}).get("id"),
            "order_code": context.get("order", {}).get("order_code"),
            "user_id": context.get("user", {}).get("id"),
        },
        "status": "running",
        "steps": [],
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "error": None
    }
    
    # Insert a copy to avoid MongoDB adding _id to our dict
    await db.workflow_executions.insert_one(dict(execution_log))
    
    try:
        nodes = workflow.get("nodes", [])
        edges = workflow.get("edges", [])
        
        # Find trigger node
        trigger_node = next((n for n in nodes if n.get("type") == "trigger"), None)
        if not trigger_node:
            raise Exception("No trigger node found in workflow")
        
        # Execute nodes in sequence following edges
        executed_nodes = set()
        current_node_id = trigger_node["id"]
        
        while current_node_id and current_node_id not in executed_nodes:
            current_node = next((n for n in nodes if n["id"] == current_node_id), None)
            if not current_node:
                break
            
            executed_nodes.add(current_node_id)
            
            # Execute the node
            step_result = await execute_node(db, current_node, context, execution_id)
            execution_log["steps"].append(step_result)
            
            # Update execution log
            await db.workflow_executions.update_one(
                {"id": execution_id},
                {"$set": {"steps": execution_log["steps"]}}
            )
            
            # If node execution failed and it's critical, stop
            if not step_result.get("success") and current_node.get("data", {}).get("stop_on_failure", False):
                raise Exception(f"Node {current_node_id} failed: {step_result.get('error')}")
            
            # Find next node via edges
            next_edge = next((e for e in edges if e.get("source") == current_node_id), None)
            current_node_id = next_edge.get("target") if next_edge else None
        
        # Mark execution as complete
        execution_log["status"] = "completed"
        execution_log["completed_at"] = datetime.now(timezone.utc).isoformat()
        
    except Exception as e:
        logging.error(f"Workflow execution failed: {e}")
        execution_log["status"] = "failed"
        execution_log["error"] = str(e)
        execution_log["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.workflow_executions.update_one(
        {"id": execution_id},
        {"$set": execution_log}
    )
    
    return execution_log


async def execute_node(db, node: dict, context: dict, execution_id: str) -> dict:
    """Execute a single workflow node"""
    node_type = node.get("type")
    node_id = node.get("id")
    node_data = node.get("data", {})
    
    step_result = {
        "node_id": node_id,
        "node_type": node_type,
        "node_label": node.get("label", "Unknown"),
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "success": False,
        "output": None,
        "error": None
    }
    
    try:
        if node_type == "trigger":
            # Trigger nodes just pass through
            step_result["success"] = True
            step_result["output"] = {"message": "Workflow triggered"}
            
        elif node_type == "action":
            action_type = node_data.get("action_type")
            step_result["output"] = await execute_action(db, action_type, node_data, context)
            step_result["success"] = True
            
        elif node_type == "condition":
            # Evaluate condition
            condition_result = await evaluate_condition(node_data, context)
            step_result["success"] = True
            step_result["output"] = {"condition_met": condition_result}
            
        elif node_type == "form":
            # Form nodes require user input - mark as pending
            step_result["success"] = True
            step_result["output"] = {"status": "pending_input", "form_fields": node_data.get("fields", [])}
            
        else:
            step_result["success"] = True
            step_result["output"] = {"message": f"Unknown node type: {node_type}"}
            
    except Exception as e:
        step_result["error"] = str(e)
        logging.error(f"Node execution error: {e}")
    
    step_result["completed_at"] = datetime.now(timezone.utc).isoformat()
    return step_result


async def execute_action(db, action_type: str, node_data: dict, context: dict) -> dict:
    """Execute a workflow action"""
    order = context.get("order", {})
    user = context.get("user", {})
    
    if action_type == "assign_role":
        # Assign order to a specific role
        target_role = node_data.get("config", {}).get("role")
        if target_role and order.get("id"):
            # Find a user with this role
            target_user = await db.users.find_one(
                {"role": target_role, "active": True},
                {"_id": 0}
            )
            if target_user:
                await db.orders.update_one(
                    {"id": order["id"]},
                    {"$set": {
                        "editor_id": target_user["id"],
                        "editor_name": target_user["name"],
                        "status": "In Progress"
                    }}
                )
                return {"assigned_to": target_user["name"], "role": target_role}
        return {"message": "No assignment made"}
    
    elif action_type == "update_status":
        # Update order status
        new_status = node_data.get("config", {}).get("status")
        if new_status and order.get("id"):
            await db.orders.update_one(
                {"id": order["id"]},
                {"$set": {"status": new_status}}
            )
            return {"new_status": new_status}
        return {"message": "No status update"}
    
    elif action_type == "notify":
        # Send notification
        target = node_data.get("config", {}).get("target", "requester")
        message = node_data.get("config", {}).get("message", "You have a new notification")
        
        target_user_id = None
        if target == "requester":
            target_user_id = order.get("requester_id")
        elif target == "resolver":
            target_user_id = order.get("editor_id")
        elif target == "admin":
            admin = await db.users.find_one({"role": "Admin", "active": True}, {"_id": 0})
            target_user_id = admin["id"] if admin else None
        
        if target_user_id:
            await create_notification(
                db,
                target_user_id,
                "workflow_notification",
                "Workflow Notification",
                message.format(order_code=order.get("order_code", ""), title=order.get("title", "")),
                order.get("id")
            )
            return {"notified": target, "user_id": target_user_id}
        return {"message": "No notification sent"}
    
    elif action_type == "email_user" or action_type == "email_requester":
        # Send email
        target_email = order.get("requester_email") if action_type == "email_requester" else node_data.get("config", {}).get("email")
        subject = node_data.get("config", {}).get("subject", "Notification from Red Ops")
        body = node_data.get("config", {}).get("body", "You have a notification regarding your request.")
        
        if target_email:
            await send_email_notification(target_email, subject, body)
            return {"emailed": target_email}
        return {"message": "No email sent"}
    
    elif action_type == "webhook":
        # Trigger external webhook
        webhook_url = node_data.get("config", {}).get("url")
        if webhook_url:
            await trigger_webhooks(db, "workflow.action", {
                "workflow_action": "custom_webhook",
                "order_id": order.get("id"),
                "order_code": order.get("order_code"),
                "custom_url": webhook_url
            })
            return {"webhook_triggered": webhook_url}
        return {"message": "No webhook triggered"}
    
    elif action_type == "forward_ticket":
        # Forward to another category/team
        target_category = node_data.get("config", {}).get("category_id")
        if target_category and order.get("id"):
            category = await db.categories_l2.find_one({"id": target_category}, {"_id": 0})
            if category:
                await db.orders.update_one(
                    {"id": order["id"]},
                    {"$set": {
                        "category_l2_id": target_category,
                        "category_l2_name": category.get("name")
                    }}
                )
                return {"forwarded_to": category.get("name")}
        return {"message": "No forwarding done"}
    
    elif action_type == "auto_escalate":
        # Legacy action - redirect to apply_sla_policy logic
        # For backward compatibility, try to auto-apply a policy
        if order.get("id"):
            from services.sla_policy_engine import auto_apply_policy_to_order
            policy = await auto_apply_policy_to_order(order["id"], order)
            if policy:
                return {"applied_policy": policy["name"]}
        return {"message": "No matching policy found"}
    
    elif action_type == "apply_sla_policy":
        # Apply a specific SLA policy to the order
        config = node_data.get("config", {})
        policy_id = config.get("policy_id")
        
        if not order.get("id"):
            return {"message": "No order in context"}
        
        if not policy_id:
            # Auto-apply best matching policy
            from services.sla_policy_engine import auto_apply_policy_to_order
            policy = await auto_apply_policy_to_order(order["id"], order)
            if policy:
                return {"applied_policy": policy["name"], "auto_selected": True}
            return {"message": "No matching policy found"}
        
        # Apply specific policy
        policy = await db.sla_policies.find_one({"id": policy_id, "is_active": True}, {"_id": 0})
        if not policy:
            return {"message": "Policy not found or inactive"}
        
        # Calculate deadline based on policy SLA rules
        sla_minutes = policy.get("sla_rules", {}).get("duration_minutes", 1440)
        now = datetime.now(timezone.utc)
        deadline = now + timedelta(minutes=sla_minutes)
        
        await db.orders.update_one(
            {"id": order["id"]},
            {"$set": {
                "sla_policy_id": policy_id,
                "sla_policy_name": policy["name"],
                "sla_deadline": deadline.isoformat(),
                "is_sla_breached": False,
                "current_escalation_level": 0
            }}
        )
        
        return {
            "applied_policy": policy["name"],
            "sla_deadline": deadline.isoformat(),
            "sla_duration_minutes": sla_minutes
        }
    
    return {"message": f"Unknown action type: {action_type}"}


async def evaluate_condition(node_data: dict, context: dict) -> bool:
    """Evaluate a workflow condition"""
    conditions = node_data.get("conditions", [])
    order = context.get("order", {})
    
    for condition in conditions:
        field = condition.get("field")
        operator = condition.get("operator")
        value = condition.get("value")
        
        actual_value = order.get(field)
        
        if operator == "equals":
            if actual_value != value:
                return False
        elif operator == "not_equals":
            if actual_value == value:
                return False
        elif operator == "contains":
            if value not in str(actual_value):
                return False
        elif operator == "greater_than":
            try:
                if float(actual_value) <= float(value):
                    return False
            except:
                return False
        elif operator == "less_than":
            try:
                if float(actual_value) >= float(value):
                    return False
            except:
                return False
    
    return True


async def get_workflows_for_trigger(db, trigger_event: str, category_id: Optional[str] = None):
    """Get all active workflows that should be triggered for an event"""
    query = {
        "is_active": True,
        "trigger_event": trigger_event
    }
    
    if category_id:
        query["$or"] = [
            {"trigger_category_id": category_id},
            {"trigger_category_id": None},
            {"trigger_category_id": {"$exists": False}}
        ]
    
    workflows = await db.workflows.find(query, {"_id": 0}).to_list(100)
    return workflows
