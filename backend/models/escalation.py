"""Escalation models for auto-escalation system"""
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class EscalationTrigger(str, Enum):
    SLA_WARNING = "sla_warning"
    SLA_BREACH = "sla_breach"
    BOTH = "both"


class EscalationActionType(str, Enum):
    NOTIFY_USER = "notify_user"
    NOTIFY_ROLE = "notify_role"
    REASSIGN_USER = "reassign_user"
    REASSIGN_TEAM = "reassign_team"
    CHANGE_PRIORITY = "change_priority"
    SEND_EMAIL = "send_email"
    WEBHOOK = "webhook"


class EscalationAction(BaseModel):
    """Individual action within an escalation level"""
    type: EscalationActionType
    target_user_id: Optional[str] = None
    target_user_name: Optional[str] = None
    target_role_id: Optional[str] = None
    target_role_name: Optional[str] = None
    target_team_id: Optional[str] = None
    target_team_name: Optional[str] = None
    new_priority: Optional[str] = None  # For change_priority
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_method: str = "POST"
    webhook_headers: Optional[dict] = None
    webhook_body_template: Optional[str] = None


class EscalationLevel(BaseModel):
    """Single escalation level with time threshold and actions"""
    level: int = Field(..., ge=1, le=5)
    name: str  # e.g., "Initial Alert", "Manager Escalation", "Critical"
    time_threshold_minutes: int = Field(..., ge=0)  # Minutes after trigger
    actions: List[EscalationAction] = []
    notify_message: Optional[str] = None  # Template for notification


class EscalationPolicyCreate(BaseModel):
    """Create a new escalation policy"""
    name: str
    description: Optional[str] = None
    trigger: EscalationTrigger = EscalationTrigger.BOTH
    # Filters - when to apply this policy
    category_l1_ids: List[str] = []  # Apply to specific categories (empty = all)
    category_l2_ids: List[str] = []
    priorities: List[str] = []  # Apply to specific priorities (empty = all)
    # Escalation levels
    levels: List[EscalationLevel] = []
    # Cooldown to prevent spam
    cooldown_minutes: int = Field(default=30, ge=5)
    is_active: bool = True


class EscalationPolicyUpdate(BaseModel):
    """Update an escalation policy"""
    name: Optional[str] = None
    description: Optional[str] = None
    trigger: Optional[EscalationTrigger] = None
    category_l1_ids: Optional[List[str]] = None
    category_l2_ids: Optional[List[str]] = None
    priorities: Optional[List[str]] = None
    levels: Optional[List[EscalationLevel]] = None
    cooldown_minutes: Optional[int] = None
    is_active: Optional[bool] = None


class EscalationPolicyResponse(BaseModel):
    """Response model for escalation policy"""
    id: str
    name: str
    description: Optional[str] = None
    trigger: str
    category_l1_ids: List[str] = []
    category_l1_names: List[str] = []
    category_l2_ids: List[str] = []
    category_l2_names: List[str] = []
    priorities: List[str] = []
    levels: List[dict] = []
    cooldown_minutes: int
    is_active: bool
    created_at: str
    updated_at: Optional[str] = None


class EscalationHistoryEntry(BaseModel):
    """Record of an escalation event"""
    id: str
    order_id: str
    order_code: str
    policy_id: str
    policy_name: str
    level: int
    level_name: str
    trigger_type: str  # sla_warning or sla_breach
    actions_taken: List[dict] = []
    acknowledged: bool = False
    acknowledged_by_id: Optional[str] = None
    acknowledged_by_name: Optional[str] = None
    acknowledged_at: Optional[str] = None
    created_at: str


class EscalatedOrderResponse(BaseModel):
    """Response for escalated order summary"""
    order_id: str
    order_code: str
    order_title: str
    order_status: str
    order_priority: str
    current_escalation_level: int
    current_level_name: str
    policy_name: str
    escalated_at: str
    time_in_escalation: str  # Human readable
    assigned_to: Optional[str] = None
    requester_name: str


class AcknowledgeEscalation(BaseModel):
    """Acknowledge an escalation"""
    notes: Optional[str] = None
