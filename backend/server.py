from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Query
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
import re

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

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

app = FastAPI(title="Red Ribbon Ops Portal API")
api_router = APIRouter(prefix="/api")

# ============== ENUMS ==============
ORDER_TYPES = ["Video Edit", "Reel Batch", "Listing Video", "Marketplace Service", "Videography Booking", "Other"]
ORDER_STATUSES = ["New", "In Progress", "Needs Client Review", "Revision Requested", "Approved", "Delivered", "Canceled"]
PRIORITIES = ["Low", "Normal", "High", "Urgent"]
SOURCES = ["Manual", "Marketplace", "GHL", "Other"]
FILE_TYPES = ["Raw", "Working", "Export", "Final", "Other"]
USER_ROLES = ["Admin", "Manager", "Editor", "Client"]
TICKET_STATUSES = ["Open", "Waiting", "Closed"]

# ============== MODELS ==============

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["Admin", "Manager", "Editor", "Client"]
    client_id: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[Literal["Admin", "Manager", "Editor", "Client"]] = None
    active: Optional[bool] = None
    client_id: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    active: bool
    client_id: Optional[str] = None
    created_at: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

class ClientCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    notes: Optional[str] = None

class ClientResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    notes: Optional[str] = None
    created_at: str

class OrderCreate(BaseModel):
    client_id: str
    title: str
    type: Literal["Video Edit", "Reel Batch", "Listing Video", "Marketplace Service", "Videography Booking", "Other"]
    priority: Literal["Low", "Normal", "High", "Urgent"] = "Normal"
    due_date: Optional[str] = None
    assigned_editor_id: str
    assigned_qc_id: Optional[str] = None
    source: Literal["Manual", "Marketplace", "GHL", "Other"] = "Manual"
    intake_required: bool = True
    notes: Optional[str] = None

class OrderUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    assigned_editor_id: Optional[str] = None
    assigned_qc_id: Optional[str] = None
    intake_required: Optional[bool] = None
    intake_completed: Optional[bool] = None

class OrderResponse(BaseModel):
    id: str
    order_code: str
    client_id: str
    client_name: Optional[str] = None
    title: str
    type: str
    status: str
    priority: str
    due_date: Optional[str] = None
    assigned_editor_id: str
    assigned_editor_name: Optional[str] = None
    assigned_qc_id: Optional[str] = None
    assigned_qc_name: Optional[str] = None
    source: str
    intake_required: bool
    intake_completed: bool
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
    file_type: Literal["Raw", "Working", "Export", "Final", "Other"]
    label: str
    url_or_upload: str
    version: str = "V1"

class FileResponse(BaseModel):
    id: str
    order_id: str
    uploaded_by_user_id: str
    uploaded_by_name: str
    file_type: str
    label: str
    url_or_upload: str
    version: str
    is_pinned_latest_final: bool
    created_at: str

class ChecklistUpdate(BaseModel):
    intake_complete: Optional[bool] = None
    assets_received: Optional[bool] = None
    first_cut_delivered: Optional[bool] = None
    revision_round_1_done: Optional[bool] = None
    final_export_delivered: Optional[bool] = None

class ChecklistResponse(BaseModel):
    id: str
    order_id: str
    intake_complete: bool
    assets_received: bool
    first_cut_delivered: bool
    revision_round_1_done: bool
    final_export_delivered: bool
    updated_at: str

class TicketCreate(BaseModel):
    subject: str
    client_id: Optional[str] = None
    related_order_id: Optional[str] = None
    message_body: Optional[str] = None

class TicketResponse(BaseModel):
    id: str
    ticket_code: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    related_order_id: Optional[str] = None
    related_order_code: Optional[str] = None
    subject: str
    status: str
    owner_user_id: str
    owner_name: str
    created_at: str
    updated_at: str

class TicketMessageCreate(BaseModel):
    message_body: str

class TicketMessageResponse(BaseModel):
    id: str
    ticket_id: str
    author_user_id: str
    author_name: str
    author_role: str
    message_body: str
    created_at: str

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    related_order_id: Optional[str] = None
    related_ticket_id: Optional[str] = None
    is_read: bool
    created_at: str

class ActivityLogResponse(BaseModel):
    id: str
    order_id: str
    user_id: str
    user_name: str
    action: str
    details: str
    created_at: str

class WebhookOrderCreate(BaseModel):
    client_name: str
    client_email: EmailStr
    client_phone: Optional[str] = None
    title: str
    type: str = "Video Edit"
    due_date: Optional[str] = None
    notes: Optional[str] = None
    assigned_editor_email: Optional[str] = None

class DashboardStats(BaseModel):
    new_count: int
    in_progress_count: int
    needs_review_count: int
    revision_requested_count: int
    delivered_last_7_days: int

# ============== HELPERS ==============

def get_utc_now():
    return datetime.now(timezone.utc).isoformat()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

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

async def get_next_ticket_code():
    counter = await db.counters.find_one_and_update(
        {"_id": "ticket_code"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"TCK-{str(counter['seq']).zfill(6)}"

async def create_notification(user_id: str, type: str, title: str, message: str, related_order_id: str = None, related_ticket_id: str = None):
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type,
        "title": title,
        "message": message,
        "related_order_id": related_order_id,
        "related_ticket_id": related_ticket_id,
        "is_read": False,
        "created_at": get_utc_now()
    }
    await db.notifications.insert_one(notification)

async def create_activity_log(order_id: str, user_id: str, user_name: str, action: str, details: str):
    activity = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "details": details,
        "created_at": get_utc_now()
    }
    await db.activity_logs.insert_one(activity)

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
            client_id=user.get("client_id"),
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
        client_id=user.get("client_id"),
        created_at=user["created_at"]
    )

# ============== USER ROUTES ==============

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
        "client_id": user_data.client_id,
        "created_at": get_utc_now()
    }
    await db.users.insert_one(user)
    return UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        active=user["active"],
        client_id=user.get("client_id"),
        created_at=user["created_at"]
    )

@api_router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(require_roles(["Admin", "Manager"]))):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(require_roles(["Admin", "Manager"]))):
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
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

@api_router.get("/users/role/editors", response_model=List[UserResponse])
async def list_editors(current_user: dict = Depends(require_roles(["Admin", "Manager"]))):
    users = await db.users.find({"role": "Editor", "active": True}, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

# ============== CLIENT ROUTES ==============

@api_router.post("/clients", response_model=ClientResponse)
async def create_client(client_data: ClientCreate, current_user: dict = Depends(require_roles(["Admin", "Manager"]))):
    existing = await db.clients.find_one({"email": client_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Client email already exists")
    
    client = {
        "id": str(uuid.uuid4()),
        "name": client_data.name,
        "email": client_data.email.lower(),
        "phone": client_data.phone,
        "notes": client_data.notes,
        "created_at": get_utc_now()
    }
    await db.clients.insert_one(client)
    return ClientResponse(**client)

@api_router.get("/clients", response_model=List[ClientResponse])
async def list_clients(current_user: dict = Depends(require_roles(["Admin", "Manager"]))):
    clients = await db.clients.find({}, {"_id": 0}).to_list(1000)
    return [ClientResponse(**c) for c in clients]

@api_router.get("/clients/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str, current_user: dict = Depends(require_roles(["Admin", "Manager"]))):
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return ClientResponse(**client)

@api_router.patch("/clients/{client_id}", response_model=ClientResponse)
async def update_client(client_id: str, client_data: ClientCreate, current_user: dict = Depends(require_roles(["Admin", "Manager"]))):
    client = await db.clients.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    update_dict = client_data.model_dump()
    update_dict["email"] = update_dict["email"].lower()
    await db.clients.update_one({"id": client_id}, {"$set": update_dict})
    
    updated = await db.clients.find_one({"id": client_id}, {"_id": 0})
    return ClientResponse(**updated)

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    result = await db.clients.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client deleted"}

# ============== ORDER ROUTES ==============

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order_data: OrderCreate, current_user: dict = Depends(require_roles(["Admin", "Manager"]))):
    # Verify client exists
    client = await db.clients.find_one({"id": order_data.client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=400, detail="Client not found")
    
    # Verify editor exists
    editor = await db.users.find_one({"id": order_data.assigned_editor_id, "role": "Editor"}, {"_id": 0})
    if not editor:
        raise HTTPException(status_code=400, detail="Editor not found")
    
    order_code = await get_next_order_code()
    order = {
        "id": str(uuid.uuid4()),
        "order_code": order_code,
        "client_id": order_data.client_id,
        "title": order_data.title,
        "type": order_data.type,
        "status": "New",
        "priority": order_data.priority,
        "due_date": order_data.due_date,
        "assigned_editor_id": order_data.assigned_editor_id,
        "assigned_qc_id": order_data.assigned_qc_id,
        "source": order_data.source,
        "intake_required": order_data.intake_required,
        "intake_completed": False,
        "created_at": get_utc_now(),
        "updated_at": get_utc_now()
    }
    await db.orders.insert_one(order)
    
    # Create checklist
    checklist = {
        "id": str(uuid.uuid4()),
        "order_id": order["id"],
        "intake_complete": False,
        "assets_received": False,
        "first_cut_delivered": False,
        "revision_round_1_done": False,
        "final_export_delivered": False,
        "updated_at": get_utc_now()
    }
    await db.order_checklists.insert_one(checklist)
    
    # Create initial message if notes provided
    if order_data.notes:
        message = {
            "id": str(uuid.uuid4()),
            "order_id": order["id"],
            "author_user_id": current_user["id"],
            "author_name": current_user["name"],
            "author_role": current_user["role"],
            "message_body": f"**Order Notes:**\n{order_data.notes}",
            "created_at": get_utc_now()
        }
        await db.order_messages.insert_one(message)
    
    # Activity log
    await create_activity_log(order["id"], current_user["id"], current_user["name"], "created", f"Order {order_code} created")
    
    # Notify editor
    await create_notification(
        order_data.assigned_editor_id,
        "new_order",
        "New Order Assigned",
        f"You have been assigned to order {order_code}: {order_data.title}",
        related_order_id=order["id"]
    )
    
    return OrderResponse(
        **order,
        client_name=client["name"],
        assigned_editor_name=editor["name"],
        assigned_qc_name=None
    )

@api_router.get("/orders", response_model=List[OrderResponse])
async def list_orders(
    status: Optional[str] = None,
    assigned_editor_id: Optional[str] = None,
    type: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Role-based filtering
    if current_user["role"] == "Editor":
        query["assigned_editor_id"] = current_user["id"]
    elif current_user["role"] == "Client":
        # Find client record linked to this user
        if current_user.get("client_id"):
            query["client_id"] = current_user["client_id"]
        else:
            return []
    
    # Additional filters
    if status:
        query["status"] = status
    if assigned_editor_id and current_user["role"] in ["Admin", "Manager"]:
        query["assigned_editor_id"] = assigned_editor_id
    if type:
        query["type"] = type
    if priority:
        query["priority"] = priority
    if search:
        query["$or"] = [
            {"order_code": {"$regex": search, "$options": "i"}},
            {"title": {"$regex": search, "$options": "i"}}
        ]
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with names
    result = []
    for order in orders:
        client = await db.clients.find_one({"id": order["client_id"]}, {"_id": 0})
        editor = await db.users.find_one({"id": order["assigned_editor_id"]}, {"_id": 0})
        qc = await db.users.find_one({"id": order.get("assigned_qc_id")}, {"_id": 0}) if order.get("assigned_qc_id") else None
        
        result.append(OrderResponse(
            **order,
            client_name=client["name"] if client else None,
            assigned_editor_name=editor["name"] if editor else None,
            assigned_qc_name=qc["name"] if qc else None
        ))
    
    return result

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check
    if current_user["role"] == "Editor" and order["assigned_editor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Client" and order["client_id"] != current_user.get("client_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    client = await db.clients.find_one({"id": order["client_id"]}, {"_id": 0})
    editor = await db.users.find_one({"id": order["assigned_editor_id"]}, {"_id": 0})
    qc = await db.users.find_one({"id": order.get("assigned_qc_id")}, {"_id": 0}) if order.get("assigned_qc_id") else None
    
    return OrderResponse(
        **order,
        client_name=client["name"] if client else None,
        assigned_editor_name=editor["name"] if editor else None,
        assigned_qc_name=qc["name"] if qc else None
    )

@api_router.patch("/orders/{order_id}", response_model=OrderResponse)
async def update_order(order_id: str, order_data: OrderUpdate, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check for editors
    if current_user["role"] == "Editor" and order["assigned_editor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Status transition validation
    if order_data.status:
        old_status = order["status"]
        new_status = order_data.status
        
        # Editor transitions
        if current_user["role"] == "Editor":
            allowed = {
                "New": ["In Progress"],
                "In Progress": ["Needs Client Review", "Delivered"],
                "Revision Requested": ["In Progress"]
            }
            if old_status not in allowed or new_status not in allowed.get(old_status, []):
                raise HTTPException(status_code=403, detail=f"Editor cannot change status from {old_status} to {new_status}")
        
        # Client transitions
        elif current_user["role"] == "Client":
            allowed = {
                "Needs Client Review": ["Revision Requested", "Approved"]
            }
            if old_status not in allowed or new_status not in allowed.get(old_status, []):
                raise HTTPException(status_code=403, detail=f"Client cannot change status from {old_status} to {new_status}")
        
        # Delivered requires final file
        if new_status == "Delivered":
            final_file = await db.order_files.find_one({
                "order_id": order_id,
                "file_type": {"$in": ["Final", "Export"]}
            })
            if not final_file:
                raise HTTPException(status_code=400, detail="Cannot mark as Delivered without a Final or Export file")
    
    update_dict = {k: v for k, v in order_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = get_utc_now()
    
    await db.orders.update_one({"id": order_id}, {"$set": update_dict})
    
    # Activity log for status change
    if order_data.status and order_data.status != order["status"]:
        await create_activity_log(
            order_id, current_user["id"], current_user["name"],
            "status_changed",
            f"Status changed from {order['status']} to {order_data.status}"
        )
        
        # Notifications
        if order_data.status == "Revision Requested":
            await create_notification(
                order["assigned_editor_id"],
                "revision_requested",
                "Revision Requested",
                f"Client requested revisions for order {order['order_code']}",
                related_order_id=order_id
            )
        elif order_data.status == "Approved":
            await create_notification(
                order["assigned_editor_id"],
                "order_approved",
                "Order Approved",
                f"Client approved order {order['order_code']}",
                related_order_id=order_id
            )
        elif order_data.status == "Needs Client Review":
            # Notify client user if exists
            client_user = await db.users.find_one({"client_id": order["client_id"], "role": "Client"})
            if client_user:
                await create_notification(
                    client_user["id"],
                    "ready_for_review",
                    "Ready for Review",
                    f"Order {order['order_code']} is ready for your review",
                    related_order_id=order_id
                )
    
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    client = await db.clients.find_one({"id": updated["client_id"]}, {"_id": 0})
    editor = await db.users.find_one({"id": updated["assigned_editor_id"]}, {"_id": 0})
    qc = await db.users.find_one({"id": updated.get("assigned_qc_id")}, {"_id": 0}) if updated.get("assigned_qc_id") else None
    
    return OrderResponse(
        **updated,
        client_name=client["name"] if client else None,
        assigned_editor_name=editor["name"] if editor else None,
        assigned_qc_name=qc["name"] if qc else None
    )

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Cleanup related data
    await db.order_messages.delete_many({"order_id": order_id})
    await db.order_files.delete_many({"order_id": order_id})
    await db.order_checklists.delete_one({"order_id": order_id})
    await db.activity_logs.delete_many({"order_id": order_id})
    
    return {"message": "Order deleted"}

# ============== MESSAGE ROUTES ==============

@api_router.post("/orders/{order_id}/messages", response_model=MessageResponse)
async def create_message(order_id: str, message_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check
    if current_user["role"] == "Editor" and order["assigned_editor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Client" and order["client_id"] != current_user.get("client_id"):
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
    
    # Notify relevant users
    users_to_notify = set()
    if current_user["role"] != "Editor":
        users_to_notify.add(order["assigned_editor_id"])
    if current_user["role"] != "Client":
        client_user = await db.users.find_one({"client_id": order["client_id"], "role": "Client"})
        if client_user:
            users_to_notify.add(client_user["id"])
    
    for user_id in users_to_notify:
        if user_id != current_user["id"]:
            await create_notification(
                user_id,
                "new_message",
                "New Message",
                f"New message on order {order['order_code']} from {current_user['name']}",
                related_order_id=order_id
            )
    
    return MessageResponse(**message)

@api_router.get("/orders/{order_id}/messages", response_model=List[MessageResponse])
async def list_messages(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check
    if current_user["role"] == "Editor" and order["assigned_editor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Client" and order["client_id"] != current_user.get("client_id"):
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
    if current_user["role"] == "Editor" and order["assigned_editor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Client" and order["client_id"] != current_user.get("client_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_doc = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "uploaded_by_user_id": current_user["id"],
        "uploaded_by_name": current_user["name"],
        "file_type": file_data.file_type,
        "label": file_data.label,
        "url_or_upload": file_data.url_or_upload,
        "version": file_data.version,
        "is_pinned_latest_final": False,
        "created_at": get_utc_now()
    }
    await db.order_files.insert_one(file_doc)
    
    # Activity log
    await create_activity_log(order_id, current_user["id"], current_user["name"], "file_added", f"File added: {file_data.label} ({file_data.version})")
    
    return FileResponse(**file_doc)

@api_router.get("/orders/{order_id}/files", response_model=List[FileResponse])
async def list_files(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check
    if current_user["role"] == "Editor" and order["assigned_editor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Client" and order["client_id"] != current_user.get("client_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    files = await db.order_files.find({"order_id": order_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [FileResponse(**f) for f in files]

@api_router.patch("/orders/{order_id}/files/{file_id}/pin")
async def pin_file_as_final(order_id: str, file_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check - Admin, Manager, or assigned Editor
    if current_user["role"] == "Editor" and order["assigned_editor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Client":
        raise HTTPException(status_code=403, detail="Clients cannot pin files")
    
    file_doc = await db.order_files.find_one({"id": file_id, "order_id": order_id})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Unpin all other files for this order
    await db.order_files.update_many(
        {"order_id": order_id},
        {"$set": {"is_pinned_latest_final": False}}
    )
    
    # Pin this file
    await db.order_files.update_one(
        {"id": file_id},
        {"$set": {"is_pinned_latest_final": True}}
    )
    
    # Activity log
    await create_activity_log(order_id, current_user["id"], current_user["name"], "file_pinned", f"File pinned as latest final: {file_doc['label']}")
    
    return {"message": "File pinned as latest final"}

# ============== CHECKLIST ROUTES ==============

@api_router.get("/orders/{order_id}/checklist", response_model=ChecklistResponse)
async def get_checklist(order_id: str, current_user: dict = Depends(get_current_user)):
    checklist = await db.order_checklists.find_one({"order_id": order_id}, {"_id": 0})
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return ChecklistResponse(**checklist)

@api_router.patch("/orders/{order_id}/checklist", response_model=ChecklistResponse)
async def update_checklist(order_id: str, checklist_data: ChecklistUpdate, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check
    if current_user["role"] == "Editor" and order["assigned_editor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Client":
        raise HTTPException(status_code=403, detail="Clients cannot update checklist")
    
    update_dict = {k: v for k, v in checklist_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = get_utc_now()
    
    await db.order_checklists.update_one({"order_id": order_id}, {"$set": update_dict})
    
    # Update intake_completed on order if intake_complete changed
    if checklist_data.intake_complete is not None:
        await db.orders.update_one({"id": order_id}, {"$set": {"intake_completed": checklist_data.intake_complete}})
    
    updated = await db.order_checklists.find_one({"order_id": order_id}, {"_id": 0})
    return ChecklistResponse(**updated)

# ============== ACTIVITY LOG ROUTES ==============

@api_router.get("/orders/{order_id}/activity", response_model=List[ActivityLogResponse])
async def get_activity_log(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check
    if current_user["role"] == "Editor" and order["assigned_editor_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Client" and order["client_id"] != current_user.get("client_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    logs = await db.activity_logs.find({"order_id": order_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [ActivityLogResponse(**log) for log in logs]

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

# ============== TICKET ROUTES ==============

@api_router.post("/tickets", response_model=TicketResponse)
async def create_ticket(ticket_data: TicketCreate, current_user: dict = Depends(get_current_user)):
    ticket_code = await get_next_ticket_code()
    ticket = {
        "id": str(uuid.uuid4()),
        "ticket_code": ticket_code,
        "client_id": ticket_data.client_id,
        "related_order_id": ticket_data.related_order_id,
        "subject": ticket_data.subject,
        "status": "Open",
        "owner_user_id": current_user["id"],
        "created_at": get_utc_now(),
        "updated_at": get_utc_now()
    }
    await db.tickets.insert_one(ticket)
    
    # Create initial message if provided
    if ticket_data.message_body:
        message = {
            "id": str(uuid.uuid4()),
            "ticket_id": ticket["id"],
            "author_user_id": current_user["id"],
            "author_name": current_user["name"],
            "author_role": current_user["role"],
            "message_body": ticket_data.message_body,
            "created_at": get_utc_now()
        }
        await db.ticket_messages.insert_one(message)
    
    return TicketResponse(
        **ticket,
        client_name=None,
        related_order_code=None,
        owner_name=current_user["name"]
    )

@api_router.get("/tickets", response_model=List[TicketResponse])
async def list_tickets(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    
    # Clients can only see their own tickets
    if current_user["role"] == "Client" and current_user.get("client_id"):
        query["client_id"] = current_user["client_id"]
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    result = []
    for ticket in tickets:
        client = await db.clients.find_one({"id": ticket.get("client_id")}, {"_id": 0}) if ticket.get("client_id") else None
        order = await db.orders.find_one({"id": ticket.get("related_order_id")}, {"_id": 0}) if ticket.get("related_order_id") else None
        owner = await db.users.find_one({"id": ticket["owner_user_id"]}, {"_id": 0})
        
        result.append(TicketResponse(
            **ticket,
            client_name=client["name"] if client else None,
            related_order_code=order["order_code"] if order else None,
            owner_name=owner["name"] if owner else "Unknown"
        ))
    
    return result

@api_router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    client = await db.clients.find_one({"id": ticket.get("client_id")}, {"_id": 0}) if ticket.get("client_id") else None
    order = await db.orders.find_one({"id": ticket.get("related_order_id")}, {"_id": 0}) if ticket.get("related_order_id") else None
    owner = await db.users.find_one({"id": ticket["owner_user_id"]}, {"_id": 0})
    
    return TicketResponse(
        **ticket,
        client_name=client["name"] if client else None,
        related_order_code=order["order_code"] if order else None,
        owner_name=owner["name"] if owner else "Unknown"
    )

@api_router.patch("/tickets/{ticket_id}")
async def update_ticket_status(ticket_id: str, status: str = Query(...), current_user: dict = Depends(get_current_user)):
    if status not in TICKET_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": status, "updated_at": get_utc_now()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"message": "Ticket status updated"}

@api_router.post("/tickets/{ticket_id}/messages", response_model=TicketMessageResponse)
async def create_ticket_message(ticket_id: str, message_data: TicketMessageCreate, current_user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    message = {
        "id": str(uuid.uuid4()),
        "ticket_id": ticket_id,
        "author_user_id": current_user["id"],
        "author_name": current_user["name"],
        "author_role": current_user["role"],
        "message_body": message_data.message_body,
        "created_at": get_utc_now()
    }
    await db.ticket_messages.insert_one(message)
    
    # Update ticket timestamp
    await db.tickets.update_one({"id": ticket_id}, {"$set": {"updated_at": get_utc_now()}})
    
    return TicketMessageResponse(**message)

@api_router.get("/tickets/{ticket_id}/messages", response_model=List[TicketMessageResponse])
async def list_ticket_messages(ticket_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.ticket_messages.find({"ticket_id": ticket_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return [TicketMessageResponse(**m) for m in messages]

# ============== DASHBOARD ROUTES ==============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] == "Editor":
        query["assigned_editor_id"] = current_user["id"]
    elif current_user["role"] == "Client" and current_user.get("client_id"):
        query["client_id"] = current_user["client_id"]
    
    new_count = await db.orders.count_documents({**query, "status": "New"})
    in_progress_count = await db.orders.count_documents({**query, "status": "In Progress"})
    needs_review_count = await db.orders.count_documents({**query, "status": "Needs Client Review"})
    revision_count = await db.orders.count_documents({**query, "status": "Revision Requested"})
    
    # Delivered in last 7 days
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    delivered_count = await db.orders.count_documents({
        **query,
        "status": "Delivered",
        "updated_at": {"$gte": seven_days_ago}
    })
    
    return DashboardStats(
        new_count=new_count,
        in_progress_count=in_progress_count,
        needs_review_count=needs_review_count,
        revision_requested_count=revision_count,
        delivered_last_7_days=delivered_count
    )

# ============== WEBHOOK ROUTES (Placeholders) ==============

@api_router.post("/webhooks/create-order")
async def webhook_create_order(order_data: WebhookOrderCreate):
    """Incoming webhook to create order from GHL/Marketplace"""
    # Find or create client
    client = await db.clients.find_one({"email": order_data.client_email.lower()}, {"_id": 0})
    if not client:
        client = {
            "id": str(uuid.uuid4()),
            "name": order_data.client_name,
            "email": order_data.client_email.lower(),
            "phone": order_data.client_phone,
            "notes": None,
            "created_at": get_utc_now()
        }
        await db.clients.insert_one(client)
    
    # Find editor
    editor = None
    if order_data.assigned_editor_email:
        editor = await db.users.find_one({"email": order_data.assigned_editor_email.lower(), "role": "Editor"}, {"_id": 0})
    
    if not editor:
        # Get first available editor
        editor = await db.users.find_one({"role": "Editor", "active": True}, {"_id": 0})
    
    if not editor:
        raise HTTPException(status_code=400, detail="No editor available")
    
    order_code = await get_next_order_code()
    order = {
        "id": str(uuid.uuid4()),
        "order_code": order_code,
        "client_id": client["id"],
        "title": order_data.title,
        "type": order_data.type if order_data.type in ORDER_TYPES else "Video Edit",
        "status": "New",
        "priority": "Normal",
        "due_date": order_data.due_date,
        "assigned_editor_id": editor["id"],
        "assigned_qc_id": None,
        "source": "GHL",
        "intake_required": True,
        "intake_completed": False,
        "created_at": get_utc_now(),
        "updated_at": get_utc_now()
    }
    await db.orders.insert_one(order)
    
    # Create checklist
    checklist = {
        "id": str(uuid.uuid4()),
        "order_id": order["id"],
        "intake_complete": False,
        "assets_received": False,
        "first_cut_delivered": False,
        "revision_round_1_done": False,
        "final_export_delivered": False,
        "updated_at": get_utc_now()
    }
    await db.order_checklists.insert_one(checklist)
    
    # Create initial message with notes
    if order_data.notes:
        message = {
            "id": str(uuid.uuid4()),
            "order_id": order["id"],
            "author_user_id": "system",
            "author_name": "System",
            "author_role": "System",
            "message_body": f"**Order Notes from GHL:**\n{order_data.notes}",
            "created_at": get_utc_now()
        }
        await db.order_messages.insert_one(message)
    
    # Notify editor
    await create_notification(
        editor["id"],
        "new_order",
        "New Order Assigned",
        f"You have been assigned to order {order_code}: {order_data.title}",
        related_order_id=order["id"]
    )
    
    return {"order_code": order_code, "order_id": order["id"]}

@api_router.post("/webhooks/status-update")
async def webhook_status_update_placeholder():
    """Placeholder for outgoing webhook to GHL on status update"""
    return {"message": "Webhook placeholder - not implemented"}

# ============== SEED DATA ==============

@api_router.post("/seed")
async def seed_data():
    """Seed initial admin user"""
    existing = await db.users.find_one({"email": "info@redribbonrealty.ca"})
    if existing:
        return {"message": "Admin already exists"}
    
    admin = {
        "id": str(uuid.uuid4()),
        "name": "Admin",
        "email": "info@redribbonrealty.ca",
        "password": hash_password("admin123"),
        "role": "Admin",
        "active": True,
        "client_id": None,
        "created_at": get_utc_now()
    }
    await db.users.insert_one(admin)
    
    # Initialize counters
    await db.counters.update_one({"_id": "order_code"}, {"$setOnInsert": {"seq": 0}}, upsert=True)
    await db.counters.update_one({"_id": "ticket_code"}, {"$setOnInsert": {"seq": 0}}, upsert=True)
    
    return {"message": "Seed data created", "admin_email": "info@redribbonrealty.ca", "admin_password": "admin123"}

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
