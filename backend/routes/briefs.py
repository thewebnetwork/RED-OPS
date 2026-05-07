"""Brief management routes — Editor Module Phase 1.

Brief lifecycle:
  draft → sent → acknowledged → in-progress → submitted
                                            → revisions-requested → submitted (loop)
                                            → in-review → approved
                                                       → revisions-requested
       → cancelled (terminal, valid from sent / acknowledged / in-progress only)
                                            approved → paid → closed (terminal)

Phase 1 = system of record only. No Nextcloud bridge (source_files are
text-input paths). No Stripe payment automation (paid is set manually). No
auto-recommend freelancer.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import get_utc_now
from services.email import send_email_notification

router = APIRouter(tags=["Briefs"])

logger = logging.getLogger(__name__)

# Roles allowed to manage briefs (create / assign / transition / rate)
MANAGE_ROLES = ["Administrator", "Operator"]
# Roles allowed to read all briefs (for context); not required Phase 1
READ_ROLES = ["Administrator", "Operator", "Standard User"]

BRIEF_TYPES = ["video-edit", "thumbnail", "shorts-cut", "design", "writing", "other"]
BRIEF_TYPE_PATTERN = r"^(video-edit|thumbnail|shorts-cut|design|writing|other)$"
PAYMENT_TERMS_PATTERN = r"^(on-approval|50-50|net-30|manual)$"
STATUS_VALUES = [
    "draft", "sent", "acknowledged", "in-progress",
    "submitted", "in-review", "revisions-requested",
    "approved", "paid", "closed", "cancelled",
]
STATUS_PATTERN = (
    r"^(draft|sent|acknowledged|in-progress|submitted|in-review|"
    r"revisions-requested|approved|paid|closed|cancelled)$"
)

# State machine — what target states are reachable from a given source
ALLOWED_TRANSITIONS = {
    "draft":               ["sent"],
    "sent":                ["acknowledged", "cancelled"],
    "acknowledged":        ["in-progress", "cancelled"],
    "in-progress":         ["submitted", "cancelled"],
    "submitted":           ["in-review", "approved", "revisions-requested"],
    "in-review":           ["approved", "revisions-requested"],
    "revisions-requested": ["submitted"],
    "approved":            ["paid"],
    "paid":                ["closed"],
    "closed":              [],
    "cancelled":           [],
}

# Fields freelancers can NEVER see — internal-only
FREELANCER_HIDDEN_FIELDS = {"client_id", "client_name", "internal_notes", "rating_id"}

# Internal notification "types" used for in-app feed
NOTIFY_TYPE_BRIEF = "brief"


# ── Pydantic Models ──────────────────────────────────────────────────────────

class DeliverableSpec(BaseModel):
    format: Optional[str] = None
    length: Optional[str] = None
    dimensions: Optional[str] = None
    style: Optional[str] = None
    references: List[str] = []


class SourceFile(BaseModel):
    path: str
    label: Optional[str] = None
    added_by: Optional[str] = None
    added_at: Optional[str] = None


class OutputTarget(BaseModel):
    nextcloud_folder_path: Optional[str] = None
    naming_convention: Optional[str] = None


class BriefCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=240)
    description: str = ""  # markdown
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    brief_type: str = Field("other", pattern=BRIEF_TYPE_PATTERN)
    deliverable_spec: dict = {}
    deadline: Optional[str] = None  # YYYY-MM-DD
    payment_amount: Optional[float] = Field(None, ge=0)
    payment_currency: str = "CAD"
    payment_terms: str = Field("on-approval", pattern=PAYMENT_TERMS_PATTERN)
    source_files: List[dict] = []
    output_target: dict = {}
    assigned_freelancer_id: Optional[str] = None
    template_id: Optional[str] = None
    internal_notes: Optional[str] = None  # admin/operator only


class BriefUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=240)
    description: Optional[str] = None
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    brief_type: Optional[str] = Field(None, pattern=BRIEF_TYPE_PATTERN)
    deliverable_spec: Optional[dict] = None
    deadline: Optional[str] = None
    payment_amount: Optional[float] = Field(None, ge=0)
    payment_currency: Optional[str] = None
    payment_terms: Optional[str] = Field(None, pattern=PAYMENT_TERMS_PATTERN)
    source_files: Optional[List[dict]] = None
    output_target: Optional[dict] = None
    assigned_freelancer_id: Optional[str] = None
    internal_notes: Optional[str] = None


class TransitionRequest(BaseModel):
    to_status: str = Field(..., pattern=STATUS_PATTERN)
    notes: Optional[str] = None
    deliverables: Optional[List[dict]] = None  # optional: included on submit


class MessageCreate(BaseModel):
    body: str = Field(..., min_length=1)
    attachments: List[dict] = []


class RatingCreate(BaseModel):
    quality: int = Field(..., ge=1, le=5)
    speed: int = Field(..., ge=1, le=5)
    communication: int = Field(..., ge=1, le=5)
    rehire: bool = False
    notes: Optional[str] = None  # internal only


# ── Brief templates (8 defaults) ─────────────────────────────────────────────

BRIEF_TEMPLATES = [
    {
        "id": "youtube-long",
        "label": "YouTube Long-Form Edit",
        "brief_type": "video-edit",
        "description": (
            "Edit raw footage into an 8-12 minute episode with intro hook, "
            "b-roll, lower thirds, and outro CTA. Match channel style guide."
        ),
        "deliverable_spec": {
            "format": "MP4 (1080p, H.264)",
            "length": "8-12 minutes",
            "dimensions": "1920x1080",
            "style": "Channel style guide",
            "references": [],
        },
        "recommended_deadline_days": 5,
        "recommended_payment_min": 150,
        "recommended_payment_max": 400,
    },
    {
        "id": "youtube-shorts",
        "label": "YouTube Shorts Cut (3-5 verticals from one source)",
        "brief_type": "shorts-cut",
        "description": (
            "From the provided long-form source, cut 3-5 vertical shorts "
            "(60-90 seconds each). Hook in first 1.5 seconds. Captions burned in."
        ),
        "deliverable_spec": {
            "format": "MP4 (1080x1920, H.264)",
            "length": "60-90 seconds each, 3-5 deliverables",
            "dimensions": "1080x1920",
            "style": "Vertical, captions burned in",
            "references": [],
        },
        "recommended_deadline_days": 3,
        "recommended_payment_min": 100,
        "recommended_payment_max": 250,
    },
    {
        "id": "instagram-reel",
        "label": "Instagram Reel (single vertical)",
        "brief_type": "shorts-cut",
        "description": "Cut a single vertical 30-90 sec reel from any source. Music + captions.",
        "deliverable_spec": {
            "format": "MP4 (1080x1920)",
            "length": "30-90 seconds",
            "dimensions": "1080x1920",
            "style": "Trending audio + captions",
            "references": [],
        },
        "recommended_deadline_days": 2,
        "recommended_payment_min": 50,
        "recommended_payment_max": 120,
    },
    {
        "id": "thumbnail-3-options",
        "label": "Thumbnail Design (3 options)",
        "brief_type": "thumbnail",
        "description": "3 thumbnail options for a video. High contrast, readable at small sizes, follows brand color palette.",
        "deliverable_spec": {
            "format": "PNG",
            "length": "3 deliverables",
            "dimensions": "1280x720",
            "style": "High contrast, brand palette",
            "references": [],
        },
        "recommended_deadline_days": 2,
        "recommended_payment_min": 50,
        "recommended_payment_max": 150,
    },
    {
        "id": "blog-repurpose",
        "label": "Blog Post Repurpose",
        "brief_type": "writing",
        "description": "Convert long-form video into 800-1500 word blog post with screenshots, headers, and a meta description.",
        "deliverable_spec": {
            "format": "Markdown + screenshot images",
            "length": "800-1500 words",
            "dimensions": None,
            "style": "Editorial, scannable headers",
            "references": [],
        },
        "recommended_deadline_days": 4,
        "recommended_payment_min": 100,
        "recommended_payment_max": 300,
    },
    {
        "id": "ad-static",
        "label": "Ad Creative — Static",
        "brief_type": "design",
        "description": "Meta ad image with headline + CTA. Designed for feed + stories placements.",
        "deliverable_spec": {
            "format": "PNG (feed) + PNG (story)",
            "length": "2 deliverables",
            "dimensions": "1080x1080 + 1080x1920",
            "style": "Brand palette, clear CTA",
            "references": [],
        },
        "recommended_deadline_days": 2,
        "recommended_payment_min": 80,
        "recommended_payment_max": 200,
    },
    {
        "id": "ad-video",
        "label": "Ad Creative — Video (15-30s)",
        "brief_type": "video-edit",
        "description": "15-30 second Meta video ad. Opening hook, value prop, CTA.",
        "deliverable_spec": {
            "format": "MP4 (1080x1080) + MP4 (1080x1920)",
            "length": "15-30 seconds",
            "dimensions": "1080x1080 + 1080x1920",
            "style": "Hook in 1.5s, captions, CTA card",
            "references": [],
        },
        "recommended_deadline_days": 4,
        "recommended_payment_min": 150,
        "recommended_payment_max": 400,
    },
    {
        "id": "custom",
        "label": "Custom (free-form)",
        "brief_type": "other",
        "description": "",
        "deliverable_spec": {},
        "recommended_deadline_days": None,
        "recommended_payment_min": None,
        "recommended_payment_max": None,
    },
]


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _create_inapp_notification(user_id: str, title: str, message: str, related_brief_id: str):
    """Insert a row into db.notifications matching the existing in-app feed
    pattern (see services/escalation_engine.create_notification)."""
    if not user_id:
        return
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": NOTIFY_TYPE_BRIEF,
        "title": title,
        "message": message,
        "related_brief_id": related_brief_id,
        "is_read": False,
        "created_at": get_utc_now(),
    }
    try:
        await db.notifications.insert_one(notif)
    except Exception as e:
        logger.warning(f"Failed to insert in-app notification: {e}")


async def _email_freelancer(freelancer_user_id: str, subject: str, body: str):
    """Look up the freelancer's email and send a plain-text notification.
    Falls through silently on any error (email is best-effort)."""
    if not freelancer_user_id:
        return
    try:
        user = await db.users.find_one(
            {"id": freelancer_user_id}, {"_id": 0, "email": 1, "name": 1}
        )
        if not user or not user.get("email"):
            logger.info(f"No email on file for freelancer {freelancer_user_id}; skipping send")
            return
        await send_email_notification(
            to_email=user["email"],
            subject=subject,
            body=body,
        )
    except Exception as e:
        logger.warning(f"Failed to email freelancer {freelancer_user_id}: {e}")


def _scope_for_freelancer(brief: dict) -> dict:
    """Strip internal-only fields before returning to a Freelancer."""
    if not brief:
        return brief
    out = {k: v for k, v in brief.items() if k not in FREELANCER_HIDDEN_FIELDS}
    return out


async def _log_history(brief_id: str, event: str, by_user: dict, payload: Optional[dict] = None):
    """Append a history event to brief_history. Used for status changes,
    assignment, rating, etc. Read-only feed for the History tab."""
    doc = {
        "id": str(uuid.uuid4()),
        "brief_id": brief_id,
        "event": event,
        "by_user_id": by_user.get("id") if by_user else None,
        "by_user_name": by_user.get("name") if by_user else None,
        "payload": payload or {},
        "created_at": get_utc_now(),
    }
    try:
        await db.brief_history.insert_one(doc)
    except Exception as e:
        logger.warning(f"Failed to log brief history event {event}: {e}")


def _validate_transition(current: str, target: str):
    """Raise 422 if target is not a legal next state from current."""
    allowed = ALLOWED_TRANSITIONS.get(current)
    if allowed is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown current status '{current}'",
        )
    if target not in allowed:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Illegal transition: {current} → {target}. "
                f"From '{current}' the only allowed states are: {allowed or '(terminal)'}"
            ),
        )


# Per-state field that records the timestamp when the brief entered the state
STATE_TIMESTAMP_FIELDS = {
    "sent": "sent_at",
    "submitted": "submitted_at",
    "approved": "approved_at",
    "paid": "paid_at",
    "closed": "closed_at",
    "cancelled": "cancelled_at",
}


# ── CRUD endpoints ───────────────────────────────────────────────────────────

@router.post("/briefs")
async def create_brief(
    data: BriefCreate,
    current_user: dict = Depends(require_roles(MANAGE_ROLES)),
):
    """Create a brief in `draft` status. Use POST /briefs/{id}/transition with
    to_status='sent' once the brief is ready to send to the freelancer."""
    now = get_utc_now()
    brief = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "status": "draft",
        "revision_count": 0,
        "created_by": current_user["id"],
        "created_at": now,
        "assigned_at": now if data.assigned_freelancer_id else None,
    }
    await db.briefs.insert_one(brief)
    brief.pop("_id", None)

    await _log_history(brief["id"], "created", current_user, {"title": brief["title"]})

    return brief


@router.get("/briefs")
async def list_briefs(
    status: Optional[str] = Query(None),
    brief_type: Optional[str] = Query(None),
    freelancer_id: Optional[str] = Query(None, alias="freelancer"),
    deadline_before: Optional[str] = Query(None),
    deadline_after: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    limit: int = Query(500, le=1000),
    current_user: dict = Depends(require_roles(MANAGE_ROLES)),
):
    """Admin/Operator board view. Filters compose with AND."""
    query: dict = {}
    if status:
        query["status"] = status
    if brief_type:
        query["brief_type"] = brief_type
    if freelancer_id:
        query["assigned_freelancer_id"] = freelancer_id
    if project_id:
        query["project_id"] = project_id
    if deadline_before or deadline_after:
        deadline_q: dict = {}
        if deadline_after:
            deadline_q["$gte"] = deadline_after
        if deadline_before:
            deadline_q["$lte"] = deadline_before
        query["deadline"] = deadline_q

    items = await db.briefs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    total = await db.briefs.count_documents(query)
    return {"items": items, "total": total}


@router.get("/briefs/{brief_id}")
async def get_brief(
    brief_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Single brief. Freelancers can only fetch briefs assigned to them, and
    receive a scoped view (no internal_notes, no client_id)."""
    brief = await db.briefs.find_one({"id": brief_id}, {"_id": 0})
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")

    role = current_user.get("role")
    if role == "Freelancer":
        if brief.get("assigned_freelancer_id") != current_user["id"]:
            raise HTTPException(status_code=404, detail="Brief not found")
        return _scope_for_freelancer(brief)

    if role not in MANAGE_ROLES and role not in READ_ROLES:
        raise HTTPException(status_code=403, detail="Permission denied")

    return brief


@router.patch("/briefs/{brief_id}")
async def update_brief(
    brief_id: str,
    data: BriefUpdate,
    current_user: dict = Depends(require_roles(MANAGE_ROLES)),
):
    """Edit non-status fields. Use /transition for status changes. Editing
    after the brief is past `sent` is allowed but a history event is logged."""
    brief = await db.briefs.find_one({"id": brief_id}, {"_id": 0})
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    if brief["status"] in ("closed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot edit a {brief['status']} brief")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_dict:
        return brief

    # Track assignment change explicitly so we can stamp assigned_at + log it
    if "assigned_freelancer_id" in update_dict and update_dict["assigned_freelancer_id"] != brief.get("assigned_freelancer_id"):
        update_dict["assigned_at"] = get_utc_now()

    update_dict["updated_at"] = get_utc_now()
    await db.briefs.update_one({"id": brief_id}, {"$set": update_dict})
    await _log_history(brief_id, "updated", current_user, {"fields": list(update_dict.keys())})

    refreshed = await db.briefs.find_one({"id": brief_id}, {"_id": 0})
    return refreshed


@router.delete("/briefs/{brief_id}")
async def delete_brief(
    brief_id: str,
    current_user: dict = Depends(require_roles(["Administrator"])),
):
    """Hard-delete. Only allowed in draft. For sent+ briefs, transition to
    cancelled instead."""
    brief = await db.briefs.find_one({"id": brief_id}, {"_id": 0})
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    if brief["status"] != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot hard-delete a brief in status '{brief['status']}'. Cancel it instead.",
        )
    await db.briefs.delete_one({"id": brief_id})
    return {"success": True, "brief_id": brief_id}


# ── State machine transition endpoint ────────────────────────────────────────

@router.post("/briefs/{brief_id}/transition")
async def transition_brief(
    brief_id: str,
    data: TransitionRequest,
    current_user: dict = Depends(get_current_user),
):
    """Move a brief between lifecycle states. Validates against the state
    machine (returns 422 on illegal transitions). Fires email + in-app
    notifications per the matrix below.

    Permissions:
    - Most transitions: admin/operator only
    - acknowledged, in-progress, submitted: freelancer-initiated (only on
      their own assigned brief)
    """
    brief = await db.briefs.find_one({"id": brief_id}, {"_id": 0})
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")

    current = brief["status"]
    target = data.to_status
    role = current_user.get("role")

    # Per-target authorization
    freelancer_initiated = {"acknowledged", "in-progress", "submitted"}
    if target in freelancer_initiated:
        if role == "Freelancer":
            if brief.get("assigned_freelancer_id") != current_user["id"]:
                raise HTTPException(status_code=403, detail="Not your brief")
        elif role not in MANAGE_ROLES:
            raise HTTPException(status_code=403, detail="Permission denied")
    else:
        if role not in MANAGE_ROLES:
            raise HTTPException(status_code=403, detail="Permission denied")

    _validate_transition(current, target)

    now = get_utc_now()
    update: dict = {"status": target, "updated_at": now}
    if target in STATE_TIMESTAMP_FIELDS:
        update[STATE_TIMESTAMP_FIELDS[target]] = now
    if target == "submitted":
        update["revision_count"] = (brief.get("revision_count") or 0) + (1 if current == "revisions-requested" else 0)
        if data.deliverables:
            update["deliverables"] = data.deliverables

    await db.briefs.update_one({"id": brief_id}, {"$set": update})
    await _log_history(
        brief_id, f"status:{current}→{target}", current_user,
        {"notes": data.notes} if data.notes else None,
    )

    # Notification matrix
    freelancer_id = brief.get("assigned_freelancer_id")
    creator_id = brief.get("created_by")
    title = brief.get("title") or "(untitled brief)"

    if target == "sent":
        await _email_freelancer(
            freelancer_id,
            subject=f"New brief: {title}",
            body=(
                f"Hi — you've been assigned a new brief on Red Ops.\n\n"
                f"Title: {title}\n"
                f"Deadline: {brief.get('deadline') or 'not set'}\n"
                f"Payment: {brief.get('payment_amount') or '—'} {brief.get('payment_currency') or ''}\n\n"
                f"Open Red Ops → My Queue to view details and acknowledge.\n"
            ),
        )
        await _create_inapp_notification(freelancer_id, "New brief assigned", title, brief_id)
    elif target == "acknowledged":
        await _create_inapp_notification(creator_id, "Brief acknowledged", f"{title} acknowledged by freelancer", brief_id)
    elif target == "submitted":
        await _create_inapp_notification(creator_id, "Brief submitted for review", title, brief_id)
    elif target == "revisions-requested":
        await _email_freelancer(
            freelancer_id,
            subject=f"Revisions requested: {title}",
            body=(
                f"Hi — revisions have been requested on your brief.\n\n"
                f"Title: {title}\n"
                f"{('Notes: ' + data.notes) if data.notes else ''}\n\n"
                f"Open Red Ops → My Queue to see the request and re-submit.\n"
            ),
        )
        await _create_inapp_notification(freelancer_id, "Revisions requested", title, brief_id)
    elif target == "approved":
        await _email_freelancer(
            freelancer_id,
            subject=f"Approved: {title}",
            body=f"Your brief was approved. Payment is being processed per the agreed terms.\n\nTitle: {title}\n",
        )
        await _create_inapp_notification(freelancer_id, "Brief approved", title, brief_id)
    elif target == "paid":
        await _email_freelancer(
            freelancer_id,
            subject=f"Paid: {title}",
            body=(
                f"Payment has been recorded for: {title}\n"
                f"Amount: {brief.get('payment_amount') or '—'} {brief.get('payment_currency') or ''}\n\n"
                f"Thanks for the work.\n"
            ),
        )
        await _create_inapp_notification(freelancer_id, "Payment recorded", title, brief_id)
        await _create_inapp_notification(creator_id, "Brief marked paid", title, brief_id)

    refreshed = await db.briefs.find_one({"id": brief_id}, {"_id": 0})
    return _scope_for_freelancer(refreshed) if role == "Freelancer" else refreshed


# ── Comment thread ───────────────────────────────────────────────────────────

@router.get("/briefs/{brief_id}/messages")
async def list_brief_messages(
    brief_id: str,
    current_user: dict = Depends(get_current_user),
):
    brief = await db.briefs.find_one({"id": brief_id}, {"_id": 0, "assigned_freelancer_id": 1, "id": 1})
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    role = current_user.get("role")
    if role == "Freelancer" and brief.get("assigned_freelancer_id") != current_user["id"]:
        raise HTTPException(status_code=404, detail="Brief not found")
    if role not in MANAGE_ROLES and role != "Freelancer" and role not in READ_ROLES:
        raise HTTPException(status_code=403, detail="Permission denied")

    msgs = await db.brief_messages.find(
        {"brief_id": brief_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    return msgs


@router.post("/briefs/{brief_id}/messages")
async def add_brief_message(
    brief_id: str,
    data: MessageCreate,
    current_user: dict = Depends(get_current_user),
):
    brief = await db.briefs.find_one({"id": brief_id}, {"_id": 0})
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    role = current_user.get("role")
    if role == "Freelancer" and brief.get("assigned_freelancer_id") != current_user["id"]:
        raise HTTPException(status_code=404, detail="Brief not found")
    if role not in MANAGE_ROLES and role != "Freelancer" and role not in READ_ROLES:
        raise HTTPException(status_code=403, detail="Permission denied")

    msg = {
        "id": str(uuid.uuid4()),
        "brief_id": brief_id,
        "author_id": current_user["id"],
        "author_name": current_user.get("name"),
        "author_role": role,
        "body": data.body,
        "attachments": data.attachments or [],
        "created_at": get_utc_now(),
    }
    await db.brief_messages.insert_one(msg)
    msg.pop("_id", None)
    return msg


# ── Rating ───────────────────────────────────────────────────────────────────

@router.post("/briefs/{brief_id}/rate")
async def rate_brief(
    brief_id: str,
    data: RatingCreate,
    current_user: dict = Depends(require_roles(MANAGE_ROLES)),
):
    """Admin/Operator rates the freelancer after a brief closes. Per-brief —
    one rating per brief. Updates roster avg_rating implicitly (computed on
    read in freelancers.py)."""
    brief = await db.briefs.find_one({"id": brief_id}, {"_id": 0})
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    if brief["status"] != "closed":
        raise HTTPException(
            status_code=400,
            detail=f"Brief must be closed before rating (current: {brief['status']})",
        )
    freelancer_id = brief.get("assigned_freelancer_id")
    if not freelancer_id:
        raise HTTPException(status_code=400, detail="Brief has no assigned freelancer to rate")

    existing = await db.brief_ratings.find_one({"brief_id": brief_id})
    if existing:
        raise HTTPException(status_code=400, detail="Brief already rated")

    rating = {
        "id": str(uuid.uuid4()),
        "brief_id": brief_id,
        "freelancer_id": freelancer_id,
        "rated_by": current_user["id"],
        "quality": data.quality,
        "speed": data.speed,
        "communication": data.communication,
        "rehire": data.rehire,
        "notes": data.notes,
        "created_at": get_utc_now(),
    }
    await db.brief_ratings.insert_one(rating)
    rating.pop("_id", None)
    await _log_history(brief_id, "rated", current_user, {
        "quality": data.quality, "speed": data.speed, "communication": data.communication,
    })
    return rating


# ── Brief history (read-only) ────────────────────────────────────────────────

@router.get("/briefs/{brief_id}/history")
async def list_brief_history(
    brief_id: str,
    current_user: dict = Depends(get_current_user),
):
    brief = await db.briefs.find_one({"id": brief_id}, {"_id": 0, "assigned_freelancer_id": 1})
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    role = current_user.get("role")
    if role == "Freelancer" and brief.get("assigned_freelancer_id") != current_user["id"]:
        raise HTTPException(status_code=404, detail="Brief not found")

    events = await db.brief_history.find(
        {"brief_id": brief_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return events


# ── Freelancer self-service: my-queue, my-payments ───────────────────────────

@router.get("/my-queue")
async def get_my_queue(current_user: dict = Depends(get_current_user)):
    """Freelancer dashboard. Returns briefs grouped by Active / Submitted /
    Recent (last 30 days closed) plus a header summary of money in-flight
    and earned-this-month."""
    if current_user.get("role") != "Freelancer":
        raise HTTPException(status_code=403, detail="Freelancer-only endpoint")

    user_id = current_user["id"]
    active_states = {"sent", "acknowledged", "in-progress", "revisions-requested"}
    submitted_states = {"submitted", "in-review", "approved"}

    all_assigned = await db.briefs.find(
        {"assigned_freelancer_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)

    active = []
    submitted = []
    recent = []
    payment_due = 0.0
    earned_this_month = 0.0
    now = datetime.now(timezone.utc)
    current_month_prefix = now.strftime("%Y-%m")

    for b in all_assigned:
        scoped = _scope_for_freelancer(b)
        st = b.get("status")
        if st in active_states:
            active.append(scoped)
        elif st in submitted_states:
            submitted.append(scoped)
            if st == "approved":
                payment_due += float(b.get("payment_amount") or 0)
        elif st in ("paid", "closed"):
            paid_at = (b.get("paid_at") or "")[:7]
            if paid_at == current_month_prefix:
                earned_this_month += float(b.get("payment_amount") or 0)
            # "Recent" = closed within last 30 days
            closed_at = b.get("closed_at") or b.get("paid_at")
            if closed_at:
                try:
                    closed_dt = datetime.fromisoformat(closed_at.replace("Z", "+00:00"))
                    if (now - closed_dt).days <= 30:
                        recent.append(scoped)
                except (ValueError, AttributeError):
                    pass

    return {
        "active": active,
        "submitted": submitted,
        "recent": recent,
        "summary": {
            "payment_due_approved": round(payment_due, 2),
            "earned_this_month": round(earned_this_month, 2),
            "active_count": len(active),
            "submitted_count": len(submitted),
        },
    }


@router.get("/my-payments")
async def get_my_payments(current_user: dict = Depends(get_current_user)):
    """Freelancer's paid + closed brief history with YTD totals."""
    if current_user.get("role") != "Freelancer":
        raise HTTPException(status_code=403, detail="Freelancer-only endpoint")

    user_id = current_user["id"]
    paid_briefs = await db.briefs.find(
        {"assigned_freelancer_id": user_id, "status": {"$in": ["paid", "closed"]}},
        {"_id": 0},
    ).sort("paid_at", -1).to_list(1000)

    year_prefix = datetime.now(timezone.utc).strftime("%Y")
    ytd_total = 0.0
    rows = []
    for b in paid_briefs:
        amount = float(b.get("payment_amount") or 0)
        paid_at = b.get("paid_at") or ""
        if paid_at.startswith(year_prefix):
            ytd_total += amount
        rows.append({
            "brief_id": b.get("id"),
            "title": b.get("title"),
            "payment_amount": amount,
            "payment_currency": b.get("payment_currency"),
            "paid_at": paid_at,
            "status": b.get("status"),
        })

    return {
        "items": rows,
        "ytd_total": round(ytd_total, 2),
        "currency_note": "Amounts shown in their original transaction currency.",
    }


# ── Templates ────────────────────────────────────────────────────────────────

@router.get("/brief-templates")
async def list_brief_templates(current_user: dict = Depends(require_roles(MANAGE_ROLES))):
    """Returns the 8 default brief templates. Phase 1 = static constants;
    Phase 2 will add per-project saved templates persisted in DB."""
    return {"items": BRIEF_TEMPLATES}
