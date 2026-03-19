"""
ServiceTemplate Model - The canonical engine for Red Ops MVP

Each sellable service is defined by one ServiceTemplate.
It drives: service card display, default title, hidden category mapping,
form schema, required fields, auto-task creation, and SLA/workflow defaults.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal


class FormField(BaseModel):
    """Single field in a service template's intake form"""
    field: str
    label: str
    type: Literal["text", "textarea", "select", "date", "toggle", "file"]
    required: bool = False
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None
    default_value: Optional[str] = None
    help_text: Optional[str] = None


class TaskTemplate(BaseModel):
    """Auto-generated task template attached to a service"""
    title: str
    description: Optional[str] = None
    assignee_type: Literal["client", "account_manager", "internal"] = "internal"
    visibility: Literal["client", "internal", "both"] = "internal"
    default_status: str = "todo"


class ServiceTemplateResponse(BaseModel):
    """Response model for service templates"""
    id: str
    name: str
    description: str
        category: Optional[str] = None
    client_visible: bool = True
    icon: str
    default_title: str
    hidden_category_l1: Optional[str] = None
    hidden_category_l2: Optional[str] = None
    form_schema: List[FormField] = []
    required_fields: List[str] = []
    default_task_templates: List[TaskTemplate] = []
    turnaround_text: str
    deliverable_type: Optional[str] = None
    active: bool = True
    sort_order: int = 0
    offer_track: Optional[str] = None
    flow_type: Optional[str] = None
    cta_url: Optional[str] = None
    cta_label: Optional[str] = None
