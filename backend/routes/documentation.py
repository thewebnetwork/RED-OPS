"""Documentation routes - Serve system documentation to admins"""
import os
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from typing import List

from utils.auth import require_roles

router = APIRouter(prefix="/documentation", tags=["Documentation"])

# Paths
DOCS_PATH = "/app/memory/System_Logic_Snapshot.md"
SYSTEM_DOCS_DIR = "/app/backups/system_docs"

class DocumentationResponse(BaseModel):
    content: str
    filename: str
    last_modified: str

class DocFile(BaseModel):
    filename: str
    format: str
    size_kb: float
    path: str

class SystemDocsResponse(BaseModel):
    files: List[DocFile]
    directory: str


@router.get("/system-logic-snapshot")
async def get_system_logic_snapshot(
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Get the System Logic Snapshot markdown content (Admin only)"""
    if not os.path.exists(DOCS_PATH):
        raise HTTPException(status_code=404, detail="Documentation file not found")
    
    try:
        with open(DOCS_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Get file modification time
        mtime = os.path.getmtime(DOCS_PATH)
        from datetime import datetime, timezone
        last_modified = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
        
        return DocumentationResponse(
            content=content,
            filename="System_Logic_Snapshot.md",
            last_modified=last_modified
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading documentation: {str(e)}")


@router.get("/system-logic-snapshot/download")
async def download_system_logic_snapshot(
    format: str = "md",
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Download the System Logic Snapshot (Admin only)
    
    Args:
        format: 'md' for markdown, 'pdf' for PDF
    """
    if not os.path.exists(DOCS_PATH):
        raise HTTPException(status_code=404, detail="Documentation file not found")
    
    if format == "md":
        return FileResponse(
            DOCS_PATH,
            media_type="text/markdown",
            filename="System_Logic_Snapshot.md"
        )
    elif format == "pdf":
        # For PDF, we return the markdown content with a flag for frontend to generate PDF
        # This is because server-side PDF generation would require additional dependencies
        try:
            with open(DOCS_PATH, 'r', encoding='utf-8') as f:
                content = f.read()
            
            return {
                "content": content,
                "filename": "System_Logic_Snapshot.pdf",
                "format": "pdf",
                "note": "Use frontend PDF generation with this content"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading documentation: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Use 'md' or 'pdf'")



@router.get("/system-docs-pack")
async def list_system_docs_pack(
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """List available System Documentation Pack files (Admin only)"""
    if not os.path.exists(SYSTEM_DOCS_DIR):
        raise HTTPException(status_code=404, detail="System docs directory not found")
    
    files = []
    for filename in os.listdir(SYSTEM_DOCS_DIR):
        filepath = os.path.join(SYSTEM_DOCS_DIR, filename)
        if os.path.isfile(filepath):
            ext = filename.split('.')[-1].lower()
            size_kb = round(os.path.getsize(filepath) / 1024, 2)
            files.append(DocFile(
                filename=filename,
                format=ext,
                size_kb=size_kb,
                path=f"/api/documentation/system-docs-pack/download/{filename}"
            ))
    
    return SystemDocsResponse(files=files, directory=SYSTEM_DOCS_DIR)


@router.get("/system-docs-pack/download/{filename}")
async def download_system_docs_pack_file(
    filename: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Download a specific file from the System Documentation Pack (Admin only)"""
    filepath = os.path.join(SYSTEM_DOCS_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    
    # Validate filename is in allowed list
    allowed_files = os.listdir(SYSTEM_DOCS_DIR)
    if filename not in allowed_files:
        raise HTTPException(status_code=403, detail="File not allowed")
    
    # Determine media type
    ext = filename.split('.')[-1].lower()
    media_types = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'md': 'text/markdown',
        'html': 'text/html'
    }
    media_type = media_types.get(ext, 'application/octet-stream')
    
    return FileResponse(
        filepath,
        media_type=media_type,
        filename=filename
    )
