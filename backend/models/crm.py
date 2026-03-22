"""
CRM Models - Post-close relationship management

Contact: Customer relationship details
Pipeline: Sales pipeline definition with stages
Deal: Individual sales opportunity
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime


# ── CONTACT MODELS ──────────────────────────────────────────────────────

class ActivityLogEntry(BaseModel):
    """Single activity log entry for a contact."""
    action: str
    note: Optional[str] = None
    timestamp: str
    user_id: str


class ContactCreate(BaseModel):
    """Create a new contact."""
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    source: Literal["referral", "website", "cold", "partner", "other"] = "other"
    status: Literal["active", "inactive", "lead", "churned"] = "active"
    assigned_to_user_id: Optional[str] = None
    custom_fields: Dict[str, Any] = Field(default_factory=dict)


class ContactUpdate(BaseModel):
    """Update an existing contact."""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    source: Optional[Literal["referral", "website", "cold", "partner", "other"]] = None
    status: Optional[Literal["active", "inactive", "lead", "churned"]] = None
    assigned_to_user_id: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None


class ContactResponse(BaseModel):
    """Contact response with full details."""
    id: str
    org_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    source: str
    status: str
    assigned_to_user_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    custom_fields: Dict[str, Any] = Field(default_factory=dict)
    activity_log: List[ActivityLogEntry] = Field(default_factory=list)
    created_by_user_id: str
    created_by_name: Optional[str] = None
    created_at: str
    updated_at: str


class ActivityLogCreate(BaseModel):
    """Add an activity log entry to a contact."""
    action: str = Field(..., min_length=1, max_length=100)
    note: Optional[str] = None


# ── PIPELINE MODELS ─────────────────────────────────────────────────────

class PipelineStage(BaseModel):
    """Individual stage in a pipeline."""
    id: str
    name: str
    order: int
    color: Optional[str] = None


class PipelineCreate(BaseModel):
    """Create a new pipeline."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    stages: List[PipelineStage] = Field(..., min_items=1)
    is_default: bool = False


class PipelineUpdate(BaseModel):
    """Update an existing pipeline."""
    name: Optional[str] = None
    description: Optional[str] = None
    stages: Optional[List[PipelineStage]] = None
    is_default: Optional[bool] = None


class PipelineResponse(BaseModel):
    """Pipeline response with full details."""
    id: str
    org_id: str
    name: str
    description: Optional[str] = None
    stages: List[PipelineStage]
    is_default: bool
    created_by_user_id: str
    created_by_name: Optional[str] = None
    created_at: str
    updated_at: str


# ── DEAL MODELS ─────────────────────────────────────────────────────────

class DealCreate(BaseModel):
    """Create a new deal."""
    pipeline_id: str
    stage_id: str
    contact_id: str
    title: str = Field(..., min_length=1, max_length=255)
    value: float = Field(default=0.0, ge=0)
    currency: str = Field(default="CAD", max_length=3)
    status: Literal["open", "won", "lost"] = "open"
    probability: int = Field(default=50, ge=0, le=100)
    expected_close_date: Optional[str] = None
    assigned_to_user_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class DealUpdate(BaseModel):
    """Update an existing deal."""
    pipeline_id: Optional[str] = None
    stage_id: Optional[str] = None
    contact_id: Optional[str] = None
    title: Optional[str] = None
    value: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[Literal["open", "won", "lost"]] = None
    probability: Optional[int] = None
    expected_close_date: Optional[str] = None
    assigned_to_user_id: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    lost_reason: Optional[str] = None


class DealMoveRequest(BaseModel):
    """Move a deal to a different stage."""
    stage_id: str
    pipeline_id: Optional[str] = None


class DealResponse(BaseModel):
    """Deal response with full details."""
    id: str
    org_id: str
    pipeline_id: str
    pipeline_name: Optional[str] = None
    stage_id: str
    stage_name: Optional[str] = None
    contact_id: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    title: str
    value: float
    currency: str
    status: str
    probability: int
    expected_close_date: Optional[str] = None
    assigned_to_user_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    lost_reason: Optional[str] = None
    won_at: Optional[str] = None
    lost_at: Optional[str] = None
    created_by_user_id: str
    created_by_name: Optional[str] = None
    created_at: str
    updated_at: str


class DealStatsResponse(BaseModel):
    """Pipeline deal statistics."""
    pipeline_id: str
    pipeline_name: str
    total_deals: int
    open_deals: int
    won_deals: int
    lost_deals: int
    total_value: float
    won_value: float
    lost_value: float
    by_stage: Dict[str, Dict[str, Any]]
