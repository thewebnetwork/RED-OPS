"""Unified SLA & Escalation Policy models"""
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class TriggerType(str, Enum):
    AT_RISK = "at_risk"
    BREACH = "breach"
    BREACH_PLUS_MINUTES = "breach_plus_minutes"


class ActionType(str, Enum):
    NOTIFY_USERS = "notify_users"
    NOTIFY_ROLE = "notify_role"
    NOTIFY_TEAM = "notify_team"
    ESCALATE_TO_ROLE = "escalate_to_role"
    ESCALATE_TO_TEAM = "escalate_to_team"
    REASSIGN = "reassign"
    CHANGE_PRIORITY = "change_priority"
    SEND_EMAIL = "send_email"
    WEBHOOK = "webhook"


class EscalationAction(BaseModel):
    """Individual action within an escalation level"""
    type: ActionType
    target_role_id: Optional[str] = None
    target_role_name: Optional[str] = None
    target_team_id: Optional[str] = None
    target_team_name: Optional[str] = None
    target_user_ids: List[str] = []
    target_user_names: List[str] = []
    new_priority: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    notification_message: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_method: str = "POST"
    webhook_headers: Optional[dict] = None
    webhook_body_template: Optional[str] = None


class EscalationLevel(BaseModel):
    """Single escalation level with trigger and actions"""
    level: int = Field(..., ge=1, le=5)
    name: str
    trigger: TriggerType
    delay_minutes: int = Field(default=0, ge=0)  # For breach_plus_minutes trigger
    actions: List[EscalationAction] = []


class SLAPolicyScope(BaseModel):
    """Defines where a policy applies"""
    role_ids: List[str] = []
    role_names: List[str] = []
    team_ids: List[str] = []
    team_names: List[str] = []
    specialty_ids: List[str] = []
    specialty_names: List[str] = []
    access_tier_ids: List[str] = []
    access_tier_names: List[str] = []


class SLARules(BaseModel):
    """SLA clock configuration"""
    duration_minutes: int = Field(..., ge=1)
    business_hours_only: bool = False
    timezone: str = "UTC"


class SLAThresholds(BaseModel):
    """SLA threshold configuration"""
    at_risk_minutes: Optional[int] = None  # Minutes before deadline
    at_risk_percentage: Optional[int] = None  # Percentage of SLA used (e.g., 80%)


class SLAPolicyCreate(BaseModel):
    """Create a new SLA & Escalation policy"""
    name: str
    description: Optional[str] = None
    scope: SLAPolicyScope = SLAPolicyScope()
    sla_rules: SLARules
    thresholds: SLAThresholds = SLAThresholds()
    escalation_levels: List[EscalationLevel] = []
    is_active: bool = True


class SLAPolicyUpdate(BaseModel):
    """Update an SLA & Escalation policy"""
    name: Optional[str] = None
    description: Optional[str] = None
    scope: Optional[SLAPolicyScope] = None
    sla_rules: Optional[SLARules] = None
    thresholds: Optional[SLAThresholds] = None
    escalation_levels: Optional[List[EscalationLevel]] = None
    is_active: Optional[bool] = None


class SLAPolicyResponse(BaseModel):
    """Response model for SLA policy"""
    id: str
    name: str
    description: Optional[str] = None
    scope: dict = {}
    sla_rules: dict = {}
    thresholds: dict = {}
    escalation_levels: List[dict] = []
    is_active: bool
    orders_count: int = 0  # Count of orders using this policy
    created_at: str
    created_by_name: Optional[str] = None
    updated_at: Optional[str] = None


class MonitoringOrderResponse(BaseModel):
    """Order with SLA monitoring details"""
    id: str
    order_code: str
    title: str
    status: str
    priority: str
    sla_deadline: Optional[str] = None
    sla_status: str  # "on_track", "at_risk", "breached"
    time_remaining: Optional[str] = None  # Human readable
    time_remaining_minutes: Optional[int] = None
    policy_id: Optional[str] = None
    policy_name: Optional[str] = None
    current_escalation_level: int = 0
    assigned_to: Optional[str] = None
    requester_name: str
    created_at: str


class EscalationHistoryResponse(BaseModel):
    """Escalation history entry"""
    id: str
    order_id: str
    order_code: str
    policy_id: str
    policy_name: str
    level: int
    level_name: str
    trigger_type: str
    actions_taken: List[dict] = []
    acknowledged: bool = False
    acknowledged_by_name: Optional[str] = None
    acknowledged_at: Optional[str] = None
    created_at: str
