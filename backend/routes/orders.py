"""Order management routes including messages and files"""
import uuid
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Literal

from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import (
    get_utc_now, get_utc_now_dt, calculate_sla_deadline, 
    is_sla_breached, normalize_order, get_next_code, create_notification
)
from services.webhooks import trigger_webhooks
from services.workflow_engine import get_workflows_for_trigger, execute_workflow
from services.email import send_satisfaction_survey_email
from config import FRONTEND_URL

router = APIRouter(prefix="/orders", tags=["Orders"])


# ============== MODELS ==============

class OrderCreate(BaseModel):
    title: str
    category_l1_id: Optional[str] = None
    category_l2_id: Optional[str] = None
    priority: Literal["Low", "Normal", "High", "Urgent"] = "Normal"
    description: str
    video_script: Optional[str] = None
    reference_links: Optional[str] = None
    footage_links: Optional[str] = None
    music_preference: Optional[str] = None
    delivery_format: Optional[str] = None
    special_instructions: Optional[str] = None
    is_draft: bool = False  # If true, save as Draft instead of Open


class OrderResponse(BaseModel):
    id: str
    order_code: str
    request_type: str
    requester_id: str
    requester_name: str
    requester_email: str
    editor_id: Optional[str] = None
    editor_name: Optional[str] = None
    title: str
    category_l1_id: Optional[str] = None
    category_l1_name: Optional[str] = None
    category_l2_id: Optional[str] = None
    category_l2_name: Optional[str] = None
    status: str
    priority: str
    description: str
    video_script: Optional[str] = None
    reference_links: Optional[str] = None
    footage_links: Optional[str] = None
    music_preference: Optional[str] = None
    delivery_format: Optional[str] = None
    special_instructions: Optional[str] = None
    close_reason: Optional[str] = None
    closed_at: Optional[str] = None
    sla_deadline: Optional[str] = None  # None for drafts
    is_sla_breached: bool
    created_at: str
    updated_at: str
    picked_at: Optional[str] = None
    delivered_at: Optional[str] = None
    review_started_at: Optional[str] = None  # When status changed to Pending
    last_requester_message_at: Optional[str] = None  # Last message from requester


class CloseOrderRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class MessageCreate(BaseModel):
    message_body: str


class MessageResponse(BaseModel):
    id: str
    order_id: str
    author_user_id: str
    author_name: str
    author_role: str
    message_body: str
    created_at: str


class FileCreate(BaseModel):
    file_type: Literal["Raw Footage", "Reference", "Export", "Final Delivery", "Screenshot", "Attachment", "Other"]
    label: str
    url: str


class FileResponse(BaseModel):
    id: str
    order_id: str
    uploaded_by_user_id: str
    uploaded_by_name: str
    file_type: str
    label: str
    url: str
    is_final_delivery: bool
    created_at: str


# ============== HELPER FUNCTIONS ==============

async def notify_status_change(order: dict, old_status: str, new_status: str, changed_by: dict):
    """Send notifications when order status changes"""
    # Notify requester
    if order.get("requester_id") and order["requester_id"] != changed_by["id"]:
        await create_notification(
            db,
            order["requester_id"],
            "status_change",
            f"Order {old_status} → {new_status}",
            f"Your order {order['order_code']} status changed from {old_status} to {new_status}",
            order["id"]
        )
    
    # Notify editor if assigned and not the one who made the change
    if order.get("editor_id") and order["editor_id"] != changed_by["id"]:
        await create_notification(
            db,
            order["editor_id"],
            "status_change",
            f"Order {old_status} → {new_status}",
            f"Order {order['order_code']} status changed from {old_status} to {new_status}",
            order["id"]
        )


# ============== ORDER CRUD ROUTES ==============

@router.post("", response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["Requester", "Admin"]))
):
    """Create a new order (or save as draft)"""
    order_code = await get_next_code(db, "order_code", "RRG")
    created_at = get_utc_now_dt()
    
    # Drafts don't get SLA deadline until submitted
    is_draft = getattr(order_data, 'is_draft', False)
    sla_deadline = None if is_draft else calculate_sla_deadline(created_at)
    initial_status = "Draft" if is_draft else "Open"
    
    # Get category names
    cat_l1_name = None
    cat_l2_name = None
    if order_data.category_l1_id:
        l1 = await db.categories_l1.find_one({"id": order_data.category_l1_id}, {"_id": 0})
        cat_l1_name = l1["name"] if l1 else None
    if order_data.category_l2_id:
        l2 = await db.categories_l2.find_one({"id": order_data.category_l2_id}, {"_id": 0})
        cat_l2_name = l2["name"] if l2 else None
    
    order = {
        "id": str(uuid.uuid4()),
        "order_code": order_code,
        "request_type": "Editing",
        "requester_id": current_user["id"],
        "requester_name": current_user["name"],
        "requester_email": current_user["email"],
        "editor_id": None,
        "editor_name": None,
        "title": order_data.title,
        "category_l1_id": order_data.category_l1_id,
        "category_l1_name": cat_l1_name,
        "category_l2_id": order_data.category_l2_id,
        "category_l2_name": cat_l2_name,
        "status": initial_status,
        "priority": order_data.priority,
        "description": order_data.description,
        "video_script": order_data.video_script,
        "reference_links": order_data.reference_links,
        "footage_links": order_data.footage_links,
        "music_preference": order_data.music_preference,
        "delivery_format": order_data.delivery_format,
        "special_instructions": order_data.special_instructions,
        "sla_deadline": sla_deadline.isoformat() if sla_deadline else None,
        "created_at": created_at.isoformat(),
        "updated_at": created_at.isoformat(),
        "picked_at": None,
        "delivered_at": None,
        "last_responded_at": None,
        "review_started_at": None,
        "last_requester_message_at": None
    }
    await db.orders.insert_one(order)
    
    # Only notify/trigger workflows for non-draft orders
    if not is_draft:
        # Notify editors
        editors = await db.users.find({"role": "Editor", "active": True}, {"_id": 0}).to_list(100)
        for editor in editors:
            await create_notification(
                db,
                editor['id'],
                "new_order",
                "New request available",
                f"New editing request {order_code} '{order_data.title}' is available for pickup",
                order['id']
            )
        
        # Trigger webhooks
        background_tasks.add_task(trigger_webhooks, "order.created", {
            "order_id": order["id"],
            "order_code": order_code,
            "title": order_data.title,
            "requester_name": current_user["name"],
            "requester_email": current_user["email"],
            "category": cat_l2_name or cat_l1_name,
            "priority": order_data.priority,
            "status": "Open"
        })
        
        # Execute workflows triggered by order.created
        async def run_workflows():
            workflows = await get_workflows_for_trigger(db, "order.created", order_data.category_l2_id)
            for workflow in workflows:
                await execute_workflow(db, workflow["id"], "order.created", {
                    "order": order,
                    "user": current_user
                })
        background_tasks.add_task(run_workflows)
    
    return OrderResponse(
        **{k: v for k, v in order.items() if k != '_id'},
        is_sla_breached=False
    )


@router.post("/{order_id}/submit", response_model=OrderResponse)
async def submit_draft(
    order_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Submit a draft order - converts Draft to Open status"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only requester can submit their own draft
    if order["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only submit your own drafts")
    
    if order["status"] != "Draft":
        raise HTTPException(status_code=400, detail="Only draft orders can be submitted")
    
    now = get_utc_now_dt()
    sla_deadline = calculate_sla_deadline(now)
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "Open",
            "sla_deadline": sla_deadline.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    # Now notify editors since the order is officially submitted
    editors = await db.users.find({"role": "Editor", "active": True}, {"_id": 0}).to_list(100)
    for editor in editors:
        await create_notification(
            db,
            editor['id'],
            "new_order",
            "New request available",
            f"New editing request {order['order_code']} '{order['title']}' is available for pickup",
            order['id']
        )
    
    # Trigger webhooks for order.submitted (and order.created for backwards compat)
    background_tasks.add_task(trigger_webhooks, "order.created", {
        "order_id": order["id"],
        "order_code": order["order_code"],
        "title": order["title"],
        "requester_name": order["requester_name"],
        "requester_email": order["requester_email"],
        "category": order.get("category_l2_name") or order.get("category_l1_name"),
        "priority": order["priority"],
        "status": "Open"
    })
    
    # Execute workflows triggered by order.created
    async def run_workflows():
        workflows = await get_workflows_for_trigger(db, "order.created", order.get("category_l2_id"))
        for workflow in workflows:
            order["status"] = "Open"  # Update status for workflow context
            await execute_workflow(db, workflow["id"], "order.created", {
                "order": order,
                "user": current_user
            })
    background_tasks.add_task(run_workflows)
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    updated_order = normalize_order(updated_order)
    return OrderResponse(
        **updated_order,
        is_sla_breached=False
    )


@router.put("/{order_id}/draft", response_model=OrderResponse)
async def update_draft(
    order_id: str,
    order_data: OrderCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a draft order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only requester can update their own draft
    if order["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only update your own drafts")
    
    if order["status"] != "Draft":
        raise HTTPException(status_code=400, detail="Only draft orders can be updated this way")
    
    # Get category names
    cat_l1_name = None
    cat_l2_name = None
    if order_data.category_l1_id:
        l1 = await db.categories_l1.find_one({"id": order_data.category_l1_id}, {"_id": 0})
        cat_l1_name = l1["name"] if l1 else None
    if order_data.category_l2_id:
        l2 = await db.categories_l2.find_one({"id": order_data.category_l2_id}, {"_id": 0})
        cat_l2_name = l2["name"] if l2 else None
    
    now = get_utc_now()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "title": order_data.title,
            "description": order_data.description,
            "category_l1_id": order_data.category_l1_id,
            "category_l1_name": cat_l1_name,
            "category_l2_id": order_data.category_l2_id,
            "category_l2_name": cat_l2_name,
            "priority": order_data.priority,
            "video_script": order_data.video_script,
            "reference_links": order_data.reference_links,
            "footage_links": order_data.footage_links,
            "music_preference": order_data.music_preference,
            "delivery_format": order_data.delivery_format,
            "special_instructions": order_data.special_instructions,
            "updated_at": now
        }}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    updated_order = normalize_order(updated_order)
    return OrderResponse(
        **updated_order,
        is_sla_breached=False
    )


@router.get("", response_model=List[OrderResponse])
async def list_orders(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List orders based on user role"""
    query = {}
    
    if current_user["role"] == "Requester":
        query["requester_id"] = current_user["id"]
    elif current_user["role"] == "Editor":
        query["$or"] = [
            {"status": "Open"},
            {"editor_id": current_user["id"]}
        ]
    
    if status:
        if current_user["role"] == "Editor" and status != "Open":
            query = {"editor_id": current_user["id"], "status": status}
        elif current_user["role"] != "Editor":
            query["status"] = status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    result = []
    for order in orders:
        order = normalize_order(order)
        result.append(OrderResponse(
            **order,
            is_sla_breached=is_sla_breached(order['sla_deadline'], order['status'])
        ))
    
    return result


@router.get("/pool", response_model=List[OrderResponse])
async def get_order_pool(current_user: dict = Depends(require_roles(["Editor", "Admin"]))):
    """Get pool of open orders available for pickup"""
    orders = await db.orders.find({"status": "Open"}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    
    result = []
    for order in orders:
        order = normalize_order(order)
        result.append(OrderResponse(
            **order,
            is_sla_breached=is_sla_breached(order['sla_deadline'], order['status'])
        ))
    
    return result


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Access control
    if current_user["role"] == "Requester" and order["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Editor":
        if order["status"] != "Open" and order.get("editor_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    
    order = normalize_order(order)
    return OrderResponse(
        **order,
        is_sla_breached=is_sla_breached(order['sla_deadline'], order['status'])
    )


# ============== ORDER STATUS ACTIONS ==============

@router.post("/{order_id}/pick")
async def pick_order(
    order_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["Editor"]))
):
    """Pick an order from the pool"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != "Open":
        raise HTTPException(status_code=400, detail="Order is not available for pickup")
    
    old_status = order["status"]
    now = get_utc_now()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "editor_id": current_user["id"],
            "editor_name": current_user["name"],
            "status": "In Progress",
            "picked_at": now,
            "updated_at": now
        }}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    background_tasks.add_task(notify_status_change, updated_order, old_status, "In Progress", current_user)
    
    background_tasks.add_task(trigger_webhooks, "order.status_changed", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "title": order.get("title"),
        "old_status": old_status,
        "new_status": "In Progress",
        "assigned_to": current_user["name"]
    })
    
    return {"message": "Order picked successfully", "order_code": order["order_code"]}


@router.post("/{order_id}/submit-for-review")
async def submit_for_review(
    order_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["Editor"]))
):
    """Submit order for requester review"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("editor_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="This order is not assigned to you")
    
    if order["status"] != "In Progress":
        raise HTTPException(status_code=400, detail="Order must be In Progress to submit for review")
    
    old_status = order["status"]
    now = get_utc_now()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "Pending", "updated_at": now}}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    background_tasks.add_task(notify_status_change, updated_order, old_status, "Pending", current_user)
    
    return {"message": "Order submitted for review"}


@router.post("/{order_id}/respond")
async def respond_to_order(
    order_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["Requester"]))
):
    """Requester responds to pending order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="This is not your order")
    
    if order["status"] != "Pending":
        raise HTTPException(status_code=400, detail="Order must be Pending to respond")
    
    old_status = order["status"]
    now = get_utc_now()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "In Progress", "updated_at": now, "last_responded_at": now}}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    background_tasks.add_task(notify_status_change, updated_order, old_status, "In Progress", current_user)
    
    return {"message": "Response sent, order back to editor"}


@router.post("/{order_id}/deliver")
async def deliver_order(
    order_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["Editor"]))
):
    """Mark order as delivered"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("editor_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="This order is not assigned to you")
    
    final_file = await db.order_files.find_one({"order_id": order_id, "is_final_delivery": True})
    if not final_file:
        raise HTTPException(status_code=400, detail="Please upload and mark a final delivery file before delivering")
    
    old_status = order["status"]
    now = get_utc_now()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "Delivered", "delivered_at": now, "updated_at": now}}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    background_tasks.add_task(notify_status_change, updated_order, old_status, "Delivered", current_user)
    
    background_tasks.add_task(trigger_webhooks, "order.delivered", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "title": order.get("title"),
        "delivered_by": current_user["name"]
    })
    
    # Create satisfaction survey
    requester = await db.users.find_one({"id": order["requester_id"]}, {"_id": 0})
    if requester:
        survey_token = str(uuid.uuid4())
        survey = {
            "id": str(uuid.uuid4()),
            "token": survey_token,
            "order_id": order_id,
            "requester_id": order["requester_id"],
            "resolver_id": current_user["id"],
            "completed": False,
            "created_at": get_utc_now()
        }
        await db.rating_surveys.insert_one(survey)
        
        survey_link = f"{FRONTEND_URL}/rate?token={survey_token}"
        background_tasks.add_task(
            send_satisfaction_survey_email,
            requester["email"],
            requester["name"],
            current_user["name"],
            order["order_code"],
            order["title"],
            survey_link
        )
    
    return {"message": "Order delivered successfully"}


@router.post("/{order_id}/close")
async def close_order(
    order_id: str,
    close_data: CloseOrderRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Allow requesters to close their own tickets with a reason"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["requester_id"] != current_user["id"] and current_user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Only the requester can close this order")
    
    if order["status"] == "Closed":
        raise HTTPException(status_code=400, detail="Order is already closed")
    
    old_status = order["status"]
    now = get_utc_now()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "Closed",
            "close_reason": close_data.reason,
            "closed_at": now,
            "updated_at": now
        }}
    )
    
    # Notify editor if assigned
    if order.get("editor_id"):
        await create_notification(
            db,
            order["editor_id"],
            "order_closed",
            "Order closed by requester",
            f"Order {order['order_code']} '{order['title']}' was closed. Reason: {close_data.reason}",
            order['id']
        )
    
    background_tasks.add_task(trigger_webhooks, "order.closed", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "close_reason": close_data.reason,
        "closed_by": current_user["name"]
    })
    
    return {"message": "Order closed successfully"}


# ============== MESSAGE ROUTES ==============

@router.post("/{order_id}/messages", response_model=MessageResponse)
async def create_message(
    order_id: str,
    message_data: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a message to an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Access control
    is_requester = order["requester_id"] == current_user["id"]
    is_resolver = order.get("editor_id") == current_user["id"]
    is_admin = current_user["role"] == "Admin"
    
    if not (is_requester or is_resolver or is_admin):
        raise HTTPException(status_code=403, detail="Access denied")
    
    message = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "author_user_id": current_user["id"],
        "author_name": current_user["name"],
        "author_role": current_user["role"],
        "message_body": message_data.message_body,
        "created_at": get_utc_now()
    }
    await db.order_messages.insert_one(message)
    
    # Send notifications
    preview = message_data.message_body[:50] + ('...' if len(message_data.message_body) > 50 else '')
    
    if is_requester:
        if order.get("editor_id"):
            await create_notification(
                db,
                order["editor_id"],
                "new_message",
                "New message on your ticket",
                f"{current_user['name']} sent a message on ticket {order['order_code']}: \"{preview}\"",
                order_id
            )
    else:
        if order.get("requester_id"):
            sender_label = "Your resolver" if is_resolver else "Admin"
            await create_notification(
                db,
                order["requester_id"],
                "new_message",
                "New message on your request",
                f"{sender_label} sent a message on request {order['order_code']}: \"{preview}\"",
                order_id
            )
    
    return MessageResponse(**message)


@router.get("/{order_id}/messages", response_model=List[MessageResponse])
async def list_messages(order_id: str, current_user: dict = Depends(get_current_user)):
    """List messages for an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    messages = await db.order_messages.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return [MessageResponse(**m) for m in messages]


# ============== FILE ROUTES ==============

@router.post("/{order_id}/files", response_model=FileResponse)
async def create_file(
    order_id: str,
    file_data: FileCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a file to an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    file_doc = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "uploaded_by_user_id": current_user["id"],
        "uploaded_by_name": current_user["name"],
        "file_type": file_data.file_type,
        "label": file_data.label,
        "url": file_data.url,
        "is_final_delivery": False,
        "created_at": get_utc_now()
    }
    await db.order_files.insert_one(file_doc)
    
    return FileResponse(**file_doc)


@router.get("/{order_id}/files", response_model=List[FileResponse])
async def list_files(order_id: str, current_user: dict = Depends(get_current_user)):
    """List files for an order"""
    files = await db.order_files.find({"order_id": order_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [FileResponse(**f) for f in files]


@router.patch("/{order_id}/files/{file_id}/mark-final")
async def mark_file_as_final(
    order_id: str,
    file_id: str,
    current_user: dict = Depends(require_roles(["Editor", "Admin"]))
):
    """Mark a file as final delivery"""
    await db.order_files.update_many({"order_id": order_id}, {"$set": {"is_final_delivery": False}})
    await db.order_files.update_one({"id": file_id}, {"$set": {"is_final_delivery": True}})
    return {"message": "File marked as final delivery"}
