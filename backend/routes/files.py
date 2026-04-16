"""
Files Module — Universal file management across orders, projects, and standalone.

Provides:
  - Folder creation and nesting
  - File upload (to Nextcloud or local disk)
  - File listing with folder hierarchy
  - File download
  - Mark as deliverable
  - Bulk operations
"""
import uuid
import os
import io
from datetime import datetime, timezone
from typing import Optional, List, Literal
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user
from utils.helpers import get_utc_now
from utils.nextcloud import (
    upload_file as nc_upload, download_file as nc_download,
    is_configured as nc_enabled
)

router = APIRouter(prefix="/files", tags=["Files"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/redops_uploads")


# ============== MODELS ==============

class FolderCreate(BaseModel):
    name: str
    parent_folder_id: Optional[str] = None
    context_type: Optional[Literal["order", "project", "standalone"]] = "standalone"
    context_id: Optional[str] = None
    color: Optional[str] = None

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class FileUpdate(BaseModel):
    label: Optional[str] = None
    is_deliverable: Optional[bool] = None
    folder_id: Optional[str] = None


# ============== HELPERS ==============

def file_storage_path(file_id: str, ext: str, context_type: str = "standalone", context_id: str = None):
    """Build a storage path for Nextcloud or local."""
    ctx = f"{context_type}/{context_id}" if context_id else "general"
    return f"RED-OPS/files/{ctx}/{file_id}{ext}"


# ============== FOLDER ROUTES ==============

@router.post("/folders")
async def create_folder(data: FolderCreate, current_user: dict = Depends(get_current_user)):
    """Create a folder."""
    folder = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "parent_folder_id": data.parent_folder_id,
        "context_type": data.context_type,
        "context_id": data.context_id,
        "color": data.color,
        "org_id": current_user.get("org_id"),
        "created_by_user_id": current_user["id"],
        "created_by_name": current_user.get("name", ""),
        "created_at": get_utc_now(),
        "updated_at": get_utc_now(),
    }
    await db.file_folders.insert_one(folder)
    folder.pop("_id", None)
    return folder


@router.get("/folders")
async def list_folders(
    context_type: Optional[str] = Query(None),
    context_id: Optional[str] = Query(None),
    parent_folder_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List folders scoped to the caller. Media Clients only ever see
    folders they created or folders explicitly tied to their account."""
    is_client = current_user.get("account_type") == "Media Client" or current_user.get("role") == "Media Client"
    if is_client:
        # Media Client: only their own uploads or folders keyed to them
        query = {
            "$or": [
                {"created_by_user_id": current_user["id"]},
                {"context_type": "client", "context_id": current_user["id"]},
            ]
        }
    else:
        query = {"org_id": current_user.get("org_id")}
    if context_type:
        query["context_type"] = context_type
    if context_id:
        query["context_id"] = context_id
    if parent_folder_id:
        query["parent_folder_id"] = parent_folder_id
    elif not parent_folder_id and "parent_folder_id" not in query:
        query["parent_folder_id"] = None  # root level

    folders = await db.file_folders.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    return folders


@router.patch("/folders/{folder_id}")
async def update_folder(folder_id: str, data: FolderUpdate, current_user: dict = Depends(get_current_user)):
    """Rename or recolor a folder."""
    updates = {k: v for k, v in data.dict(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    updates["updated_at"] = get_utc_now()
    await db.file_folders.update_one({"id": folder_id}, {"$set": updates})
    return {"message": "Folder updated"}


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a folder and move its files to parent/root."""
    folder = await db.file_folders.find_one({"id": folder_id}, {"_id": 0})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    # Org isolation
    user_org = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    folder_org = folder.get("org_id")
    if folder_org and user_org and folder_org != user_org:
        raise HTTPException(status_code=404, detail="Folder not found")

    parent_id = folder.get("parent_folder_id")
    # Move children folders up
    await db.file_folders.update_many(
        {"parent_folder_id": folder_id},
        {"$set": {"parent_folder_id": parent_id}}
    )
    # Move files up
    await db.files.update_many(
        {"folder_id": folder_id},
        {"$set": {"folder_id": parent_id}}
    )
    await db.file_folders.delete_one({"id": folder_id})
    return {"message": "Folder deleted"}


# ============== FILE ROUTES ==============

@router.post("/upload")
async def upload_file_universal(
    file: UploadFile = File(...),
    context_type: str = Form("standalone"),
    context_id: Optional[str] = Form(None),
    folder_id: Optional[str] = Form(None),
    is_deliverable: bool = Form(False),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file to the universal file system."""
    # File size limit: 100MB
    MAX_FILE_SIZE = 100 * 1024 * 1024
    # Block executable extensions
    BLOCKED_EXTS = {'.exe', '.bat', '.cmd', '.sh', '.php', '.jsp', '.cgi', '.com', '.scr', '.pif', '.msi'}

    file_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ''
    if file_ext in BLOCKED_EXTS:
        raise HTTPException(status_code=400, detail=f"File type {file_ext} is not allowed")
    stored_filename = f"{file_id}{file_ext}"
    content = await file.read()
    file_size = len(content)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 100MB limit")
    storage_backend = "local"

    if nc_enabled():
        nc_path = file_storage_path(file_id, file_ext, context_type, context_id)
        success = await nc_upload(nc_path, content, file.content_type or "application/octet-stream")
        if not success:
            raise HTTPException(status_code=500, detail="Failed to upload to storage")
        storage_backend = "nextcloud"
    else:
        ctx_dir = os.path.join(UPLOAD_DIR, "files", context_type, context_id or "general")
        os.makedirs(ctx_dir, exist_ok=True)
        path = os.path.join(ctx_dir, stored_filename)
        with open(path, "wb") as f:
            f.write(content)

    file_doc = {
        "id": file_id,
        "org_id": current_user.get("org_id"),
        "context_type": context_type,
        "context_id": context_id,
        "folder_id": folder_id,
        "uploaded_by_user_id": current_user["id"],
        "uploaded_by_name": current_user.get("name", ""),
        "label": file.filename or "Untitled",
        "original_filename": file.filename,
        "stored_filename": stored_filename,
        "content_type": file.content_type,
        "file_size": file_size,
        "storage_backend": storage_backend,
        "is_deliverable": is_deliverable,
        "download_count": 0,
        "created_at": get_utc_now(),
        "updated_at": get_utc_now(),
    }
    await db.files.insert_one(file_doc)

    # Also mirror to order_files if it's an order context (backward compat)
    if context_type == "order" and context_id:
        compat_doc = {
            "id": file_id,
            "order_id": context_id,
            "uploaded_by_user_id": current_user["id"],
            "uploaded_by_name": current_user.get("name", ""),
            "file_type": "Attachment",
            "label": file.filename,
            "url": f"/api/files/{file_id}/download",
            "original_filename": file.filename,
            "stored_filename": stored_filename,
            "content_type": file.content_type,
            "storage_backend": storage_backend,
            "is_final_delivery": is_deliverable,
            "created_at": get_utc_now()
        }
        await db.order_files.insert_one(compat_doc)

    return {
        "id": file_id,
        "label": file.filename,
        "file_size": file_size,
        "content_type": file.content_type,
        "download_url": f"/api/files/{file_id}/download",
        "is_deliverable": is_deliverable,
    }


@router.get("")
async def list_files(
    context_type: Optional[str] = Query(None),
    context_id: Optional[str] = Query(None),
    folder_id: Optional[str] = Query(None),
    is_deliverable: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List files with optional context/folder filtering. Media Clients see
    only their own uploads or files explicitly tied to their client account —
    never the agency's internal file library."""
    is_client = current_user.get("account_type") == "Media Client" or current_user.get("role") == "Media Client"
    if is_client:
        query = {
            "$or": [
                {"uploaded_by_user_id": current_user["id"]},
                {"context_type": "client", "context_id": current_user["id"]},
            ]
        }
    else:
        query = {"org_id": current_user.get("org_id")}
    if context_type:
        query["context_type"] = context_type
    if context_id:
        query["context_id"] = context_id
    if folder_id is not None:
        query["folder_id"] = folder_id if folder_id != "root" else None
    if is_deliverable is not None:
        query["is_deliverable"] = is_deliverable
    if search:
        query["label"] = {"$regex": search, "$options": "i"}

    files = await db.files.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

    # Enrich with context names
    for f in files:
        f["download_url"] = f"/api/files/{f['id']}/download"

    return files


@router.get("/{file_id}")
async def get_file_info(file_id: str, current_user: dict = Depends(get_current_user)):
    """Get file metadata."""
    f = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    f["download_url"] = f"/api/files/{f['id']}/download"
    return f


@router.get("/{file_id}/download")
async def download_file_universal(file_id: str, current_user: dict = Depends(get_current_user)):
    """Download a file."""
    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_doc:
        # Fall back to order_files for backward compat
        file_doc = await db.order_files.find_one({"id": file_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    stored_filename = file_doc.get("stored_filename")
    original_filename = file_doc.get("original_filename", stored_filename)
    content_type = file_doc.get("content_type", "application/octet-stream")
    storage_backend = file_doc.get("storage_backend", "local")
    context_type = file_doc.get("context_type", "order")
    context_id = file_doc.get("context_id") or file_doc.get("order_id")

    # Increment download count
    await db.files.update_one({"id": file_id}, {"$inc": {"download_count": 1}})

    if storage_backend == "nextcloud":
        file_ext = os.path.splitext(stored_filename)[1] if stored_filename else ''
        nc_path = file_storage_path(file_id, file_ext, context_type, context_id)
        file_bytes = await nc_download(nc_path)
        if file_bytes is None:
            # Try legacy order path
            from utils.nextcloud import order_file_path
            nc_path2 = order_file_path(context_id or "", stored_filename)
            file_bytes = await nc_download(nc_path2)
        if file_bytes is None:
            raise HTTPException(status_code=404, detail="File not found in storage")
        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{original_filename}"'}
        )
    else:
        # Local disk
        ctx_dir = os.path.join(UPLOAD_DIR, "files", context_type or "order", context_id or "general")
        path = os.path.join(ctx_dir, stored_filename)
        if not os.path.exists(path):
            # Try legacy order path
            path = os.path.join(UPLOAD_DIR, context_id or "", stored_filename)
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="File not found on disk")

        from fastapi.responses import FileResponse as FastAPIFileResponse
        return FastAPIFileResponse(path, filename=original_filename, media_type=content_type)


@router.patch("/{file_id}")
async def update_file(file_id: str, data: FileUpdate, current_user: dict = Depends(get_current_user)):
    """Update file metadata (rename, move to folder, toggle deliverable)."""
    updates = {k: v for k, v in data.dict(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates")
    updates["updated_at"] = get_utc_now()
    await db.files.update_one({"id": file_id}, {"$set": updates})
    return {"message": "File updated"}


@router.delete("/{file_id}")
async def delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a file record. Does not delete from storage (soft delete)."""
    # Verify file belongs to user's org before deleting
    user_org = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0, "org_id": 1, "uploaded_by_user_id": 1})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    file_org = file_doc.get("org_id")
    if file_org and user_org and file_org != user_org:
        raise HTTPException(status_code=404, detail="File not found")
    await db.files.delete_one({"id": file_id})
    await db.order_files.delete_one({"id": file_id})
    return {"message": "File deleted"}


# ============== STATS ==============

@router.get("/stats/summary")
async def file_stats(current_user: dict = Depends(get_current_user)):
    """Get file storage statistics."""
    org_id = current_user.get("org_id")
    query = {"org_id": org_id} if org_id else {}

    total = await db.files.count_documents(query)
    pipeline = [
        {"$match": query},
        {"$group": {"_id": None, "total_size": {"$sum": "$file_size"}, "total_downloads": {"$sum": "$download_count"}}}
    ]
    agg = await db.files.aggregate(pipeline).to_list(1)
    stats = agg[0] if agg else {"total_size": 0, "total_downloads": 0}

    deliverables = await db.files.count_documents({**query, "is_deliverable": True})
    folders = await db.file_folders.count_documents({"org_id": org_id} if org_id else {})

    return {
        "total_files": total,
        "total_folders": folders,
        "total_size_bytes": stats.get("total_size", 0),
        "total_downloads": stats.get("total_downloads", 0),
        "deliverables": deliverables,
    }
