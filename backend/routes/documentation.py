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
