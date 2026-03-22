"""
Knowledge Base / SOPs API Routes

Full CRUD for org-scoped documents with:
- Folder filtering, search, access control
- Version history (snapshots on every edit)
- Star/unstar per user
- RBAC: owner/admin/manager can create/edit, member/viewer read-only
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List

from ..database import get_db
from ..auth import get_current_user
from ..models.document import (
    DocumentCreate,
    DocumentUpdate,
    DocumentResponse,
    DocumentVersionResponse,
)

router = APIRouter(prefix="/knowledge-base", tags=["Knowledge Base"])


# ── Helpers ──────────────────────────────────────────────────────────

async def _get_org_id(user: dict, db: AsyncIOMotorDatabase) -> str:
    """Get org_id from user's active membership."""
    if user.get("active_org_id"):
        return user["active_org_id"]
    mem = await db.org_memberships.find_one({"user_id": str(user["_id"])})
    if not mem:
        raise HTTPException(404, "No organization membership found")
    return mem["org_id"]


async def _get_org_role(user_id: str, org_id: str, db: AsyncIOMotorDatabase) -> str:
    """Get user's role within the org."""
    mem = await db.org_memberships.find_one({"user_id": user_id, "org_id": org_id})
    if not mem:
        raise HTTPException(403, "Not a member of this organization")
    return mem.get("role", "viewer")


def _can_edit(role: str) -> bool:
    return role in ("owner", "admin", "manager")


async def _enrich_doc(doc: dict, db: AsyncIOMotorDatabase) -> dict:
    """Add user names to a document dict."""
    doc["id"] = str(doc["_id"])

    # Created by name
    if doc.get("created_by_user_id"):
        u = await db.users.find_one({"_id": ObjectId(doc["created_by_user_id"])})
        doc["created_by_name"] = u.get("name", u.get("email", "Unknown")) if u else None

    # Updated by name
    if doc.get("updated_by_user_id"):
        u = await db.users.find_one({"_id": ObjectId(doc["updated_by_user_id"])})
        doc["updated_by_name"] = u.get("name", u.get("email", "Unknown")) if u else None

    return doc


# ── CREATE ───────────────────────────────────────────────────────────

@router.post("/documents", response_model=DocumentResponse)
async def create_document(
    payload: DocumentCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    org_id = await _get_org_id(current_user, db)
    role = await _get_org_role(user_id, org_id, db)

    if not _can_edit(role):
        raise HTTPException(403, "You don't have permission to create documents")

    now = datetime.now(timezone.utc)
    doc = {
        "org_id": org_id,
        "title": payload.title,
        "folder": payload.folder,
        "access": payload.access,
        "status": payload.status,
        "body": payload.body,
        "tags": payload.tags,
        "created_by_user_id": user_id,
        "updated_by_user_id": user_id,
        "version": 1,
        "starred_by": [],
        "created_at": now,
        "updated_at": now,
    }
    result = await db.documents.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Save initial version snapshot
    await db.document_versions.insert_one({
        "document_id": str(result.inserted_id),
        "version": 1,
        "title": payload.title,
        "body": payload.body,
        "edited_by_user_id": user_id,
        "created_at": now,
    })

    enriched = await _enrich_doc(doc, db)
    return DocumentResponse(**enriched)


# ── LIST ─────────────────────────────────────────────────────────────

@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    folder: Optional[str] = Query(None),
    access: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    starred: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    org_id = await _get_org_id(current_user, db)
    await _get_org_role(user_id, org_id, db)  # Verify membership

    query = {"org_id": org_id}

    if folder:
        query["folder"] = folder
    if access:
        query["access"] = access
    if status:
        query["status"] = status
    if starred:
        query["starred_by"] = user_id
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"body": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.documents.find(query).sort("updated_at", -1).skip(skip).limit(limit)
    docs = []
    async for doc in cursor:
        enriched = await _enrich_doc(doc, db)
        docs.append(DocumentResponse(**enriched))
    return docs


# ── GET SINGLE ───────────────────────────────────────────────────────

@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    org_id = await _get_org_id(current_user, db)
    await _get_org_role(user_id, org_id, db)

    doc = await db.documents.find_one({"_id": ObjectId(document_id), "org_id": org_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    enriched = await _enrich_doc(doc, db)
    return DocumentResponse(**enriched)


# ── UPDATE ───────────────────────────────────────────────────────────

@router.patch("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    payload: DocumentUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    org_id = await _get_org_id(current_user, db)
    role = await _get_org_role(user_id, org_id, db)

    if not _can_edit(role):
        raise HTTPException(403, "You don't have permission to edit documents")

    doc = await db.documents.find_one({"_id": ObjectId(document_id), "org_id": org_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    updates = payload.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "No fields to update")

    now = datetime.now(timezone.utc)
    updates["updated_at"] = now
    updates["updated_by_user_id"] = user_id

    # If body or title changed, bump version and save snapshot
    content_changed = "body" in updates or "title" in updates
    new_version = doc.get("version", 1)
    if content_changed:
        new_version += 1
        updates["version"] = new_version

    await db.documents.update_one({"_id": ObjectId(document_id)}, {"$set": updates})

    if content_changed:
        await db.document_versions.insert_one({
            "document_id": document_id,
            "version": new_version,
            "title": updates.get("title", doc["title"]),
            "body": updates.get("body", doc["body"]),
            "edited_by_user_id": user_id,
            "created_at": now,
        })

    updated = await db.documents.find_one({"_id": ObjectId(document_id)})
    enriched = await _enrich_doc(updated, db)
    return DocumentResponse(**enriched)


# ── DELETE ───────────────────────────────────────────────────────────

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    org_id = await _get_org_id(current_user, db)
    role = await _get_org_role(user_id, org_id, db)

    if role not in ("owner", "admin"):
        raise HTTPException(403, "Only owners and admins can delete documents")

    doc = await db.documents.find_one({"_id": ObjectId(document_id), "org_id": org_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    await db.documents.delete_one({"_id": ObjectId(document_id)})
    await db.document_versions.delete_many({"document_id": document_id})

    return {"status": "deleted", "id": document_id}


# ── STAR / UNSTAR ────────────────────────────────────────────────────

@router.post("/documents/{document_id}/star")
async def star_document(
    document_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    org_id = await _get_org_id(current_user, db)
    await _get_org_role(user_id, org_id, db)

    doc = await db.documents.find_one({"_id": ObjectId(document_id), "org_id": org_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    starred = doc.get("starred_by", [])
    if user_id in starred:
        # Unstar
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$pull": {"starred_by": user_id}},
        )
        return {"status": "unstarred", "id": document_id}
    else:
        # Star
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$addToSet": {"starred_by": user_id}},
        )
        return {"status": "starred", "id": document_id}


# ── VERSION HISTORY ──────────────────────────────────────────────────

@router.get("/documents/{document_id}/versions", response_model=List[DocumentVersionResponse])
async def list_versions(
    document_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    org_id = await _get_org_id(current_user, db)
    await _get_org_role(user_id, org_id, db)

    doc = await db.documents.find_one({"_id": ObjectId(document_id), "org_id": org_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    cursor = db.document_versions.find({"document_id": document_id}).sort("version", -1)
    versions = []
    async for v in cursor:
        v["id"] = str(v["_id"])
        # Enrich editor name
        if v.get("edited_by_user_id"):
            u = await db.users.find_one({"_id": ObjectId(v["edited_by_user_id"])})
            v["edited_by_name"] = u.get("name", u.get("email", "Unknown")) if u else None
        versions.append(DocumentVersionResponse(**v))
    return versions


@router.get("/documents/{document_id}/versions/{version_number}", response_model=DocumentVersionResponse)
async def get_version(
    document_id: str,
    version_number: int,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    org_id = await _get_org_id(current_user, db)
    await _get_org_role(user_id, org_id, db)

    doc = await db.documents.find_one({"_id": ObjectId(document_id), "org_id": org_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    v = await db.document_versions.find_one({
        "document_id": document_id,
        "version": version_number,
    })
    if not v:
        raise HTTPException(404, f"Version {version_number} not found")

    v["id"] = str(v["_id"])
    if v.get("edited_by_user_id"):
        u = await db.users.find_one({"_id": ObjectId(v["edited_by_user_id"])})
        v["edited_by_name"] = u.get("name", u.get("email", "Unknown")) if u else None
    return DocumentVersionResponse(**v)


# ── FOLDER STATS ─────────────────────────────────────────────────────

@router.get("/folders/stats")
async def folder_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get document counts per folder for the current org."""
    user_id = str(current_user["_id"])
    org_id = await _get_org_id(current_user, db)
    await _get_org_role(user_id, org_id, db)

    pipeline = [
        {"$match": {"org_id": org_id}},
        {"$group": {"_id": "$folder", "count": {"$sum": 1}}},
    ]
    results = {}
    async for item in db.documents.aggregate(pipeline):
        results[item["_id"]] = item["count"]

    total = sum(results.values())
    starred_count = await db.documents.count_documents({
        "org_id": org_id,
        "starred_by": user_id,
    })

    return {
        "folders": results,
        "total": total,
        "starred": starred_count,
    }
