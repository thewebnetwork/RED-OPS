"""
Task Template Model - Defines auto-generated task patterns for MVP services.

Templates map (service_id, trigger_event) → task definition.
The generator uses these to create tasks when request events fire.
"""
from pydantic import BaseModel
from typing import Optional, Literal

TriggerEvent = Literal[
    "request_created",
    "status_changed_to_doing",
    "status_changed_to_review",
    "revision_requested",
    "delivered",
]

AssignTarget = Literal["client", "internal", "request_owner", "unassigned"]


class TaskTemplate(BaseModel):
    id: str
    service_id: str  # matches rrmServices id, or "_default" for all services
    trigger_event: TriggerEvent
    title_template: str  # supports {request_title}, {request_code}
    visibility: Literal["client", "internal", "both"]
    task_type: Literal["manual", "request_generated", "approval", "follow_up"]
    default_status: str = "todo"
    assign_target_type: AssignTarget = "unassigned"
    due_offset_hours: Optional[int] = None
    active: bool = True
