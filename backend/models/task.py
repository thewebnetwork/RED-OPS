"""
Task Model - Shared work orchestration for Red Ops MVP

Tasks are action objects assigned to humans. They can optionally link to
requests but exist independently. No pool or routing concepts.
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

# Task status enum
TaskStatus = Literal["backlog", "todo", "doing", "waiting_on_client", "review", "done"]

# Task visibility enum
TaskVisibility = Literal["client", "internal", "both"]

# Task type enum
TaskType = Literal["manual", "request_generated", "approval", "follow_up"]

# Created source enum
CreatedSource = Literal["system", "admin", "client"]

# Priority enum
TaskPriority = Literal["urgent", "high", "medium", "low"]


class TaskCreate(BaseModel):
    """Task creation request"""
    org_id: Optional[str] = None  # Auto-filled from user if not provided
    request_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: TaskStatus = "todo"
    priority: TaskPriority = "medium"
    assignee_user_id: Optional[str] = None
    visibility: TaskVisibility = "internal"
    task_type: TaskType = "manual"
    due_at: Optional[datetime] = None
    position: Optional[float] = None


class TaskUpdate(BaseModel):
    """Task update request"""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_user_id: Optional[str] = None
    visibility: Optional[TaskVisibility] = None
    task_type: Optional[TaskType] = None
    due_at: Optional[datetime] = None
    position: Optional[float] = None
    completed_at: Optional[datetime] = None


class TaskReorder(BaseModel):
    """Task reorder request"""
    task_id: str
    new_status: TaskStatus
    new_position: float


class TaskResponse(BaseModel):
    """Task response"""
    id: str
    org_id: Optional[str] = None
    request_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority = "medium"
    assignee_user_id: Optional[str] = None
    created_by_user_id: str
    visibility: TaskVisibility
    task_type: TaskType
    due_at: Optional[datetime] = None
    position: Optional[float] = None
    created_source: CreatedSource
    completed_at: Optional[datetime] = None
    template_id: Optional[str] = None
    trigger_event: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Optional enriched fields (populated from joins)
    assignee_name: Optional[str] = None
    created_by_name: Optional[str] = None
    request_title: Optional[str] = None
