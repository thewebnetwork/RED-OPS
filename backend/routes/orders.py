"""Order management routes including messages and files"""
import uuid
import os
import base64
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Form
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
from services.email import (
    send_satisfaction_survey_email,
    send_ticket_created_email,
    send_ticket_assigned_email,
    send_ticket_picked_up_email,
    send_ticket_resolved_email,
    send_ticket_cancelled_email,
    send_pool_assignment_email,
    send_ticket_status_changed_email,
    send_ticket_pending_review_email,
    send_ticket_reopened_email,
    send_ticket_reassigned_email,
    send_ticket_closed_email
)
from config import FRONTEND_URL, CANCELLATION_REASONS

router = APIRouter(prefix="/orders", tags=["Orders"])

# File upload directory
UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


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
    # Cancellation fields
    cancellation_reason: Optional[str] = None
    cancellation_notes: Optional[str] = None
    canceled_at: Optional[str] = None
    # Resolution/Delivery fields
    resolution_notes: Optional[str] = None
    # Soft delete fields
    deleted: Optional[bool] = None
    deleted_at: Optional[str] = None
    deleted_by_name: Optional[str] = None
    deletion_reason: Optional[str] = None


class CloseOrderRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class CancelOrderRequest(BaseModel):
    reason: str = Field(..., description="Cancellation reason from predefined list")
    notes: Optional[str] = Field(None, max_length=1000, description="Optional additional notes")


class DeliverOrderRequest(BaseModel):
    resolution_notes: str = Field(..., min_length=1, max_length=2000, description="Required delivery/resolution notes")


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


# ============== CANCELLATION REASONS ==============

@router.get("/cancellation-reasons")
async def get_cancellation_reasons():
    """Get list of valid cancellation reasons"""
    return {"reasons": CANCELLATION_REASONS}


# ============== HELPER FUNCTIONS ==============

async def notify_status_change(order: dict, old_status: str, new_status: str, changed_by: dict):
    """Send notifications (in-app and email) when order status changes"""
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
        
        # Send email to requester for status changes
        requester_email = order.get("requester_email")
        requester_name = order.get("requester_name", "User")
        if requester_email and new_status in ["In Progress", "Pending", "Delivered", "Closed"]:
            try:
                if new_status == "Pending":
                    # Special email for Pending status (review required)
                    await send_ticket_pending_review_email(
                        requester_email=requester_email,
                        requester_name=requester_name,
                        resolver_name=order.get("editor_name", changed_by.get("name", "Team Member")),
                        order_code=order["order_code"],
                        title=order.get("title", ""),
                        order_id=order["id"]
                    )
                else:
                    # General status change email
                    await send_ticket_status_changed_email(
                        to_email=requester_email,
                        to_name=requester_name,
                        order_code=order["order_code"],
                        title=order.get("title", ""),
                        old_status=old_status,
                        new_status=new_status,
                        changed_by=changed_by.get("name", "System"),
                        order_id=order["id"]
                    )
            except Exception as e:
                logging.error(f"Failed to send status change email to {requester_email}: {e}")
    
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
        
        # Also send email to editor for relevant status changes
        editor = await db.users.find_one({"id": order["editor_id"]}, {"_id": 0, "email": 1, "name": 1})
        if editor and editor.get("email") and new_status in ["Canceled", "Closed"]:
            try:
                await send_ticket_status_changed_email(
                    to_email=editor["email"],
                    to_name=editor.get("name", "Team Member"),
                    order_code=order["order_code"],
                    title=order.get("title", ""),
                    old_status=old_status,
                    new_status=new_status,
                    changed_by=changed_by.get("name", "System"),
                    order_id=order["id"]
                )
            except Exception as e:
                logging.error(f"Failed to send status change email to editor: {e}")


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
        
        # Send email notification to requester
        background_tasks.add_task(
            send_ticket_created_email,
            current_user["email"],
            current_user["name"],
            order_code,
            order_data.title,
            order_data.priority,
            cat_l2_name or cat_l1_name or "General",
            order["id"]
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
        
        # Notify Pool 1 (Partners) about new ticket availability
        async def notify_pool_1():
            partners = await db.users.find(
                {"account_type": "Partner", "active": True}, 
                {"_id": 0, "email": 1, "name": 1}
            ).to_list(100)
            for partner in partners:
                await send_pool_assignment_email(
                    partner["email"],
                    partner["name"],
                    order_code,
                    order_data.title,
                    order_data.priority,
                    cat_l2_name or cat_l1_name or "General",
                    "Partner Pool (Pool 1)",
                    order["id"]
                )
        background_tasks.add_task(notify_pool_1)
    
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
    """List orders based on user role. Drafts only visible to their owner."""
    query = {}
    
    if current_user["role"] == "Requester":
        query["requester_id"] = current_user["id"]
        # Requester can see their own drafts
    elif current_user["role"] == "Editor":
        # Editors cannot see drafts, only Open and their assigned orders
        query["$or"] = [
            {"status": "Open"},
            {"editor_id": current_user["id"]}
        ]
    else:
        # Admin - exclude drafts from general view unless filtering by Draft status
        if status != "Draft":
            query["status"] = {"$ne": "Draft"}
    
    if status:
        if current_user["role"] == "Editor" and status != "Open":
            query = {"editor_id": current_user["id"], "status": status}
        elif current_user["role"] != "Editor":
            query["status"] = status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    result = []
    for order in orders:
        order = normalize_order(order)
        sla_deadline = order.get('sla_deadline')
        result.append(OrderResponse(
            **order,
            is_sla_breached=is_sla_breached(sla_deadline, order['status']) if sla_deadline else False
        ))
    
    return result


@router.get("/pool", response_model=List[OrderResponse])
async def get_order_pool(current_user: dict = Depends(require_roles(["Editor", "Admin"]))):
    """Get pool of open orders available for pickup (excludes drafts)"""
    orders = await db.orders.find({"status": "Open"}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    
    result = []
    for order in orders:
        order = normalize_order(order)
        result.append(OrderResponse(
            **order,
            is_sla_breached=is_sla_breached(order['sla_deadline'], order['status'])
        ))
    
    return result


@router.get("/my-requests", response_model=List[OrderResponse])
async def get_my_requests(current_user: dict = Depends(get_current_user)):
    """Get all requests created by the current user"""
    orders = await db.orders.find(
        {"requester_id": current_user["id"], "status": {"$ne": "Draft"}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    result = []
    for order in orders:
        order = normalize_order(order)
        result.append(OrderResponse(
            **order,
            is_sla_breached=is_sla_breached(order.get('sla_deadline'), order['status'])
        ))
    
    return result


@router.get("/my-assigned", response_model=List[OrderResponse])
async def get_my_assigned_tickets(current_user: dict = Depends(get_current_user)):
    """Get all tickets assigned to the current user (for resolvers)"""
    orders = await db.orders.find(
        {"editor_id": current_user["id"], "status": {"$nin": ["Closed", "Canceled"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    result = []
    for order in orders:
        order = normalize_order(order)
        result.append(OrderResponse(
            **order,
            is_sla_breached=is_sla_breached(order.get('sla_deadline'), order['status'])
        ))
    
    return result


@router.post("/{order_id}/force-pool-2")
async def force_ticket_to_pool_2(
    order_id: str,
    background_tasks: BackgroundTasks,
    reason: Optional[str] = None,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Admin-only: Force a ticket to Pool 2 immediately (bypass 24h right-of-first-refusal)"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != "Open":
        raise HTTPException(status_code=400, detail="Only Open tickets can be forced to Pool 2")
    
    if order.get("editor_id"):
        raise HTTPException(status_code=400, detail="Cannot force assigned tickets to pool")
    
    now = get_utc_now()
    
    # Set pool_entered_at to 25 hours ago to make it eligible for Pool 2
    forced_pool_entered = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "pool_entered_at": forced_pool_entered,
            "forced_to_pool_2": True,
            "forced_to_pool_2_at": now,
            "forced_to_pool_2_by": current_user["id"],
            "forced_to_pool_2_by_name": current_user["name"],
            "forced_to_pool_2_reason": reason,
            "pool_2_notified": False,  # Reset so vendors get notified
            "updated_at": now
        }}
    )
    
    # Log the action
    log_message = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "author_user_id": "system",
        "author_name": "System",
        "author_role": "System",
        "message_body": f"⚡ **Ticket Forced to Pool 2**\n\n**By:** {current_user['name']}\n**Reason:** {reason or 'Not specified'}",
        "created_at": now,
        "is_system_message": True
    }
    await db.order_messages.insert_one(log_message)
    
    # Trigger webhook
    background_tasks.add_task(trigger_webhooks, "order.forced_to_pool_2", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "title": order.get("title"),
        "forced_by": current_user["name"],
        "reason": reason
    })
    
    return {"message": "Ticket forced to Pool 2 successfully"}


@router.get("/pool/{pool_number}", response_model=List[OrderResponse])
async def get_pool_tickets(
    pool_number: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Get tickets in a specific pool filtered by user's specialty.
    Pool 1 = Partner pool (first 24 hours)
    Pool 2 = Vendor/Freelancer pool (after 24 hours)
    
    Filtering rules:
    - Partners/Vendors only see tickets matching their Specialty
    - Support/Issue tickets are excluded unless user has support specialty
    - Admins/Operators see all tickets
    """
    account_type = current_user.get("account_type")
    role = current_user.get("role")
    user_specialty_id = current_user.get("specialty_id")
    
    # Access control
    if pool_number == 1:
        if role not in ["Administrator", "Operator"] and account_type != "Partner":
            raise HTTPException(status_code=403, detail="Access denied to Pool 1")
    elif pool_number == 2:
        if role not in ["Administrator", "Operator"] and account_type != "Vendor/Freelancer":
            raise HTTPException(status_code=403, detail="Access denied to Pool 2")
    else:
        raise HTTPException(status_code=400, detail="Invalid pool number")
    
    # Get user's specialty info for filtering
    user_specialty = None
    if user_specialty_id:
        user_specialty = await db.specialties.find_one({"id": user_specialty_id}, {"_id": 0})
    
    # Get tickets in this pool
    now = datetime.now(timezone.utc)
    twenty_four_hours_ago = now - timedelta(hours=24)
    
    orders = await db.orders.find(
        {"status": "Open", "editor_id": None},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    result = []
    for order in orders:
        order = normalize_order(order)
        pool_entered = order.get("pool_entered_at") or order.get("created_at")
        
        try:
            if isinstance(pool_entered, str):
                pool_entered_dt = datetime.fromisoformat(pool_entered.replace('Z', '+00:00'))
            else:
                pool_entered_dt = pool_entered
        except:
            pool_entered_dt = now
        
        # Determine which pool this ticket belongs to
        in_pool_1 = pool_entered_dt > twenty_four_hours_ago
        
        # Check pool timing
        if pool_number == 1 and not in_pool_1:
            continue
        elif pool_number == 2 and in_pool_1:
            continue
        
        # Apply specialty filtering for non-admin users
        if role not in ["Administrator", "Operator"]:
            request_type = order.get("request_type", "").lower()
            category_l1_name = order.get("category_l1_name", "").lower()
            
            # Exclude Support/Issue tickets from Partners/Vendors unless they have support specialty
            is_support_ticket = (
                request_type in ["issue", "bug"] or 
                "support" in category_l1_name or 
                "issue" in category_l1_name or
                "bug" in category_l1_name
            )
            
            user_specialty_name = (user_specialty.get("name", "") if user_specialty else "").lower()
            has_support_specialty = "support" in user_specialty_name
            
            if is_support_ticket and not has_support_specialty:
                continue
            
            # If user has a specialty, optionally filter by it
            # For now, we allow all service tickets if not support
            # Can be extended to match specialty with category
        
        result.append(OrderResponse(
            **order,
            is_sla_breached=is_sla_breached(order.get('sla_deadline'), order['status'])
        ))
    
    return result


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Access control - drafts only visible to owner
    if order["status"] == "Draft" and order["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user["role"] == "Requester" and order["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Editor":
        if order["status"] not in ["Open", "Draft"] and order.get("editor_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    
    order = normalize_order(order)
    sla_deadline = order.get('sla_deadline')
    return OrderResponse(
        **order,
        is_sla_breached=is_sla_breached(sla_deadline, order['status']) if sla_deadline else False
    )


# ============== ORDER STATUS ACTIONS ==============

@router.post("/{order_id}/pick")
async def pick_order(
    order_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Pick an order from the pool"""
    # Check if user can pick orders (Partner or Vendor/Freelancer)
    account_type = current_user.get("account_type")
    role = current_user.get("role")
    
    if role not in ["Administrator", "Operator"] and account_type not in ["Partner", "Vendor/Freelancer"]:
        raise HTTPException(status_code=403, detail="Only Partners and Vendors can pick orders")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != "Open":
        raise HTTPException(status_code=400, detail="Order is not available for pickup")
    
    if order.get("editor_id"):
        raise HTTPException(status_code=400, detail="Order already assigned")
    
    # Check pool eligibility based on time
    now_dt = datetime.now(timezone.utc)
    pool_entered = order.get("pool_entered_at") or order.get("created_at")
    try:
        if isinstance(pool_entered, str):
            pool_entered_dt = datetime.fromisoformat(pool_entered.replace('Z', '+00:00'))
        else:
            pool_entered_dt = pool_entered
        hours_in_pool = (now_dt - pool_entered_dt).total_seconds() / 3600
    except:
        hours_in_pool = 0
    
    # Partners can only pick from Pool 1 (first 24 hours)
    # Vendors can only pick from Pool 2 (after 24 hours)
    if account_type == "Partner" and hours_in_pool >= 24:
        raise HTTPException(status_code=400, detail="This ticket is no longer in the Partner pool")
    if account_type == "Vendor/Freelancer" and hours_in_pool < 24:
        raise HTTPException(status_code=400, detail="This ticket is still in the Partner pool")
    
    old_status = order["status"]
    now = get_utc_now()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "editor_id": current_user["id"],
            "editor_name": current_user["name"],
            "status": "In Progress",
            "picked_at": now,
            "picked_from_pool": 1 if hours_in_pool < 24 else 2,
            "updated_at": now
        }}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    background_tasks.add_task(notify_status_change, updated_order, old_status, "In Progress", current_user)
    
    # Send email to requester that their ticket was picked up
    requester = await db.users.find_one({"id": order["requester_id"]}, {"_id": 0, "password": 0})
    if requester:
        background_tasks.add_task(
            send_ticket_picked_up_email,
            requester["email"],
            requester["name"],
            current_user["name"],
            order["order_code"],
            order.get("title", ""),
            order_id
        )
    
    # Send email to new resolver that they have been assigned
    background_tasks.add_task(
        send_ticket_assigned_email,
        current_user["email"],
        current_user["name"],
        order.get("requester_name", ""),
        order["order_code"],
        order.get("title", ""),
        order.get("priority_or_severity", "Normal"),
        order_id
    )
    
    background_tasks.add_task(trigger_webhooks, "order.status_changed", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "title": order.get("title"),
        "old_status": old_status,
        "new_status": "In Progress",
        "assigned_to": current_user["name"],
        "picked_by_account_type": account_type
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
        {"$set": {
            "status": "Pending", 
            "updated_at": now,
            "review_started_at": now  # Track when review started for auto-close logic
        }}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    background_tasks.add_task(notify_status_change, updated_order, old_status, "Pending", current_user)
    
    # Trigger workflows for pending_review event
    async def run_pending_workflows():
        workflows = await get_workflows_for_trigger(db, "order.pending_review", order.get("category_l2_id"))
        for workflow in workflows:
            await execute_workflow(db, workflow["id"], "order.pending_review", {
                "order": {**order, "status": "Pending", "review_started_at": now},
                "user": current_user
            })
    background_tasks.add_task(run_pending_workflows)
    
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
        {"$set": {
            "status": "In Progress", 
            "updated_at": now, 
            "last_responded_at": now,
            "last_requester_message_at": now,  # Track requester activity
            "review_started_at": None  # Clear review timestamp since they responded
        }}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    background_tasks.add_task(notify_status_change, updated_order, old_status, "In Progress", current_user)
    
    return {"message": "Response sent, order back to editor"}


@router.post("/{order_id}/deliver")
async def deliver_order(
    order_id: str,
    deliver_data: DeliverOrderRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["Editor"]))
):
    """Mark order as delivered - requires resolution notes"""
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
        {"$set": {
            "status": "Delivered", 
            "delivered_at": now, 
            "updated_at": now,
            "resolution_notes": deliver_data.resolution_notes
        }}
    )
    
    # Add delivery notes to timeline
    delivery_message = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "author_user_id": current_user["id"],
        "author_name": current_user["name"],
        "author_role": current_user["role"],
        "message_body": f"✅ **Delivery Notes:**\n\n{deliver_data.resolution_notes}",
        "created_at": now,
        "is_delivery_note": True
    }
    await db.order_messages.insert_one(delivery_message)
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    background_tasks.add_task(notify_status_change, updated_order, old_status, "Delivered", current_user)
    
    background_tasks.add_task(trigger_webhooks, "order.delivered", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "title": order.get("title"),
        "delivered_by": current_user["name"]
    })
    
    # Get requester for email and survey
    requester = await db.users.find_one({"id": order["requester_id"]}, {"_id": 0})
    if requester:
        # Send ticket resolved email
        background_tasks.add_task(
            send_ticket_resolved_email,
            requester["email"],
            requester["name"],
            current_user["name"],
            order["order_code"],
            order.get("title", ""),
            deliver_data.resolution_notes,
            order_id
        )
        
        # Create satisfaction survey
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
    """Allow requesters or admins to close tickets with a reason"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    is_admin = current_user["role"] in ["Admin", "Administrator"]
    is_owner = order["requester_id"] == current_user["id"]
    
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Only the requester or admin can close this order")
    
    if order["status"] in ["Closed", "Canceled"]:
        raise HTTPException(status_code=400, detail=f"Order is already {order['status'].lower()}")
    
    old_status = order["status"]
    now = get_utc_now()
    closed_by = "Admin" if is_admin and not is_owner else "Requester"
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "Closed",
            "close_reason": close_data.reason,
            "closed_at": now,
            "closed_by": closed_by,
            "closed_by_id": current_user["id"],
            "closed_by_name": current_user["name"],
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
    
    # Send close email to requester (if not the one closing)
    if order.get("requester_email") and not is_owner:
        background_tasks.add_task(
            send_ticket_closed_email,
            requester_email=order["requester_email"],
            requester_name=order.get("requester_name", "User"),
            closed_by=current_user["name"],
            order_code=order["order_code"],
            title=order.get("title", ""),
            close_reason=close_data.reason,
            order_id=order_id
        )
    
    background_tasks.add_task(trigger_webhooks, "order.closed", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "close_reason": close_data.reason,
        "closed_by": current_user["name"]
    })
    
    return {"message": "Order closed successfully"}


class ReopenOrderRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500, description="Reason for reopening")


class SoftDeleteOrderRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500, description="Reason for deletion")


# ============== SOFT DELETE / RESTORE ROUTES (Admin only) ==============

@router.delete("/{order_id}")
async def soft_delete_order(
    order_id: str,
    delete_data: SoftDeleteOrderRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Soft delete an order (Admin only). Order can be restored later."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("deleted"):
        raise HTTPException(status_code=400, detail="Order is already deleted")
    
    now = get_utc_now()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "deleted": True,
            "deleted_at": now,
            "deleted_by_id": current_user["id"],
            "deleted_by_name": current_user["name"],
            "deletion_reason": delete_data.reason,
            "updated_at": now
        }}
    )
    
    # Add deletion message to timeline
    delete_message = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "author_user_id": "system",
        "author_name": "System",
        "author_role": "System",
        "message_body": f"🗑️ **Ticket Soft-Deleted**\n\n**By:** {current_user['name']}\n**Reason:** {delete_data.reason}",
        "created_at": now,
        "is_system_message": True
    }
    await db.order_messages.insert_one(delete_message)
    
    # Notify requester
    if order.get("requester_id"):
        await create_notification(
            db,
            order["requester_id"],
            "order_deleted",
            "Your ticket has been removed",
            f"Ticket {order['order_code']} has been removed by an administrator. Reason: {delete_data.reason}",
            order_id
        )
    
    background_tasks.add_task(trigger_webhooks, "order.deleted", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "title": order.get("title"),
        "deleted_by": current_user["name"],
        "reason": delete_data.reason
    })
    
    return {"message": "Ticket soft-deleted successfully"}


@router.post("/{order_id}/restore")
async def restore_deleted_order(
    order_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Restore a soft-deleted order (Admin only)"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if not order.get("deleted"):
        raise HTTPException(status_code=400, detail="Order is not deleted")
    
    now = get_utc_now()
    
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "deleted": False,
                "restored_at": now,
                "restored_by_id": current_user["id"],
                "restored_by_name": current_user["name"],
                "updated_at": now
            },
            "$unset": {
                "deleted_at": "",
                "deleted_by_id": "",
                "deleted_by_name": "",
                "deletion_reason": ""
            }
        }
    )
    
    # Add restore message to timeline
    restore_message = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "author_user_id": "system",
        "author_name": "System",
        "author_role": "System",
        "message_body": f"♻️ **Ticket Restored**\n\n**By:** {current_user['name']}",
        "created_at": now,
        "is_system_message": True
    }
    await db.order_messages.insert_one(restore_message)
    
    # Notify requester
    if order.get("requester_id"):
        await create_notification(
            db,
            order["requester_id"],
            "order_restored",
            "Your ticket has been restored",
            f"Ticket {order['order_code']} has been restored by an administrator.",
            order_id
        )
    
    background_tasks.add_task(trigger_webhooks, "order.restored", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "title": order.get("title"),
        "restored_by": current_user["name"]
    })
    
    return {"message": "Ticket restored successfully"}


@router.get("/deleted/list", response_model=List[OrderResponse])
async def list_deleted_orders(
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """List all soft-deleted orders (Admin only)"""
    orders = await db.orders.find(
        {"deleted": True},
        {"_id": 0}
    ).sort("deleted_at", -1).to_list(1000)
    
    result = []
    for order in orders:
        order = normalize_order(order)
        result.append(OrderResponse(
            **order,
            is_sla_breached=False  # Deleted orders don't have SLA tracking
        ))
    
    return result


@router.post("/{order_id}/reopen")
async def reopen_order(
    order_id: str,
    reopen_data: ReopenOrderRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Allow Admin to reopen a closed ticket. Requesters must submit a new request."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] not in ["Closed", "Canceled"]:
        raise HTTPException(status_code=400, detail=f"Order is not closed/canceled (current: {order['status']})")
    
    old_status = order["status"]
    now = get_utc_now()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "Open",
            "reopened_at": now,
            "reopened_by_id": current_user["id"],
            "reopened_by_name": current_user["name"],
            "reopen_reason": reopen_data.reason,
            "closed_at": None,
            "close_reason": None,
            "canceled_at": None,
            "cancellation_reason": None,
            "updated_at": now
        }}
    )
    
    # Add reopen message to timeline
    reopen_message = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "author_user_id": "system",
        "author_name": "System",
        "author_role": "System",
        "message_body": f"🔄 **Ticket Reopened**\n\n**By:** {current_user['name']}\n**From:** {old_status}\n**Reason:** {reopen_data.reason}",
        "created_at": now,
        "is_system_message": True
    }
    await db.order_messages.insert_one(reopen_message)
    
    # Notify requester
    await create_notification(
        db,
        order["requester_id"],
        "order_reopened",
        "Your ticket has been reopened",
        f"Ticket {order['order_code']} '{order['title']}' has been reopened by {current_user['name']}",
        order['id']
    )
    
    # Notify previous editor if assigned
    if order.get("editor_id"):
        await create_notification(
            db,
            order["editor_id"],
            "order_reopened",
            "A ticket you worked on was reopened",
            f"Ticket {order['order_code']} has been reopened",
            order['id']
        )
    
    background_tasks.add_task(trigger_webhooks, "order.reopened", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "title": order.get("title"),
        "reopened_by": current_user["name"],
        "reason": reopen_data.reason
    })
    
    return {"message": "Order reopened successfully"}


@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    cancel_data: CancelOrderRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Allow requester to cancel their own ticket with a reason"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only requester can cancel their own ticket
    if order["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the requester can cancel this ticket")
    
    # Cannot cancel if already Delivered, Closed, or Canceled
    if order["status"] in ["Delivered", "Closed", "Canceled"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel a ticket that is already {order['status']}")
    
    old_status = order["status"]
    now = get_utc_now()
    
    # Update the order
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "Canceled",
            "cancellation_reason": cancel_data.reason,
            "cancellation_notes": cancel_data.notes,
            "canceled_at": now,
            "updated_at": now
        }}
    )
    
    # Add system log entry to timeline
    system_message = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "author_user_id": "system",
        "author_name": "System",
        "author_role": "System",
        "message_body": f"⚠️ Requester canceled this ticket.\n\n**Reason:** {cancel_data.reason}" + (f"\n**Notes:** {cancel_data.notes}" if cancel_data.notes else ""),
        "created_at": now,
        "is_system_message": True
    }
    await db.order_messages.insert_one(system_message)
    
    # Notify resolver/assignee if assigned
    if order.get("editor_id"):
        await create_notification(
            db,
            order["editor_id"],
            "order_canceled",
            "Requester canceled request",
            f"Order {order['order_code']} '{order['title']}' was canceled by the requester.\n\nReason: {cancel_data.reason}" + (f"\nNotes: {cancel_data.notes}" if cancel_data.notes else ""),
            order['id']
        )
        
        # Send email to resolver (NOT to requester, NO satisfaction survey)
        resolver = await db.users.find_one({"id": order["editor_id"]}, {"_id": 0, "password": 0})
        if resolver:
            background_tasks.add_task(
                send_ticket_cancelled_email,
                resolver["email"],
                resolver["name"],
                current_user["name"],
                order["order_code"],
                order.get("title", ""),
                cancel_data.reason,
                order_id
            )
    
    # Also notify admins of cancellation
    admins = await db.users.find({"role": "Administrator", "active": True, "id": {"$ne": current_user["id"]}}, {"_id": 0}).to_list(10)
    for admin in admins:
        background_tasks.add_task(
            send_ticket_cancelled_email,
            admin["email"],
            admin["name"],
            current_user["name"],
            order["order_code"],
            order.get("title", ""),
            cancel_data.reason,
            order_id
        )
    
    # Trigger webhook
    background_tasks.add_task(trigger_webhooks, "order.status_changed", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "old_status": old_status,
        "new_status": "Canceled",
        "cancellation_reason": cancel_data.reason,
        "canceled_by": current_user["name"]
    })
    
    return {"message": "Ticket canceled successfully"}


# ============== REASSIGN ROUTES ==============

class ReassignRequest(BaseModel):
    reassign_type: Literal["user", "team", "specialty"] = Field(..., description="Type of reassignment")
    target_id: str = Field(..., description="ID of user, team, or specialty to reassign to")
    reason: Optional[str] = Field(None, max_length=500, description="Optional reason for reassignment")


@router.post("/{order_id}/reassign")
async def reassign_order(
    order_id: str,
    reassign_data: ReassignRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Reassign a ticket to another user, team, or specialty.
    Only available to: assigned resolver, Admin, Operator
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check permission - must be admin, operator, or current resolver
    is_admin = current_user["role"] == "Administrator"
    is_operator = current_user["role"] == "Operator"
    is_resolver = order.get("editor_id") == current_user["id"]
    
    if not (is_admin or is_operator or is_resolver):
        raise HTTPException(status_code=403, detail="Only admins, operators, or the assigned resolver can reassign")
    
    # Cannot reassign closed/canceled/delivered tickets
    if order["status"] in ["Closed", "Canceled", "Delivered"]:
        raise HTTPException(status_code=400, detail=f"Cannot reassign a {order['status'].lower()} ticket")
    
    now = get_utc_now()
    old_editor_id = order.get("editor_id")
    old_editor_name = order.get("editor_name")
    
    update_data = {"updated_at": now}
    new_editor_id = None
    new_editor_name = None
    reassign_target_label = ""
    
    if reassign_data.reassign_type == "user":
        # Reassign to a specific user
        target_user = await db.users.find_one({"id": reassign_data.target_id, "active": True}, {"_id": 0, "password": 0})
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found or inactive")
        
        new_editor_id = target_user["id"]
        new_editor_name = target_user["name"]
        reassign_target_label = f"user: {new_editor_name}"
        
        update_data["editor_id"] = new_editor_id
        update_data["editor_name"] = new_editor_name
        # If was Open, move to In Progress since it's now assigned
        if order["status"] == "Open":
            update_data["status"] = "In Progress"
            update_data["picked_at"] = now
        
    elif reassign_data.reassign_type == "team":
        # Reassign to a team - unassign current resolver, ticket goes back to pool
        target_team = await db.teams.find_one({"id": reassign_data.target_id, "active": True}, {"_id": 0})
        if not target_team:
            raise HTTPException(status_code=404, detail="Target team not found or inactive")
        
        reassign_target_label = f"team: {target_team['name']}"
        
        # Unassign and set team preference
        update_data["editor_id"] = None
        update_data["editor_name"] = None
        update_data["preferred_team_id"] = target_team["id"]
        update_data["preferred_team_name"] = target_team["name"]
        # Move back to Open if it was In Progress
        if order["status"] == "In Progress":
            update_data["status"] = "Open"
        
    elif reassign_data.reassign_type == "specialty":
        # Reassign to a specialty pool - unassign current resolver
        target_specialty = await db.specialties.find_one({"id": reassign_data.target_id, "active": True}, {"_id": 0})
        if not target_specialty:
            raise HTTPException(status_code=404, detail="Target specialty not found or inactive")
        
        reassign_target_label = f"specialty: {target_specialty['name']}"
        
        # Unassign and set specialty preference
        update_data["editor_id"] = None
        update_data["editor_name"] = None
        update_data["preferred_specialty_id"] = target_specialty["id"]
        update_data["preferred_specialty_name"] = target_specialty["name"]
        # Move back to Open if it was In Progress
        if order["status"] == "In Progress":
            update_data["status"] = "Open"
    
    # Update the order
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    # Log the reassignment in order_messages (activity log)
    log_message = f"🔄 **Ticket Reassigned**\n\n" \
                  f"**From:** {old_editor_name or 'Unassigned'}\n" \
                  f"**To:** {reassign_target_label}\n" \
                  f"**By:** {current_user['name']}"
    if reassign_data.reason:
        log_message += f"\n**Reason:** {reassign_data.reason}"
    
    reassign_log = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "author_user_id": "system",
        "author_name": "System",
        "author_role": "System",
        "message_body": log_message,
        "created_at": now,
        "is_system_message": True,
        "reassignment_info": {
            "type": reassign_data.reassign_type,
            "from_user_id": old_editor_id,
            "from_user_name": old_editor_name,
            "to_id": reassign_data.target_id,
            "to_label": reassign_target_label,
            "by_user_id": current_user["id"],
            "by_user_name": current_user["name"],
            "reason": reassign_data.reason
        }
    }
    await db.order_messages.insert_one(reassign_log)
    
    # Notify relevant parties
    # Notify old resolver if they didn't do the reassign
    if old_editor_id and old_editor_id != current_user["id"]:
        await create_notification(
            db,
            old_editor_id,
            "order_reassigned",
            "Ticket reassigned",
            f"Ticket {order['order_code']} has been reassigned from you to {reassign_target_label}",
            order_id
        )
    
    # Notify new resolver if assigned to a specific user
    if new_editor_id and new_editor_id != current_user["id"]:
        await create_notification(
            db,
            new_editor_id,
            "order_assigned",
            "Ticket assigned to you",
            f"Ticket {order['order_code']} '{order['title']}' has been assigned to you",
            order_id
        )
    
    # Notify requester
    if order.get("requester_id") and order["requester_id"] != current_user["id"]:
        await create_notification(
            db,
            order["requester_id"],
            "order_reassigned",
            "Your ticket has been reassigned",
            f"Your ticket {order['order_code']} has been reassigned to {reassign_target_label}",
            order_id
        )
    
    # Trigger webhook
    background_tasks.add_task(trigger_webhooks, "order.reassigned", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "title": order.get("title"),
        "from_user": old_editor_name,
        "to": reassign_target_label,
        "reassign_type": reassign_data.reassign_type,
        "reassigned_by": current_user["name"],
        "reason": reassign_data.reason
    })
    
    return {
        "message": f"Ticket reassigned to {reassign_target_label}",
        "reassignment": {
            "type": reassign_data.reassign_type,
            "from": old_editor_name,
            "to": reassign_target_label
        }
    }


@router.get("/{order_id}/reassign-options")
async def get_reassign_options(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get available users, teams, and specialties for reassignment"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get active users (excluding the current requester)
    users = await db.users.find(
        {"active": True, "id": {"$ne": order.get("requester_id")}},
        {"_id": 0, "password": 0}
    ).to_list(500)
    
    # Get active teams
    teams = await db.teams.find({"active": True}, {"_id": 0}).to_list(100)
    
    # Get active specialties
    specialties = await db.specialties.find({"active": True}, {"_id": 0}).to_list(100)
    
    return {
        "users": [{"id": u["id"], "name": u["name"], "role": u.get("role"), "specialty_name": u.get("specialty_name")} for u in users],
        "teams": [{"id": t["id"], "name": t["name"]} for t in teams],
        "specialties": [{"id": s["id"], "name": s["name"]} for s in specialties]
    }


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
    
    now = get_utc_now()
    message = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "author_user_id": current_user["id"],
        "author_name": current_user["name"],
        "author_role": current_user["role"],
        "message_body": message_data.message_body,
        "created_at": now
    }
    await db.order_messages.insert_one(message)
    
    # If requester sends a message while order is Pending, update last_requester_message_at
    # This is used by the review reminder workflow to check if requester has responded
    if is_requester and order["status"] == "Pending":
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"last_requester_message_at": now}}
        )
    
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

@router.post("/{order_id}/files/upload")
async def upload_file(
    order_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file attachment to an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Create order-specific upload directory
    order_upload_dir = os.path.join(UPLOAD_DIR, order_id)
    os.makedirs(order_upload_dir, exist_ok=True)
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ''
    stored_filename = f"{file_id}{file_ext}"
    file_path = os.path.join(order_upload_dir, stored_filename)
    
    # Save file to disk
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Create file record in DB
    file_doc = {
        "id": file_id,
        "order_id": order_id,
        "uploaded_by_user_id": current_user["id"],
        "uploaded_by_name": current_user["name"],
        "file_type": "Attachment",
        "label": file.filename or "Attachment",
        "url": f"/api/orders/{order_id}/files/{file_id}/download",
        "original_filename": file.filename,
        "stored_filename": stored_filename,
        "content_type": file.content_type,
        "is_final_delivery": False,
        "created_at": get_utc_now()
    }
    await db.order_files.insert_one(file_doc)
    
    return {
        "id": file_id,
        "label": file.filename,
        "url": file_doc["url"],
        "message": "File uploaded successfully"
    }


@router.get("/{order_id}/files/{file_id}/download")
async def download_file(
    order_id: str,
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download a file attachment"""
    from fastapi.responses import FileResponse as FastAPIFileResponse
    
    file_doc = await db.order_files.find_one({"id": file_id, "order_id": order_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    stored_filename = file_doc.get("stored_filename")
    if not stored_filename:
        raise HTTPException(status_code=404, detail="File storage info missing")
    
    file_path = os.path.join(UPLOAD_DIR, order_id, stored_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FastAPIFileResponse(
        path=file_path,
        filename=file_doc.get("original_filename", stored_filename),
        media_type=file_doc.get("content_type", "application/octet-stream")
    )


@router.post("/{order_id}/files", response_model=FileResponse)
async def create_file(
    order_id: str,
    file_data: FileCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a file reference to an order (for external URLs)"""
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
