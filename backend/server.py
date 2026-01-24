from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, BackgroundTasks, UploadFile, File
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
import base64

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

app = FastAPI(title="Red Ribbon Ops Portal API - V2")
api_router = APIRouter(prefix="/api")

# ============== ENUMS ==============
USER_ROLES = ["Admin", "Editor", "Requester"]
ORDER_STATUSES = ["Open", "In Progress", "Pending", "Delivered"]
REQUEST_TYPES = ["Request", "Bug"]
PRIORITIES = ["Low", "Normal", "High", "Urgent"]
BUG_SEVERITIES = ["Low", "Normal", "High", "Urgent"]
BROWSERS = ["Chrome", "Safari", "Firefox", "Edge", "Other"]
DEVICES = ["Desktop", "Mobile", "Tablet"]

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

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar: Optional[str] = None  # Base64 encoded image

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    active: bool
    avatar: Optional[str] = None
    created_at: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

# Categories
class CategoryL1Create(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None

class CategoryL2Create(BaseModel):
    name: str
    category_l1_id: str
    description: Optional[str] = None
    triggers_editor_workflow: bool = False

class CategoryL1Response(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    active: bool
    created_at: str

class CategoryL2Response(BaseModel):
    id: str
    name: str
    category_l1_id: str
    category_l1_name: Optional[str] = None
    description: Optional[str] = None
    triggers_editor_workflow: bool
    active: bool
    created_at: str

# Editing Order (existing)
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

class OrderUpdate(BaseModel):
    title: Optional[str] = None
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
    sla_deadline: str
    is_sla_breached: bool
    created_at: str
    updated_at: str
    picked_at: Optional[str] = None
    delivered_at: Optional[str] = None

# Feature Request
class FeatureRequestCreate(BaseModel):
    title: str
    category_l1_id: Optional[str] = None
    category_l2_id: Optional[str] = None
    description: str
    why_important: Optional[str] = None
    who_is_for: Optional[str] = None
    reference_links: Optional[str] = None
    priority: Literal["Low", "Normal", "High"] = "Normal"

class FeatureRequestResponse(BaseModel):
    id: str
    request_code: str
    request_type: str
    requester_id: str
    requester_name: str
    title: str
    category_l1_id: Optional[str] = None
    category_l1_name: Optional[str] = None
    category_l2_id: Optional[str] = None
    category_l2_name: Optional[str] = None
    description: str
    why_important: Optional[str] = None
    who_is_for: Optional[str] = None
    reference_links: Optional[str] = None
    priority: str
    status: str
    created_at: str
    updated_at: str

# Bug Report
class BugReportCreate(BaseModel):
    title: str
    category_l1_id: Optional[str] = None
    category_l2_id: Optional[str] = None
    bug_type: str
    steps_to_reproduce: str
    expected_behavior: str
    actual_behavior: str
    browser: Optional[str] = None
    device: Optional[str] = None
    url_page: Optional[str] = None
    severity: Literal["Low", "Normal", "High", "Urgent"] = "Normal"

class BugReportResponse(BaseModel):
    id: str
    report_code: str
    request_type: str
    requester_id: str
    requester_name: str
    title: str
    category_l1_id: Optional[str] = None
    category_l1_name: Optional[str] = None
    category_l2_id: Optional[str] = None
    category_l2_name: Optional[str] = None
    bug_type: str
    steps_to_reproduce: str
    expected_behavior: str
    actual_behavior: str
    browser: Optional[str] = None
    device: Optional[str] = None
    url_page: Optional[str] = None
    severity: str
    status: str
    created_at: str
    updated_at: str

# Unified Request Response (for My Requests list)
class UnifiedRequestResponse(BaseModel):
    id: str
    code: str
    request_type: str  # "Editing", "Feature", "Bug"
    title: str
    category_l1_name: Optional[str] = None
    category_l2_name: Optional[str] = None
    status: str
    priority_or_severity: str
    created_at: str
    updated_at: str

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

class DashboardStats(BaseModel):
    open_count: int
    in_progress_count: int
    pending_count: int
    delivered_count: int
    sla_breaching_count: int
    orders_responded_count: int = 0
    feature_requests_count: int = 0
    bug_reports_count: int = 0

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

def normalize_order(order: dict) -> dict:
    """Normalize order dict to ensure all required fields exist for OrderResponse"""
    defaults = {
        "request_type": "Editing",
        "category_l1_id": None,
        "category_l1_name": None,
        "category_l2_id": None,
        "category_l2_name": None,
        "editor_id": None,
        "editor_name": None,
        "video_script": None,
        "reference_links": None,
        "footage_links": None,
        "music_preference": None,
        "delivery_format": None,
        "special_instructions": None,
        "picked_at": None,
        "delivered_at": None,
    }
    for key, default_val in defaults.items():
        if key not in order:
            order[key] = default_val
    return order

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

async def get_next_code(counter_name: str, prefix: str):
    counter = await db.counters.find_one_and_update(
        {"_id": counter_name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"{prefix}-{str(counter['seq']).zfill(6)}"

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
    
    requester = await db.users.find_one({"id": order['requester_id']}, {"_id": 0})
    editor = None
    if order.get('editor_id'):
        editor = await db.users.find_one({"id": order['editor_id']}, {"_id": 0})
    
    if new_status == "In Progress" and old_status == "Open":
        if requester:
            await create_notification(
                requester['id'], 
                "order_picked",
                "Your request has been picked up",
                f"Request {order_code} '{title}' is now being worked on by {changed_by['name']}",
                order['id']
            )
    
    elif new_status == "Pending":
        if requester:
            await create_notification(
                requester['id'],
                "review_needed",
                "Request needs your review",
                f"Request {order_code} '{title}' is pending your review",
                order['id']
            )
    
    elif new_status == "In Progress" and old_status == "Pending":
        if editor:
            await create_notification(
                editor['id'],
                "order_responded",
                "Requester has responded",
                f"Request {order_code} '{title}' has been responded to",
                order['id']
            )
    
    elif new_status == "Delivered":
        if requester:
            await create_notification(
                requester['id'],
                "order_delivered",
                "Request completed!",
                f"Request {order_code} '{title}' has been delivered",
                order['id']
            )
    
    admins = await db.users.find({"role": "Admin", "active": True}, {"_id": 0}).to_list(100)
    for admin in admins:
        if admin['id'] != changed_by['id']:
            await create_notification(
                admin['id'],
                "status_change",
                f"Request status changed",
                f"Request {order_code} changed from {old_status} to {new_status} by {changed_by['name']}",
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
            avatar=user.get("avatar"),
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
        avatar=user.get("avatar"),
        created_at=user["created_at"]
    )

@api_router.patch("/auth/profile", response_model=UserResponse)
async def update_profile(profile_data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in profile_data.model_dump().items() if v is not None}
    if "email" in update_dict:
        update_dict["email"] = update_dict["email"].lower()
        existing = await db.users.find_one({"email": update_dict["email"], "id": {"$ne": current_user["id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
    
    if update_dict:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_dict})
    
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return UserResponse(**updated)

@api_router.post("/auth/change-password")
async def change_password(password_data: PasswordChange, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not verify_password(password_data.current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password": hash_password(password_data.new_password)}}
    )
    return {"message": "Password changed successfully"}

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
        "avatar": None,
        "created_at": get_utc_now()
    }
    await db.users.insert_one(user)
    return UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        active=user["active"],
        avatar=user.get("avatar"),
        created_at=user["created_at"]
    )

@api_router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(require_roles(["Admin"]))):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

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

# ============== CATEGORY ROUTES ==============

@api_router.post("/categories/l1", response_model=CategoryL1Response)
async def create_category_l1(category_data: CategoryL1Create, current_user: dict = Depends(require_roles(["Admin"]))):
    category = {
        "id": str(uuid.uuid4()),
        "name": category_data.name,
        "description": category_data.description,
        "icon": category_data.icon,
        "active": True,
        "created_at": get_utc_now()
    }
    await db.categories_l1.insert_one(category)
    return CategoryL1Response(**category)

@api_router.get("/categories/l1", response_model=List[CategoryL1Response])
async def list_categories_l1(current_user: dict = Depends(get_current_user)):
    categories = await db.categories_l1.find({"active": True}, {"_id": 0}).to_list(100)
    return [CategoryL1Response(**c) for c in categories]

@api_router.patch("/categories/l1/{category_id}", response_model=CategoryL1Response)
async def update_category_l1(category_id: str, category_data: CategoryL1Create, current_user: dict = Depends(require_roles(["Admin"]))):
    await db.categories_l1.update_one(
        {"id": category_id},
        {"$set": category_data.model_dump()}
    )
    updated = await db.categories_l1.find_one({"id": category_id}, {"_id": 0})
    return CategoryL1Response(**updated)

@api_router.delete("/categories/l1/{category_id}")
async def delete_category_l1(category_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    await db.categories_l1.update_one({"id": category_id}, {"$set": {"active": False}})
    return {"message": "Category deactivated"}

@api_router.post("/categories/l2", response_model=CategoryL2Response)
async def create_category_l2(category_data: CategoryL2Create, current_user: dict = Depends(require_roles(["Admin"]))):
    l1 = await db.categories_l1.find_one({"id": category_data.category_l1_id}, {"_id": 0})
    if not l1:
        raise HTTPException(status_code=400, detail="Category L1 not found")
    
    category = {
        "id": str(uuid.uuid4()),
        "name": category_data.name,
        "category_l1_id": category_data.category_l1_id,
        "description": category_data.description,
        "triggers_editor_workflow": category_data.triggers_editor_workflow,
        "active": True,
        "created_at": get_utc_now()
    }
    await db.categories_l2.insert_one(category)
    return CategoryL2Response(**category, category_l1_name=l1["name"])

@api_router.get("/categories/l2", response_model=List[CategoryL2Response])
async def list_categories_l2(category_l1_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"active": True}
    if category_l1_id:
        query["category_l1_id"] = category_l1_id
    
    categories = await db.categories_l2.find(query, {"_id": 0}).to_list(100)
    
    result = []
    for c in categories:
        l1 = await db.categories_l1.find_one({"id": c["category_l1_id"]}, {"_id": 0})
        result.append(CategoryL2Response(**c, category_l1_name=l1["name"] if l1 else None))
    
    return result

@api_router.patch("/categories/l2/{category_id}", response_model=CategoryL2Response)
async def update_category_l2(category_id: str, category_data: CategoryL2Create, current_user: dict = Depends(require_roles(["Admin"]))):
    await db.categories_l2.update_one(
        {"id": category_id},
        {"$set": category_data.model_dump()}
    )
    updated = await db.categories_l2.find_one({"id": category_id}, {"_id": 0})
    l1 = await db.categories_l1.find_one({"id": updated["category_l1_id"]}, {"_id": 0})
    return CategoryL2Response(**updated, category_l1_name=l1["name"] if l1 else None)

@api_router.delete("/categories/l2/{category_id}")
async def delete_category_l2(category_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    await db.categories_l2.update_one({"id": category_id}, {"$set": {"active": False}})
    return {"message": "Category deactivated"}

# ============== EDITING ORDER ROUTES (existing workflow) ==============

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order_data: OrderCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(require_roles(["Requester", "Admin"]))):
    order_code = await get_next_code("order_code", "RRG")
    created_at = get_utc_now_dt()
    sla_deadline = calculate_sla_deadline(created_at)
    
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
    
    # Notify editors
    editors = await db.users.find({"role": "Editor", "active": True}, {"_id": 0}).to_list(100)
    for editor in editors:
        await create_notification(
            editor['id'],
            "new_order",
            "New request available",
            f"New editing request {order_code} '{order_data.title}' is available for pickup",
            order['id']
        )
    
    return OrderResponse(
        **{k: v for k, v in order.items() if k != '_id'},
        is_sla_breached=False
    )

@api_router.get("/orders", response_model=List[OrderResponse])
async def list_orders(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
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

@api_router.get("/orders/pool", response_model=List[OrderResponse])
async def get_order_pool(current_user: dict = Depends(require_roles(["Editor", "Admin"]))):
    orders = await db.orders.find({"status": "Open"}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    
    result = []
    for order in orders:
        order = normalize_order(order)
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

@api_router.post("/orders/{order_id}/pick")
async def pick_order(order_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(require_roles(["Editor"]))):
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
    
    return {"message": "Order picked successfully", "order_code": order["order_code"]}

@api_router.post("/orders/{order_id}/submit-for-review")
async def submit_for_review(order_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(require_roles(["Editor"]))):
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

@api_router.post("/orders/{order_id}/respond")
async def respond_to_order(order_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(require_roles(["Requester"]))):
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

@api_router.post("/orders/{order_id}/deliver")
async def deliver_order(order_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(require_roles(["Editor"]))):
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
    
    return {"message": "Order delivered successfully"}

# ============== FEATURE REQUEST ROUTES ==============

@api_router.post("/feature-requests", response_model=FeatureRequestResponse)
async def create_feature_request(request_data: FeatureRequestCreate, current_user: dict = Depends(get_current_user)):
    request_code = await get_next_code("feature_request_code", "FR")
    now = get_utc_now()
    
    cat_l1_name = None
    cat_l2_name = None
    if request_data.category_l1_id:
        l1 = await db.categories_l1.find_one({"id": request_data.category_l1_id}, {"_id": 0})
        cat_l1_name = l1["name"] if l1 else None
    if request_data.category_l2_id:
        l2 = await db.categories_l2.find_one({"id": request_data.category_l2_id}, {"_id": 0})
        cat_l2_name = l2["name"] if l2 else None
    
    feature_request = {
        "id": str(uuid.uuid4()),
        "request_code": request_code,
        "request_type": "Feature",
        "requester_id": current_user["id"],
        "requester_name": current_user["name"],
        "title": request_data.title,
        "category_l1_id": request_data.category_l1_id,
        "category_l1_name": cat_l1_name,
        "category_l2_id": request_data.category_l2_id,
        "category_l2_name": cat_l2_name,
        "description": request_data.description,
        "why_important": request_data.why_important,
        "who_is_for": request_data.who_is_for,
        "reference_links": request_data.reference_links,
        "priority": request_data.priority,
        "status": "Open",
        "created_at": now,
        "updated_at": now
    }
    await db.feature_requests.insert_one(feature_request)
    
    # Notify admins
    admins = await db.users.find({"role": "Admin", "active": True}, {"_id": 0}).to_list(100)
    for admin in admins:
        await create_notification(
            admin['id'],
            "new_feature_request",
            "New feature request",
            f"New feature request {request_code}: {request_data.title}",
            feature_request['id']
        )
    
    return FeatureRequestResponse(**feature_request)

@api_router.get("/feature-requests", response_model=List[FeatureRequestResponse])
async def list_feature_requests(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] == "Requester":
        query["requester_id"] = current_user["id"]
    
    requests = await db.feature_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [FeatureRequestResponse(**r) for r in requests]

@api_router.get("/feature-requests/{request_id}", response_model=FeatureRequestResponse)
async def get_feature_request(request_id: str, current_user: dict = Depends(get_current_user)):
    request = await db.feature_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Feature request not found")
    
    if current_user["role"] == "Requester" and request["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return FeatureRequestResponse(**request)

@api_router.patch("/feature-requests/{request_id}/status")
async def update_feature_request_status(request_id: str, status: str = Query(...), current_user: dict = Depends(require_roles(["Admin"]))):
    result = await db.feature_requests.update_one(
        {"id": request_id},
        {"$set": {"status": status, "updated_at": get_utc_now()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Feature request not found")
    return {"message": "Status updated"}

# ============== BUG REPORT ROUTES ==============

@api_router.post("/bug-reports", response_model=BugReportResponse)
async def create_bug_report(report_data: BugReportCreate, current_user: dict = Depends(get_current_user)):
    report_code = await get_next_code("bug_report_code", "BUG")
    now = get_utc_now()
    
    cat_l1_name = None
    cat_l2_name = None
    if report_data.category_l1_id:
        l1 = await db.categories_l1.find_one({"id": report_data.category_l1_id}, {"_id": 0})
        cat_l1_name = l1["name"] if l1 else None
    if report_data.category_l2_id:
        l2 = await db.categories_l2.find_one({"id": report_data.category_l2_id}, {"_id": 0})
        cat_l2_name = l2["name"] if l2 else None
    
    bug_report = {
        "id": str(uuid.uuid4()),
        "report_code": report_code,
        "request_type": "Bug",
        "requester_id": current_user["id"],
        "requester_name": current_user["name"],
        "title": report_data.title,
        "category_l1_id": report_data.category_l1_id,
        "category_l1_name": cat_l1_name,
        "category_l2_id": report_data.category_l2_id,
        "category_l2_name": cat_l2_name,
        "bug_type": report_data.bug_type,
        "steps_to_reproduce": report_data.steps_to_reproduce,
        "expected_behavior": report_data.expected_behavior,
        "actual_behavior": report_data.actual_behavior,
        "browser": report_data.browser,
        "device": report_data.device,
        "url_page": report_data.url_page,
        "severity": report_data.severity,
        "status": "Open",
        "created_at": now,
        "updated_at": now
    }
    await db.bug_reports.insert_one(bug_report)
    
    # Notify admins
    admins = await db.users.find({"role": "Admin", "active": True}, {"_id": 0}).to_list(100)
    for admin in admins:
        await create_notification(
            admin['id'],
            "new_bug_report",
            "New bug report",
            f"New bug report {report_code}: {report_data.title} (Severity: {report_data.severity})",
            bug_report['id']
        )
    
    return BugReportResponse(**bug_report)

@api_router.get("/bug-reports", response_model=List[BugReportResponse])
async def list_bug_reports(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] == "Requester":
        query["requester_id"] = current_user["id"]
    
    reports = await db.bug_reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [BugReportResponse(**r) for r in reports]

@api_router.get("/bug-reports/{report_id}", response_model=BugReportResponse)
async def get_bug_report(report_id: str, current_user: dict = Depends(get_current_user)):
    report = await db.bug_reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Bug report not found")
    
    if current_user["role"] == "Requester" and report["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return BugReportResponse(**report)

@api_router.patch("/bug-reports/{report_id}/status")
async def update_bug_report_status(report_id: str, status: str = Query(...), current_user: dict = Depends(require_roles(["Admin"]))):
    result = await db.bug_reports.update_one(
        {"id": report_id},
        {"$set": {"status": status, "updated_at": get_utc_now()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bug report not found")
    return {"message": "Status updated"}

# ============== UNIFIED MY REQUESTS ==============

@api_router.get("/my-requests", response_model=List[UnifiedRequestResponse])
async def get_my_requests(current_user: dict = Depends(get_current_user)):
    """Get all requests (editing orders, feature requests, bug reports) for current user"""
    results = []
    
    # Get editing orders
    orders = await db.orders.find({"requester_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    for o in orders:
        results.append(UnifiedRequestResponse(
            id=o["id"],
            code=o["order_code"],
            request_type="Editing",
            title=o["title"],
            category_l1_name=o.get("category_l1_name"),
            category_l2_name=o.get("category_l2_name"),
            status=o["status"],
            priority_or_severity=o["priority"],
            created_at=o["created_at"],
            updated_at=o["updated_at"]
        ))
    
    # Get feature requests
    features = await db.feature_requests.find({"requester_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    for f in features:
        results.append(UnifiedRequestResponse(
            id=f["id"],
            code=f["request_code"],
            request_type="Feature",
            title=f["title"],
            category_l1_name=f.get("category_l1_name"),
            category_l2_name=f.get("category_l2_name"),
            status=f["status"],
            priority_or_severity=f["priority"],
            created_at=f["created_at"],
            updated_at=f["updated_at"]
        ))
    
    # Get bug reports
    bugs = await db.bug_reports.find({"requester_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    for b in bugs:
        results.append(UnifiedRequestResponse(
            id=b["id"],
            code=b["report_code"],
            request_type="Bug",
            title=b["title"],
            category_l1_name=b.get("category_l1_name"),
            category_l2_name=b.get("category_l2_name"),
            status=b["status"],
            priority_or_severity=b["severity"],
            created_at=b["created_at"],
            updated_at=b["updated_at"]
        ))
    
    # Sort by created_at descending
    results.sort(key=lambda x: x.created_at, reverse=True)
    
    return results

# ============== MESSAGE ROUTES ==============

@api_router.post("/orders/{order_id}/messages", response_model=MessageResponse)
async def create_message(order_id: str, message_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
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
    
    if current_user["role"] == "Editor" and order.get("requester_id"):
        await create_notification(order["requester_id"], "new_message", "New message on your request", f"Editor sent a message on request {order['order_code']}", order_id)
    elif current_user["role"] == "Requester" and order.get("editor_id"):
        await create_notification(order["editor_id"], "new_message", "New message on request", f"Requester sent a message on request {order['order_code']}", order_id)
    
    return MessageResponse(**message)

@api_router.get("/orders/{order_id}/messages", response_model=List[MessageResponse])
async def list_messages(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    messages = await db.order_messages.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return [MessageResponse(**m) for m in messages]

# ============== FILE ROUTES ==============

@api_router.post("/orders/{order_id}/files", response_model=FileResponse)
async def create_file(order_id: str, file_data: FileCreate, current_user: dict = Depends(get_current_user)):
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

@api_router.get("/orders/{order_id}/files", response_model=List[FileResponse])
async def list_files(order_id: str, current_user: dict = Depends(get_current_user)):
    files = await db.order_files.find({"order_id": order_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [FileResponse(**f) for f in files]

@api_router.patch("/orders/{order_id}/files/{file_id}/mark-final")
async def mark_file_as_final(order_id: str, file_id: str, current_user: dict = Depends(require_roles(["Editor", "Admin"]))):
    await db.order_files.update_many({"order_id": order_id}, {"$set": {"is_final_delivery": False}})
    await db.order_files.update_one({"id": file_id}, {"$set": {"is_final_delivery": True}})
    return {"message": "File marked as final delivery"}

# ============== DASHBOARD ROUTES ==============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    base_query = {}
    
    if current_user["role"] == "Requester":
        base_query["requester_id"] = current_user["id"]
    elif current_user["role"] == "Editor":
        base_query["editor_id"] = current_user["id"]
    
    open_count = await db.orders.count_documents({**base_query, "status": "Open"}) if current_user["role"] != "Editor" else await db.orders.count_documents({"status": "Open"})
    in_progress_count = await db.orders.count_documents({**base_query, "status": "In Progress"})
    pending_count = await db.orders.count_documents({**base_query, "status": "Pending"})
    delivered_count = await db.orders.count_documents({**base_query, "status": "Delivered"})
    
    now = datetime.now(timezone.utc).isoformat()
    sla_breaching_query = {**base_query, "status": {"$ne": "Delivered"}, "sla_deadline": {"$lt": now}}
    if current_user["role"] == "Editor":
        sla_breaching_query["editor_id"] = current_user["id"]
    sla_breaching_count = await db.orders.count_documents(sla_breaching_query)
    
    orders_responded_count = 0
    if current_user["role"] == "Editor":
        orders_responded_count = await db.orders.count_documents({
            "editor_id": current_user["id"],
            "status": "In Progress",
            "last_responded_at": {"$ne": None}
        })
    
    feature_requests_count = await db.feature_requests.count_documents({"requester_id": current_user["id"]} if current_user["role"] == "Requester" else {})
    bug_reports_count = await db.bug_reports.count_documents({"requester_id": current_user["id"]} if current_user["role"] == "Requester" else {})
    
    return DashboardStats(
        open_count=open_count,
        in_progress_count=in_progress_count,
        pending_count=pending_count,
        delivered_count=delivered_count,
        sla_breaching_count=sla_breaching_count,
        orders_responded_count=orders_responded_count,
        feature_requests_count=feature_requests_count,
        bug_reports_count=bug_reports_count
    )

@api_router.get("/dashboard/editor")
async def get_editor_dashboard(current_user: dict = Depends(require_roles(["Editor"]))):
    now = datetime.now(timezone.utc).isoformat()
    
    new_orders = await db.orders.find({"status": "Open"}, {"_id": 0}).sort("created_at", 1).to_list(100)
    in_progress = await db.orders.find({"editor_id": current_user["id"], "status": "In Progress", "last_responded_at": None}, {"_id": 0}).to_list(100)
    pending_review = await db.orders.find({"editor_id": current_user["id"], "status": "Pending"}, {"_id": 0}).to_list(100)
    responded = await db.orders.find({"editor_id": current_user["id"], "status": "In Progress", "last_responded_at": {"$ne": None}}, {"_id": 0}).to_list(100)
    delivered = await db.orders.find({"editor_id": current_user["id"], "status": "Delivered"}, {"_id": 0}).sort("delivered_at", -1).limit(20).to_list(20)
    sla_breaching = await db.orders.find({"editor_id": current_user["id"], "status": {"$ne": "Delivered"}, "sla_deadline": {"$lt": now}}, {"_id": 0}).to_list(100)
    
    def enrich(orders):
        return [OrderResponse(**normalize_order(o), is_sla_breached=is_sla_breached(o['sla_deadline'], o['status'])) for o in orders]
    
    return {
        "new_orders": enrich(new_orders),
        "in_progress": enrich(in_progress),
        "pending_review": enrich(pending_review),
        "responded": enrich(responded),
        "delivered": enrich(delivered),
        "sla_breaching": enrich(sla_breaching)
    }

@api_router.get("/dashboard/requester")
async def get_requester_dashboard(current_user: dict = Depends(require_roles(["Requester"]))):
    open_orders = await db.orders.find({"requester_id": current_user["id"], "status": "Open"}, {"_id": 0}).to_list(100)
    in_progress = await db.orders.find({"requester_id": current_user["id"], "status": "In Progress"}, {"_id": 0}).to_list(100)
    needs_review = await db.orders.find({"requester_id": current_user["id"], "status": "Pending"}, {"_id": 0}).to_list(100)
    delivered = await db.orders.find({"requester_id": current_user["id"], "status": "Delivered"}, {"_id": 0}).sort("delivered_at", -1).limit(20).to_list(20)
    
    def enrich(orders):
        return [OrderResponse(**normalize_order(o), is_sla_breached=is_sla_breached(o['sla_deadline'], o['status'])) for o in orders]
    
    return {
        "open_orders": enrich(open_orders),
        "in_progress": enrich(in_progress),
        "needs_review": enrich(needs_review),
        "delivered": enrich(delivered)
    }

# ============== NOTIFICATION ROUTES ==============

@api_router.get("/notifications", response_model=List[NotificationResponse])
async def list_notifications(current_user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find({"user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [NotificationResponse(**n) for n in notifications]

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notification_id, "user_id": current_user["id"]}, {"$set": {"is_read": True}})
    return {"message": "Notification marked as read"}

@api_router.patch("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": current_user["id"]}, {"$set": {"is_read": True}})
    return {"message": "All notifications marked as read"}

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": current_user["id"], "is_read": False})
    return {"count": count}

# ============== SEED DATA ==============

@api_router.post("/seed")
async def seed_data():
    """Seed initial admin user and categories"""
    # Create admin if not exists
    existing = await db.users.find_one({"email": "admin@redribbonops.com"})
    if not existing:
        admin = {
            "id": str(uuid.uuid4()),
            "name": "Admin",
            "email": "admin@redribbonops.com",
            "password": hash_password("admin123"),
            "role": "Admin",
            "active": True,
            "avatar": None,
            "created_at": get_utc_now()
        }
        await db.users.insert_one(admin)
    
    # Seed categories
    categories_l1 = [
        {"name": "Media Services", "description": "Video editing and media production services", "icon": "video"},
        {"name": "Feature Requests", "description": "Request new features or services", "icon": "lightbulb"},
        {"name": "Bug Reports / Incidents", "description": "Report bugs and technical issues", "icon": "bug"},
    ]
    
    for cat in categories_l1:
        existing = await db.categories_l1.find_one({"name": cat["name"]})
        if not existing:
            cat["id"] = str(uuid.uuid4())
            cat["active"] = True
            cat["created_at"] = get_utc_now()
            await db.categories_l1.insert_one(cat)
    
    # Get category IDs
    media_services = await db.categories_l1.find_one({"name": "Media Services"}, {"_id": 0})
    feature_requests = await db.categories_l1.find_one({"name": "Feature Requests"}, {"_id": 0})
    bug_reports = await db.categories_l1.find_one({"name": "Bug Reports / Incidents"}, {"_id": 0})
    
    # Seed L2 categories
    categories_l2 = [
        {"name": "Editing Services", "category_l1_id": media_services["id"], "triggers_editor_workflow": True},
        {"name": "Photography", "category_l1_id": media_services["id"], "triggers_editor_workflow": False},
        {"name": "Videography Booking", "category_l1_id": media_services["id"], "triggers_editor_workflow": False},
        {"name": "New Feature Request", "category_l1_id": feature_requests["id"], "triggers_editor_workflow": False},
        {"name": "New Service Request", "category_l1_id": feature_requests["id"], "triggers_editor_workflow": False},
        {"name": "UI Bug", "category_l1_id": bug_reports["id"], "triggers_editor_workflow": False},
        {"name": "Button / Click Bug", "category_l1_id": bug_reports["id"], "triggers_editor_workflow": False},
        {"name": "Login / Access Bug", "category_l1_id": bug_reports["id"], "triggers_editor_workflow": False},
        {"name": "Payment / Checkout Bug", "category_l1_id": bug_reports["id"], "triggers_editor_workflow": False},
        {"name": "Other Bug", "category_l1_id": bug_reports["id"], "triggers_editor_workflow": False},
    ]
    
    for cat in categories_l2:
        existing = await db.categories_l2.find_one({"name": cat["name"], "category_l1_id": cat["category_l1_id"]})
        if not existing:
            cat["id"] = str(uuid.uuid4())
            cat["description"] = None
            cat["active"] = True
            cat["created_at"] = get_utc_now()
            await db.categories_l2.insert_one(cat)
    
    # Initialize counters
    await db.counters.update_one({"_id": "order_code"}, {"$setOnInsert": {"seq": 0}}, upsert=True)
    await db.counters.update_one({"_id": "feature_request_code"}, {"$setOnInsert": {"seq": 0}}, upsert=True)
    await db.counters.update_one({"_id": "bug_report_code"}, {"$setOnInsert": {"seq": 0}}, upsert=True)
    
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
