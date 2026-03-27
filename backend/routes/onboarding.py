"""
Client Onboarding Checklist Routes

Structured checklist system for tracking new client onboarding progress.
Auto-created when a new Media Client user is added.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user, require_roles

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


# ============== MODELS ==============

DEFAULT_STEPS = [
    {"title": "Account access sent", "description": "Client received login credentials", "required": True},
    {"title": "Assets collected", "description": "Ad creatives, landing page, GHL access", "required": True},
    {"title": "Campaign setup complete", "description": "Meta ad campaign live", "required": True},
    {"title": "GHL pipeline configured", "description": "Booking system active", "required": True},
    {"title": "Kickoff call scheduled", "description": "First call booked", "required": True},
    {"title": "First week check-in done", "description": "7-day follow-up complete", "required": True},
]


class StepToggle(BaseModel):
    completed: bool


# ============== HELPER ==============

async def create_checklist_for_client(client_id: str, client_name: str, created_by: str) -> dict:
    """Create a new onboarding checklist with default steps. Returns the checklist doc."""
    now = datetime.now(timezone.utc).isoformat()
    steps = []
    for s in DEFAULT_STEPS:
        steps.append({
            "id": str(uuid.uuid4()),
            "title": s["title"],
            "description": s["description"],
            "completed": False,
            "completed_by": None,
            "completed_at": None,
            "required": s["required"],
        })

    checklist = {
        "id": str(uuid.uuid4()),
        "client_id": client_id,
        "client_name": client_name,
        "created_by": created_by,
        "created_at": now,
        "steps": steps,
        "completed_at": None,
        "status": "in_progress",
    }
    await db.onboarding_checklists.insert_one(checklist)
    return checklist


# ============== ENDPOINTS ==============

@router.post("")
async def create_onboarding_checklist(
    body: dict,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Create an onboarding checklist for a client. Admin only."""
    client_id = body.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="client_id is required")

    # Check client exists
    client = await db.users.find_one({"id": client_id}, {"_id": 0, "id": 1, "name": 1})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Check if checklist already exists
    existing = await db.onboarding_checklists.find_one({"client_id": client_id}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=409, detail="Checklist already exists for this client")

    checklist = await create_checklist_for_client(
        client_id=client_id,
        client_name=client.get("name", "Unknown"),
        created_by=current_user["id"],
    )
    checklist.pop("_id", None)
    return checklist


@router.get("")
async def list_onboarding_checklists(
    current_user: dict = Depends(get_current_user)
):
    """List all onboarding checklists with completion %. Admin/Operator only."""
    role = current_user.get("role", "")
    if role not in ["Administrator", "Admin", "Operator"]:
        raise HTTPException(status_code=403, detail="Admin or Operator access required")

    checklists = await db.onboarding_checklists.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

    result = []
    for cl in checklists:
        steps = cl.get("steps", [])
        total = len(steps)
        done = sum(1 for s in steps if s.get("completed"))
        cl["total_steps"] = total
        cl["completed_steps"] = done
        cl["completion_pct"] = round((done / total) * 100) if total > 0 else 0
        result.append(cl)

    return result


@router.get("/{client_id}")
async def get_onboarding_checklist(
    client_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get onboarding checklist for a client. Clients can view their own."""
    is_client = current_user.get("account_type") == "Media Client" or current_user.get("role") == "Media Client"
    if is_client and current_user.get("id") != client_id:
        raise HTTPException(status_code=403, detail="You can only view your own onboarding checklist")

    checklist = await db.onboarding_checklists.find_one({"client_id": client_id}, {"_id": 0})
    if not checklist:
        return None

    steps = checklist.get("steps", [])
    total = len(steps)
    done = sum(1 for s in steps if s.get("completed"))
    checklist["total_steps"] = total
    checklist["completed_steps"] = done
    checklist["completion_pct"] = round((done / total) * 100) if total > 0 else 0

    return checklist


@router.patch("/{checklist_id}/step/{step_id}")
async def toggle_step(
    checklist_id: str,
    step_id: str,
    body: StepToggle,
    current_user: dict = Depends(get_current_user)
):
    """Toggle a checklist step complete/incomplete."""
    role = current_user.get("role", "")
    if role not in ["Administrator", "Admin", "Operator"]:
        raise HTTPException(status_code=403, detail="Admin or Operator access required")

    checklist = await db.onboarding_checklists.find_one({"id": checklist_id}, {"_id": 0})
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    now = datetime.now(timezone.utc).isoformat()
    steps = checklist.get("steps", [])
    found = False

    for step in steps:
        if step["id"] == step_id:
            step["completed"] = body.completed
            step["completed_by"] = current_user.get("name") or current_user.get("id") if body.completed else None
            step["completed_at"] = now if body.completed else None
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Step not found")

    # Check if all steps complete
    all_done = all(s.get("completed") for s in steps)
    status = "completed" if all_done else "in_progress"
    completed_at = now if all_done else None

    await db.onboarding_checklists.update_one(
        {"id": checklist_id},
        {"$set": {"steps": steps, "status": status, "completed_at": completed_at}}
    )

    return {"success": True, "step_id": step_id, "completed": body.completed, "checklist_status": status}
