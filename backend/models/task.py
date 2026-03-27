"""
Task Model - Shared work orchestration for Red Ops

Tasks are action objects assigned to humans. They can optionally link to
requests and/or projects. Supports subtasks (via parent_task_id) and comments.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
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
    project_id: Optional[str] = None  # Link to project
    parent_task_id: Optional[str] = None  # Subtask support
    blocked_by: Optional[List[str]] = []  # Task IDs that block this task
    request_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: TaskStatus = "todo"
    priority: TaskPriority = "medium"
    assignee_user_id: Optional[str] = None
    client_id: Optional[str] = None  # Link to client user
    client_name: Optional[str] = None  # Denormalized client name
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
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    visibility: Optional[TaskVisibility] = None
    task_type: Optional[TaskType] = None
    due_at: Optional[datetime] = None
    position: Optional[float] = None
    completed_at: Optional[datetime] = None
    project_id: Optional[str] = None


class TaskReorder(BaseModel):
    """Task reorder request"""
    task_id: str
    new_status: TaskStatus
    new_position: float


class TimeEntryCreate(BaseModel):
    """Log hours against a task"""
    hours: float
    description: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD, defaults to today


class TimeEntryResponse(BaseModel):
    """Time entry response"""
    id: str
    task_id: str
    user_id: str
    user_name: Optional[str] = None
    hours: float
    description: Optional[str] = None
    date: str
    created_at: datetime


class TaskCommentCreate(BaseModel):
    """Comment on a task"""
    content: str


class TaskCommentResponse(BaseModel):
    """Comment response"""
    id: str
    task_id: str
    user_id: str
    user_name: Optional[str] = None
    content: str
    created_at: datetime


class TaskResponse(BaseModel):
    """Task response"""
    id: str
    org_id: Optional[str] = None
    project_id: Optional[str] = None
    parent_task_id: Optional[str] = None
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

    # Subtask count
    subtask_count: int = 0
    completed_subtask_count: int = 0

    # Dependencies
    blocked_by: Optional[List[str]] = []
    blocked_by_tasks: Optional[List[dict]] = []  # Enriched: [{ id, title, status }]

    # Time tracking
    total_hours: float = 0.0
    time_entry_count: int = 0

    # Comment count
    comment_count: int = 0

    # Client association
    client_id: Optional[str] = None
    client_name: Optional[str] = None

    # Optional enriched fields (populated from joins)
    assignee_name: Optional[str] = None
    created_by_name: Optional[str] = None
    request_title: Optional[str] = None
    project_name: Optional[str] = None
