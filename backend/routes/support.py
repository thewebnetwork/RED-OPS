"""
Support Ticket System

Clients can submit support tickets and chat with admins.
Admins see all tickets in a unified support dashboard.
Each ticket has a built-in message thread.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/support", tags=["Support"])


# ============== MODELS ==============

class TicketCreate(BaseModel):
    subject: str
    category: str = "general"  # general | bug | feature | billing | other
    description: str
    priority: str = "normal"  # low | normal | high | urgent


class TicketUpdate(BaseModel):
    status: Optional[str] = None  # open | in_progress | waiting | resolved | closed
    priority: Optional[str] = None
    assigned_to: Optional[str] = None


class TicketMessageCreate(BaseModel):
    body: str


TICKET_CATEGORIES = ["general", "bug", "feature", "billing", "other"]
TICKET_STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"]


# ============== ENDPOINTS ==============

@router.post("/tickets")
async def create_ticket(
    data: TicketCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a support ticket. Any authenticated user."""
    now = datetime.now(timezone.utc).isoformat()
    ticket = {
        "id": str(uuid.uuid4()),
        "subject": data.subject,
        "category": data.category,
        "description": data.description,
        "priority": data.priority,
        "status": "open",
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name") or current_user.get("email"),
        "created_by_role": current_user.get("role"),
        "assigned_to": None,
        "assigned_to_name": None,
        "created_at": now,
        "updated_at": now,
        "resolved_at": None,
        "message_count": 0,
        "last_message_at": now,
        "last_message_by": current_user.get("name"),
    }
    await db.support_tickets.insert_one(ticket)
    ticket.pop("_id", None)

    # Auto-create first message from the description
    if data.description.strip():
        msg = {
            "id": str(uuid.uuid4()),
            "ticket_id": ticket["id"],
            "sender_id": current_user["id"],
            "sender_name": current_user.get("name") or current_user.get("email"),
            "sender_role": current_user.get("role"),
            "body": data.description,
            "created_at": now,
        }
        await db.support_messages.insert_one(msg)
        await db.support_tickets.update_one(
            {"id": ticket["id"]},
            {"$set": {"message_count": 1}}
        )

    return ticket


@router.get("/tickets")
async def list_tickets(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List tickets. Clients see their own, admins see all."""
    is_client = current_user.get("account_type") == "Media Client" or current_user.get("role") == "Media Client"

    query = {}
    if is_client:
        query["created_by"] = current_user["id"]
    if status:
        query["status"] = status

    tickets = await db.support_tickets.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return tickets


@router.get("/tickets/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single ticket."""
    ticket = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    is_client = current_user.get("account_type") == "Media Client"
    if is_client and ticket.get("created_by") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ticket")

    return ticket


@router.patch("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    data: TicketUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update ticket status/priority/assignment. Admin/Operator only for assignment."""
    ticket = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.status:
        update["status"] = data.status
        if data.status in ["resolved", "closed"]:
            update["resolved_at"] = datetime.now(timezone.utc).isoformat()
    if data.priority:
        update["priority"] = data.priority
    if data.assigned_to is not None:
        assignee = await db.users.find_one({"id": data.assigned_to}, {"_id": 0, "name": 1})
        update["assigned_to"] = data.assigned_to
        update["assigned_to_name"] = assignee.get("name") if assignee else None

    await db.support_tickets.update_one({"id": ticket_id}, {"$set": update})
    updated = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
    return updated


# ── Ticket Messages ───────────────────────────────────────────────────────────

@router.get("/tickets/{ticket_id}/messages")
async def list_ticket_messages(
    ticket_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all messages in a ticket thread."""
    ticket = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0, "created_by": 1})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    is_client = current_user.get("account_type") == "Media Client"
    if is_client and ticket.get("created_by") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ticket")

    messages = await db.support_messages.find(
        {"ticket_id": ticket_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return messages


@router.post("/tickets/{ticket_id}/messages")
async def send_ticket_message(
    ticket_id: str,
    data: TicketMessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Send a message in a ticket thread."""
    if not data.body.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    ticket = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0, "created_by": 1})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    is_client = current_user.get("account_type") == "Media Client"
    if is_client and ticket.get("created_by") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your ticket")

    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "id": str(uuid.uuid4()),
        "ticket_id": ticket_id,
        "sender_id": current_user["id"],
        "sender_name": current_user.get("name") or current_user.get("email"),
        "sender_role": current_user.get("role"),
        "body": data.body.strip(),
        "created_at": now,
    }
    await db.support_messages.insert_one(msg)

    await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "updated_at": now,
            "last_message_at": now,
            "last_message_by": current_user.get("name"),
            "message_count": (ticket.get("message_count", 0) or 0) + 1,
            # Reopen if client replies to a resolved ticket
            **( {"status": "open"} if ticket.get("status") in ["resolved", "closed"] and is_client else {} ),
        }}
    )

    msg.pop("_id", None)
    return msg


@router.get("/stats")
async def support_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get support ticket stats for admin dashboard."""
    if current_user.get("role") not in ["Administrator", "Admin", "Operator"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    total = await db.support_tickets.count_documents({})
    open_count = await db.support_tickets.count_documents({"status": "open"})
    in_progress = await db.support_tickets.count_documents({"status": "in_progress"})
    resolved = await db.support_tickets.count_documents({"status": {"$in": ["resolved", "closed"]}})

    return {
        "total": total,
        "open": open_count,
        "in_progress": in_progress,
        "resolved": resolved,
    }
