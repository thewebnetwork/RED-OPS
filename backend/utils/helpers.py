"""Helper functions"""
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_HOURS, SLA_DAYS

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def get_utc_now_dt() -> datetime:
    return datetime.now(timezone.utc)

def calculate_sla_deadline(created_at: datetime) -> datetime:
    return created_at + timedelta(days=SLA_DAYS)

def is_sla_breached(sla_deadline_str: str, status: str) -> bool:
    if status in ["Delivered", "Closed"]:
        return False
    if not sla_deadline_str:
        return False
    try:
        deadline = datetime.fromisoformat(sla_deadline_str.replace('Z', '+00:00'))
        return datetime.now(timezone.utc) > deadline
    except:
        return False

def normalize_order(order: dict) -> dict:
    """Ensure all expected fields exist with default values"""
    defaults = {
        'request_type': order.get('request_type', 'Editing'),
        'requester_name': order.get('requester_name', 'Unknown'),
        'requester_email': order.get('requester_email', ''),
        'editor_name': order.get('editor_name'),
        'closed_at': order.get('closed_at'),
        'closed_by_id': order.get('closed_by_id'),
        'close_reason': order.get('close_reason'),
        'review_started_at': order.get('review_started_at'),
        'last_requester_message_at': order.get('last_requester_message_at'),
        # Cancellation fields
        'cancellation_reason': order.get('cancellation_reason'),
        'cancellation_notes': order.get('cancellation_notes'),
        'canceled_at': order.get('canceled_at'),
        # Resolution fields
        'resolution_notes': order.get('resolution_notes'),
    }
    return {**order, **defaults}

async def get_next_code(db, counter_name: str, prefix: str) -> str:
    """Generate next sequential code (e.g., RRG-000001)"""
    counter = await db.counters.find_one_and_update(
        {"_id": counter_name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"{prefix}-{str(counter['seq']).zfill(6)}"

async def create_notification(db, user_id: str, type: str, title: str, message: str, related_order_id: str = None):
    """Create a notification for a user"""
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
