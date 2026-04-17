"""Client Portal Data — admin-managed portal content per Media Client.

Session 1 of 3: data layer + admin CRUD.
Session 2: client-facing portal page.
Session 3: polish.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user, require_roles
from utils.tenancy import resolve_org_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/client-portal", tags=["Client Portal"])


# ============== MODELS ==============

class AppointmentEntry(BaseModel):
    appointment_date: str
    lead_name: str
    lead_type: str = "buyer"
    notes: Optional[str] = None


class PerformanceData(BaseModel):
    appointments_this_week: int = 0
    appointments_this_month: int = 0
    appointments_total: int = 0


class PortalDataCreate(BaseModel):
    user_id: str
    status_phase: str = "onboarding"
    status_message: str = ""
    launched_at: Optional[str] = None


class PortalDataUpdate(BaseModel):
    status_phase: Optional[str] = None
    status_message: Optional[str] = None
    launched_at: Optional[str] = None
    performance: Optional[PerformanceData] = None
    upcoming_appointments: Optional[List[AppointmentEntry]] = None


# ============== HELPERS ==============

def _calc_days_since_launch(launched_at: Optional[str]) -> Optional[int]:
    if not launched_at:
        return None
    try:
        launch = datetime.fromisoformat(launched_at.replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - launch
        return max(0, delta.days)
    except (ValueError, TypeError):
        return None


def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    doc["days_since_launch"] = _calc_days_since_launch(doc.get("launched_at"))
    return doc


# ============== ENDPOINTS ==============

@router.post("/data", status_code=201)
async def create_portal_data(
    body: PortalDataCreate,
    current_user: dict = Depends(require_roles(["Administrator", "Operator"]))
):
    """Create portal data for a Media Client user."""
    target = await db.users.find_one({"id": body.user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.get("role") != "Media Client" and target.get("account_type") != "Media Client":
        raise HTTPException(status_code=400, detail="User is not a Media Client")

    existing = await db.client_portal_data.find_one({"user_id": body.user_id})
    if existing:
        raise HTTPException(status_code=409, detail="Portal data already exists for this user")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": body.user_id,
        "org_id": body.user_id,
        "status_phase": body.status_phase,
        "status_message": body.status_message,
        "launched_at": body.launched_at,
        "performance": {
            "appointments_this_week": 0,
            "appointments_this_month": 0,
            "appointments_total": 0,
            "last_updated_at": now,
        },
        "upcoming_appointments": [],
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"],
    }

    await db.client_portal_data.insert_one(doc)
    return _serialize(doc)


@router.get("/data/me")
async def get_my_portal_data(current_user: dict = Depends(get_current_user)):
    """Authenticated user fetches their own portal data."""
    doc = await db.client_portal_data.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No portal data found")
    return _serialize(doc)


@router.get("/data/{user_id}")
async def get_portal_data(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Admin reads any; Media Client reads only their own."""
    is_admin = current_user.get("role") in ["Administrator", "Admin", "Operator"]

    if not is_admin and user_id != current_user["id"]:
        raise HTTPException(status_code=404, detail="No portal data found")

    doc = await db.client_portal_data.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No portal data found")
    return _serialize(doc)


@router.patch("/data/{user_id}")
async def update_portal_data(
    user_id: str,
    body: PortalDataUpdate,
    current_user: dict = Depends(require_roles(["Administrator", "Operator"]))
):
    """Admin-only partial update."""
    doc = await db.client_portal_data.find_one({"user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No portal data found")

    now = datetime.now(timezone.utc).isoformat()
    update = {"updated_at": now}

    if body.status_phase is not None:
        update["status_phase"] = body.status_phase
    if body.status_message is not None:
        update["status_message"] = body.status_message
    if body.launched_at is not None:
        update["launched_at"] = body.launched_at
    if body.performance is not None:
        update["performance"] = {
            **body.performance.model_dump(),
            "last_updated_at": now,
        }
    if body.upcoming_appointments is not None:
        update["upcoming_appointments"] = [a.model_dump() for a in body.upcoming_appointments]

    await db.client_portal_data.update_one({"user_id": user_id}, {"$set": update})

    updated = await db.client_portal_data.find_one({"user_id": user_id}, {"_id": 0})
    return _serialize(updated)


@router.get("/clients")
async def list_portal_clients(
    current_user: dict = Depends(require_roles(["Administrator", "Operator"]))
):
    """List all Media Client users with portal-data flag."""
    clients = await db.users.find(
        {"$or": [{"role": "Media Client"}, {"account_type": "Media Client"}]},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "account_type": 1, "avatar": 1}
    ).sort("name", 1).to_list(500)

    portal_user_ids = set()
    portal_docs = await db.client_portal_data.find({}, {"_id": 0, "user_id": 1}).to_list(500)
    for p in portal_docs:
        portal_user_ids.add(p["user_id"])

    for c in clients:
        c["has_portal_data"] = c["id"] in portal_user_ids

    return clients
