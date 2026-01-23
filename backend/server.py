from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
SECRET_KEY = os.environ.get('JWT_SECRET', 'red-ribbon-ops-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# SLA Config
SLA_DAYS = 7

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

app = FastAPI(title="Red Ribbon Ops Portal API")
api_router = APIRouter(prefix="/api")

# ============== ENUMS ==============
USER_ROLES = ["Admin", "Editor", "Requester"]
ORDER_STATUSES = ["Open", "In Progress", "Pending", "Delivered"]
ORDER_CATEGORIES = ["Video Editing", "Reel Batch", "Listing Video", "Marketplace Service", "Videography", "Other"]
PRIORITIES = ["Low", "Normal", "High", "Urgent"]

# ============== MODELS ==============

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["Admin", "Editor", "Requester"]

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[Literal["Admin", "Editor", "Requester"]] = None
    active: Optional[bool] = None

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    active: bool
    created_at: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

class OrderCreate(BaseModel):
    title: str
    category: Literal["Video Editing", "Reel Batch", "Listing Video", "Marketplace Service", "Videography", "Other"] = "Video Editing"
    priority: Literal["Low", "Normal", "High", "Urgent"] = "Normal"
    description: str
    video_script: Optional[str] = None
    reference_links: Optional[str] = None
    footage_links: Optional[str] = None
    music_preference: Optional[str] = None
    delivery_format: Optional[str] = None
    special_instructions: Optional[str] = None

class OrderUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    description: Optional[str] = None
    video_script: Optional[str] = None
    reference_links: Optional[str] = None
    footage_links: Optional[str] = None
    music_preference: Optional[str] = None
    delivery_format: Optional[str] = None
    special_instructions: Optional[str] = None

class OrderResponse(BaseModel):
    id: str
    order_code: str
    requester_id: str
    requester_name: str
    requester_email: str
    editor_id: Optional[str] = None
    editor_name: Optional[str] = None
    title: str
    category: str
    status: str
    priority: str
    description: str
    video_script: Optional[str] = None
    reference_links: Optional[str] = None
    footage_links: Optional[str] = None
    music_preference: Optional[str] = None
    delivery_format: Optional[str] = None
    special_instructions: Optional[str] = None
    sla_deadline: str
    is_sla_breached: bool
    created_at: str
    updated_at: str
    picked_at: Optional[str] = None
    delivered_at: Optional[str] = None

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
    file_type: Literal["Raw Footage", "Reference", "Export", "Final Delivery", "Other"]
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

class DashboardStats(BaseModel):
    open_count: int
    in_progress_count: int
    pending_count: int
    delivered_count: int
    sla_breaching_count: int
    orders_responded_count: int = 0

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    related_order_id: Optional[str] = None
    is_read: bool
    created_at: str

# ============== HELPERS ==============

def get_utc_now():
    return datetime.now(timezone.utc).isoformat()

def get_utc_now_dt():
    return datetime.now(timezone.utc)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def calculate_sla_deadline(created_at: datetime) -> datetime:
    return created_at + timedelta(days=SLA_DAYS)

def is_sla_breached(sla_deadline: str, status: str) -> bool:
    if status == "Delivered":
        return False
    deadline = datetime.fromisoformat(sla_deadline.replace('Z', '+00:00'))
    return datetime.now(timezone.utc) > deadline

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("active", True):
            raise HTTPException(status_code=401, detail="User is deactivated")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(allowed_roles: List[str]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

async def get_next_order_code():
    counter = await db.counters.find_one_and_update(
        {"_id": "order_code"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"RRG-{str(counter['seq']).zfill(6)}"

async def create_notification(user_id: str, type: str, title: str, message: str, related_order_id: str = None):
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

async def send_email_notification(to_email: str, subject: str, body: str):
    """Send email notification - uses SMTP settings from env"""
    smtp_host = os.environ.get('SMTP_HOST', '')
    smtp_port = os.environ.get('SMTP_PORT', '587')
    smtp_user = os.environ.get('SMTP_USER', '')
    smtp_password = os.environ.get('SMTP_PASSWORD', '')
    smtp_from = os.environ.get('SMTP_FROM', 'info@redribbonrealty.ca')
    
    if not smtp_host or not smtp_user:
        logging.info(f"Email notification (SMTP not configured): To: {to_email}, Subject: {subject}")
        return False
    
    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_from
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        with smtplib.SMTP(smtp_host, int(smtp_port)) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        
        logging.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logging.error(f"Failed to send email: {e}")
        return False

async def notify_status_change(order: dict, old_status: str, new_status: str, changed_by: dict):
    """Send notifications when order status changes"""
    order_code = order['order_code']
    title = order['title']
    
    # Get requester
    requester = await db.users.find_one({"id": order['requester_id']}, {"_id": 0})
    
    # Get editor if assigned
    editor = None
    if order.get('editor_id'):
        editor = await db.users.find_one({"id": order['editor_id']}, {"_id": 0})
    
    # Notify based on status change
    if new_status == "In Progress" and old_status == "Open":
        # Editor picked the order - notify requester
        if requester:
            await create_notification(
                requester['id'], 
                "order_picked",
                "Your order has been picked up",
                f"Order {order_code} '{title}' is now being worked on by {changed_by['name']}",
                order['id']
            )
            await send_email_notification(
                requester['email'],
                f"[Red Ribbon Ops] Order {order_code} In Progress",
                f"<p>Hi {requester['name']},</p><p>Your order <strong>{order_code}</strong> - {title} is now being worked on.</p><p>Editor: {changed_by['name']}</p>"
            )
    
    elif new_status == "Pending":
        # Editor sent for review - notify requester
        if requester:
            await create_notification(
                requester['id'],
                "review_needed",
                "Order needs your review",
                f"Order {order_code} '{title}' is pending your review",
                order['id']
            )
            await send_email_notification(
                requester['email'],
                f"[Red Ribbon Ops] Order {order_code} Needs Your Review",
                f"<p>Hi {requester['name']},</p><p>Your order <strong>{order_code}</strong> - {title} needs your review.</p><p>Please log in to review and respond.</p>"
            )
    
    elif new_status == "In Progress" and old_status == "Pending":
        # Requester responded - notify editor
        if editor:
            await create_notification(
                editor['id'],
                "order_responded",
                "Requester has responded",
                f"Order {order_code} '{title}' has been responded to by the requester",
                order['id']
            )
            await send_email_notification(
                editor['email'],
                f"[Red Ribbon Ops] Order {order_code} Response Received",
                f"<p>Hi {editor['name']},</p><p>The requester has responded to order <strong>{order_code}</strong> - {title}.</p><p>Please review and continue working.</p>"
            )
    
    elif new_status == "Delivered":
        # Order delivered - notify requester
        if requester:
            await create_notification(
                requester['id'],
                "order_delivered",
                "Order delivered!",
                f"Order {order_code} '{title}' has been delivered",
                order['id']
            )
            await send_email_notification(
                requester['email'],
                f"[Red Ribbon Ops] Order {order_code} Delivered!",
                f"<p>Hi {requester['name']},</p><p>Your order <strong>{order_code}</strong> - {title} has been delivered!</p><p>Please log in to download your files.</p>"
            )
    
    # Notify admins of all status changes
    admins = await db.users.find({"role": "Admin", "active": True}, {"_id": 0}).to_list(100)
    for admin in admins:
        if admin['id'] != changed_by['id']:
            await create_notification(
                admin['id'],
                "status_change",
                f"Order status changed",
                f"Order {order_code} changed from {old_status} to {new_status} by {changed_by['name']}",
                order['id']
            )

# ============== AUTH ROUTES ==============

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user = await db.users.find_one({"email": request.email.lower()}, {"_id": 0})
    if not user or not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("active", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    return LoginResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            active=user.get("active", True),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        active=user.get("active", True),
        created_at=user["created_at"]
    )

# ============== USER ROUTES (Admin only) ==============

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_roles(["Admin"]))):
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user = {
        "id": str(uuid.uuid4()),
        "name": user_data.name,
        "email": user_data.email.lower(),
        "password": hash_password(user_data.password),
        "role": user_data.role,
        "active": True,
        "created_at": get_utc_now()
    }
    await db.users.insert_one(user)
    return UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        active=user["active"],
        created_at=user["created_at"]
    )

@api_router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(require_roles(["Admin"]))):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

@api_router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_dict = {k: v for k, v in user_data.model_dump().items() if v is not None}
    if "password" in update_dict:
        update_dict["password"] = hash_password(update_dict["password"])
    if "email" in update_dict:
        update_dict["email"] = update_dict["email"].lower()
    
    if update_dict:
        await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return UserResponse(**updated)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

# ============== ORDER ROUTES ==============

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order_data: OrderCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(require_roles(["Requester", "Admin"]))):
    """Create a new order - only Requesters and Admins can create"""
    order_code = await get_next_order_code()
    created_at = get_utc_now_dt()
    sla_deadline = calculate_sla_deadline(created_at)
    
    order = {
        "id": str(uuid.uuid4()),
        "order_code": order_code,
        "requester_id": current_user["id"],
        "requester_name": current_user["name"],
        "requester_email": current_user["email"],
        "editor_id": None,
        "editor_name": None,
        "title": order_data.title,
        "category": order_data.category,
        "status": "Open",
        "priority": order_data.priority,
        "description": order_data.description,
        "video_script": order_data.video_script,
        "reference_links": order_data.reference_links,
        "footage_links": order_data.footage_links,
        "music_preference": order_data.music_preference,
        "delivery_format": order_data.delivery_format,
        "special_instructions": order_data.special_instructions,
        "sla_deadline": sla_deadline.isoformat(),
        "created_at": created_at.isoformat(),
        "updated_at": created_at.isoformat(),
        "picked_at": None,
        "delivered_at": None,
        "last_responded_at": None
    }
    await db.orders.insert_one(order)
    
    # Notify all editors about new order
    editors = await db.users.find({"role": "Editor", "active": True}, {"_id": 0}).to_list(100)
    for editor in editors:
        await create_notification(
            editor['id'],
            "new_order",
            "New order available",
            f"New order {order_code} '{order_data.title}' is available for pickup",
            order['id']
        )
        background_tasks.add_task(
            send_email_notification,
            editor['email'],
            f"[Red Ribbon Ops] New Order Available: {order_code}",
            f"<p>Hi {editor['name']},</p><p>A new order is available for pickup:</p><p><strong>{order_code}</strong> - {order_data.title}</p><p>Category: {order_data.category}</p><p>Priority: {order_data.priority}</p>"
        )
    
    return OrderResponse(
        **{k: v for k, v in order.items() if k != '_id'},
        is_sla_breached=False
    )

@api_router.get("/orders", response_model=List[OrderResponse])
async def list_orders(
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    List orders based on role:
    - Admin: sees all orders
    - Editor: sees Open orders (pool) + orders assigned to them
    - Requester: sees only their orders
    """
    query = {}
    
    if current_user["role"] == "Requester":
        query["requester_id"] = current_user["id"]
    elif current_user["role"] == "Editor":
        # Editors see: Open orders (pool) OR orders assigned to them
        query["$or"] = [
            {"status": "Open"},
            {"editor_id": current_user["id"]}
        ]
    # Admin sees all
    
    if status:
        if current_user["role"] == "Editor" and status != "Open":
            # If filtering by non-Open status, only show editor's own orders
            query = {"editor_id": current_user["id"], "status": status}
        elif current_user["role"] != "Editor":
            query["status"] = status
    
    if category:
        query["category"] = category
    if priority:
        query["priority"] = priority
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    result = []
    for order in orders:
        result.append(OrderResponse(
            **order,
            is_sla_breached=is_sla_breached(order['sla_deadline'], order['status'])
        ))
    
    return result

@api_router.get("/orders/pool", response_model=List[OrderResponse])
async def get_order_pool(current_user: dict = Depends(require_roles(["Editor", "Admin"]))):
    """Get open orders available for editors to pick"""
    orders = await db.orders.find({"status": "Open"}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    
    result = []
    for order in orders:
        result.append(OrderResponse(
            **order,
            is_sla_breached=is_sla_breached(order['sla_deadline'], order['status'])
        ))
    
    return result

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check
    if current_user["role"] == "Requester" and order["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Editor":
        # Editors can view Open orders or their own assigned orders
        if order["status"] != "Open" and order.get("editor_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return OrderResponse(
        **order,
        is_sla_breached=is_sla_breached(order['sla_deadline'], order['status'])
    )

@api_router.post("/orders/{order_id}/pick")
async def pick_order(order_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(require_roles(["Editor"]))):
    """Editor picks an open order from the pool"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != "Open":
        raise HTTPException(status_code=400, detail="Order is not available for pickup")
    
    if order.get("editor_id"):
        raise HTTPException(status_code=400, detail="Order already assigned to another editor")
    
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
    
    # Get updated order and notify
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    background_tasks.add_task(notify_status_change, updated_order, old_status, "In Progress", current_user)
    
    return {"message": "Order picked successfully", "order_code": order["order_code"]}

@api_router.post("/orders/{order_id}/submit-for-review")
async def submit_for_review(order_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(require_roles(["Editor"]))):
    """Editor submits order for requester review (sets to Pending)"""
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
            "updated_at": now
        }}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    background_tasks.add_task(notify_status_change, updated_order, old_status, "Pending", current_user)
    
    return {"message": "Order submitted for review"}

@api_router.post("/orders/{order_id}/respond")
async def respond_to_order(order_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(require_roles(["Requester"]))):
    """Requester responds to pending order (sets back to In Progress)"""
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
            "last_responded_at": now
        }}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    background_tasks.add_task(notify_status_change, updated_order, old_status, "In Progress", current_user)
    
    return {"message": "Response sent, order back to editor"}

@api_router.post("/orders/{order_id}/deliver")
async def deliver_order(order_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(require_roles(["Editor"]))):
    """Editor marks order as delivered"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("editor_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="This order is not assigned to you")
    
    if order["status"] not in ["In Progress", "Pending"]:
        raise HTTPException(status_code=400, detail="Order cannot be delivered from current status")
    
    # Check for final delivery file
    final_file = await db.order_files.find_one({
        "order_id": order_id,
        "is_final_delivery": True
    })
    if not final_file:
        raise HTTPException(status_code=400, detail="Please upload and mark a final delivery file before delivering")
    
    old_status = order["status"]
    now = get_utc_now()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "Delivered",
            "delivered_at": now,
            "updated_at": now
        }}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    background_tasks.add_task(notify_status_change, updated_order, old_status, "Delivered", current_user)
    
    return {"message": "Order delivered successfully"}

@api_router.patch("/orders/{order_id}", response_model=OrderResponse)
async def update_order(order_id: str, order_data: OrderUpdate, current_user: dict = Depends(get_current_user)):
    """Update order details - Admin can update any, Requester can update their own Open orders"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if current_user["role"] == "Requester":
        if order["requester_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="This is not your order")
        if order["status"] != "Open":
            raise HTTPException(status_code=400, detail="Can only edit Open orders")
    elif current_user["role"] == "Editor":
        raise HTTPException(status_code=403, detail="Editors cannot edit order details")
    
    update_dict = {k: v for k, v in order_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = get_utc_now()
    
    await db.orders.update_one({"id": order_id}, {"$set": update_dict})
    
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return OrderResponse(
        **updated,
        is_sla_breached=is_sla_breached(updated['sla_deadline'], updated['status'])
    )

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Cleanup related data
    await db.order_messages.delete_many({"order_id": order_id})
    await db.order_files.delete_many({"order_id": order_id})
    
    return {"message": "Order deleted"}

# ============== MESSAGE ROUTES ==============

@api_router.post("/orders/{order_id}/messages", response_model=MessageResponse)
async def create_message(order_id: str, message_data: MessageCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check
    if current_user["role"] == "Requester" and order["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Editor" and order.get("editor_id") != current_user["id"]:
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
    
    # Notify the other party
    if current_user["role"] == "Editor" and order.get("requester_id"):
        await create_notification(
            order["requester_id"],
            "new_message",
            "New message on your order",
            f"Editor sent a message on order {order['order_code']}",
            order_id
        )
    elif current_user["role"] == "Requester" and order.get("editor_id"):
        await create_notification(
            order["editor_id"],
            "new_message",
            "New message on order",
            f"Requester sent a message on order {order['order_code']}",
            order_id
        )
    
    return MessageResponse(**message)

@api_router.get("/orders/{order_id}/messages", response_model=List[MessageResponse])
async def list_messages(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check
    if current_user["role"] == "Requester" and order["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Editor" and order.get("editor_id") != current_user["id"] and order["status"] != "Open":
        raise HTTPException(status_code=403, detail="Access denied")
    
    messages = await db.order_messages.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return [MessageResponse(**m) for m in messages]

# ============== FILE ROUTES ==============

@api_router.post("/orders/{order_id}/files", response_model=FileResponse)
async def create_file(order_id: str, file_data: FileCreate, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check
    if current_user["role"] == "Requester" and order["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Editor" and order.get("editor_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
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

@api_router.get("/orders/{order_id}/files", response_model=List[FileResponse])
async def list_files(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check
    if current_user["role"] == "Requester" and order["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Editor" and order.get("editor_id") != current_user["id"] and order["status"] != "Open":
        raise HTTPException(status_code=403, detail="Access denied")
    
    files = await db.order_files.find({"order_id": order_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [FileResponse(**f) for f in files]

@api_router.patch("/orders/{order_id}/files/{file_id}/mark-final")
async def mark_file_as_final(order_id: str, file_id: str, current_user: dict = Depends(require_roles(["Editor", "Admin"]))):
    """Mark a file as the final delivery"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if current_user["role"] == "Editor" and order.get("editor_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="This order is not assigned to you")
    
    file_doc = await db.order_files.find_one({"id": file_id, "order_id": order_id})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Unmark any existing final
    await db.order_files.update_many(
        {"order_id": order_id},
        {"$set": {"is_final_delivery": False}}
    )
    
    # Mark this file as final
    await db.order_files.update_one(
        {"id": file_id},
        {"$set": {"is_final_delivery": True}}
    )
    
    return {"message": "File marked as final delivery"}

# ============== DASHBOARD ROUTES ==============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard stats based on role"""
    base_query = {}
    
    if current_user["role"] == "Requester":
        base_query["requester_id"] = current_user["id"]
    elif current_user["role"] == "Editor":
        base_query["editor_id"] = current_user["id"]
    
    # Count by status
    open_count = await db.orders.count_documents({**base_query, "status": "Open"}) if current_user["role"] != "Editor" else await db.orders.count_documents({"status": "Open"})
    in_progress_count = await db.orders.count_documents({**base_query, "status": "In Progress"})
    pending_count = await db.orders.count_documents({**base_query, "status": "Pending"})
    delivered_count = await db.orders.count_documents({**base_query, "status": "Delivered"})
    
    # SLA breaching (only for non-delivered orders)
    now = datetime.now(timezone.utc).isoformat()
    sla_breaching_query = {
        **base_query,
        "status": {"$ne": "Delivered"},
        "sla_deadline": {"$lt": now}
    }
    if current_user["role"] == "Editor":
        sla_breaching_query["editor_id"] = current_user["id"]
    sla_breaching_count = await db.orders.count_documents(sla_breaching_query)
    
    # Orders responded (for editors - orders that came back from requester)
    orders_responded_count = 0
    if current_user["role"] == "Editor":
        # Count orders that have last_responded_at set and are In Progress
        orders_responded_count = await db.orders.count_documents({
            "editor_id": current_user["id"],
            "status": "In Progress",
            "last_responded_at": {"$ne": None}
        })
    
    return DashboardStats(
        open_count=open_count,
        in_progress_count=in_progress_count,
        pending_count=pending_count,
        delivered_count=delivered_count,
        sla_breaching_count=sla_breaching_count,
        orders_responded_count=orders_responded_count
    )

@api_router.get("/dashboard/editor", response_model=dict)
async def get_editor_dashboard(current_user: dict = Depends(require_roles(["Editor"]))):
    """Get detailed editor dashboard data"""
    now = datetime.now(timezone.utc).isoformat()
    
    # New orders in pool
    new_orders = await db.orders.find(
        {"status": "Open"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # My orders in progress
    in_progress = await db.orders.find(
        {"editor_id": current_user["id"], "status": "In Progress", "last_responded_at": None},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    # Orders sent for review (Pending)
    pending_review = await db.orders.find(
        {"editor_id": current_user["id"], "status": "Pending"},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    # Orders that came back (responded by requester)
    responded = await db.orders.find(
        {"editor_id": current_user["id"], "status": "In Progress", "last_responded_at": {"$ne": None}},
        {"_id": 0}
    ).sort("last_responded_at", -1).to_list(100)
    
    # Delivered orders
    delivered = await db.orders.find(
        {"editor_id": current_user["id"], "status": "Delivered"},
        {"_id": 0}
    ).sort("delivered_at", -1).limit(20).to_list(20)
    
    # SLA breaching
    sla_breaching = await db.orders.find(
        {"editor_id": current_user["id"], "status": {"$ne": "Delivered"}, "sla_deadline": {"$lt": now}},
        {"_id": 0}
    ).sort("sla_deadline", 1).to_list(100)
    
    def enrich_orders(orders):
        return [OrderResponse(**o, is_sla_breached=is_sla_breached(o['sla_deadline'], o['status'])) for o in orders]
    
    return {
        "new_orders": enrich_orders(new_orders),
        "in_progress": enrich_orders(in_progress),
        "pending_review": enrich_orders(pending_review),
        "responded": enrich_orders(responded),
        "delivered": enrich_orders(delivered),
        "sla_breaching": enrich_orders(sla_breaching)
    }

@api_router.get("/dashboard/requester", response_model=dict)
async def get_requester_dashboard(current_user: dict = Depends(require_roles(["Requester"]))):
    """Get detailed requester dashboard data"""
    
    # My open orders
    open_orders = await db.orders.find(
        {"requester_id": current_user["id"], "status": "Open"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Orders in progress
    in_progress = await db.orders.find(
        {"requester_id": current_user["id"], "status": "In Progress"},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    # Orders needing my review (Pending)
    needs_review = await db.orders.find(
        {"requester_id": current_user["id"], "status": "Pending"},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    # Delivered orders
    delivered = await db.orders.find(
        {"requester_id": current_user["id"], "status": "Delivered"},
        {"_id": 0}
    ).sort("delivered_at", -1).limit(20).to_list(20)
    
    def enrich_orders(orders):
        return [OrderResponse(**o, is_sla_breached=is_sla_breached(o['sla_deadline'], o['status'])) for o in orders]
    
    return {
        "open_orders": enrich_orders(open_orders),
        "in_progress": enrich_orders(in_progress),
        "needs_review": enrich_orders(needs_review),
        "delivered": enrich_orders(delivered)
    }

# ============== NOTIFICATION ROUTES ==============

@api_router.get("/notifications", response_model=List[NotificationResponse])
async def list_notifications(current_user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [NotificationResponse(**n) for n in notifications]

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

@api_router.patch("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": current_user["id"], "is_read": False})
    return {"count": count}

# ============== SEED DATA ==============

@api_router.post("/seed")
async def seed_data():
    """Seed initial admin user"""
    existing = await db.users.find_one({"email": "admin@redribbonops.com"})
    if existing:
        return {"message": "Admin already exists", "admin_email": "admin@redribbonops.com"}
    
    admin = {
        "id": str(uuid.uuid4()),
        "name": "Admin",
        "email": "admin@redribbonops.com",
        "password": hash_password("admin123"),
        "role": "Admin",
        "active": True,
        "created_at": get_utc_now()
    }
    await db.users.insert_one(admin)
    
    # Initialize counters
    await db.counters.update_one({"_id": "order_code"}, {"$setOnInsert": {"seq": 0}}, upsert=True)
    
    return {"message": "Seed data created", "admin_email": "admin@redribbonops.com", "admin_password": "admin123"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
