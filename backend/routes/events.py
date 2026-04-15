"""
Calendar events — internal events stored in MongoDB.

Scope: this router owns *internal* events created inside RED-OPS.
External calendar sync (Google Calendar, Outlook) is a follow-up — the
`source` + `external_id` fields on the schema are forward-compatible
so synced events land in the same collection and get rendered on the
same grid as internal events.

All endpoints are org-scoped via the 3-level fallback
(org_id / team_id / id) per CLAUDE.md.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/events", tags=["Calendar Events"])


# ============== MODELS ==============

EventSource = Literal["internal", "google", "outlook"]


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    starts_at: datetime
    ends_at: Optional[datetime] = None
    all_day: bool = False
    color: Optional[str] = None  # Hex, defaults to accent on frontend
    location: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    all_day: Optional[bool] = None
    color: Optional[str] = None
    location: Optional[str] = None


class EventResponse(BaseModel):
    id: str
    org_id: str
    title: str
    description: Optional[str] = None
    starts_at: datetime
    ends_at: Optional[datetime] = None
    all_day: bool = False
    color: Optional[str] = None
    location: Optional[str] = None
    source: EventSource = "internal"
    external_id: Optional[str] = None  # For synced events (Google, Outlook)
    created_by_user_id: str
    created_at: datetime
    updated_at: datetime


# ============== HELPERS ==============

def _org_id(user: dict) -> str:
    return user.get("org_id") or user.get("team_id") or user.get("id")


# ============== ROUTES ==============

@router.get("", response_model=List[EventResponse])
async def list_events(
    frm: Optional[str] = Query(None, alias="from", description="ISO date — lower bound (inclusive)"),
    to: Optional[str] = Query(None, description="ISO date — upper bound (inclusive)"),
    current_user: dict = Depends(get_current_user),
):
    """List events for the current org. Optional date-range filter."""
    org_id = _org_id(current_user)
    query: dict = {"org_id": org_id}

    if frm or to:
        range_q: dict = {}
        if frm:
            try:
                range_q["$gte"] = datetime.fromisoformat(frm.replace("Z", "+00:00"))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid 'from' date format")
        if to:
            try:
                range_q["$lte"] = datetime.fromisoformat(to.replace("Z", "+00:00"))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid 'to' date format")
        # Filter on starts_at within range — good enough for month/week windows
        query["starts_at"] = range_q

    cursor = db.calendar_events.find(query, {"_id": 0}).sort("starts_at", 1)
    events = await cursor.to_list(1000)
    return [EventResponse(**e) for e in events]


@router.post("", response_model=EventResponse)
async def create_event(
    body: EventCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new internal event."""
    org_id = _org_id(current_user)
    now = datetime.now(timezone.utc)

    event = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "title": body.title,
        "description": body.description,
        "starts_at": body.starts_at,
        "ends_at": body.ends_at,
        "all_day": body.all_day,
        "color": body.color,
        "location": body.location,
        "source": "internal",
        "external_id": None,
        "created_by_user_id": current_user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.calendar_events.insert_one(event)
    return EventResponse(**event)


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    body: EventUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an internal event. Synced events (source != 'internal') are read-only here."""
    org_id = _org_id(current_user)
    existing = await db.calendar_events.find_one({"id": event_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found")
    if existing.get("source", "internal") != "internal":
        raise HTTPException(status_code=400, detail="Synced external events are read-only — edit in their source calendar")

    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        return EventResponse(**existing)
    update["updated_at"] = datetime.now(timezone.utc)
    await db.calendar_events.update_one({"id": event_id, "org_id": org_id}, {"$set": update})
    updated = await db.calendar_events.find_one({"id": event_id, "org_id": org_id}, {"_id": 0})
    return EventResponse(**updated)


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete an internal event."""
    org_id = _org_id(current_user)
    existing = await db.calendar_events.find_one({"id": event_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found")
    if existing.get("source", "internal") != "internal":
        raise HTTPException(status_code=400, detail="Synced external events are read-only — remove from their source calendar")
    await db.calendar_events.delete_one({"id": event_id, "org_id": org_id})
    return {"ok": True, "id": event_id}
