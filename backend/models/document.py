"""
Document Model - Knowledge Base / SOPs for Red Ops

Documents are org-scoped knowledge articles. They support:
- Folder categorization (playbook, template, reference, training, general)
- Access control (internal vs shared with client)
- Version history tracking
- Star/favorite per user
- Search by title and content
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

# Document folder/category enum
DocumentFolder = Literal["playbook", "template", "reference", "training", "general"]

# Access level enum
DocumentAccess = Literal["internal", "shared"]

# Document status
DocumentStatus = Literal["draft", "published", "archived"]


class DocumentCreate(BaseModel):
    """Create a new knowledge base document"""
    title: str
    folder: DocumentFolder = "general"
    access: DocumentAccess = "internal"
    status: DocumentStatus = "published"
    body: str = ""  # HTML content
    tags: List[str] = []


class DocumentUpdate(BaseModel):
    """Update a document"""
    title: Optional[str] = None
    folder: Optional[DocumentFolder] = None
    access: Optional[DocumentAccess] = None
    status: Optional[DocumentStatus] = None
    body: Optional[str] = None
    tags: Optional[List[str]] = None


class DocumentResponse(BaseModel):
    """Document response"""
    id: str
    org_id: str
    title: str
    folder: DocumentFolder
    access: DocumentAccess
    status: DocumentStatus
    body: str
    tags: List[str] = []
    created_by_user_id: str
    created_by_name: Optional[str] = None
    updated_by_user_id: Optional[str] = None
    updated_by_name: Optional[str] = None
    version: int = 1
    starred_by: List[str] = []  # user_ids who starred
    created_at: datetime
    updated_at: datetime


class DocumentVersionResponse(BaseModel):
    """A single version snapshot"""
    id: str
    document_id: str
    version: int
    title: str
    body: str
    edited_by_user_id: str
    edited_by_name: Optional[str] = None
    created_at: datetime
