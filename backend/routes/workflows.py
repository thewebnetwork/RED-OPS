"""Workflow management routes including templates and executions"""
import uuid
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Optional, List

from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import get_utc_now
from models.workflow import (
    WorkflowCreate, WorkflowUpdate, WorkflowResponse
)
from services.workflow_engine import execute_workflow

router = APIRouter(tags=["Workflows"])


# ============== HELPER FUNCTIONS ==============

async def get_role_names_by_ids(role_ids: List[str]) -> List[str]:
    """Helper to get role names from IDs"""
    if not role_ids:
        return []
    names = []
    for role_id in role_ids:
        role = await db.roles.find_one({"id": role_id}, {"_id": 0, "name": 1})
        if role:
            names.append(role["name"])
    return names


async def get_team_names_by_ids(team_ids: List[str]) -> List[str]:
    """Helper to get team names from IDs"""
    if not team_ids:
        return []
    names = []
    for team_id in team_ids:
        team = await db.teams.find_one({"id": team_id}, {"_id": 0, "name": 1})
        if team:
            names.append(team["name"])
    return names


async def get_specialty_names_by_ids(specialty_ids: List[str]) -> List[str]:
    """Helper to get specialty names from IDs"""
    if not specialty_ids:
        return []
    names = []
    for specialty_id in specialty_ids:
        specialty = await db.specialties.find_one({"id": specialty_id}, {"_id": 0, "name": 1})
        if specialty:
            names.append(specialty["name"])
    return names


async def get_access_tier_names_by_ids(tier_ids: List[str]) -> List[str]:
    """Helper to get access tier names from IDs"""
    if not tier_ids:
        return []
    names = []
    for tier_id in tier_ids:
        tier = await db.access_tiers.find_one({"id": tier_id}, {"_id": 0, "name": 1})
        if tier:
            names.append(tier["name"])
    return names


async def get_category_names_by_ids(category_ids: List[str]) -> List[str]:
    """Helper to get category names from IDs (L1 or L2)"""
    if not category_ids:
        return []
    names = []
    for cat_id in category_ids:
        cat = await db.categories_l1.find_one({"id": cat_id}, {"_id": 0, "name": 1})
        if cat:
            names.append(cat["name"])
        else:
            cat = await db.categories_l2.find_one({"id": cat_id}, {"_id": 0, "name": 1})
            if cat:
                names.append(cat["name"])
    return names


def normalize_workflow(workflow: dict) -> dict:
    """Normalize workflow dict to ensure all required fields exist"""
    defaults = {
        "assigned_roles": [],
        "assigned_role_names": [],
        "assigned_teams": [],
        "assigned_team_names": [],
        "assigned_specialties": [],
        "assigned_specialty_names": [],
        "assigned_access_tiers": [],
        "assigned_access_tier_names": [],
        "trigger_categories": [],
        "trigger_category_names": [],
        "nodes": [],
        "edges": [],
        "is_template": False,
        "is_active": True,
        "updated_at": None
    }
    for key, default_val in defaults.items():
        if key not in workflow:
            workflow[key] = default_val
    
    # Ensure 'active' field exists (alias for is_active)
    if "active" not in workflow:
        workflow["active"] = workflow.get("is_active", True)
    
    return workflow


# ============== WORKFLOW CRUD ROUTES ==============

@router.post("/workflows", response_model=WorkflowResponse)
async def create_workflow(workflow_data: WorkflowCreate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new visual workflow"""
    existing = await db.workflows.find_one({"name": workflow_data.name, "active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Workflow with this name already exists")
    
    # Get names for assigned entities
    assigned_role_names = await get_role_names_by_ids(workflow_data.assigned_roles)
    assigned_team_names = await get_team_names_by_ids(workflow_data.assigned_teams)
    assigned_specialty_names = await get_specialty_names_by_ids(workflow_data.assigned_specialties)
    assigned_access_tier_names = await get_access_tier_names_by_ids(workflow_data.assigned_access_tiers)
    trigger_category_names = await get_category_names_by_ids(workflow_data.trigger_categories)
    
    now = get_utc_now()
    workflow = {
        "id": str(uuid.uuid4()),
        "name": workflow_data.name,
        "description": workflow_data.description,
        "assigned_roles": workflow_data.assigned_roles,
        "assigned_role_names": assigned_role_names,
        "assigned_teams": workflow_data.assigned_teams,
        "assigned_team_names": assigned_team_names,
        "assigned_specialties": workflow_data.assigned_specialties,
        "assigned_specialty_names": assigned_specialty_names,
        "assigned_access_tiers": workflow_data.assigned_access_tiers,
        "assigned_access_tier_names": assigned_access_tier_names,
        "trigger_categories": workflow_data.trigger_categories,
        "trigger_category_names": trigger_category_names,
        "trigger_event": workflow_data.trigger_event,
        "trigger_category_id": workflow_data.trigger_category_id,
        "color": workflow_data.color or "#3B82F6",
        "nodes": [n.model_dump() for n in workflow_data.nodes],
        "edges": [e.model_dump() for e in workflow_data.edges],
        "is_template": workflow_data.is_template,
        "is_active": workflow_data.is_active,
        "active": workflow_data.is_active,
        "created_at": now,
        "updated_at": now
    }
    await db.workflows.insert_one(workflow)
    
    return WorkflowResponse(**workflow)


@router.get("/workflows", response_model=List[WorkflowResponse])
async def list_workflows(
    active_only: bool = True,
    templates_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """List all workflows"""
    query = {}
    if active_only:
        query["active"] = True
    if templates_only:
        query["is_template"] = True
    
    workflows = await db.workflows.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    return [WorkflowResponse(**normalize_workflow(w)) for w in workflows]


@router.get("/workflows/meta/actions")
async def get_workflow_actions(current_user: dict = Depends(get_current_user)):
    """Get list of available actions for workflow nodes"""
    return {
        "actions": [
            {"type": "assign_role", "label": "Auto-Assign Role", "description": "Automatically assign ticket to a role", "icon": "UserPlus", "config_fields": ["role_id"]},
            {"type": "forward_ticket", "label": "Forward Ticket", "description": "Forward ticket to another team/user", "icon": "Forward", "config_fields": ["team_id", "user_id"]},
            {"type": "email_user", "label": "Email Assigned User", "description": "Send email to the assigned user", "icon": "Mail", "config_fields": ["email_template", "subject"]},
            {"type": "email_requester", "label": "Email Requester", "description": "Send email to the requester", "icon": "Send", "config_fields": ["email_template", "subject"]},
            {"type": "update_status", "label": "Update Status", "description": "Change ticket status", "icon": "RefreshCw", "config_fields": ["status"]},
            {"type": "notify", "label": "Send Notification", "description": "Send in-app notification", "icon": "Bell", "config_fields": ["message", "recipients"]},
            {"type": "webhook", "label": "Trigger Webhook", "description": "Call external API", "icon": "Webhook", "config_fields": ["url", "method", "headers", "body"]},
            {"type": "delay", "label": "Add Delay", "description": "Wait before next action", "icon": "Clock", "config_fields": ["delay_value", "delay_unit"]},
            {"type": "apply_sla_policy", "label": "Apply SLA Policy", "description": "Apply a specific SLA & Escalation policy to this ticket", "icon": "Shield", "config_fields": ["policy_id"]},
        ]
    }


@router.get("/workflows/meta/field-types")
async def get_form_field_types(current_user: dict = Depends(get_current_user)):
    """Get list of available form field types"""
    return {
        "field_types": [
            {"type": "text", "label": "Text Input", "icon": "Type"},
            {"type": "textarea", "label": "Text Area", "icon": "AlignLeft"},
            {"type": "number", "label": "Number", "icon": "Hash"},
            {"type": "email", "label": "Email", "icon": "AtSign"},
            {"type": "phone", "label": "Phone Number", "icon": "Phone"},
            {"type": "url", "label": "URL", "icon": "Link"},
            {"type": "date", "label": "Date Picker", "icon": "Calendar"},
            {"type": "select", "label": "Dropdown", "icon": "ChevronDown"},
            {"type": "multiselect", "label": "Multi-Select", "icon": "CheckSquare"},
            {"type": "checkbox", "label": "Checkbox", "icon": "Square"},
            {"type": "file", "label": "File Upload", "icon": "Upload"},
        ]
    }


@router.get("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific workflow"""
    workflow = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return WorkflowResponse(**normalize_workflow(workflow))


@router.get("/workflows/by-role/{role_name}")
async def get_workflows_by_role(role_name: str, current_user: dict = Depends(get_current_user)):
    """Get workflows assigned to a specific role"""
    role = await db.roles.find_one({"name": role_name}, {"_id": 0})
    if not role:
        return []
    
    workflows = await db.workflows.find({
        "assigned_roles": role["id"],
        "active": True
    }, {"_id": 0}).to_list(100)
    
    return [WorkflowResponse(**normalize_workflow(w)) for w in workflows]


@router.get("/workflows/by-team/{team_id}")
async def get_workflows_by_team(team_id: str, current_user: dict = Depends(get_current_user)):
    """Get workflows assigned to a specific team"""
    workflows = await db.workflows.find({
        "assigned_teams": team_id,
        "active": True
    }, {"_id": 0}).to_list(100)
    
    return [WorkflowResponse(**normalize_workflow(w)) for w in workflows]


@router.get("/workflows/by-category/{category_id}")
async def get_workflows_by_category(category_id: str, current_user: dict = Depends(get_current_user)):
    """Get workflows triggered by a specific category"""
    workflows = await db.workflows.find({
        "trigger_categories": category_id,
        "active": True
    }, {"_id": 0}).to_list(100)
    
    return [WorkflowResponse(**normalize_workflow(w)) for w in workflows]


@router.get("/workflows/by-specialty/{specialty_id}")
async def get_workflows_by_specialty(specialty_id: str, current_user: dict = Depends(get_current_user)):
    """Get workflows assigned to a specific specialty"""
    workflows = await db.workflows.find({
        "assigned_specialties": specialty_id,
        "active": True
    }, {"_id": 0}).to_list(100)
    
    return [WorkflowResponse(**normalize_workflow(w)) for w in workflows]


@router.get("/workflows/by-access-tier/{tier_id}")
async def get_workflows_by_access_tier(tier_id: str, current_user: dict = Depends(get_current_user)):
    """Get workflows assigned to a specific access tier"""
    workflows = await db.workflows.find({
        "assigned_access_tiers": tier_id,
        "active": True
    }, {"_id": 0}).to_list(100)
    
    return [WorkflowResponse(**normalize_workflow(w)) for w in workflows]


@router.put("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow_full(workflow_id: str, workflow_data: WorkflowUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Full update of workflow including nodes and edges"""
    workflow = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    update_dict = {}
    for k, v in workflow_data.model_dump().items():
        if v is not None:
            if k == "nodes":
                update_dict[k] = [n if isinstance(n, dict) else n.model_dump() for n in v]
            elif k == "edges":
                update_dict[k] = [e if isinstance(e, dict) else e.model_dump() for e in v]
            else:
                update_dict[k] = v
    
    # Update names for assigned entities
    if "assigned_roles" in update_dict:
        update_dict["assigned_role_names"] = await get_role_names_by_ids(update_dict["assigned_roles"])
    if "assigned_teams" in update_dict:
        update_dict["assigned_team_names"] = await get_team_names_by_ids(update_dict["assigned_teams"])
    if "assigned_specialties" in update_dict:
        update_dict["assigned_specialty_names"] = await get_specialty_names_by_ids(update_dict["assigned_specialties"])
    if "assigned_access_tiers" in update_dict:
        update_dict["assigned_access_tier_names"] = await get_access_tier_names_by_ids(update_dict["assigned_access_tiers"])
    if "trigger_categories" in update_dict:
        update_dict["trigger_category_names"] = await get_category_names_by_ids(update_dict["trigger_categories"])
    
    # Handle is_active/active consistency
    if "is_active" in update_dict:
        update_dict["active"] = update_dict["is_active"]
    if "active" in update_dict:
        update_dict["is_active"] = update_dict["active"]
    
    update_dict["updated_at"] = get_utc_now()
    
    if update_dict:
        await db.workflows.update_one({"id": workflow_id}, {"$set": update_dict})
    
    updated = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    return WorkflowResponse(**normalize_workflow(updated))


@router.patch("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow_partial(workflow_id: str, workflow_data: WorkflowUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Partial update of workflow metadata only"""
    workflow = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    update_dict = {k: v for k, v in workflow_data.model_dump().items() if v is not None}
    
    # Update names for assigned entities
    if "assigned_roles" in update_dict:
        update_dict["assigned_role_names"] = await get_role_names_by_ids(update_dict["assigned_roles"])
    if "assigned_teams" in update_dict:
        update_dict["assigned_team_names"] = await get_team_names_by_ids(update_dict["assigned_teams"])
    if "assigned_specialties" in update_dict:
        update_dict["assigned_specialty_names"] = await get_specialty_names_by_ids(update_dict["assigned_specialties"])
    if "assigned_access_tiers" in update_dict:
        update_dict["assigned_access_tier_names"] = await get_access_tier_names_by_ids(update_dict["assigned_access_tiers"])
    if "trigger_categories" in update_dict:
        update_dict["trigger_category_names"] = await get_category_names_by_ids(update_dict["trigger_categories"])
    
    # Handle is_active/active consistency
    if "is_active" in update_dict:
        update_dict["active"] = update_dict["is_active"]
    if "active" in update_dict:
        update_dict["is_active"] = update_dict["active"]
    
    update_dict["updated_at"] = get_utc_now()
    
    if update_dict:
        await db.workflows.update_one({"id": workflow_id}, {"$set": update_dict})
    
    updated = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    return WorkflowResponse(**normalize_workflow(updated))


@router.post("/workflows/{workflow_id}/duplicate", response_model=WorkflowResponse)
async def duplicate_workflow(workflow_id: str, new_name: str = Query(...), current_user: dict = Depends(require_roles(["Admin"]))):
    """Duplicate an existing workflow"""
    workflow = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    existing = await db.workflows.find_one({"name": new_name, "active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Workflow with this name already exists")
    
    now = get_utc_now()
    new_workflow = {
        "id": str(uuid.uuid4()),
        "name": new_name,
        "description": workflow.get("description"),
        "assigned_roles": workflow.get("assigned_roles", []),
        "assigned_role_names": workflow.get("assigned_role_names", []),
        "assigned_teams": workflow.get("assigned_teams", []),
        "assigned_team_names": workflow.get("assigned_team_names", []),
        "assigned_specialties": workflow.get("assigned_specialties", []),
        "assigned_specialty_names": workflow.get("assigned_specialty_names", []),
        "assigned_access_tiers": workflow.get("assigned_access_tiers", []),
        "assigned_access_tier_names": workflow.get("assigned_access_tier_names", []),
        "trigger_categories": workflow.get("trigger_categories", []),
        "trigger_category_names": workflow.get("trigger_category_names", []),
        "trigger_event": workflow.get("trigger_event"),
        "trigger_category_id": workflow.get("trigger_category_id"),
        "color": workflow.get("color"),
        "nodes": workflow.get("nodes", []),
        "edges": workflow.get("edges", []),
        "is_template": False,
        "is_active": True,
        "active": True,
        "created_at": now,
        "updated_at": now
    }
    await db.workflows.insert_one(new_workflow)
    
    return WorkflowResponse(**normalize_workflow(new_workflow))


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Deactivate a workflow (soft delete)"""
    workflow = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    await db.workflows.update_one(
        {"id": workflow_id}, 
        {"$set": {"active": False, "is_active": False, "updated_at": get_utc_now()}}
    )
    return {"message": "Workflow deactivated"}


# ============== WORKFLOW TEMPLATES ==============

WORKFLOW_TEMPLATES = [
    {
        "id": "template-pool-routing",
        "name": "Pool Routing (24h Right of First Refusal)",
        "description": "Routes paid service tickets to Partner pool first, then to Vendor/Freelancer pool after 24 hours if unclaimed",
        "category": "Routing",
        "icon": "Users",
        "color": "#8B5CF6",
        "popularity": 98,
        "editable": True,
        "nodes": [
            {"id": "trigger-1", "type": "trigger", "label": "Ticket Status = OPEN (Paid)", "position": {"x": 250, "y": 50}, "data": {"trigger_type": "order.status_changed", "condition": {"status": "Open"}}},
            {"id": "action-pool1", "type": "action", "label": "Route to Pool 1 (Partners)", "position": {"x": 250, "y": 170}, "data": {"action_type": "route_to_pool", "config": {"pool": "pool_1", "target_specialty": "{ticket_specialty}", "target_account_type": "Partner", "message": "New paid service request available for Partners: {order_code}"}}},
            {"id": "delay-1", "type": "delay", "label": "Wait 24 Hours", "position": {"x": 250, "y": 290}, "data": {"delay_type": "hours", "delay_value": 24, "configurable": True}},
            {"id": "condition-claimed", "type": "condition", "label": "Check if Claimed", "position": {"x": 250, "y": 410}, "data": {"field": "editor_id", "conditions": [{"operator": "is_not_null"}]}},
            {"id": "action-pool2", "type": "action", "label": "Route to Pool 2 (Vendors)", "position": {"x": 400, "y": 530}, "data": {"action_type": "route_to_pool", "config": {"pool": "pool_2", "target_specialty": "{ticket_specialty}", "target_account_type": "Vendor/Freelancer", "message": "Unclaimed request available for Vendors: {order_code}"}}},
            {"id": "end-claimed", "type": "end", "label": "Already Claimed", "position": {"x": 100, "y": 530}, "data": {"reason": "Ticket picked by Partner"}}
        ],
        "edges": [
            {"id": "e1", "source": "trigger-1", "target": "action-pool1"},
            {"id": "e2", "source": "action-pool1", "target": "delay-1"},
            {"id": "e3", "source": "delay-1", "target": "condition-claimed"},
            {"id": "e4", "source": "condition-claimed", "target": "end-claimed", "label": "Claimed", "source_handle": "yes"},
            {"id": "e5", "source": "condition-claimed", "target": "action-pool2", "label": "Not Claimed", "source_handle": "no"}
        ]
    },
    {
        "id": "template-payments-workflow",
        "name": "Payments + Status Progression",
        "description": "Sends GHL payment link, changes status on payment confirmation, then routes to pools. Example for Media Services > Editing Services.",
        "category": "Payments",
        "icon": "CreditCard",
        "color": "#10B981",
        "popularity": 96,
        "editable": True,
        "mocked": True,
        "nodes": [
            {"id": "trigger-1", "type": "trigger", "label": "Ticket Created (NEW)", "position": {"x": 250, "y": 50}, "data": {"trigger_type": "order.created", "condition": {"category_l1": "Media Services", "category_l2": "Editing Services"}}},
            {"id": "action-payment", "type": "action", "label": "Send GHL Payment Link", "position": {"x": 250, "y": 170}, "data": {"action_type": "send_payment_link", "config": {"provider": "ghl_mocked", "price_partner": 100, "price_media_client": 150, "message": "Please complete payment for your request: {payment_link}"}}},
            {"id": "webhook-wait", "type": "trigger", "label": "Wait for Payment Webhook", "position": {"x": 250, "y": 290}, "data": {"trigger_type": "webhook.payment_confirmed", "webhook_source": "ghl_mocked"}},
            {"id": "action-status", "type": "action", "label": "Update Status: NEW → OPEN", "position": {"x": 250, "y": 410}, "data": {"action_type": "update_status", "config": {"status": "Open", "add_note": "Payment confirmed. Ticket is now open for fulfillment."}}},
            {"id": "action-pool1", "type": "action", "label": "Route to Pool 1 (Partners)", "position": {"x": 250, "y": 530}, "data": {"action_type": "route_to_pool", "config": {"pool": "pool_1", "target_specialty": "{ticket_specialty}", "target_account_type": "Partner"}}},
            {"id": "delay-1", "type": "delay", "label": "Wait 24 Hours", "position": {"x": 250, "y": 650}, "data": {"delay_type": "hours", "delay_value": 24}},
            {"id": "condition-claimed", "type": "condition", "label": "Check if Claimed", "position": {"x": 250, "y": 770}, "data": {"field": "editor_id", "conditions": [{"operator": "is_not_null"}]}},
            {"id": "action-pool2", "type": "action", "label": "Route to Pool 2 (Vendors)", "position": {"x": 400, "y": 890}, "data": {"action_type": "route_to_pool", "config": {"pool": "pool_2", "target_account_type": "Vendor/Freelancer"}}},
            {"id": "end-claimed", "type": "end", "label": "Fulfilled", "position": {"x": 100, "y": 890}, "data": {}}
        ],
        "edges": [
            {"id": "e1", "source": "trigger-1", "target": "action-payment"},
            {"id": "e2", "source": "action-payment", "target": "webhook-wait"},
            {"id": "e3", "source": "webhook-wait", "target": "action-status"},
            {"id": "e4", "source": "action-status", "target": "action-pool1"},
            {"id": "e5", "source": "action-pool1", "target": "delay-1"},
            {"id": "e6", "source": "delay-1", "target": "condition-claimed"},
            {"id": "e7", "source": "condition-claimed", "target": "end-claimed", "label": "Claimed", "source_handle": "yes"},
            {"id": "e8", "source": "condition-claimed", "target": "action-pool2", "label": "Not Claimed", "source_handle": "no"}
        ]
    },
    {
        "id": "template-editor-assignment",
        "name": "Editor Assignment",
        "description": "Automatically notifies editors when new orders are created and sends email alerts",
        "category": "Assignment",
        "icon": "UserPlus",
        "color": "#10B981",
        "popularity": 95,
        "nodes": [
            {"id": "trigger-1", "type": "trigger", "label": "New Order Created", "position": {"x": 250, "y": 50}, "data": {"trigger_type": "order.created"}},
            {"id": "action-1", "type": "action", "label": "Notify Editors", "position": {"x": 250, "y": 170}, "data": {"action_type": "notify", "config": {"target": "role:Editor", "message": "New order {order_code} available: {title}"}}},
            {"id": "action-2", "type": "action", "label": "Email Editor Team", "position": {"x": 250, "y": 290}, "data": {"action_type": "send_email", "config": {"to": "editors", "subject": "New Order: {order_code}", "body": "A new order is ready for pickup.\n\nTitle: {title}\nPriority: {priority}"}}}
        ],
        "edges": [
            {"id": "e1", "source": "trigger-1", "target": "action-1"},
            {"id": "e2", "source": "action-1", "target": "action-2"}
        ]
    },
    {
        "id": "template-sla-escalation",
        "name": "SLA Escalation",
        "description": "Automatically escalates tickets to managers when SLA is at risk or breached",
        "category": "Escalation",
        "icon": "AlertTriangle",
        "color": "#EF4444",
        "popularity": 88,
        "nodes": [
            {"id": "trigger-1", "type": "trigger", "label": "SLA Warning", "position": {"x": 250, "y": 50}, "data": {"trigger_type": "order.sla_warning"}},
            {"id": "action-1", "type": "action", "label": "Notify Admin", "position": {"x": 250, "y": 170}, "data": {"action_type": "notify", "config": {"target": "role:Admin", "message": "⚠️ SLA at risk for {order_code}: {title}"}}},
            {"id": "action-2", "type": "action", "label": "Email Manager", "position": {"x": 250, "y": 290}, "data": {"action_type": "send_email", "config": {"to": "admin", "subject": "SLA Alert: {order_code}", "body": "Order {order_code} is at risk of breaching SLA.\n\nDeadline: {sla_deadline}\nAssigned to: {editor_name}"}}}
        ],
        "edges": [
            {"id": "e1", "source": "trigger-1", "target": "action-1"},
            {"id": "e2", "source": "action-1", "target": "action-2"}
        ]
    },
    {
        "id": "template-customer-feedback",
        "name": "Customer Feedback Request",
        "description": "Sends satisfaction survey to customers after ticket delivery",
        "category": "Feedback",
        "icon": "Star",
        "color": "#F59E0B",
        "popularity": 82,
        "nodes": [
            {"id": "trigger-1", "type": "trigger", "label": "Order Delivered", "position": {"x": 250, "y": 50}, "data": {"trigger_type": "order.delivered"}},
            {"id": "delay-1", "type": "delay", "label": "Wait 24 Hours", "position": {"x": 250, "y": 170}, "data": {"delay_type": "hours", "delay_value": 24}},
            {"id": "action-1", "type": "action", "label": "Send Survey Email", "position": {"x": 250, "y": 290}, "data": {"action_type": "send_email", "config": {"to": "requester", "subject": "How did we do? Rate your experience", "body": "Hi {requester_name},\n\nYour order {order_code} has been delivered. We'd love to hear your feedback!\n\nPlease take a moment to rate your experience."}}}
        ],
        "edges": [
            {"id": "e1", "source": "trigger-1", "target": "delay-1"},
            {"id": "e2", "source": "delay-1", "target": "action-1"}
        ]
    },
    {
        "id": "template-auto-close",
        "name": "Auto-Close Inactive Tickets",
        "description": "Automatically closes tickets that have been pending response for too long",
        "category": "Automation",
        "icon": "Clock",
        "color": "#6366F1",
        "popularity": 76,
        "nodes": [
            {"id": "trigger-1", "type": "trigger", "label": "Status Changed to Pending", "position": {"x": 250, "y": 50}, "data": {"trigger_type": "order.status_changed", "condition": {"status": "Pending"}}},
            {"id": "delay-1", "type": "delay", "label": "Wait 7 Days", "position": {"x": 250, "y": 170}, "data": {"delay_type": "days", "delay_value": 7}},
            {"id": "action-1", "type": "action", "label": "Notify Requester", "position": {"x": 250, "y": 290}, "data": {"action_type": "notify", "config": {"target": "requester", "message": "Your ticket {order_code} will be auto-closed in 24 hours if no response is received."}}},
            {"id": "delay-2", "type": "delay", "label": "Wait 24 Hours", "position": {"x": 250, "y": 410}, "data": {"delay_type": "hours", "delay_value": 24}},
            {"id": "action-2", "type": "action", "label": "Close Ticket", "position": {"x": 250, "y": 530}, "data": {"action_type": "update_status", "config": {"status": "Closed", "reason": "Auto-closed due to inactivity"}}}
        ],
        "edges": [
            {"id": "e1", "source": "trigger-1", "target": "delay-1"},
            {"id": "e2", "source": "delay-1", "target": "action-1"},
            {"id": "e3", "source": "action-1", "target": "delay-2"},
            {"id": "e4", "source": "delay-2", "target": "action-2"}
        ]
    },
    {
        "id": "template-priority-routing",
        "name": "Priority-Based Routing",
        "description": "Routes high priority tickets to senior team members immediately",
        "category": "Routing",
        "icon": "Zap",
        "color": "#8B5CF6",
        "popularity": 71,
        "nodes": [
            {"id": "trigger-1", "type": "trigger", "label": "New Order Created", "position": {"x": 250, "y": 50}, "data": {"trigger_type": "order.created"}},
            {"id": "condition-1", "type": "condition", "label": "Check Priority", "position": {"x": 250, "y": 170}, "data": {"field": "priority", "conditions": [{"operator": "equals", "value": "Urgent"}, {"operator": "equals", "value": "High"}]}},
            {"id": "action-high", "type": "action", "label": "Notify Senior Team", "position": {"x": 100, "y": 290}, "data": {"action_type": "notify", "config": {"target": "team:senior", "message": "🔴 High priority order {order_code}: {title}"}}},
            {"id": "action-normal", "type": "action", "label": "Add to Pool", "position": {"x": 400, "y": 290}, "data": {"action_type": "notify", "config": {"target": "role:Editor", "message": "New order {order_code} available"}}}
        ],
        "edges": [
            {"id": "e1", "source": "trigger-1", "target": "condition-1"},
            {"id": "e2", "source": "condition-1", "target": "action-high", "label": "High/Urgent", "source_handle": "yes"},
            {"id": "e3", "source": "condition-1", "target": "action-normal", "label": "Normal/Low", "source_handle": "no"}
        ]
    },
    {
        "id": "template-webhook-integration",
        "name": "External System Sync",
        "description": "Sends order updates to external systems via webhook",
        "category": "Integration",
        "icon": "Link",
        "color": "#0EA5E9",
        "popularity": 65,
        "nodes": [
            {"id": "trigger-1", "type": "trigger", "label": "Order Status Changed", "position": {"x": 250, "y": 50}, "data": {"trigger_type": "order.status_changed"}},
            {"id": "action-1", "type": "action", "label": "Send Webhook", "position": {"x": 250, "y": 170}, "data": {"action_type": "webhook", "config": {"url": "https://your-system.com/api/webhook", "method": "POST", "body": {"order_id": "{order_id}", "status": "{status}", "updated_at": "{updated_at}"}}}}
        ],
        "edges": [
            {"id": "e1", "source": "trigger-1", "target": "action-1"}
        ]
    }
]


@router.get("/workflow-templates")
async def get_workflow_templates(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all available workflow templates"""
    templates = WORKFLOW_TEMPLATES
    
    if category:
        templates = [t for t in templates if t["category"].lower() == category.lower()]
    
    # Sort by popularity
    templates = sorted(templates, key=lambda x: x["popularity"], reverse=True)
    
    # Extract unique categories from all templates
    categories = list(set(t["category"] for t in WORKFLOW_TEMPLATES))
    
    return {
        "templates": templates,
        "categories": sorted(categories)
    }


@router.get("/workflow-templates/{template_id}")
async def get_workflow_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific workflow template"""
    template = next((t for t in WORKFLOW_TEMPLATES if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/workflow-templates/{template_id}/install")
async def install_workflow_template(
    template_id: str,
    workflow_name: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Install a workflow from a template"""
    template = next((t for t in WORKFLOW_TEMPLATES if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Use provided name or template name
    name = workflow_name or template["name"]
    
    # Check if workflow with this name already exists
    existing = await db.workflows.find_one({"name": name, "active": True})
    if existing:
        # Append number to make unique
        count = await db.workflows.count_documents({"name": {"$regex": f"^{name}"}})
        name = f"{name} ({count + 1})"
    
    now = get_utc_now()
    workflow_id = str(uuid.uuid4())
    
    workflow = {
        "id": workflow_id,
        "name": name,
        "description": template["description"],
        "assigned_roles": [],
        "assigned_role_names": [],
        "assigned_teams": [],
        "assigned_team_names": [],
        "trigger_categories": [],
        "trigger_category_names": [],
        "trigger_event": template["nodes"][0]["data"].get("trigger_type") if template["nodes"] else None,
        "color": template["color"],
        "nodes": template["nodes"],
        "edges": template["edges"],
        "is_template": False,
        "is_active": True,
        "active": True,
        "created_at": now,
        "updated_at": now,
        "created_from_template": template_id
    }
    
    await db.workflows.insert_one(workflow)
    
    return {
        "id": workflow_id,
        "name": name,
        "description": workflow["description"],
        "message": f"Workflow '{name}' created from template '{template['name']}'"
    }


# ============== WORKFLOW EXECUTION ROUTES ==============

@router.get("/workflow-executions")
async def list_workflow_executions(
    workflow_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """List workflow executions"""
    query = {}
    if workflow_id:
        query["workflow_id"] = workflow_id
    
    executions = await db.workflow_executions.find(query, {"_id": 0}).sort("started_at", -1).limit(limit).to_list(limit)
    return executions


@router.get("/workflow-executions/{execution_id}")
async def get_workflow_execution(execution_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Get a specific workflow execution"""
    execution = await db.workflow_executions.find_one({"id": execution_id}, {"_id": 0})
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution


@router.post("/workflows/{workflow_id}/test")
async def test_workflow(workflow_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(require_roles(["Admin"]))):
    """Test a workflow with sample data"""
    workflow = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Create test context
    test_context = {
        "order": {
            "id": "test-order-id",
            "order_code": "TEST-001",
            "title": "Test Order",
            "description": "This is a test order for workflow testing",
            "status": "Open",
            "priority": "Normal",
            "requester_name": current_user["name"],
            "requester_email": current_user["email"],
            "editor_name": None,
            "sla_deadline": get_utc_now()
        },
        "user": current_user,
        "is_test": True
    }
    
    # Execute workflow in background
    execution_id = str(uuid.uuid4())
    
    async def run_test():
        await execute_workflow(db, workflow_id, "test", test_context, execution_id)
    
    background_tasks.add_task(run_test)
    
    return {
        "message": "Workflow test started",
        "execution_id": execution_id,
        "workflow_name": workflow["name"]
    }



# ============== MOCKED GHL PAYMENT WEBHOOK ==============

class MockedGHLPaymentWebhook(BaseModel):
    """Simulated GHL payment webhook payload"""
    order_id: str
    payment_status: str = "confirmed"
    amount: Optional[float] = None
    transaction_id: Optional[str] = None


@router.post("/webhooks/ghl-payment-mock")
async def receive_ghl_payment_mock(
    payload: MockedGHLPaymentWebhook,
    background_tasks: BackgroundTasks
):
    """
    MOCKED GHL Payment Webhook Endpoint
    
    This simulates receiving a payment confirmation from GoHighLevel.
    In production, this would be replaced with a real GHL webhook integration.
    
    Use this endpoint to simulate payment confirmation for testing workflows.
    """
    order_id = payload.order_id
    
    # Find the order
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if payload.payment_status == "confirmed":
        # Update order status from NEW to OPEN
        now = get_utc_now()
        update_data = {
            "status": "Open",
            "payment_confirmed": True,
            "payment_confirmed_at": now,
            "payment_transaction_id": payload.transaction_id or f"mock-txn-{uuid.uuid4().hex[:8]}",
            "payment_amount": payload.amount
        }
        
        await db.orders.update_one({"id": order_id}, {"$set": update_data})
        
        # Add activity log
        activity = {
            "id": str(uuid.uuid4()),
            "order_id": order_id,
            "type": "status_change",
            "description": "Payment confirmed via GHL webhook (MOCKED). Status changed from New to Open.",
            "actor": "System",
            "timestamp": now
        }
        await db.order_activity.insert_one(activity)
        
        # Trigger any workflows that listen for payment confirmation
        workflows = await db.workflows.find({
            "is_active": True,
            "active": True,
            "trigger_event": "webhook.payment_confirmed"
        }, {"_id": 0}).to_list(100)
        
        context = {
            "order": {**order, **update_data},
            "payment": {
                "status": payload.payment_status,
                "amount": payload.amount,
                "transaction_id": payload.transaction_id
            }
        }
        
        for workflow in workflows:
            execution_id = str(uuid.uuid4())
            background_tasks.add_task(execute_workflow, db, workflow["id"], "webhook.payment_confirmed", context, execution_id)
        
        return {
            "message": "Payment confirmation processed (MOCKED)",
            "order_id": order_id,
            "new_status": "Open",
            "workflows_triggered": len(workflows)
        }
    else:
        return {
            "message": "Payment status received but not confirmed",
            "order_id": order_id,
            "status": payload.payment_status
        }


@router.post("/simulate-payment/{order_id}")
async def simulate_payment(
    order_id: str,
    amount: float = 100.0,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """
    Admin endpoint to simulate a GHL payment for testing purposes.
    This triggers the same flow as if GHL sent a payment confirmation webhook.
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Create mock webhook payload
    mock_payload = MockedGHLPaymentWebhook(
        order_id=order_id,
        payment_status="confirmed",
        amount=amount,
        transaction_id=f"sim-{uuid.uuid4().hex[:8]}"
    )
    
    # Call the mock webhook handler
    from fastapi import BackgroundTasks
    bg_tasks = BackgroundTasks()
    result = await receive_ghl_payment_mock(mock_payload, bg_tasks)
    
    return {
        **result,
        "simulated_by": current_user["name"],
        "note": "This is a simulated payment for testing purposes"
    }
