"""Freelancer management routes — Editor Module Phase 1.

Admin/Operator-managed roster of external editors and contract help. Each
freelancer also has a backing user record (role="Freelancer") so they can
log in and see their queue. Computed fields (avg_rating, current_open_briefs,
total_briefs_completed) aggregate from briefs + brief_ratings on read.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field

from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import get_utc_now, hash_password
from services.email import send_account_created_email

router = APIRouter(tags=["Freelancers"])

logger = logging.getLogger(__name__)

# Roles allowed to manage the freelancer roster
ROSTER_MANAGE_ROLES = ["Administrator", "Operator"]

AVAILABILITY_VALUES = {"available", "busy", "unavailable"}
AVAILABILITY_PATTERN = r"^(available|busy|unavailable)$"


# ── Pydantic Models ──────────────────────────────────────────────────────────

class FreelancerCreate(BaseModel):
    email: EmailStr
    display_name: str = Field(..., min_length=1, max_length=120)
    skills: List[str] = []
    hourly_rate: Optional[float] = Field(None, ge=0)
    typical_turnaround_days: Optional[int] = Field(None, ge=0)
    payment_method: Optional[str] = None
    availability_state: str = Field("available", pattern=AVAILABILITY_PATTERN)
    timezone: Optional[str] = None
    portfolio_url: Optional[str] = None
    notes: Optional[str] = None  # internal-only


class FreelancerUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=120)
    skills: Optional[List[str]] = None
    hourly_rate: Optional[float] = Field(None, ge=0)
    typical_turnaround_days: Optional[int] = Field(None, ge=0)
    payment_method: Optional[str] = None
    availability_state: Optional[str] = Field(None, pattern=AVAILABILITY_PATTERN)
    timezone: Optional[str] = None
    portfolio_url: Optional[str] = None
    notes: Optional[str] = None  # internal-only — only admin/operator


class FreelancerSelfUpdate(BaseModel):
    """Subset of FreelancerUpdate that the Freelancer role can change for
    themselves. Excludes hourly_rate (rate is set by admin) and notes
    (internal-only)."""
    display_name: Optional[str] = Field(None, min_length=1, max_length=120)
    skills: Optional[List[str]] = None
    typical_turnaround_days: Optional[int] = Field(None, ge=0)
    payment_method: Optional[str] = None
    availability_state: Optional[str] = Field(None, pattern=AVAILABILITY_PATTERN)
    timezone: Optional[str] = None
    portfolio_url: Optional[str] = None


# ── Computed-field aggregators ───────────────────────────────────────────────

async def _compute_freelancer_stats(user_id: str) -> dict:
    """Aggregate live counts + avg rating for a freelancer profile."""
    closed_count = await db.briefs.count_documents(
        {"assigned_freelancer_id": user_id, "status": "closed"}
    )
    open_count = await db.briefs.count_documents(
        {
            "assigned_freelancer_id": user_id,
            "status": {"$in": ["sent", "acknowledged", "in-progress",
                              "submitted", "in-review", "revisions-requested"]},
        }
    )

    ratings = await db.brief_ratings.find(
        {"freelancer_id": user_id},
        {"_id": 0, "quality": 1, "speed": 1, "communication": 1},
    ).to_list(1000)
    if ratings:
        # Average across all three dimensions for a single composite rating
        all_scores = []
        for r in ratings:
            for key in ("quality", "speed", "communication"):
                v = r.get(key)
                if v is not None:
                    all_scores.append(v)
        avg = round(sum(all_scores) / len(all_scores), 2) if all_scores else None
    else:
        avg = None

    last_assigned = await db.briefs.find_one(
        {"assigned_freelancer_id": user_id},
        {"_id": 0, "assigned_at": 1},
        sort=[("assigned_at", -1)],
    )

    return {
        "total_briefs_completed": closed_count,
        "current_open_briefs": open_count,
        "avg_rating": avg,
        "rating_count": len(ratings),
        "last_assigned_at": last_assigned.get("assigned_at") if last_assigned else None,
    }


async def _hydrate_freelancer(profile: dict, include_internal: bool = True) -> dict:
    """Attach computed stats + the user record's email/active flag."""
    if not profile:
        return profile
    user_id = profile.get("user_id")
    out = {**profile}
    if user_id:
        user = await db.users.find_one(
            {"id": user_id}, {"_id": 0, "password": 0}
        )
        if user:
            out["email"] = user.get("email")
            out["active"] = user.get("active", True)
        out.update(await _compute_freelancer_stats(user_id))
    if not include_internal:
        out.pop("notes", None)
        out.pop("hourly_rate", None)
    return out


# ── Admin / Operator endpoints ───────────────────────────────────────────────

@router.post("/freelancers")
async def create_freelancer(
    data: FreelancerCreate,
    current_user: dict = Depends(require_roles(ROSTER_MANAGE_ROLES)),
):
    """Invite a new freelancer. Creates a user record with role=Freelancer +
    freelancer profile. Sends the invite email with a one-time password."""
    email = data.email.lower().strip()

    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    now = get_utc_now()
    user_id = str(uuid.uuid4())
    temp_password = f"Welcome{uuid.uuid4().hex[:8]}!"

    user = {
        "id": user_id,
        "name": data.display_name,
        "email": email,
        "password": hash_password(temp_password),
        "role": "Freelancer",
        "account_type": "Freelancer",
        "invited_by": current_user["id"],
        "active": True,
        "force_password_change": True,
        "created_at": now,
        "specialty_ids": [],
        "primary_specialty_id": None,
        "specialty_id": None,
        "permissions": {},
        "can_pick": False,
    }
    await db.users.insert_one(user)

    profile = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "display_name": data.display_name,
        "skills": data.skills or [],
        "hourly_rate": data.hourly_rate,
        "typical_turnaround_days": data.typical_turnaround_days,
        "payment_method": data.payment_method,
        "availability_state": data.availability_state,
        "timezone": data.timezone,
        "portfolio_url": data.portfolio_url,
        "notes": data.notes,
        "created_at": now,
        "created_by": current_user["id"],
    }
    await db.freelancers.insert_one(profile)
    profile.pop("_id", None)

    try:
        await send_account_created_email(
            to_email=email,
            user_name=data.display_name,
            temp_password=temp_password,
            role="Freelancer",
        )
    except Exception as e:
        logger.warning(f"Failed to send freelancer invite email to {email}: {e}")

    return await _hydrate_freelancer(profile)


@router.get("/freelancers")
async def list_freelancers(
    current_user: dict = Depends(require_roles(ROSTER_MANAGE_ROLES)),
):
    """Admin/Operator roster view. Returns hydrated profiles with computed
    stats."""
    profiles = await db.freelancers.find({}, {"_id": 0}).sort("display_name", 1).to_list(500)
    return [await _hydrate_freelancer(p) for p in profiles]


@router.get("/freelancers/{freelancer_id}")
async def get_freelancer(
    freelancer_id: str,
    current_user: dict = Depends(require_roles(ROSTER_MANAGE_ROLES)),
):
    profile = await db.freelancers.find_one({"id": freelancer_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Freelancer not found")
    return await _hydrate_freelancer(profile)


@router.patch("/freelancers/{freelancer_id}")
async def update_freelancer(
    freelancer_id: str,
    data: FreelancerUpdate,
    current_user: dict = Depends(require_roles(ROSTER_MANAGE_ROLES)),
):
    profile = await db.freelancers.find_one({"id": freelancer_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Freelancer not found")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = get_utc_now()
        await db.freelancers.update_one({"id": freelancer_id}, {"$set": update_dict})
        # Mirror display_name to user.name so it shows up consistently elsewhere
        if "display_name" in update_dict:
            await db.users.update_one(
                {"id": profile["user_id"]},
                {"$set": {"name": update_dict["display_name"]}},
            )

    refreshed = await db.freelancers.find_one({"id": freelancer_id}, {"_id": 0})
    return await _hydrate_freelancer(refreshed)


@router.delete("/freelancers/{freelancer_id}")
async def deactivate_freelancer(
    freelancer_id: str,
    current_user: dict = Depends(require_roles(["Administrator"])),
):
    """Soft-deactivate. Sets the backing user.active=False so the freelancer
    can no longer log in. Profile + brief history stay for audit."""
    profile = await db.freelancers.find_one({"id": freelancer_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Freelancer not found")

    await db.users.update_one(
        {"id": profile["user_id"]},
        {"$set": {"active": False, "deactivated_at": get_utc_now()}},
    )
    return {"success": True, "freelancer_id": freelancer_id}


# ── Freelancer self-service endpoints ────────────────────────────────────────

@router.get("/my-profile")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Freelancer reads own profile. No internal fields (notes, hourly_rate
    are admin-only)."""
    if current_user.get("role") != "Freelancer":
        raise HTTPException(status_code=403, detail="Freelancer-only endpoint")
    profile = await db.freelancers.find_one(
        {"user_id": current_user["id"]}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return await _hydrate_freelancer(profile, include_internal=False)


@router.patch("/my-profile")
async def update_my_profile(
    data: FreelancerSelfUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "Freelancer":
        raise HTTPException(status_code=403, detail="Freelancer-only endpoint")
    profile = await db.freelancers.find_one(
        {"user_id": current_user["id"]}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = get_utc_now()
        await db.freelancers.update_one(
            {"user_id": current_user["id"]}, {"$set": update_dict}
        )
        if "display_name" in update_dict:
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$set": {"name": update_dict["display_name"]}},
            )

    refreshed = await db.freelancers.find_one(
        {"user_id": current_user["id"]}, {"_id": 0}
    )
    return await _hydrate_freelancer(refreshed, include_internal=False)
