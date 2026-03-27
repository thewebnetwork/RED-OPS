"""
Document / Pages Routes — Notion-style block-based documents

Supports page hierarchy (parent_id), rich content stored as JSON (TipTap format),
and full CRUD with soft-delete.
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

router = APIRouter(prefix="/documents", tags=["Documents"])


# ============== MODELS ==============

class DocumentCreate(BaseModel):
    title: str
    content: Optional[dict] = None  # TipTap JSON content
    parent_id: Optional[str] = None
    icon: Optional[str] = None  # Emoji icon
    tags: Optional[List[str]] = []


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[dict] = None
    parent_id: Optional[str] = None
    icon: Optional[str] = None
    tags: Optional[List[str]] = None
    archived: Optional[bool] = None


class DocumentResponse(BaseModel):
    id: str
    title: str
    content: Optional[dict] = None
    parent_id: Optional[str] = None
    icon: Optional[str] = None
    tags: List[str] = []
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str
    updated_at: str
    archived: bool = False
    child_count: int = 0


# ============== ENDPOINTS ==============

@router.post("", response_model=DocumentResponse)
async def create_document(
    body: DocumentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new document/page."""
    if body.parent_id:
        parent = await db.documents.find_one({"id": body.parent_id, "archived": {"$ne": True}})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent document not found")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "content": body.content,
        "parent_id": body.parent_id,
        "icon": body.icon or "📄",
        "tags": body.tags or [],
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name"),
        "created_at": now,
        "updated_at": now,
        "archived": False,
    }

    await db.documents.insert_one(doc)
    doc.pop("_id", None)
    doc["child_count"] = 0
    return DocumentResponse(**doc)


@router.get("")
async def list_documents(
    parent_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List documents. Filter by parent_id for hierarchy navigation."""
    query = {"archived": {"$ne": True}}

    if parent_id:
        query["parent_id"] = parent_id
    elif search:
        query["title"] = {"$regex": search, "$options": "i"}
    else:
        # Root level — no parent
        query["parent_id"] = {"$in": [None, ""]}

    docs = await db.documents.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)

    result = []
    for d in docs:
        d["child_count"] = await db.documents.count_documents({"parent_id": d["id"], "archived": {"$ne": True}})
        result.append(d)

    return result


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single document with its content."""
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc["child_count"] = await db.documents.count_documents({"parent_id": doc_id, "archived": {"$ne": True}})
    return DocumentResponse(**doc)


@router.patch("/{doc_id}", response_model=DocumentResponse)
async def update_document(
    doc_id: str,
    body: DocumentUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a document's title, content, or metadata."""
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    update = {}
    if body.title is not None:
        update["title"] = body.title
    if body.content is not None:
        update["content"] = body.content
    if body.parent_id is not None:
        if body.parent_id == doc_id:
            raise HTTPException(status_code=400, detail="Document cannot be its own parent")
        update["parent_id"] = body.parent_id or None
    if body.icon is not None:
        update["icon"] = body.icon
    if body.tags is not None:
        update["tags"] = body.tags
    if body.archived is not None:
        update["archived"] = body.archived

    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.documents.update_one({"id": doc_id}, {"$set": update})

    updated = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    updated["child_count"] = await db.documents.count_documents({"parent_id": doc_id, "archived": {"$ne": True}})
    return DocumentResponse(**updated)


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Soft-delete (archive) a document and its children."""
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    now = datetime.now(timezone.utc).isoformat()
    # Archive this doc and all children recursively
    await db.documents.update_one({"id": doc_id}, {"$set": {"archived": True, "updated_at": now}})
    await db.documents.update_many({"parent_id": doc_id}, {"$set": {"archived": True, "updated_at": now}})

    return {"success": True, "archived_doc_id": doc_id}


@router.get("/{doc_id}/children")
async def list_children(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List child pages of a document."""
    children = await db.documents.find(
        {"parent_id": doc_id, "archived": {"$ne": True}},
        {"_id": 0}
    ).sort("title", 1).to_list(100)

    for c in children:
        c["child_count"] = await db.documents.count_documents({"parent_id": c["id"], "archived": {"$ne": True}})

    return children
