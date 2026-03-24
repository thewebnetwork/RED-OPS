"""
CRM / Pipeline API Routes

Full CRUD for:
- Contacts: Customer relationship management
- Pipelines: Sales pipeline definitions with stages
- Deals: Individual sales opportunities within pipelines

RBAC: owner/admin/manager can create/edit/delete
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional, List
import uuid

from database import db
from utils.auth import get_current_user
from models.crm import (
    ContactCreate,
    ContactUpdate,
    ContactResponse,
    ActivityLogCreate,
    ActivityLogEntry,
    PipelineCreate,
    PipelineUpdate,
    PipelineResponse,
    PipelineStage,
    DealCreate,
    DealUpdate,
    DealResponse,
    DealMoveRequest,
    DealStatsResponse,
)

router = APIRouter(prefix="/crm", tags=["CRM"])


# ── HELPERS ──────────────────────────────────────────────────────────

async def _get_org_id(user: dict) -> str:
    """Extract org_id from authenticated user. Auto-provisions platform org for admins."""
    org_id = user.get("org_id") or user.get("team_id") or user.get("id")
    if org_id:
        return org_id
    # Platform admins without org_id: find or create default platform org
    if user.get("role") == "Administrator":
        platform_org = await db.organizations.find_one({"org_type": "platform"}, {"_id": 0})
        if platform_org:
            org_id = platform_org["id"]
        else:
            import uuid as _uuid
            org_id = str(_uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            await db.organizations.insert_one({
                "id": org_id, "name": "RRG Platform", "slug": "rrg-platform",
                "org_type": "platform", "status": "active",
                "created_by_user_id": user["id"], "created_at": now, "updated_at": now,
                "members": [{"user_id": user["id"], "role": "owner", "joined_at": now}],
            })
        # Stamp org_id on user doc for future calls
        await db.users.update_one({"id": user["id"]}, {"$set": {"org_id": org_id}})
        return org_id
    raise HTTPException(400, "No organization context. Join or create an organization first.")


def _get_org_role(user: dict) -> str:
    """Get user's org role, falling back to system role mapping."""
    org_role = user.get("org_role")
    if org_role:
        return org_role
    sys_role = user.get("role", "")
    if sys_role == "Administrator":
        return "admin"
    if sys_role == "Operator":
        return "manager"
    return "member"


def _can_edit(role: str) -> bool:
    """Check if user role can edit/create resources."""
    return role in ("owner", "admin", "manager")


def _can_delete(role: str) -> bool:
    """Check if user role can delete resources."""
    return role in ("owner", "admin")


async def _enrich_contact(contact: dict) -> dict:
    """Add user names and metadata to contact dict."""
    # Ensure id field
    if "id" not in contact and "_id" in contact:
        contact["id"] = str(contact["_id"])

    # Created by name
    if contact.get("created_by_user_id"):
        u = await db.users.find_one(
            {"id": contact["created_by_user_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        contact["created_by_name"] = u.get("name", u.get("email", "Unknown")) if u else None

    # Assigned to name
    if contact.get("assigned_to_user_id"):
        u = await db.users.find_one(
            {"id": contact["assigned_to_user_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        contact["assigned_to_name"] = u.get("name", u.get("email", "Unknown")) if u else None

    return contact


async def _enrich_pipeline(pipeline: dict) -> dict:
    """Add user names to pipeline dict."""
    # Ensure id field
    if "id" not in pipeline and "_id" in pipeline:
        pipeline["id"] = str(pipeline["_id"])

    # Created by name
    if pipeline.get("created_by_user_id"):
        u = await db.users.find_one(
            {"id": pipeline["created_by_user_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        pipeline["created_by_name"] = u.get("name", u.get("email", "Unknown")) if u else None

    return pipeline


async def _enrich_deal(deal: dict) -> dict:
    """Add user names and relationship details to deal dict."""
    # Ensure id field
    if "id" not in deal and "_id" in deal:
        deal["id"] = str(deal["_id"])

    # Created by name
    if deal.get("created_by_user_id"):
        u = await db.users.find_one(
            {"id": deal["created_by_user_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        deal["created_by_name"] = u.get("name", u.get("email", "Unknown")) if u else None

    # Assigned to name
    if deal.get("assigned_to_user_id"):
        u = await db.users.find_one(
            {"id": deal["assigned_to_user_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        deal["assigned_to_name"] = u.get("name", u.get("email", "Unknown")) if u else None

    # Pipeline name
    if deal.get("pipeline_id"):
        pipeline = await db.pipelines.find_one(
            {"id": deal["pipeline_id"]},
            {"_id": 0, "name": 1}
        )
        deal["pipeline_name"] = pipeline.get("name") if pipeline else None

    # Stage name from pipeline
    if deal.get("pipeline_id") and deal.get("stage_id"):
        pipeline = await db.pipelines.find_one(
            {"id": deal["pipeline_id"]},
            {"_id": 0, "stages": 1}
        )
        if pipeline:
            for stage in pipeline.get("stages", []):
                if stage.get("id") == deal["stage_id"]:
                    deal["stage_name"] = stage.get("name")
                    break

    # Contact name and email
    if deal.get("contact_id"):
        contact = await db.contacts.find_one(
            {"id": deal["contact_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        if contact:
            deal["contact_name"] = contact.get("name")
            deal["contact_email"] = contact.get("email")

    return deal


# ── CONTACTS ────────────────────────────────────────────────────────

@router.post("/contacts", response_model=ContactResponse)
async def create_contact(
    payload: ContactCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new contact."""
    user_id = current_user["id"]
    org_id = await _get_org_id(current_user)
    role = _get_org_role(current_user)

    if not _can_edit(role):
        raise HTTPException(403, "You don't have permission to create contacts")

    now = datetime.now(timezone.utc)
    contact_id = str(uuid.uuid4())
    contact = {
        "id": contact_id,
        "org_id": org_id,
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
        "company": payload.company,
        "title": payload.title,
        "tags": payload.tags,
        "notes": payload.notes,
        "source": payload.source,
        "status": payload.status,
        "assigned_to_user_id": payload.assigned_to_user_id,
        "custom_fields": payload.custom_fields,
        "activity_log": [],
        "created_by_user_id": user_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.contacts.insert_one(contact)

    enriched = await _enrich_contact(contact)
    return ContactResponse(**enriched)


@router.get("/contacts", response_model=List[ContactResponse])
async def list_contacts(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
):
    """List contacts with filtering."""
    org_id = await _get_org_id(current_user)

    query = {"org_id": org_id}

    if status:
        query["status"] = status
    if tag:
        query["tags"] = tag
    if assigned_to:
        query["assigned_to_user_id"] = assigned_to
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.contacts.find(query, {"_id": 0}).sort("updated_at", -1).skip(skip).limit(limit)
    contacts = []
    async for contact in cursor:
        enriched = await _enrich_contact(contact)
        contacts.append(ContactResponse(**enriched))
    return contacts


@router.get("/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single contact."""
    org_id = await _get_org_id(current_user)

    contact = await db.contacts.find_one(
        {"id": contact_id, "org_id": org_id},
        {"_id": 0}
    )
    if not contact:
        raise HTTPException(404, "Contact not found")

    enriched = await _enrich_contact(contact)
    return ContactResponse(**enriched)


@router.patch("/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    payload: ContactUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a contact."""
    org_id = await _get_org_id(current_user)
    role = _get_org_role(current_user)

    if not _can_edit(role):
        raise HTTPException(403, "You don't have permission to edit contacts")

    contact = await db.contacts.find_one(
        {"id": contact_id, "org_id": org_id},
        {"_id": 0}
    )
    if not contact:
        raise HTTPException(404, "Contact not found")

    updates = payload.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "No fields to update")

    now = datetime.now(timezone.utc)
    updates["updated_at"] = now.isoformat()

    await db.contacts.update_one({"id": contact_id}, {"$set": updates})

    updated = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    enriched = await _enrich_contact(updated)
    return ContactResponse(**enriched)


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a contact (admin/owner only)."""
    org_id = await _get_org_id(current_user)
    role = _get_org_role(current_user)

    if not _can_delete(role):
        raise HTTPException(403, "Only admins and owners can delete contacts")

    contact = await db.contacts.find_one(
        {"id": contact_id, "org_id": org_id},
        {"_id": 0}
    )
    if not contact:
        raise HTTPException(404, "Contact not found")

    await db.contacts.delete_one({"id": contact_id})
    # Also delete associated deals
    await db.deals.delete_many({"contact_id": contact_id})

    return {"status": "deleted", "id": contact_id}


@router.post("/contacts/{contact_id}/activity", response_model=ContactResponse)
async def add_activity_log(
    contact_id: str,
    payload: ActivityLogCreate,
    current_user: dict = Depends(get_current_user),
):
    """Add an activity log entry to a contact."""
    user_id = current_user["id"]
    org_id = await _get_org_id(current_user)

    contact = await db.contacts.find_one(
        {"id": contact_id, "org_id": org_id},
        {"_id": 0}
    )
    if not contact:
        raise HTTPException(404, "Contact not found")

    now = datetime.now(timezone.utc)
    activity_entry = {
        "action": payload.action,
        "note": payload.note,
        "timestamp": now.isoformat(),
        "user_id": user_id,
    }

    await db.contacts.update_one(
        {"id": contact_id},
        {
            "$push": {"activity_log": activity_entry},
            "$set": {"updated_at": now.isoformat()}
        }
    )

    updated = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    enriched = await _enrich_contact(updated)
    return ContactResponse(**enriched)


# ── PIPELINES ───────────────────────────────────────────────────────

@router.post("/pipelines", response_model=PipelineResponse)
async def create_pipeline(
    payload: PipelineCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new pipeline."""
    user_id = current_user["id"]
    org_id = await _get_org_id(current_user)
    role = _get_org_role(current_user)

    if not _can_edit(role):
        raise HTTPException(403, "You don't have permission to create pipelines")

    now = datetime.now(timezone.utc)
    pipeline_id = str(uuid.uuid4())
    pipeline = {
        "id": pipeline_id,
        "org_id": org_id,
        "name": payload.name,
        "description": payload.description,
        "stages": [stage.dict() for stage in payload.stages],
        "is_default": payload.is_default,
        "created_by_user_id": user_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.pipelines.insert_one(pipeline)

    enriched = await _enrich_pipeline(pipeline)
    return PipelineResponse(**enriched)


@router.get("/pipelines", response_model=List[PipelineResponse])
async def list_pipelines(
    current_user: dict = Depends(get_current_user),
):
    """List all pipelines for the org."""
    org_id = await _get_org_id(current_user)

    cursor = db.pipelines.find({"org_id": org_id}, {"_id": 0}).sort("created_at", -1)
    pipelines = []
    async for pipeline in cursor:
        enriched = await _enrich_pipeline(pipeline)
        pipelines.append(PipelineResponse(**enriched))
    return pipelines


@router.get("/pipelines/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(
    pipeline_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single pipeline."""
    org_id = await _get_org_id(current_user)

    pipeline = await db.pipelines.find_one(
        {"id": pipeline_id, "org_id": org_id},
        {"_id": 0}
    )
    if not pipeline:
        raise HTTPException(404, "Pipeline not found")

    enriched = await _enrich_pipeline(pipeline)
    return PipelineResponse(**enriched)


@router.patch("/pipelines/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(
    pipeline_id: str,
    payload: PipelineUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a pipeline."""
    org_id = await _get_org_id(current_user)
    role = _get_org_role(current_user)

    if not _can_edit(role):
        raise HTTPException(403, "You don't have permission to edit pipelines")

    pipeline = await db.pipelines.find_one(
        {"id": pipeline_id, "org_id": org_id},
        {"_id": 0}
    )
    if not pipeline:
        raise HTTPException(404, "Pipeline not found")

    updates = payload.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "No fields to update")

    # Convert stages to dicts if provided
    if "stages" in updates and updates["stages"]:
        updates["stages"] = [stage.dict() for stage in updates["stages"]]

    now = datetime.now(timezone.utc)
    updates["updated_at"] = now.isoformat()

    await db.pipelines.update_one({"id": pipeline_id}, {"$set": updates})

    updated = await db.pipelines.find_one({"id": pipeline_id}, {"_id": 0})
    enriched = await _enrich_pipeline(updated)
    return PipelineResponse(**enriched)


@router.delete("/pipelines/{pipeline_id}")
async def delete_pipeline(
    pipeline_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a pipeline (admin/owner only)."""
    org_id = await _get_org_id(current_user)
    role = _get_org_role(current_user)

    if not _can_delete(role):
        raise HTTPException(403, "Only admins and owners can delete pipelines")

    pipeline = await db.pipelines.find_one(
        {"id": pipeline_id, "org_id": org_id},
        {"_id": 0}
    )
    if not pipeline:
        raise HTTPException(404, "Pipeline not found")

    await db.pipelines.delete_one({"id": pipeline_id})
    # Also delete associated deals
    await db.deals.delete_many({"pipeline_id": pipeline_id})

    return {"status": "deleted", "id": pipeline_id}


# ── DEALS ───────────────────────────────────────────────────────────

@router.post("/deals", response_model=DealResponse)
async def create_deal(
    payload: DealCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new deal."""
    user_id = current_user["id"]
    org_id = await _get_org_id(current_user)
    role = _get_org_role(current_user)

    if not _can_edit(role):
        raise HTTPException(403, "You don't have permission to create deals")

    # Verify pipeline and stage exist
    pipeline = await db.pipelines.find_one(
        {"id": payload.pipeline_id, "org_id": org_id},
        {"_id": 0}
    )
    if not pipeline:
        raise HTTPException(404, "Pipeline not found")

    stage_found = any(s.get("id") == payload.stage_id for s in pipeline.get("stages", []))
    if not stage_found:
        raise HTTPException(404, "Stage not found in pipeline")

    # Verify contact exists
    contact = await db.contacts.find_one(
        {"id": payload.contact_id, "org_id": org_id},
        {"_id": 0}
    )
    if not contact:
        raise HTTPException(404, "Contact not found")

    now = datetime.now(timezone.utc)
    deal_id = str(uuid.uuid4())
    deal = {
        "id": deal_id,
        "org_id": org_id,
        "pipeline_id": payload.pipeline_id,
        "stage_id": payload.stage_id,
        "contact_id": payload.contact_id,
        "title": payload.title,
        "value": payload.value,
        "currency": payload.currency,
        "status": payload.status,
        "probability": payload.probability,
        "expected_close_date": payload.expected_close_date,
        "assigned_to_user_id": payload.assigned_to_user_id,
        "tags": payload.tags,
        "notes": payload.notes,
        "lost_reason": None,
        "won_at": None,
        "lost_at": None,
        "created_by_user_id": user_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.deals.insert_one(deal)

    enriched = await _enrich_deal(deal)
    return DealResponse(**enriched)


@router.get("/deals", response_model=List[DealResponse])
async def list_deals(
    pipeline_id: Optional[str] = Query(None),
    stage_id: Optional[str] = Query(None),
    contact_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
):
    """List deals with filtering."""
    org_id = await _get_org_id(current_user)

    query = {"org_id": org_id}

    if pipeline_id:
        query["pipeline_id"] = pipeline_id
    if stage_id:
        query["stage_id"] = stage_id
    if contact_id:
        query["contact_id"] = contact_id
    if status:
        query["status"] = status
    if assigned_to:
        query["assigned_to_user_id"] = assigned_to

    cursor = db.deals.find(query, {"_id": 0}).sort("updated_at", -1).skip(skip).limit(limit)
    deals = []
    async for deal in cursor:
        enriched = await _enrich_deal(deal)
        deals.append(DealResponse(**enriched))
    return deals


@router.get("/deals/{deal_id}", response_model=DealResponse)
async def get_deal(
    deal_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single deal."""
    org_id = await _get_org_id(current_user)

    deal = await db.deals.find_one(
        {"id": deal_id, "org_id": org_id},
        {"_id": 0}
    )
    if not deal:
        raise HTTPException(404, "Deal not found")

    enriched = await _enrich_deal(deal)
    return DealResponse(**enriched)


@router.patch("/deals/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: str,
    payload: DealUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a deal."""
    org_id = await _get_org_id(current_user)
    role = _get_org_role(current_user)

    if not _can_edit(role):
        raise HTTPException(403, "You don't have permission to edit deals")

    deal = await db.deals.find_one(
        {"id": deal_id, "org_id": org_id},
        {"_id": 0}
    )
    if not deal:
        raise HTTPException(404, "Deal not found")

    updates = payload.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "No fields to update")

    now = datetime.now(timezone.utc)
    updates["updated_at"] = now.isoformat()

    # Handle status changes
    if "status" in updates:
        if updates["status"] == "won":
            updates["won_at"] = now.isoformat()
        elif updates["status"] == "lost":
            updates["lost_at"] = now.isoformat()

    # Validate stage_id and pipeline_id if provided
    if "stage_id" in updates or "pipeline_id" in updates:
        pipeline_id = updates.get("pipeline_id", deal.get("pipeline_id"))
        stage_id = updates.get("stage_id", deal.get("stage_id"))

        pipeline = await db.pipelines.find_one(
            {"id": pipeline_id, "org_id": org_id},
            {"_id": 0}
        )
        if not pipeline:
            raise HTTPException(404, "Pipeline not found")

        stage_found = any(s.get("id") == stage_id for s in pipeline.get("stages", []))
        if not stage_found:
            raise HTTPException(404, "Stage not found in pipeline")

    await db.deals.update_one({"id": deal_id}, {"$set": updates})

    updated = await db.deals.find_one({"id": deal_id}, {"_id": 0})
    enriched = await _enrich_deal(updated)
    return DealResponse(**enriched)


@router.patch("/deals/{deal_id}/move", response_model=DealResponse)
async def move_deal(
    deal_id: str,
    payload: DealMoveRequest,
    current_user: dict = Depends(get_current_user),
):
    """Move a deal to a different stage."""
    org_id = await _get_org_id(current_user)
    role = _get_org_role(current_user)

    if not _can_edit(role):
        raise HTTPException(403, "You don't have permission to edit deals")

    deal = await db.deals.find_one(
        {"id": deal_id, "org_id": org_id},
        {"_id": 0}
    )
    if not deal:
        raise HTTPException(404, "Deal not found")

    # Use current pipeline if not specified
    pipeline_id = payload.pipeline_id or deal.get("pipeline_id")

    pipeline = await db.pipelines.find_one(
        {"id": pipeline_id, "org_id": org_id},
        {"_id": 0}
    )
    if not pipeline:
        raise HTTPException(404, "Pipeline not found")

    stage_found = any(s.get("id") == payload.stage_id for s in pipeline.get("stages", []))
    if not stage_found:
        raise HTTPException(404, "Stage not found in pipeline")

    now = datetime.now(timezone.utc)
    updates = {
        "pipeline_id": pipeline_id,
        "stage_id": payload.stage_id,
        "updated_at": now.isoformat(),
    }

    await db.deals.update_one({"id": deal_id}, {"$set": updates})

    updated = await db.deals.find_one({"id": deal_id}, {"_id": 0})
    enriched = await _enrich_deal(updated)
    return DealResponse(**enriched)


@router.delete("/deals/{deal_id}")
async def delete_deal(
    deal_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a deal (admin/owner only)."""
    org_id = await _get_org_id(current_user)
    role = _get_org_role(current_user)

    if not _can_delete(role):
        raise HTTPException(403, "Only admins and owners can delete deals")

    deal = await db.deals.find_one(
        {"id": deal_id, "org_id": org_id},
        {"_id": 0}
    )
    if not deal:
        raise HTTPException(404, "Deal not found")

    await db.deals.delete_one({"id": deal_id})

    return {"status": "deleted", "id": deal_id}


# ── STATISTICS ──────────────────────────────────────────────────────

@router.get("/stats", response_model=List[DealStatsResponse])
async def get_pipeline_stats(
    pipeline_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Get pipeline statistics (total deals, value by stage, won/lost counts)."""
    org_id = await _get_org_id(current_user)

    # Get pipelines
    pipeline_query = {"org_id": org_id}
    if pipeline_id:
        pipeline_query["id"] = pipeline_id

    pipelines = []
    cursor = db.pipelines.find(pipeline_query, {"_id": 0})
    async for pipeline in cursor:
        pipelines.append(pipeline)

    stats = []
    for pipeline in pipelines:
        # Get all deals for this pipeline
        deals = []
        deal_cursor = db.deals.find(
            {"org_id": org_id, "pipeline_id": pipeline["id"]},
            {"_id": 0}
        )
        async for deal in deal_cursor:
            deals.append(deal)

        # Calculate stats
        total_deals = len(deals)
        open_deals = sum(1 for d in deals if d.get("status") == "open")
        won_deals = sum(1 for d in deals if d.get("status") == "won")
        lost_deals = sum(1 for d in deals if d.get("status") == "lost")
        total_value = sum(d.get("value", 0) for d in deals)
        won_value = sum(d.get("value", 0) for d in deals if d.get("status") == "won")
        lost_value = sum(d.get("value", 0) for d in deals if d.get("status") == "lost")

        # Stats by stage
        by_stage = {}
        for stage in pipeline.get("stages", []):
            stage_id = stage.get("id")
            stage_deals = [d for d in deals if d.get("stage_id") == stage_id]
            by_stage[stage_id] = {
                "stage_name": stage.get("name"),
                "count": len(stage_deals),
                "value": sum(d.get("value", 0) for d in stage_deals),
                "open": sum(1 for d in stage_deals if d.get("status") == "open"),
                "won": sum(1 for d in stage_deals if d.get("status") == "won"),
                "lost": sum(1 for d in stage_deals if d.get("status") == "lost"),
            }

        stat = DealStatsResponse(
            pipeline_id=pipeline["id"],
            pipeline_name=pipeline.get("name"),
            total_deals=total_deals,
            open_deals=open_deals,
            won_deals=won_deals,
            lost_deals=lost_deals,
            total_value=total_value,
            won_value=won_value,
            lost_value=lost_value,
            by_stage=by_stage,
        )
        stats.append(stat)

    return stats
