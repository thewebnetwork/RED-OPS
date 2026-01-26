from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, BackgroundTasks, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
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
RESET_TOKEN_EXPIRE_HOURS = 1  # Password reset tokens expire in 1 hour

# SLA Config
SLA_DAYS = 7

# Frontend URL for password reset links
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://servicehub-191.preview.emergentagent.com')

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

app = FastAPI(title="Red Ribbon Ops Portal API - V2")
api_router = APIRouter(prefix="/api")

# ============== ENUMS ==============
SYSTEM_ROLES = ["Admin", "Requester"]  # Base roles that always exist
ORDER_STATUSES = ["Open", "In Progress", "Pending", "Delivered", "Closed"]
REQUEST_TYPES = ["Request", "Bug"]
PRIORITIES = ["Low", "Normal", "High", "Urgent"]
BUG_SEVERITIES = ["Low", "Normal", "High", "Urgent"]
BROWSERS = ["Chrome", "Safari", "Firefox", "Edge", "Other"]
DEVICES = ["Desktop", "Mobile", "Tablet"]
ROLE_TYPES = ["system", "service_provider", "custom"]  # system=Admin/Requester, service_provider=Editor/Photographer/etc, custom=user-created

# ============== MODELS ==============

# Dynamic Role Models
class RoleCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    role_type: Literal["system", "service_provider", "custom"] = "custom"
    icon: Optional[str] = None
    color: Optional[str] = None
    can_pick_orders: bool = False  # Whether this role can pick orders from pool
    can_create_orders: bool = False  # Whether this role can create orders/requests

class RoleUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    can_pick_orders: Optional[bool] = None
    can_create_orders: Optional[bool] = None
    active: Optional[bool] = None

class RoleResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str] = None
    role_type: str
    icon: Optional[str] = None
    color: Optional[str] = None
    can_pick_orders: bool
    can_create_orders: bool
    active: bool
    created_at: str

# Team Models
class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    active: Optional[bool] = None

class TeamResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    active: bool
    member_count: int = 0
    created_at: str

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # Now dynamic - any role name
    team_id: Optional[str] = None  # Team assignment
    force_password_change: bool = False  # Force password change on next login
    force_otp_setup: bool = False  # Force OTP/2FA setup on next login

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None  # Now dynamic
    team_id: Optional[str] = None  # Team assignment
    active: Optional[bool] = None
    force_password_change: Optional[bool] = None  # Re-trigger password change
    force_otp_setup: Optional[bool] = None  # Re-trigger OTP setup

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
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    active: bool
    avatar: Optional[str] = None
    force_password_change: bool = False
    force_otp_setup: bool = False
    otp_verified: bool = False
    created_at: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# ============== WORKFLOW MODELS (Visual Builder) ==============

# Node types for the visual workflow builder
NODE_TYPES = ["trigger", "form", "action", "condition", "delay", "end"]
ACTION_TYPES = ["assign_role", "forward_ticket", "email_user", "email_requester", "update_status", "notify", "webhook"]

# Conditional sub-field model for dynamic form fields
class ConditionalSubField(BaseModel):
    id: str
    parent_value: str  # When parent field equals this value, show this sub-field
    label: str
    field_type: Literal["text", "textarea", "number", "email", "url", "date", "select", "multiselect", "checkbox", "file", "phone"]
    required: bool = False
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None  # For select/multiselect
    is_trigger: bool = False  # If true, this field value can trigger workflow actions

class FormFieldSchema(BaseModel):
    id: str
    name: str
    label: str
    field_type: Literal["text", "textarea", "number", "email", "url", "date", "select", "multiselect", "checkbox", "file", "phone"]
    required: bool = False
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None  # For select/multiselect
    default_value: Optional[str] = None
    validation_regex: Optional[str] = None
    help_text: Optional[str] = None
    is_trigger: bool = False  # If true, this field value can trigger workflow conditions/actions
    sub_fields: Optional[List[ConditionalSubField]] = None  # Conditional sub-fields based on this field's value

class NodeAction(BaseModel):
    id: str
    action_type: str  # assign_role, forward_ticket, email_user, email_requester, update_status, notify, webhook
    config: dict = {}  # Action-specific config (e.g., role_id for assign_role, email_template for email)

class WorkflowCondition(BaseModel):
    id: str
    field: str  # Field to check
    operator: str  # equals, not_equals, contains, greater_than, less_than, is_empty, is_not_empty
    value: Optional[str] = None

class WorkflowNode(BaseModel):
    id: str
    type: str  # trigger, form, action, condition, delay, end
    label: str
    position: dict  # {x: number, y: number}
    data: dict = {}  # Node-specific data
    # For form nodes: {fields: FormFieldSchema[]}
    # For action nodes: {actions: NodeAction[]}
    # For condition nodes: {conditions: WorkflowCondition[], default_path: str}
    # For delay nodes: {delay_type: 'minutes'|'hours'|'days', delay_value: int}
    # For trigger nodes: {trigger_type: 'manual'|'form_submit'|'schedule'|'webhook'}

class WorkflowEdge(BaseModel):
    id: str
    source: str  # Source node ID
    target: str  # Target node ID
    source_handle: Optional[str] = None  # For condition nodes with multiple outputs
    label: Optional[str] = None  # Edge label (e.g., "Yes", "No" for conditions)
    condition_value: Optional[str] = None  # The value this edge represents for condition nodes

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    assigned_roles: List[str] = []  # Role IDs that can use this workflow
    assigned_teams: List[str] = []  # Team IDs that can use this workflow
    trigger_categories: List[str] = []  # Category IDs that trigger this workflow
    color: Optional[str] = None
    nodes: List[WorkflowNode] = []
    edges: List[WorkflowEdge] = []
    is_template: bool = False  # If true, this is a template for creating new workflows

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    assigned_roles: Optional[List[str]] = None
    assigned_teams: Optional[List[str]] = None
    trigger_categories: Optional[List[str]] = None
    color: Optional[str] = None
    nodes: Optional[List[WorkflowNode]] = None
    edges: Optional[List[WorkflowEdge]] = None
    active: Optional[bool] = None

class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    assigned_roles: List[str] = []
    assigned_role_names: List[str] = []
    assigned_teams: List[str] = []
    assigned_team_names: List[str] = []
    trigger_categories: List[str] = []
    trigger_category_names: List[str] = []
    color: Optional[str] = None
    nodes: List[dict] = []
    edges: List[dict] = []
    is_template: bool = False
    active: bool
    created_at: str
    updated_at: Optional[str] = None

# Legacy compatibility - keep old models for migration
class WorkflowStepCreate(BaseModel):
    name: str
    order: int
    color: Optional[str] = None
    is_initial: bool = False
    is_final: bool = False
    requires_approval: bool = False
    notify_requester: bool = True

class WorkflowStep(WorkflowStepCreate):
    id: str

class FormFieldCreate(BaseModel):
    name: str
    label: str
    field_type: Literal["text", "textarea", "number", "email", "url", "date", "select", "multiselect", "checkbox", "file"]
    required: bool = False
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None
    order: int = 0

class FormField(FormFieldCreate):
    id: str

# ============== UI SETTINGS MODELS ==============
class UISettingUpdate(BaseModel):
    value: str

class UISettingResponse(BaseModel):
    key: str
    value: str
    category: str
    description: Optional[str] = None

# SMTP/Email Settings
class SMTPConfigUpdate(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True

class SMTPConfigResponse(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_from: str
    smtp_use_tls: bool
    is_configured: bool
    last_test_status: Optional[str] = None
    last_test_at: Optional[str] = None

class EmailTestRequest(BaseModel):
    to_email: str

# Announcement Ticker
class AnnouncementTickerUpdate(BaseModel):
    message: str
    is_active: bool = True
    background_color: Optional[str] = "#A2182C"
    text_color: Optional[str] = "#FFFFFF"

class AnnouncementTickerResponse(BaseModel):
    message: str
    is_active: bool
    background_color: str
    text_color: str
    updated_at: str
    updated_by_name: Optional[str] = None

# Satisfaction Ratings
class RatingCreate(BaseModel):
    token: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class RatingResponse(BaseModel):
    id: str
    order_id: str
    order_code: str
    requester_id: str
    requester_name: str
    resolver_id: str
    resolver_name: str
    rating: int
    comment: Optional[str] = None
    created_at: str

class ResolverStatsResponse(BaseModel):
    resolver_id: str
    resolver_name: str
    total_delivered: int
    total_ratings: int
    average_rating: float
    rating_distribution: dict  # {1: count, 2: count, ...5: count}

# Categories
class CategoryL1Create(BaseModel):
    name: str
    name_en: Optional[str] = None
    name_pt: Optional[str] = None
    name_es: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None

class CategoryL2Create(BaseModel):
    name: str
    name_en: Optional[str] = None
    name_pt: Optional[str] = None
    name_es: Optional[str] = None
    category_l1_id: str
    description: Optional[str] = None
    triggers_editor_workflow: bool = False

class CategoryL1Response(BaseModel):
    id: str
    name: str
    name_en: Optional[str] = None
    name_pt: Optional[str] = None
    name_es: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    active: bool
    created_at: str

class CategoryL2Response(BaseModel):
    id: str
    name: str
    name_en: Optional[str] = None
    name_pt: Optional[str] = None
    name_es: Optional[str] = None
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
    close_reason: Optional[str] = None  # Reason for closing by requester
    closed_at: Optional[str] = None  # When the ticket was closed
    sla_deadline: str
    is_sla_breached: bool
    created_at: str
    updated_at: str
    picked_at: Optional[str] = None
    delivered_at: Optional[str] = None

# Close Order Request
class CloseOrderRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

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
    assigned_to_name: Optional[str] = None  # Who the ticket is assigned to
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
    if status in ["Delivered", "Closed"]:
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
        "close_reason": None,
        "closed_at": None,
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

async def validate_role(role_name: str):
    """Check if a role exists in the database"""
    role = await db.roles.find_one({"name": role_name, "active": True}, {"_id": 0})
    return role

async def get_role_by_name(role_name: str):
    """Get full role details by name"""
    role = await db.roles.find_one({"name": role_name}, {"_id": 0})
    return role

async def is_service_provider(role_name: str):
    """Check if a role is a service provider (can pick orders)"""
    role = await db.roles.find_one({"name": role_name, "can_pick_orders": True}, {"_id": 0})
    return role is not None

async def build_user_response(user: dict) -> UserResponse:
    """Build UserResponse with team info"""
    team_name = None
    if user.get("team_id"):
        team = await db.teams.find_one({"id": user["team_id"]}, {"_id": 0, "name": 1})
        team_name = team["name"] if team else None
    
    return UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        team_id=user.get("team_id"),
        team_name=team_name,
        active=user.get("active", True),
        avatar=user.get("avatar"),
        force_password_change=user.get("force_password_change", False),
        force_otp_setup=user.get("force_otp_setup", False),
        otp_verified=user.get("otp_verified", False),
        created_at=user["created_at"]
    )

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

async def send_password_reset_email(to_email: str, user_name: str, reset_link: str):
    """Send password reset email"""
    subject = "Reset Your Password - Red Ribbon Ops Portal"
    body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
            .button {{ display: inline-block; background: #DC2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
            .footer {{ margin-top: 20px; font-size: 12px; color: #6b7280; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">Red Ribbon Ops Portal</h1>
            </div>
            <div class="content">
                <h2>Password Reset Request</h2>
                <p>Hi {user_name},</p>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <p style="text-align: center;">
                    <a href="{reset_link}" class="button" style="color: white;">Reset Password</a>
                </p>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px; font-size: 14px;">
                    {reset_link}
                </p>
                <p><strong>This link will expire in 1 hour.</strong></p>
                <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                <div class="footer">
                    <p>This is an automated message from Red Ribbon Ops Portal. Please do not reply to this email.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    await send_email_notification(to_email, subject, body)

async def send_satisfaction_survey_email(to_email: str, requester_name: str, resolver_name: str, order_code: str, order_title: str, survey_link: str):
    """Send satisfaction survey email after order is delivered"""
    subject = f"How was your experience? Rate {resolver_name} - {order_code}"
    body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
            .stars {{ font-size: 32px; color: #fbbf24; letter-spacing: 4px; }}
            .button {{ display: inline-block; background: #DC2626; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }}
            .order-box {{ background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0; }}
            .footer {{ margin-top: 20px; font-size: 12px; color: #6b7280; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">Red Ribbon Ops Portal</h1>
            </div>
            <div class="content">
                <h2 style="text-align: center;">Your Order Has Been Delivered! 🎉</h2>
                <p>Hi {requester_name},</p>
                <p>Great news! <strong>{resolver_name}</strong> has completed your order.</p>
                
                <div class="order-box">
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">Order</p>
                    <p style="margin: 4px 0 0 0; font-weight: bold;">{order_code} - {order_title}</p>
                </div>
                
                <p style="text-align: center;">How would you rate your experience?</p>
                <p style="text-align: center;" class="stars">★★★★★</p>
                
                <p style="text-align: center;">
                    <a href="{survey_link}" class="button" style="color: white;">Leave Your Rating</a>
                </p>
                
                <p style="text-align: center; font-size: 14px; color: #6b7280;">
                    Your feedback helps us maintain quality and recognize great work.
                </p>
                
                <div class="footer">
                    <p>This is an automated message from Red Ribbon Ops Portal.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    await send_email_notification(to_email, subject, body)

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
    user_response = await build_user_response(user)
    return LoginResponse(token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return await build_user_response(user)

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
    return await build_user_response(updated)

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

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    """Request a password reset link"""
    user = await db.users.find_one({"email": request.email.lower()}, {"_id": 0})
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account exists with this email, a password reset link has been sent."}
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
    
    # Store reset token in database
    await db.password_resets.delete_many({"user_id": user["id"]})  # Remove any existing tokens
    await db.password_resets.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "token": reset_token,
        "expires_at": expires_at.isoformat(),
        "used": False,
        "created_at": get_utc_now()
    })
    
    # Build reset link
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    
    # Send email in background
    background_tasks.add_task(
        send_password_reset_email,
        user["email"],
        user["name"],
        reset_link
    )
    
    return {"message": "If an account exists with this email, a password reset link has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using token from email"""
    # Find valid token
    reset_record = await db.password_resets.find_one({
        "token": request.token,
        "used": False
    }, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check if token is expired
    expires_at = datetime.fromisoformat(reset_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    # Validate password
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Update password
    await db.users.update_one(
        {"id": reset_record["user_id"]},
        {"$set": {"password": hash_password(request.new_password)}}
    )
    
    # Mark token as used
    await db.password_resets.update_one(
        {"token": request.token},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password has been reset successfully"}

@api_router.get("/auth/verify-reset-token")
async def verify_reset_token(token: str):
    """Verify if a reset token is valid"""
    reset_record = await db.password_resets.find_one({
        "token": token,
        "used": False
    }, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    expires_at = datetime.fromisoformat(reset_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    # Get user email for display
    user = await db.users.find_one({"id": reset_record["user_id"]}, {"_id": 0, "email": 1})
    
    return {"valid": True, "email": user["email"] if user else None}

# ============== USER ROUTES (Admin only) ==============

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_roles(["Admin"]))):
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Validate role exists
    role = await validate_role(user_data.role)
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{user_data.role}' does not exist")
    
    user = {
        "id": str(uuid.uuid4()),
        "name": user_data.name,
        "email": user_data.email.lower(),
        "password": hash_password(user_data.password),
        "role": user_data.role,
        "team_id": user_data.team_id,
        "active": True,
        "avatar": None,
        "force_password_change": user_data.force_password_change,
        "force_otp_setup": user_data.force_otp_setup,
        "otp_verified": False,
        "otp_secret": None,
        "created_at": get_utc_now()
    }
    await db.users.insert_one(user)
    
    # If force_otp_setup is enabled, generate and "send" OTP code
    if user_data.force_otp_setup:
        otp_code = str(random.randint(100000, 999999))
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"pending_otp_code": otp_code, "otp_code_expires": get_utc_now()}}
        )
        # MOCKED: In production, send email with OTP code
        print(f"[MOCKED EMAIL] OTP Code for {user['email']}: {otp_code}")
    
    # Trigger webhooks for user.created event
    await trigger_webhooks("user.created", {
        "user_id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "created_by": current_user["name"]
    })
    
    return await build_user_response(user)

@api_router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(require_roles(["Admin"]))):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    result = []
    for u in users:
        result.append(await build_user_response(u))
    return result

@api_router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate role if being updated
    if user_data.role:
        role = await validate_role(user_data.role)
        if not role:
            raise HTTPException(status_code=400, detail=f"Role '{user_data.role}' does not exist")
    
    # Validate team if being updated
    if user_data.team_id:
        team = await db.teams.find_one({"id": user_data.team_id, "active": True})
        if not team:
            raise HTTPException(status_code=400, detail="Team not found")
    
    update_dict = {k: v for k, v in user_data.model_dump().items() if v is not None}
    if "password" in update_dict:
        update_dict["password"] = hash_password(update_dict["password"])
    if "email" in update_dict:
        update_dict["email"] = update_dict["email"].lower()
    
    if update_dict:
        await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return await build_user_response(updated)

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
        "name_en": category_data.name_en,
        "name_pt": category_data.name_pt,
        "name_es": category_data.name_es,
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
        "name_en": category_data.name_en,
        "name_pt": category_data.name_pt,
        "name_es": category_data.name_es,
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

# ============== ROLES ROUTES ==============

@api_router.post("/roles", response_model=RoleResponse)
async def create_role(role_data: RoleCreate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new role"""
    # Check if role name already exists
    existing = await db.roles.find_one({"name": role_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Role with this name already exists")
    
    role = {
        "id": str(uuid.uuid4()),
        "name": role_data.name,
        "display_name": role_data.display_name,
        "description": role_data.description,
        "role_type": role_data.role_type,
        "icon": role_data.icon,
        "color": role_data.color,
        "can_pick_orders": role_data.can_pick_orders,
        "can_create_orders": role_data.can_create_orders,
        "active": True,
        "created_at": get_utc_now()
    }
    await db.roles.insert_one(role)
    return RoleResponse(**role)

@api_router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    role_type: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """List all roles"""
    query = {}
    if active_only:
        query["active"] = True
    if role_type:
        query["role_type"] = role_type
    
    roles = await db.roles.find(query, {"_id": 0}).sort("display_name", 1).to_list(1000)
    return [RoleResponse(**r) for r in roles]

@api_router.get("/roles/service-providers", response_model=List[RoleResponse])
async def list_service_provider_roles(current_user: dict = Depends(get_current_user)):
    """List all service provider roles (roles that can pick orders)"""
    roles = await db.roles.find({"can_pick_orders": True, "active": True}, {"_id": 0}).sort("display_name", 1).to_list(1000)
    return [RoleResponse(**r) for r in roles]

@api_router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(role_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific role by ID"""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return RoleResponse(**role)

@api_router.patch("/roles/{role_id}", response_model=RoleResponse)
async def update_role(role_id: str, role_data: RoleUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update a role"""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Don't allow modifying system roles
    if role.get("role_type") == "system":
        raise HTTPException(status_code=400, detail="Cannot modify system roles")
    
    update_dict = {k: v for k, v in role_data.model_dump().items() if v is not None}
    if update_dict:
        await db.roles.update_one({"id": role_id}, {"$set": update_dict})
    
    updated = await db.roles.find_one({"id": role_id}, {"_id": 0})
    return RoleResponse(**updated)

@api_router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Deactivate a role (soft delete)"""
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.get("role_type") == "system":
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    # Check if any users have this role
    users_with_role = await db.users.count_documents({"role": role["name"]})
    if users_with_role > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role: {users_with_role} users have this role assigned")
    
    await db.roles.update_one({"id": role_id}, {"$set": {"active": False}})
    return {"message": "Role deactivated"}

# ============== TEAM ROUTES ==============

@api_router.post("/teams", response_model=TeamResponse)
async def create_team(team_data: TeamCreate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new team"""
    existing = await db.teams.find_one({"name": team_data.name, "active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Team with this name already exists")
    
    team = {
        "id": str(uuid.uuid4()),
        "name": team_data.name,
        "description": team_data.description,
        "color": team_data.color or "#3B82F6",
        "active": True,
        "created_at": get_utc_now()
    }
    await db.teams.insert_one(team)
    
    return TeamResponse(**team, member_count=0)

@api_router.get("/teams", response_model=List[TeamResponse])
async def list_teams(active_only: bool = True, current_user: dict = Depends(get_current_user)):
    """List all teams"""
    query = {"active": True} if active_only else {}
    teams = await db.teams.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    
    # Get member counts
    result = []
    for team in teams:
        member_count = await db.users.count_documents({"team_id": team["id"], "active": True})
        result.append(TeamResponse(**team, member_count=member_count))
    
    return result

@api_router.get("/teams/{team_id}", response_model=TeamResponse)
async def get_team(team_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific team"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    member_count = await db.users.count_documents({"team_id": team_id, "active": True})
    return TeamResponse(**team, member_count=member_count)

@api_router.get("/teams/{team_id}/members", response_model=List[UserResponse])
async def get_team_members(team_id: str, current_user: dict = Depends(get_current_user)):
    """Get members of a team"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    users = await db.users.find({"team_id": team_id, "active": True}, {"_id": 0, "password": 0}).to_list(1000)
    
    result = []
    for u in users:
        result.append(UserResponse(
            **u,
            team_name=team["name"]
        ))
    
    return result

@api_router.patch("/teams/{team_id}", response_model=TeamResponse)
async def update_team(team_id: str, team_data: TeamUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update a team"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    update_dict = {k: v for k, v in team_data.model_dump().items() if v is not None}
    if update_dict:
        await db.teams.update_one({"id": team_id}, {"$set": update_dict})
    
    updated = await db.teams.find_one({"id": team_id}, {"_id": 0})
    member_count = await db.users.count_documents({"team_id": team_id, "active": True})
    return TeamResponse(**updated, member_count=member_count)

@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Deactivate a team (soft delete)"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Remove team assignment from users
    await db.users.update_many({"team_id": team_id}, {"$set": {"team_id": None}})
    await db.teams.update_one({"id": team_id}, {"$set": {"active": False}})
    
    return {"message": "Team deactivated"}

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
    
    # Trigger webhooks for order.created event
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
    
    # Trigger webhooks for order.updated event
    background_tasks.add_task(trigger_webhooks, "order.updated", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "title": order.get("title"),
        "old_status": old_status,
        "new_status": "In Progress",
        "assigned_to": current_user["name"],
        "assigned_to_email": current_user["email"]
    })
    
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
    
    # Trigger webhooks for order.delivered event
    background_tasks.add_task(trigger_webhooks, "order.delivered", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "title": order.get("title"),
        "requester_name": order.get("requester_name"),
        "requester_email": order.get("requester_email"),
        "delivered_by": current_user["name"],
        "delivered_by_email": current_user["email"]
    })
    
    # Create satisfaction survey and send email
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

@api_router.post("/orders/{order_id}/close")
async def close_order(order_id: str, close_data: CloseOrderRequest, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Allow requesters to close their own tickets with a reason"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only the requester or admin can close the order
    if order["requester_id"] != current_user["id"] and current_user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Only the requester can close this order")
    
    # Cannot close already closed orders
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
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    
    # Notify the assigned editor if there is one
    if order.get("editor_id"):
        await create_notification(
            order["editor_id"],
            "order_closed",
            "Order closed by requester",
            f"Order {order['order_code']} '{order['title']}' was closed by the requester. Reason: {close_data.reason}",
            order['id']
        )
    
    # Notify admins
    admins = await db.users.find({"role": "Admin", "active": True}, {"_id": 0}).to_list(100)
    for admin in admins:
        if admin['id'] != current_user['id']:
            await create_notification(
                admin['id'],
                "order_closed",
                f"Order closed",
                f"Order {order['order_code']} was closed by {current_user['name']}. Reason: {close_data.reason}",
                order['id']
            )
    
    # Trigger webhooks for order.closed event
    background_tasks.add_task(trigger_webhooks, "order.closed", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "title": order.get("title"),
        "old_status": old_status,
        "close_reason": close_data.reason,
        "closed_by": current_user["name"],
        "closed_by_email": current_user["email"]
    })
    
    return {"message": "Order closed successfully"}

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
            assigned_to_name=o.get("editor_name"),  # Include assigned editor
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
            assigned_to_name=None,  # Feature requests don't have assignments yet
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
            assigned_to_name=None,  # Bug reports don't have assignments yet
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
    
    # Check access - requester can only message on their own orders
    # Resolver (editor) can only message on orders they're assigned to
    # Admin can message on any order
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
    
    # Send notifications based on who sent the message
    if is_requester:
        # Requester sent message - notify the resolver if assigned
        if order.get("editor_id"):
            await create_notification(
                order["editor_id"], 
                "new_message", 
                "New message on your ticket", 
                f"{current_user['name']} sent a message on ticket {order['order_code']}: \"{message_data.message_body[:50]}{'...' if len(message_data.message_body) > 50 else ''}\"", 
                order_id
            )
        else:
            # No resolver assigned - notify admins
            admins = await db.users.find({"role": "Admin", "active": True}, {"_id": 0}).to_list(100)
            for admin in admins:
                await create_notification(
                    admin["id"], 
                    "new_message", 
                    "New message on unassigned ticket", 
                    f"{current_user['name']} sent a message on unassigned ticket {order['order_code']}: \"{message_data.message_body[:50]}{'...' if len(message_data.message_body) > 50 else ''}\"", 
                    order_id
                )
    else:
        # Resolver or Admin sent message - notify the requester
        if order.get("requester_id"):
            sender_label = "Your resolver" if is_resolver else "Admin"
            await create_notification(
                order["requester_id"], 
                "new_message", 
                "New message on your request", 
                f"{sender_label} sent a message on request {order['order_code']}: \"{message_data.message_body[:50]}{'...' if len(message_data.message_body) > 50 else ''}\"", 
                order_id
            )
    
    # Trigger webhooks for message.sent event
    await trigger_webhooks("message.sent", {
        "order_id": order_id,
        "order_code": order["order_code"],
        "message_id": message["id"],
        "author_name": current_user["name"],
        "author_email": current_user["email"],
        "author_role": current_user["role"],
        "message_preview": message_data.message_body[:100] + ("..." if len(message_data.message_body) > 100 else "")
    })
    
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
async def get_editor_dashboard(current_user: dict = Depends(get_current_user)):
    """Dashboard for service providers who can pick orders"""
    # Check if user's role can pick orders
    role = await get_role_by_name(current_user["role"])
    if not role or not role.get("can_pick_orders"):
        raise HTTPException(status_code=403, detail="Your role cannot pick orders")
    
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

# ============== WORKFLOW ROUTES (Visual Builder) ==============

async def get_role_names_by_ids(role_ids: List[str]) -> List[str]:
    """Helper to get role display names from IDs"""
    if not role_ids:
        return []
    roles = await db.roles.find({"id": {"$in": role_ids}}, {"_id": 0, "display_name": 1}).to_list(100)
    return [r["display_name"] for r in roles]

async def get_team_names_by_ids(team_ids: List[str]) -> List[str]:
    """Helper to get team names from IDs"""
    if not team_ids:
        return []
    teams = await db.teams.find({"id": {"$in": team_ids}}, {"_id": 0, "name": 1}).to_list(100)
    return [t["name"] for t in teams]

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
        "trigger_categories": [],
        "trigger_category_names": [],
        "nodes": [],
        "edges": [],
        "is_template": False,
        "updated_at": None
    }
    for key, default_val in defaults.items():
        if key not in workflow:
            workflow[key] = default_val
    return workflow

@api_router.post("/workflows", response_model=WorkflowResponse)
async def create_workflow(workflow_data: WorkflowCreate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new visual workflow"""
    existing = await db.workflows.find_one({"name": workflow_data.name, "active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Workflow with this name already exists")
    
    # Get names for assigned entities
    assigned_role_names = await get_role_names_by_ids(workflow_data.assigned_roles)
    assigned_team_names = await get_team_names_by_ids(workflow_data.assigned_teams)
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
        "trigger_categories": workflow_data.trigger_categories,
        "trigger_category_names": trigger_category_names,
        "color": workflow_data.color or "#3B82F6",
        "nodes": [n.model_dump() for n in workflow_data.nodes],
        "edges": [e.model_dump() for e in workflow_data.edges],
        "is_template": workflow_data.is_template,
        "active": True,
        "created_at": now,
        "updated_at": now
    }
    await db.workflows.insert_one(workflow)
    
    return WorkflowResponse(**workflow)

@api_router.get("/workflows", response_model=List[WorkflowResponse])
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

@api_router.get("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific workflow"""
    workflow = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return WorkflowResponse(**normalize_workflow(workflow))

@api_router.get("/workflows/by-role/{role_name}")
async def get_workflows_by_role(role_name: str, current_user: dict = Depends(get_current_user)):
    """Get workflows assigned to a specific role"""
    # Find role ID first
    role = await db.roles.find_one({"name": role_name}, {"_id": 0})
    if not role:
        return []
    
    workflows = await db.workflows.find({
        "assigned_roles": role["id"],
        "active": True
    }, {"_id": 0}).to_list(100)
    
    return [WorkflowResponse(**normalize_workflow(w)) for w in workflows]

@api_router.get("/workflows/by-team/{team_id}")
async def get_workflows_by_team(team_id: str, current_user: dict = Depends(get_current_user)):
    """Get workflows assigned to a specific team"""
    workflows = await db.workflows.find({
        "assigned_teams": team_id,
        "active": True
    }, {"_id": 0}).to_list(100)
    
    return [WorkflowResponse(**normalize_workflow(w)) for w in workflows]

@api_router.get("/workflows/by-category/{category_id}")
async def get_workflows_by_category(category_id: str, current_user: dict = Depends(get_current_user)):
    """Get workflows triggered by a specific category"""
    workflows = await db.workflows.find({
        "trigger_categories": category_id,
        "active": True
    }, {"_id": 0}).to_list(100)
    
    return [WorkflowResponse(**normalize_workflow(w)) for w in workflows]

@api_router.put("/workflows/{workflow_id}", response_model=WorkflowResponse)
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
    if "trigger_categories" in update_dict:
        update_dict["trigger_category_names"] = await get_category_names_by_ids(update_dict["trigger_categories"])
    
    update_dict["updated_at"] = get_utc_now()
    
    if update_dict:
        await db.workflows.update_one({"id": workflow_id}, {"$set": update_dict})
    
    updated = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    return WorkflowResponse(**normalize_workflow(updated))

@api_router.patch("/workflows/{workflow_id}", response_model=WorkflowResponse)
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
    if "trigger_categories" in update_dict:
        update_dict["trigger_category_names"] = await get_category_names_by_ids(update_dict["trigger_categories"])
    
    update_dict["updated_at"] = get_utc_now()
    
    if update_dict:
        await db.workflows.update_one({"id": workflow_id}, {"$set": update_dict})
    
    updated = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    return WorkflowResponse(**normalize_workflow(updated))

@api_router.post("/workflows/{workflow_id}/duplicate", response_model=WorkflowResponse)
async def duplicate_workflow(workflow_id: str, new_name: str = Query(...), current_user: dict = Depends(require_roles(["Admin"]))):
    """Duplicate an existing workflow"""
    workflow = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Check if name already exists
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
        "trigger_categories": workflow.get("trigger_categories", []),
        "trigger_category_names": workflow.get("trigger_category_names", []),
        "color": workflow.get("color"),
        "nodes": workflow.get("nodes", []),
        "edges": workflow.get("edges", []),
        "is_template": False,
        "active": True,
        "created_at": now,
        "updated_at": now
    }
    await db.workflows.insert_one(new_workflow)
    
    return WorkflowResponse(**normalize_workflow(new_workflow))

@api_router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Deactivate a workflow (soft delete)"""
    workflow = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    await db.workflows.update_one({"id": workflow_id}, {"$set": {"active": False, "updated_at": get_utc_now()}})
    return {"message": "Workflow deactivated"}

# Get available actions for workflow builder
@api_router.get("/workflows/meta/actions")
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
        ]
    }

# Get available field types for form builder
@api_router.get("/workflows/meta/field-types")
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

# ============== UI SETTINGS ROUTES ==============

@api_router.get("/ui-settings", response_model=List[UISettingResponse])
async def get_ui_settings(category: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all UI settings"""
    query = {}
    if category:
        query["category"] = category
    
    settings = await db.ui_settings.find(query, {"_id": 0}).to_list(1000)
    return [UISettingResponse(**s) for s in settings]

@api_router.get("/ui-settings/{key}", response_model=UISettingResponse)
async def get_ui_setting(key: str, current_user: dict = Depends(get_current_user)):
    """Get a specific UI setting"""
    setting = await db.ui_settings.find_one({"key": key}, {"_id": 0})
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return UISettingResponse(**setting)

@api_router.patch("/ui-settings/{key}", response_model=UISettingResponse)
async def update_ui_setting(key: str, data: UISettingUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update a UI setting value"""
    setting = await db.ui_settings.find_one({"key": key}, {"_id": 0})
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    await db.ui_settings.update_one({"key": key}, {"$set": {"value": data.value}})
    
    updated = await db.ui_settings.find_one({"key": key}, {"_id": 0})
    return UISettingResponse(**updated)

@api_router.post("/ui-settings/bulk-update")
async def bulk_update_ui_settings(settings: dict, current_user: dict = Depends(require_roles(["Admin"]))):
    """Bulk update multiple UI settings"""
    updated_count = 0
    for key, value in settings.items():
        result = await db.ui_settings.update_one({"key": key}, {"$set": {"value": value}})
        if result.modified_count > 0:
            updated_count += 1
    
    return {"message": f"Updated {updated_count} settings"}

@api_router.post("/ui-settings/reset")
async def reset_ui_settings(current_user: dict = Depends(require_roles(["Admin"]))):
    """Reset all UI settings to defaults"""
    # Get default settings from seed
    default_settings = get_default_ui_settings()
    
    for setting in default_settings:
        await db.ui_settings.update_one(
            {"key": setting["key"]},
            {"$set": {"value": setting["default_value"]}},
            upsert=True
        )
    
    return {"message": "UI settings reset to defaults"}

def get_default_ui_settings():
    """Return default UI settings"""
    return [
        # Branding
        {"key": "app_name", "value": "Red Ribbon Ops", "default_value": "Red Ribbon Ops", "category": "branding", "description": "Application name shown in header and login"},
        {"key": "app_tagline", "value": "Operations Portal", "default_value": "Operations Portal", "category": "branding", "description": "Tagline shown under app name"},
        {"key": "logo_text", "value": "RR", "default_value": "RR", "category": "branding", "description": "Text shown in logo placeholder"},
        
        # Navigation
        {"key": "nav_dashboard", "value": "Dashboard", "default_value": "Dashboard", "category": "navigation", "description": "Dashboard menu item"},
        {"key": "nav_command_center", "value": "Command Center", "default_value": "Command Center", "category": "navigation", "description": "Command Center menu item"},
        {"key": "nav_orders", "value": "All Orders", "default_value": "All Orders", "category": "navigation", "description": "Orders menu item"},
        {"key": "nav_users", "value": "Users", "default_value": "Users", "category": "navigation", "description": "Users menu item"},
        {"key": "nav_teams", "value": "Teams", "default_value": "Teams", "category": "navigation", "description": "Teams menu item"},
        {"key": "nav_roles", "value": "Roles", "default_value": "Roles", "category": "navigation", "description": "Roles menu item"},
        {"key": "nav_categories", "value": "Categories", "default_value": "Categories", "category": "navigation", "description": "Categories menu item"},
        {"key": "nav_workflows", "value": "Workflows", "default_value": "Workflows", "category": "navigation", "description": "Workflows menu item"},
        
        # Buttons
        {"key": "btn_create_request", "value": "Create New Request", "default_value": "Create New Request", "category": "buttons", "description": "Create request button text"},
        {"key": "btn_submit", "value": "Submit", "default_value": "Submit", "category": "buttons", "description": "Generic submit button"},
        {"key": "btn_save", "value": "Save", "default_value": "Save", "category": "buttons", "description": "Generic save button"},
        {"key": "btn_cancel", "value": "Cancel", "default_value": "Cancel", "category": "buttons", "description": "Generic cancel button"},
        {"key": "btn_login", "value": "Sign In", "default_value": "Sign In", "category": "buttons", "description": "Login button text"},
        
        # Labels
        {"key": "label_email", "value": "Email", "default_value": "Email", "category": "labels", "description": "Email field label"},
        {"key": "label_password", "value": "Password", "default_value": "Password", "category": "labels", "description": "Password field label"},
        {"key": "label_name", "value": "Name", "default_value": "Name", "category": "labels", "description": "Name field label"},
        {"key": "label_role", "value": "Role", "default_value": "Role", "category": "labels", "description": "Role field label"},
        {"key": "label_team", "value": "Team", "default_value": "Team", "category": "labels", "description": "Team field label"},
        
        # Status labels
        {"key": "status_open", "value": "Open", "default_value": "Open", "category": "statuses", "description": "Open status label"},
        {"key": "status_in_progress", "value": "In Progress", "default_value": "In Progress", "category": "statuses", "description": "In Progress status label"},
        {"key": "status_pending", "value": "Pending", "default_value": "Pending", "category": "statuses", "description": "Pending status label"},
        {"key": "status_delivered", "value": "Delivered", "default_value": "Delivered", "category": "statuses", "description": "Delivered status label"},
        
        # Messages
        {"key": "msg_welcome", "value": "Welcome back!", "default_value": "Welcome back!", "category": "messages", "description": "Login success message"},
        {"key": "msg_logout", "value": "Logged out successfully", "default_value": "Logged out successfully", "category": "messages", "description": "Logout message"},
        {"key": "msg_no_data", "value": "No data found", "default_value": "No data found", "category": "messages", "description": "Empty state message"},
    ]

# ============== ANNOUNCEMENT TICKER ROUTES ==============

@api_router.get("/announcement-ticker", response_model=AnnouncementTickerResponse)
async def get_announcement_ticker():
    """Get current announcement ticker (public - no auth required for display)"""
    ticker = await db.announcement_ticker.find_one({}, {"_id": 0})
    if not ticker:
        # Return default inactive ticker
        return AnnouncementTickerResponse(
            message="",
            is_active=False,
            background_color="#A2182C",
            text_color="#FFFFFF",
            updated_at=get_utc_now(),
            updated_by_name=None
        )
    return AnnouncementTickerResponse(**ticker)

@api_router.put("/announcement-ticker", response_model=AnnouncementTickerResponse)
async def update_announcement_ticker(ticker_data: AnnouncementTickerUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update announcement ticker (Admin only)"""
    ticker = {
        "message": ticker_data.message,
        "is_active": ticker_data.is_active,
        "background_color": ticker_data.background_color or "#A2182C",
        "text_color": ticker_data.text_color or "#FFFFFF",
        "updated_at": get_utc_now(),
        "updated_by_id": current_user["id"],
        "updated_by_name": current_user["name"]
    }
    
    # Upsert - only one ticker document exists
    await db.announcement_ticker.update_one(
        {},
        {"$set": ticker},
        upsert=True
    )
    
    return AnnouncementTickerResponse(**ticker)

# ============== SATISFACTION RATING ROUTES ==============

@api_router.get("/ratings/verify-token")
async def verify_rating_token(token: str):
    """Verify if a rating token is valid and get order details"""
    survey = await db.rating_surveys.find_one({"token": token, "completed": False}, {"_id": 0})
    
    if not survey:
        raise HTTPException(status_code=400, detail="Invalid or expired survey link")
    
    # Check expiry (7 days)
    created_at = datetime.fromisoformat(survey["created_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > created_at + timedelta(days=7):
        raise HTTPException(status_code=400, detail="Survey link has expired")
    
    order = await db.orders.find_one({"id": survey["order_id"]}, {"_id": 0})
    resolver = await db.users.find_one({"id": survey["resolver_id"]}, {"_id": 0, "password": 0})
    
    return {
        "valid": True,
        "order_code": order["order_code"] if order else None,
        "order_title": order["title"] if order else None,
        "resolver_name": resolver["name"] if resolver else None,
        "resolver_avatar": resolver.get("avatar") if resolver else None
    }

@api_router.post("/ratings/submit")
async def submit_rating(rating_data: RatingCreate):
    """Submit a satisfaction rating (public endpoint - uses token)"""
    survey = await db.rating_surveys.find_one({"token": rating_data.token, "completed": False}, {"_id": 0})
    
    if not survey:
        raise HTTPException(status_code=400, detail="Invalid or expired survey link")
    
    # Check if already rated
    existing = await db.ratings.find_one({"order_id": survey["order_id"]})
    if existing:
        raise HTTPException(status_code=400, detail="This order has already been rated")
    
    order = await db.orders.find_one({"id": survey["order_id"]}, {"_id": 0})
    requester = await db.users.find_one({"id": survey["requester_id"]}, {"_id": 0})
    resolver = await db.users.find_one({"id": survey["resolver_id"]}, {"_id": 0})
    
    # Create rating
    rating = {
        "id": str(uuid.uuid4()),
        "order_id": survey["order_id"],
        "order_code": order["order_code"] if order else "",
        "requester_id": survey["requester_id"],
        "requester_name": requester["name"] if requester else "Unknown",
        "resolver_id": survey["resolver_id"],
        "resolver_name": resolver["name"] if resolver else "Unknown",
        "rating": rating_data.rating,
        "comment": rating_data.comment,
        "created_at": get_utc_now()
    }
    await db.ratings.insert_one(rating)
    
    # Mark survey as completed
    await db.rating_surveys.update_one(
        {"token": rating_data.token},
        {"$set": {"completed": True, "completed_at": get_utc_now()}}
    )
    
    # Notify the resolver
    await create_notification(
        survey["resolver_id"],
        "rating",
        f"New {rating_data.rating}-star rating received",
        f"You received a {rating_data.rating}-star rating for order {order['order_code']}" + (f": \"{rating_data.comment}\"" if rating_data.comment else ""),
        survey["order_id"]
    )
    
    return {"message": "Thank you for your feedback!", "rating": rating_data.rating}

@api_router.get("/ratings/resolver/{resolver_id}", response_model=ResolverStatsResponse)
async def get_resolver_stats(resolver_id: str, current_user: dict = Depends(get_current_user)):
    """Get resolver's rating statistics"""
    resolver = await db.users.find_one({"id": resolver_id}, {"_id": 0})
    if not resolver:
        raise HTTPException(status_code=404, detail="Resolver not found")
    
    # Get all ratings for this resolver
    ratings = await db.ratings.find({"resolver_id": resolver_id}, {"_id": 0}).to_list(1000)
    
    # Get total delivered orders
    total_delivered = await db.orders.count_documents({"editor_id": resolver_id, "status": "Delivered"})
    
    # Calculate stats
    total_ratings = len(ratings)
    average_rating = 0.0
    rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    
    if total_ratings > 0:
        total_stars = sum(r["rating"] for r in ratings)
        average_rating = round(total_stars / total_ratings, 1)
        for r in ratings:
            rating_distribution[r["rating"]] += 1
    
    return ResolverStatsResponse(
        resolver_id=resolver_id,
        resolver_name=resolver["name"],
        total_delivered=total_delivered,
        total_ratings=total_ratings,
        average_rating=average_rating,
        rating_distribution=rating_distribution
    )

@api_router.get("/ratings/my-stats", response_model=ResolverStatsResponse)
async def get_my_rating_stats(current_user: dict = Depends(get_current_user)):
    """Get current user's rating statistics (for service providers)"""
    return await get_resolver_stats(current_user["id"], current_user)

@api_router.get("/ratings/resolver/{resolver_id}/reviews", response_model=List[RatingResponse])
async def get_resolver_reviews(resolver_id: str, limit: int = 10, current_user: dict = Depends(get_current_user)):
    """Get recent reviews for a resolver"""
    ratings = await db.ratings.find(
        {"resolver_id": resolver_id}, 
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [RatingResponse(**r) for r in ratings]

# ============== SEED DATA ==============

@api_router.post("/seed")
async def seed_data():
    """Seed initial admin user, roles, and categories"""
    
    # ========== SEED ROLES ==========
    roles_to_seed = [
        # System roles (always required)
        {"name": "Admin", "display_name": "Administrator", "description": "Full system access", "role_type": "system", "icon": "shield", "color": "#DC2626", "can_pick_orders": False, "can_create_orders": True},
        {"name": "Requester", "display_name": "Requester", "description": "Can submit requests and orders", "role_type": "system", "icon": "user", "color": "#3B82F6", "can_pick_orders": False, "can_create_orders": True},
        
        # Real Estate Service Providers
        {"name": "Editor", "display_name": "Video Editor", "description": "Video editing and post-production", "role_type": "service_provider", "icon": "video", "color": "#F59E0B", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Photographer", "display_name": "Photographer", "description": "Real estate and property photography", "role_type": "service_provider", "icon": "camera", "color": "#8B5CF6", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Videographer", "display_name": "Videographer", "description": "Property videography and drone footage", "role_type": "service_provider", "icon": "film", "color": "#EC4899", "can_pick_orders": True, "can_create_orders": False},
        {"name": "DroneOperator", "display_name": "Drone Operator", "description": "Aerial photography and videography", "role_type": "service_provider", "icon": "plane", "color": "#06B6D4", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Stager", "display_name": "Home Stager", "description": "Property staging and interior design", "role_type": "service_provider", "icon": "sofa", "color": "#10B981", "can_pick_orders": True, "can_create_orders": False},
        {"name": "VirtualStager", "display_name": "Virtual Stager", "description": "Virtual staging and 3D rendering", "role_type": "service_provider", "icon": "cube", "color": "#6366F1", "can_pick_orders": True, "can_create_orders": False},
        {"name": "FloorplanDesigner", "display_name": "Floor Plan Designer", "description": "2D/3D floor plan creation", "role_type": "service_provider", "icon": "layout", "color": "#14B8A6", "can_pick_orders": True, "can_create_orders": False},
        {"name": "HomeInspector", "display_name": "Home Inspector", "description": "Property inspection services", "role_type": "service_provider", "icon": "clipboard-check", "color": "#F97316", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Appraiser", "display_name": "Appraiser", "description": "Property valuation and appraisal", "role_type": "service_provider", "icon": "calculator", "color": "#84CC16", "can_pick_orders": True, "can_create_orders": False},
        {"name": "MortgageBroker", "display_name": "Mortgage Broker", "description": "Mortgage and financing services", "role_type": "service_provider", "icon": "landmark", "color": "#0EA5E9", "can_pick_orders": True, "can_create_orders": False},
        {"name": "TitleCompany", "display_name": "Title Company", "description": "Title search and insurance", "role_type": "service_provider", "icon": "file-text", "color": "#A855F7", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Surveyor", "display_name": "Land Surveyor", "description": "Land surveying and mapping", "role_type": "service_provider", "icon": "map", "color": "#22C55E", "can_pick_orders": True, "can_create_orders": False},
        
        # Trades & Contractors
        {"name": "GeneralContractor", "display_name": "General Contractor", "description": "General construction and renovation", "role_type": "service_provider", "icon": "hard-hat", "color": "#EAB308", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Electrician", "display_name": "Electrician", "description": "Electrical work and repairs", "role_type": "service_provider", "icon": "zap", "color": "#FBBF24", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Plumber", "display_name": "Plumber", "description": "Plumbing installation and repair", "role_type": "service_provider", "icon": "droplet", "color": "#3B82F6", "can_pick_orders": True, "can_create_orders": False},
        {"name": "HVACTechnician", "display_name": "HVAC Technician", "description": "Heating, ventilation, air conditioning", "role_type": "service_provider", "icon": "thermometer", "color": "#60A5FA", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Roofer", "display_name": "Roofer", "description": "Roofing installation and repair", "role_type": "service_provider", "icon": "home", "color": "#78716C", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Painter", "display_name": "Painter", "description": "Interior and exterior painting", "role_type": "service_provider", "icon": "paintbrush", "color": "#FB923C", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Landscaper", "display_name": "Landscaper", "description": "Landscaping and lawn care", "role_type": "service_provider", "icon": "tree", "color": "#22C55E", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Cleaner", "display_name": "Cleaning Service", "description": "Property cleaning and janitorial", "role_type": "service_provider", "icon": "sparkles", "color": "#06B6D4", "can_pick_orders": True, "can_create_orders": False},
        {"name": "PestControl", "display_name": "Pest Control", "description": "Pest inspection and treatment", "role_type": "service_provider", "icon": "bug", "color": "#EF4444", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Locksmith", "display_name": "Locksmith", "description": "Lock installation and rekeying", "role_type": "service_provider", "icon": "key", "color": "#A3A3A3", "can_pick_orders": True, "can_create_orders": False},
        
        # Marketing Services
        {"name": "GraphicDesigner", "display_name": "Graphic Designer", "description": "Branding and visual design", "role_type": "service_provider", "icon": "palette", "color": "#E879F9", "can_pick_orders": True, "can_create_orders": False},
        {"name": "SocialMediaManager", "display_name": "Social Media Manager", "description": "Social media marketing", "role_type": "service_provider", "icon": "share-2", "color": "#F472B6", "can_pick_orders": True, "can_create_orders": False},
        {"name": "Copywriter", "display_name": "Copywriter", "description": "Property descriptions and marketing copy", "role_type": "service_provider", "icon": "pen-tool", "color": "#818CF8", "can_pick_orders": True, "can_create_orders": False},
        {"name": "SEOSpecialist", "display_name": "SEO Specialist", "description": "Search engine optimization", "role_type": "service_provider", "icon": "search", "color": "#34D399", "can_pick_orders": True, "can_create_orders": False},
        {"name": "WebDeveloper", "display_name": "Web Developer", "description": "Website development and maintenance", "role_type": "service_provider", "icon": "code", "color": "#60A5FA", "can_pick_orders": True, "can_create_orders": False},
        {"name": "PrintSpecialist", "display_name": "Print Specialist", "description": "Flyers, brochures, signage", "role_type": "service_provider", "icon": "printer", "color": "#A78BFA", "can_pick_orders": True, "can_create_orders": False},
        {"name": "SignInstaller", "display_name": "Sign Installer", "description": "Yard signs and property signage", "role_type": "service_provider", "icon": "signpost", "color": "#FACC15", "can_pick_orders": True, "can_create_orders": False},
    ]
    
    roles_created = 0
    for role in roles_to_seed:
        existing = await db.roles.find_one({"name": role["name"]})
        if not existing:
            role["id"] = str(uuid.uuid4())
            role["active"] = True
            role["created_at"] = get_utc_now()
            await db.roles.insert_one(role)
            roles_created += 1
    
    # ========== SEED ADMIN USER ==========
    existing = await db.users.find_one({"email": "admin@redribbonops.com"})
    if not existing:
        admin = {
            "id": str(uuid.uuid4()),
            "name": "Admin",
            "email": "admin@redribbonops.com",
            "password": hash_password("Fmtvvl171**"),
            "role": "Admin",
            "active": True,
            "avatar": None,
            "created_at": get_utc_now()
        }
        await db.users.insert_one(admin)
    
    # ========== SEED CATEGORIES ==========
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
    
    # ========== SEED UI SETTINGS ==========
    ui_settings_count = await db.ui_settings.count_documents({})
    if ui_settings_count == 0:
        default_settings = get_default_ui_settings()
        for setting in default_settings:
            setting["id"] = str(uuid.uuid4())
            setting["created_at"] = get_utc_now()
            await db.ui_settings.insert_one(setting)
    
    # Count total roles
    total_roles = await db.roles.count_documents({"active": True})
    
    return {
        "message": "Seed data created",
        "admin_email": "admin@redribbonops.com",
        "admin_password": "admin123",
        "roles_created": roles_created,
        "total_roles": total_roles
    }

# ============== SMTP/EMAIL ROUTES ==============

@api_router.get("/smtp-config", response_model=SMTPConfigResponse)
async def get_smtp_config(current_user: dict = Depends(require_roles(["Admin"]))):
    """Get current SMTP configuration (password hidden)"""
    config = await db.smtp_config.find_one({}, {"_id": 0})
    if not config:
        return SMTPConfigResponse(
            smtp_host="",
            smtp_port=587,
            smtp_user="",
            smtp_from="",
            smtp_use_tls=True,
            is_configured=False,
            last_test_status=None,
            last_test_at=None
        )
    return SMTPConfigResponse(
        smtp_host=config.get("smtp_host", ""),
        smtp_port=config.get("smtp_port", 587),
        smtp_user=config.get("smtp_user", ""),
        smtp_from=config.get("smtp_from", ""),
        smtp_use_tls=config.get("smtp_use_tls", True),
        is_configured=bool(config.get("smtp_host") and config.get("smtp_user")),
        last_test_status=config.get("last_test_status"),
        last_test_at=config.get("last_test_at")
    )

@api_router.put("/smtp-config", response_model=SMTPConfigResponse)
async def update_smtp_config(config_data: SMTPConfigUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update SMTP configuration"""
    config = {
        "smtp_host": config_data.smtp_host,
        "smtp_port": config_data.smtp_port,
        "smtp_user": config_data.smtp_user,
        "smtp_from": config_data.smtp_from,
        "smtp_use_tls": config_data.smtp_use_tls,
        "updated_at": get_utc_now(),
        "updated_by_id": current_user["id"]
    }
    
    # Only update password if provided
    if config_data.smtp_password:
        config["smtp_password"] = config_data.smtp_password
    
    # Upsert config
    existing = await db.smtp_config.find_one({})
    if existing:
        await db.smtp_config.update_one({}, {"$set": config})
    else:
        await db.smtp_config.insert_one(config)
    
    return SMTPConfigResponse(
        smtp_host=config["smtp_host"],
        smtp_port=config["smtp_port"],
        smtp_user=config["smtp_user"],
        smtp_from=config["smtp_from"],
        smtp_use_tls=config["smtp_use_tls"],
        is_configured=bool(config["smtp_host"] and config["smtp_user"]),
        last_test_status=existing.get("last_test_status") if existing else None,
        last_test_at=existing.get("last_test_at") if existing else None
    )

@api_router.post("/smtp-config/test")
async def test_smtp_config(test_data: EmailTestRequest, current_user: dict = Depends(require_roles(["Admin"]))):
    """Test SMTP configuration by sending a test email"""
    config = await db.smtp_config.find_one({}, {"_id": 0})
    if not config or not config.get("smtp_host") or not config.get("smtp_user"):
        raise HTTPException(status_code=400, detail="SMTP not configured. Please save configuration first.")
    
    try:
        msg = MIMEMultipart()
        msg['From'] = config.get("smtp_from", config["smtp_user"])
        msg['To'] = test_data.to_email
        msg['Subject'] = "Red Ops - SMTP Test Email"
        
        body = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #DC2626;">SMTP Configuration Test</h2>
            <p>This is a test email from Red Ops Portal.</p>
            <p>If you received this email, your SMTP configuration is working correctly!</p>
            <hr>
            <p style="color: #6b7280; font-size: 12px;">
                Sent at: {get_utc_now()}<br>
                Server: {config["smtp_host"]}:{config["smtp_port"]}
            </p>
        </body>
        </html>
        """
        msg.attach(MIMEText(body, 'html'))
        
        with smtplib.SMTP(config["smtp_host"], int(config["smtp_port"])) as server:
            if config.get("smtp_use_tls", True):
                server.starttls()
            server.login(config["smtp_user"], config.get("smtp_password", ""))
            server.send_message(msg)
        
        # Update test status
        await db.smtp_config.update_one({}, {"$set": {
            "last_test_status": "success",
            "last_test_at": get_utc_now()
        }})
        
        return {"message": f"Test email sent successfully to {test_data.to_email}", "status": "success"}
        
    except Exception as e:
        # Update test status
        await db.smtp_config.update_one({}, {"$set": {
            "last_test_status": f"failed: {str(e)}",
            "last_test_at": get_utc_now()
        }})
        raise HTTPException(status_code=500, detail=f"Failed to send test email: {str(e)}")

# Helper function to get SMTP config from database (for use in email sending)
async def get_smtp_settings():
    """Get SMTP settings from database, fallback to env vars"""
    config = await db.smtp_config.find_one({}, {"_id": 0})
    if config and config.get("smtp_host") and config.get("smtp_user"):
        return {
            "host": config["smtp_host"],
            "port": config.get("smtp_port", 587),
            "user": config["smtp_user"],
            "password": config.get("smtp_password", ""),
            "from_email": config.get("smtp_from", config["smtp_user"]),
            "use_tls": config.get("smtp_use_tls", True)
        }
    # Fallback to environment variables
    return {
        "host": os.environ.get('SMTP_HOST', ''),
        "port": int(os.environ.get('SMTP_PORT', '587')),
        "user": os.environ.get('SMTP_USER', ''),
        "password": os.environ.get('SMTP_PASSWORD', ''),
        "from_email": os.environ.get('SMTP_FROM', 'info@redribbonrealty.ca'),
        "use_tls": True
    }

# ============== WEBHOOK EXECUTION ==============

import httpx

async def trigger_webhooks(event: str, payload: dict):
    """Trigger all active outgoing webhooks for a given event"""
    webhooks = await db.webhooks.find({
        "direction": "outgoing",
        "is_active": True,
        "events": event
    }, {"_id": 0}).to_list(100)
    
    if not webhooks:
        return
    
    for webhook in webhooks:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    webhook["url"],
                    json={
                        "event": event,
                        "timestamp": get_utc_now(),
                        "data": payload
                    },
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Event": event,
                        "X-Webhook-Source": "red-ops"
                    }
                )
                
                # Log webhook delivery
                await db.webhook_logs.insert_one({
                    "id": str(uuid.uuid4()),
                    "webhook_id": webhook["id"],
                    "webhook_name": webhook["name"],
                    "event": event,
                    "url": webhook["url"],
                    "status_code": response.status_code,
                    "success": 200 <= response.status_code < 300,
                    "response_body": response.text[:500] if response.text else None,
                    "timestamp": get_utc_now()
                })
                
                # Update last triggered
                await db.webhooks.update_one(
                    {"id": webhook["id"]},
                    {"$set": {"last_triggered": get_utc_now()}}
                )
                
        except Exception as e:
            logging.error(f"Webhook delivery failed for {webhook['name']}: {e}")
            await db.webhook_logs.insert_one({
                "id": str(uuid.uuid4()),
                "webhook_id": webhook["id"],
                "webhook_name": webhook["name"],
                "event": event,
                "url": webhook["url"],
                "status_code": None,
                "success": False,
                "error": str(e),
                "timestamp": get_utc_now()
            })

# ============== LOGS ROUTES ==============

class LogEntry(BaseModel):
    id: str
    timestamp: str
    level: str
    message: str
    source: str
    details: Optional[dict] = None

class LogsResponse(BaseModel):
    logs: List[LogEntry]
    total: int

@api_router.get("/logs/{log_type}", response_model=LogsResponse)
async def get_logs(log_type: str, limit: int = 500, current_user: dict = Depends(require_roles(["Admin"]))):
    """Get logs by type (system, api, ui, user). Returns simulated logs for demo."""
    if log_type not in ['system', 'api', 'ui', 'user']:
        raise HTTPException(status_code=400, detail="Invalid log type")
    
    # Get logs from database (or generate sample for demo)
    logs = await db.activity_logs.find(
        {"source": log_type},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # If no logs exist, return empty list
    return LogsResponse(logs=logs, total=len(logs))

@api_router.post("/logs")
async def create_log(log_data: dict, current_user: dict = Depends(get_current_user)):
    """Create a new log entry (internal use)"""
    log_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": get_utc_now(),
        "level": log_data.get("level", "INFO"),
        "message": log_data.get("message", ""),
        "source": log_data.get("source", "system"),
        "details": log_data.get("details"),
        "user_id": current_user.get("id"),
        "user_name": current_user.get("name")
    }
    await db.activity_logs.insert_one(log_entry)
    return {"message": "Log created", "id": log_entry["id"]}

# ============== API KEYS & WEBHOOKS ROUTES ==============

class ApiKeyCreate(BaseModel):
    name: str
    permissions: str = "read"

class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_preview: str
    permissions: str
    created_at: str
    last_used: Optional[str] = None
    is_active: bool = True

class WebhookCreate(BaseModel):
    name: str
    url: str
    direction: str = "outgoing"
    events: List[str] = []
    is_active: bool = True

class WebhookResponse(BaseModel):
    id: str
    name: str
    url: str
    direction: str
    events: List[str]
    is_active: bool
    created_at: str
    last_triggered: Optional[str] = None
    success_rate: Optional[int] = None

@api_router.get("/api-keys", response_model=List[ApiKeyResponse])
async def list_api_keys(current_user: dict = Depends(require_roles(["Admin"]))):
    """List all API keys"""
    keys = await db.api_keys.find({}, {"_id": 0, "key": 0}).to_list(100)
    return keys

@api_router.post("/api-keys", response_model=dict)
async def create_api_key(key_data: ApiKeyCreate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new API key"""
    key_prefix = "rr_live_" if key_data.permissions == "read_write" else "rr_read_"
    full_key = key_prefix + str(uuid.uuid4()).replace("-", "")[:24]
    
    api_key = {
        "id": str(uuid.uuid4()),
        "name": key_data.name,
        "key": full_key,  # Store full key (hashed in production)
        "key_preview": key_prefix + "****" + full_key[-4:],
        "permissions": key_data.permissions,
        "created_at": get_utc_now(),
        "last_used": None,
        "is_active": True,
        "created_by_id": current_user["id"]
    }
    await db.api_keys.insert_one(api_key)
    
    return {"id": api_key["id"], "key": full_key, "message": "API key created"}

@api_router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Revoke an API key"""
    result = await db.api_keys.delete_one({"id": key_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key revoked"}

@api_router.get("/webhooks", response_model=List[WebhookResponse])
async def list_webhooks(current_user: dict = Depends(require_roles(["Admin"]))):
    """List all webhooks"""
    webhooks = await db.webhooks.find({}, {"_id": 0}).to_list(100)
    return webhooks

@api_router.post("/webhooks", response_model=WebhookResponse)
async def create_webhook(webhook_data: WebhookCreate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new webhook"""
    webhook = {
        "id": str(uuid.uuid4()),
        "name": webhook_data.name,
        "url": webhook_data.url,
        "direction": webhook_data.direction,
        "events": webhook_data.events,
        "is_active": webhook_data.is_active,
        "created_at": get_utc_now(),
        "last_triggered": None,
        "success_rate": 100,
        "created_by_id": current_user["id"]
    }
    await db.webhooks.insert_one(webhook)
    return WebhookResponse(**webhook)

@api_router.patch("/webhooks/{webhook_id}")
async def update_webhook(webhook_id: str, updates: dict, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update a webhook"""
    allowed_fields = ["name", "url", "events", "is_active"]
    update_dict = {k: v for k, v in updates.items() if k in allowed_fields}
    
    result = await db.webhooks.update_one(
        {"id": webhook_id},
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"message": "Webhook updated"}

@api_router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Delete a webhook"""
    result = await db.webhooks.delete_one({"id": webhook_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"message": "Webhook deleted"}

# ============== SLA ROUTES ==============

class SLACreate(BaseModel):
    name: str
    description: Optional[str] = None
    response_time_hours: int
    resolution_time_hours: int
    priority: str = "Normal"
    applies_to_type: str  # "role" or "team"
    applies_to_id: str

class SLAResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    response_time_hours: int
    resolution_time_hours: int
    priority: str
    applies_to_type: str
    applies_to_id: str
    applies_to_name: Optional[str] = None
    is_active: bool = True
    created_at: str

@api_router.get("/sla", response_model=List[SLAResponse])
async def list_slas(current_user: dict = Depends(require_roles(["Admin"]))):
    """List all SLA definitions"""
    slas = await db.sla_definitions.find({}, {"_id": 0}).to_list(100)
    
    # Enrich with applies_to_name
    for sla in slas:
        if sla.get("applies_to_type") == "role":
            role = await db.roles.find_one({"id": sla["applies_to_id"]}, {"_id": 0, "name": 1})
            sla["applies_to_name"] = role["name"] if role else "Unknown"
        elif sla.get("applies_to_type") == "team":
            team = await db.teams.find_one({"id": sla["applies_to_id"]}, {"_id": 0, "name": 1})
            sla["applies_to_name"] = team["name"] if team else "Unknown"
    
    return slas

@api_router.post("/sla", response_model=SLAResponse)
async def create_sla(sla_data: SLACreate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new SLA definition"""
    # Get applies_to_name
    applies_to_name = None
    if sla_data.applies_to_type == "role":
        role = await db.roles.find_one({"id": sla_data.applies_to_id}, {"_id": 0, "name": 1})
        applies_to_name = role["name"] if role else "Unknown"
    elif sla_data.applies_to_type == "team":
        team = await db.teams.find_one({"id": sla_data.applies_to_id}, {"_id": 0, "name": 1})
        applies_to_name = team["name"] if team else "Unknown"
    
    sla = {
        "id": str(uuid.uuid4()),
        "name": sla_data.name,
        "description": sla_data.description,
        "response_time_hours": sla_data.response_time_hours,
        "resolution_time_hours": sla_data.resolution_time_hours,
        "priority": sla_data.priority,
        "applies_to_type": sla_data.applies_to_type,
        "applies_to_id": sla_data.applies_to_id,
        "applies_to_name": applies_to_name,
        "is_active": True,
        "created_at": get_utc_now()
    }
    await db.sla_definitions.insert_one(sla)
    return SLAResponse(**sla)

@api_router.patch("/sla/{sla_id}")
async def update_sla(sla_id: str, updates: dict, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update an SLA definition"""
    result = await db.sla_definitions.update_one(
        {"id": sla_id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="SLA not found")
    return {"message": "SLA updated"}

@api_router.delete("/sla/{sla_id}")
async def delete_sla(sla_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Delete an SLA definition"""
    result = await db.sla_definitions.delete_one({"id": sla_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="SLA not found")
    return {"message": "SLA deleted"}

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
