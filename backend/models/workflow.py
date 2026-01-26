from pydantic import BaseModel
from typing import Optional, List, Literal


# Node types for the visual workflow builder
NODE_TYPES = ["trigger", "form", "action", "condition", "delay", "end"]
ACTION_TYPES = ["assign_role", "forward_ticket", "email_user", "email_requester", "update_status", "notify", "webhook"]


# Conditional sub-field model for dynamic form fields
class ConditionalSubField(BaseModel):
    id: str
    parent_value: str  # When parent field equals this value, show this sub-field
    label: str
    field_type: Literal["text", "textarea", "number", "email", "url", "date", "select", "multiselect", "checkbox", "file", "phone"]
    required: bool = False
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None  # For select/multiselect
    is_trigger: bool = False  # If true, this field value can trigger workflow actions


class FormFieldSchema(BaseModel):
    id: str
    name: str
    label: str
    field_type: Literal["text", "textarea", "number", "email", "url", "date", "select", "multiselect", "checkbox", "file", "phone"]
    required: bool = False
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None  # For select/multiselect
    default_value: Optional[str] = None
    validation_regex: Optional[str] = None
    help_text: Optional[str] = None
    is_trigger: bool = False  # If true, this field value can trigger workflow conditions/actions
    sub_fields: Optional[List[ConditionalSubField]] = None  # Conditional sub-fields based on this field's value


class NodeAction(BaseModel):
    id: str
    action_type: str  # assign_role, forward_ticket, email_user, email_requester, update_status, notify, webhook
    config: dict = {}  # Action-specific config (e.g., role_id for assign_role, email_template for email)


class WorkflowCondition(BaseModel):
    id: str
    field: str  # Field to check
    operator: str  # equals, not_equals, contains, greater_than, less_than, is_empty, is_not_empty
    value: Optional[str] = None


class WorkflowNode(BaseModel):
    id: str
    type: str  # trigger, form, action, condition, delay, end
    label: str
    position: dict  # {x: number, y: number}
    data: dict = {}  # Node-specific data
    # For form nodes: {fields: FormFieldSchema[]}
    # For action nodes: {actions: NodeAction[]}
    # For condition nodes: {conditions: WorkflowCondition[], default_path: str}
    # For delay nodes: {delay_type: 'minutes'|'hours'|'days', delay_value: int}
    # For trigger nodes: {trigger_type: 'manual'|'form_submit'|'schedule'|'webhook'}


class WorkflowEdge(BaseModel):
    id: str
    source: str  # Source node ID
    target: str  # Target node ID
    source_handle: Optional[str] = None  # For condition nodes with multiple outputs
    label: Optional[str] = None  # Edge label (e.g., "Yes", "No" for conditions)
    condition_value: Optional[str] = None  # The value this edge represents for condition nodes


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    assigned_roles: List[str] = []  # Role IDs that can use this workflow
    assigned_teams: List[str] = []  # Team IDs that can use this workflow
    assigned_specialties: List[str] = []  # Specialty IDs for targeting
    assigned_access_tiers: List[str] = []  # Access Tier IDs for targeting
    trigger_categories: List[str] = []  # Category IDs that trigger this workflow
    trigger_event: Optional[str] = None  # Event that triggers this workflow (order.created, etc.)
    trigger_category_id: Optional[str] = None  # Specific category that triggers this workflow
    color: Optional[str] = None
    nodes: List[WorkflowNode] = []
    edges: List[WorkflowEdge] = []
    is_template: bool = False  # If true, this is a template for creating new workflows
    is_active: bool = True


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    assigned_roles: Optional[List[str]] = None
    assigned_teams: Optional[List[str]] = None
    assigned_specialties: Optional[List[str]] = None
    assigned_access_tiers: Optional[List[str]] = None
    trigger_categories: Optional[List[str]] = None
    trigger_event: Optional[str] = None
    trigger_category_id: Optional[str] = None
    color: Optional[str] = None
    nodes: Optional[List[WorkflowNode]] = None
    edges: Optional[List[WorkflowEdge]] = None
    active: Optional[bool] = None
    is_active: Optional[bool] = None  # Alias for active


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    assigned_roles: List[str] = []
    assigned_role_names: List[str] = []
    assigned_teams: List[str] = []
    assigned_team_names: List[str] = []
    assigned_specialties: List[str] = []
    assigned_specialty_names: List[str] = []
    assigned_access_tiers: List[str] = []
    assigned_access_tier_names: List[str] = []
    trigger_categories: List[str] = []
    trigger_category_names: List[str] = []
    trigger_event: Optional[str] = None
    trigger_category_id: Optional[str] = None
    color: Optional[str] = None
    nodes: List[dict] = []
    edges: List[dict] = []
    is_template: bool = False
    is_active: bool = True
    active: bool
    created_at: str
    updated_at: Optional[str] = None


# Legacy compatibility - keep old models for migration
class WorkflowStepCreate(BaseModel):
    name: str
    order: int
    color: Optional[str] = None
    is_initial: bool = False
    is_final: bool = False
    requires_approval: bool = False
    notify_requester: bool = True


class WorkflowStep(WorkflowStepCreate):
    id: str


class FormFieldCreate(BaseModel):
    name: str
    label: str
    field_type: Literal["text", "textarea", "number", "email", "url", "date", "select", "multiselect", "checkbox", "file"]
    required: bool = False
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None
    order: int = 0


class FormField(FormFieldCreate):
    id: str
