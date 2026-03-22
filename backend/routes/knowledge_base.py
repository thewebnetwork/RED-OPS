"""
Knowledge Base / SOPs API Routes

Full CRUD for org-scoped documents with:
- Folder filtering, search, access control
- Version history (snapshots on every edit)
- Star/unstar per user
- RBAC: owner/admin/manager can create/edit, member/viewer read-only
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional, List
import uuid

from database import db
from utils.auth import get_current_user
from models.document import (
    DocumentCreate,
    DocumentUpdate,
    DocumentResponse,
    DocumentVersionResponse,
)

router = APIRouter(prefix="/knowledge-base", tags=["Knowledge Base"])


# ── Helpers ──────────────────────────────────────────────────────────

def _get_org_id(user: dict) -> str:
    """Extract org_id from authenticated user."""
    org_id = user.get("org_id") or user.get("team_id")
    if not org_id:
        raise HTTPException(400, "No organization context. Join or create an organization first.")
    return org_id


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
    return role in ("owner", "admin", "manager")


async def _enrich_doc(doc: dict) -> dict:
    """Add user names to a document dict."""
    # Ensure id field
    if "id" not in doc and "_id" in doc:
        doc["id"] = str(doc["_id"])

    # Created by name
    if doc.get("created_by_user_id"):
        u = await db.users.find_one(
            {"id": doc["created_by_user_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        doc["created_by_name"] = u.get("name", u.get("email", "Unknown")) if u else None

    # Updated by name
    if doc.get("updated_by_user_id"):
        u = await db.users.find_one(
            {"id": doc["updated_by_user_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        doc["updated_by_name"] = u.get("name", u.get("email", "Unknown")) if u else None

    return doc


# ── CREATE ───────────────────────────────────────────────────────────

@router.post("/documents", response_model=DocumentResponse)
async def create_document(
    payload: DocumentCreate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]
    org_id = _get_org_id(current_user)
    role = _get_org_role(current_user)

    if not _can_edit(role):
        raise HTTPException(403, "You don't have permission to create documents")

    now = datetime.now(timezone.utc)
    doc_id = str(uuid.uuid4())
    doc = {
        "id": doc_id,
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
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.documents.insert_one(doc)

    # Save initial version snapshot
    await db.document_versions.insert_one({
        "id": str(uuid.uuid4()),
        "document_id": doc_id,
        "version": 1,
        "title": payload.title,
        "body": payload.body,
        "edited_by_user_id": user_id,
        "created_at": now.isoformat(),
    })

    enriched = await _enrich_doc(doc)
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
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]
    org_id = _get_org_id(current_user)

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

    cursor = db.documents.find(query, {"_id": 0}).sort("updated_at", -1).skip(skip).limit(limit)
    docs = []
    async for doc in cursor:
        enriched = await _enrich_doc(doc)
        docs.append(DocumentResponse(**enriched))
    return docs


# ── GET SINGLE ───────────────────────────────────────────────────────

@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = _get_org_id(current_user)

    doc = await db.documents.find_one({"id": document_id, "org_id": org_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")

    enriched = await _enrich_doc(doc)
    return DocumentResponse(**enriched)


# ── UPDATE ───────────────────────────────────────────────────────────

@router.patch("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    payload: DocumentUpdate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]
    org_id = _get_org_id(current_user)
    role = _get_org_role(current_user)

    if not _can_edit(role):
        raise HTTPException(403, "You don't have permission to edit documents")

    doc = await db.documents.find_one({"id": document_id, "org_id": org_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")

    updates = payload.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "No fields to update")

    now = datetime.now(timezone.utc)
    updates["updated_at"] = now.isoformat()
    updates["updated_by_user_id"] = user_id

    # If body or title changed, bump version and save snapshot
    content_changed = "body" in updates or "title" in updates
    new_version = doc.get("version", 1)
    if content_changed:
        new_version += 1
        updates["version"] = new_version

    await db.documents.update_one({"id": document_id}, {"$set": updates})

    if content_changed:
        await db.document_versions.insert_one({
            "id": str(uuid.uuid4()),
            "document_id": document_id,
            "version": new_version,
            "title": updates.get("title", doc["title"]),
            "body": updates.get("body", doc["body"]),
            "edited_by_user_id": user_id,
            "created_at": now.isoformat(),
        })

    updated = await db.documents.find_one({"id": document_id}, {"_id": 0})
    enriched = await _enrich_doc(updated)
    return DocumentResponse(**enriched)


# ── DELETE ───────────────────────────────────────────────────────────

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = _get_org_id(current_user)
    role = _get_org_role(current_user)

    if role not in ("owner", "admin"):
        raise HTTPException(403, "Only owners and admins can delete documents")

    doc = await db.documents.find_one({"id": document_id, "org_id": org_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")

    await db.documents.delete_one({"id": document_id})
    await db.document_versions.delete_many({"document_id": document_id})

    return {"status": "deleted", "id": document_id}


# ── STAR / UNSTAR ────────────────────────────────────────────────────

@router.post("/documents/{document_id}/star")
async def star_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]
    org_id = _get_org_id(current_user)

    doc = await db.documents.find_one({"id": document_id, "org_id": org_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")

    starred = doc.get("starred_by", [])
    if user_id in starred:
        await db.documents.update_one(
            {"id": document_id},
            {"$pull": {"starred_by": user_id}},
        )
        return {"status": "unstarred", "id": document_id}
    else:
        await db.documents.update_one(
            {"id": document_id},
            {"$addToSet": {"starred_by": user_id}},
        )
        return {"status": "starred", "id": document_id}


# ── VERSION HISTORY ──────────────────────────────────────────────────

@router.get("/documents/{document_id}/versions", response_model=List[DocumentVersionResponse])
async def list_versions(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = _get_org_id(current_user)

    doc = await db.documents.find_one({"id": document_id, "org_id": org_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")

    cursor = db.document_versions.find({"document_id": document_id}, {"_id": 0}).sort("version", -1)
    versions = []
    async for v in cursor:
        if v.get("edited_by_user_id"):
            u = await db.users.find_one(
                {"id": v["edited_by_user_id"]},
                {"_id": 0, "name": 1, "email": 1}
            )
            v["edited_by_name"] = u.get("name", u.get("email", "Unknown")) if u else None
        versions.append(DocumentVersionResponse(**v))
    return versions


@router.get("/documents/{document_id}/versions/{version_number}", response_model=DocumentVersionResponse)
async def get_version(
    document_id: str,
    version_number: int,
    current_user: dict = Depends(get_current_user),
):
    org_id = _get_org_id(current_user)

    doc = await db.documents.find_one({"id": document_id, "org_id": org_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")

    v = await db.document_versions.find_one(
        {"document_id": document_id, "version": version_number},
        {"_id": 0}
    )
    if not v:
        raise HTTPException(404, f"Version {version_number} not found")

    if v.get("edited_by_user_id"):
        u = await db.users.find_one(
            {"id": v["edited_by_user_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        v["edited_by_name"] = u.get("name", u.get("email", "Unknown")) if u else None
    return DocumentVersionResponse(**v)


# ── FOLDER STATS ─────────────────────────────────────────────────────

@router.get("/folders/stats")
async def folder_stats(
    current_user: dict = Depends(get_current_user),
):
    """Get document counts per folder for the current org."""
    user_id = current_user["id"]
    org_id = _get_org_id(current_user)

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
