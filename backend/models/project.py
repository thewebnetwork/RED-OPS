"""
Project Model - Multi-tenant project management for Red Ops

Projects are containers for tasks, milestones, and team assignments.
Every project belongs to an organization (org_id). Supports types,
statuses, milestones, payment tracking, and team assignment.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


# Project status enum
ProjectStatus = Literal["planning", "active", "on_hold", "completed", "archived"]

# Project type enum
ProjectType = Literal[
    "campaign_build", "client_onboarding", "creative_sprint",
    "internal", "retainer", "one_off", "custom"
]

# Payment status (lightweight — GHL handles real invoicing)
PaymentStatus = Literal["not_applicable", "unpaid", "partial", "paid"]

# Priority
ProjectPriority = Literal["urgent", "high", "medium", "low"]


class MilestoneCreate(BaseModel):
    """Milestone within a project"""
    label: str
    due_date: Optional[datetime] = None


class MilestoneResponse(BaseModel):
    """Milestone response"""
    id: str
    label: str
    done: bool = False
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ProjectCreate(BaseModel):
    """Project creation request"""
    name: str
    description: Optional[str] = None
    project_type: ProjectType = "custom"
    status: ProjectStatus = "planning"
    priority: ProjectPriority = "medium"
    client_name: Optional[str] = None
    due_date: Optional[datetime] = None
    team_member_ids: List[str] = []
    milestones: List[MilestoneCreate] = []
    payment_status: PaymentStatus = "not_applicable"
    tags: List[str] = []


class ProjectUpdate(BaseModel):
    """Project update request"""
    name: Optional[str] = None
    description: Optional[str] = None
    project_type: Optional[ProjectType] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[ProjectPriority] = None
    client_name: Optional[str] = None
    due_date: Optional[datetime] = None
    team_member_ids: Optional[List[str]] = None
    payment_status: Optional[PaymentStatus] = None
    tags: Optional[List[str]] = None


class ProjectResponse(BaseModel):
    """Project response"""
    id: str
    org_id: str
    name: str
    description: Optional[str] = None
    project_type: ProjectType
    status: ProjectStatus
    priority: ProjectPriority = "medium"
    client_name: Optional[str] = None
    due_date: Optional[datetime] = None
    team_member_ids: List[str] = []
    milestones: List[MilestoneResponse] = []
    payment_status: PaymentStatus = "not_applicable"
    tags: List[str] = []
    progress: int = 0
    task_count: int = 0
    completed_task_count: int = 0
    created_by_user_id: str
    created_at: datetime
    updated_at: datetime

    # Auto-creation fields (set when project is auto-created from a service request)
    source: Optional[str] = None  # "service_request" for auto-created projects
    linked_order_id: Optional[str] = None  # Order ID that triggered auto-creation

    # Enriched fields
    team_members: Optional[List[dict]] = None
    created_by_name: Optional[str] = None
