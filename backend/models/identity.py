"""Specialty and Access Tier models for identity management"""
from pydantic import BaseModel
from typing import Optional


class SpecialtyCreate(BaseModel):
    """Create a new specialty (inline from User form)"""
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class SpecialtyResponse(BaseModel):
    """Response model for specialty"""
    id: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    active: bool
    user_count: int = 0
    created_at: str


class AccessTierCreate(BaseModel):
    """Create a new access tier (inline from User form)"""
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class AccessTierResponse(BaseModel):
    """Response model for access tier"""
    id: str
    name: str
    description: Optional[str] = None
    sort_order: int
    active: bool
    user_count: int = 0
    created_at: str


# Permission structure for modules
PERMISSION_MODULES = {
    "dashboard": {
        "label": "Dashboard",
        "actions": ["view"]
    },
    "command_center": {
        "label": "Command Center",
        "actions": ["view", "create"]
    },
    "orders": {
        "label": "Orders",
        "actions": ["view", "create", "edit", "delete", "export", "pick"]
    },
    "users": {
        "label": "Users",
        "actions": ["view", "create", "edit", "delete"]
    },
    "teams": {
        "label": "Teams",
        "actions": ["view", "create", "edit", "delete"]
    },
    "roles": {
        "label": "Roles",
        "actions": ["view", "edit"]
    },
    "categories": {
        "label": "Categories",
        "actions": ["view", "create", "edit", "delete"]
    },
    "workflows": {
        "label": "Workflows",
        "actions": ["view", "create", "edit", "delete", "execute"]
    },
    "escalation": {
        "label": "Escalation",
        "actions": ["view", "create", "edit", "delete", "acknowledge"]
    },
    "sla": {
        "label": "SLA",
        "actions": ["view", "create", "edit", "delete"]
    },
    "integrations": {
        "label": "Integrations",
        "actions": ["view", "create", "edit", "delete"]
    },
    "announcements": {
        "label": "Announcements",
        "actions": ["view", "create", "edit", "delete"]
    },
    "logs": {
        "label": "Logs",
        "actions": ["view", "export"]
    },
    "settings": {
        "label": "Settings",
        "actions": ["view", "edit"]
    },
    "reports": {
        "label": "Reports",
        "actions": ["view", "export"]
    }
}

# Default permissions by role
DEFAULT_PERMISSIONS = {
    "Administrator": {
        # Full access to everything
        module: {action: True for action in config["actions"]}
        for module, config in PERMISSION_MODULES.items()
    },
    "Privileged User": {
        "dashboard": {"view": True},
        "command_center": {"view": True, "create": True},
        "orders": {"view": True, "create": True, "edit": True, "delete": False, "export": True, "pick": True},
        "users": {"view": True, "create": False, "edit": False, "delete": False},
        "teams": {"view": True, "create": True, "edit": True, "delete": False},
        "roles": {"view": True, "edit": False},
        "categories": {"view": True, "create": True, "edit": True, "delete": False},
        "workflows": {"view": True, "create": True, "edit": True, "delete": False, "execute": True},
        "escalation": {"view": True, "create": False, "edit": False, "delete": False, "acknowledge": True},
        "sla": {"view": True, "create": False, "edit": False, "delete": False},
        "integrations": {"view": True, "create": False, "edit": False, "delete": False},
        "announcements": {"view": True, "create": False, "edit": False, "delete": False},
        "logs": {"view": True, "export": False},
        "settings": {"view": True, "edit": False},
        "reports": {"view": True, "export": True}
    },
    "Standard User": {
        "dashboard": {"view": True},
        "command_center": {"view": True, "create": True},
        "orders": {"view": True, "create": True, "edit": True, "delete": False, "export": False, "pick": True},
        "users": {"view": False, "create": False, "edit": False, "delete": False},
        "teams": {"view": False, "create": False, "edit": False, "delete": False},
        "roles": {"view": False, "edit": False},
        "categories": {"view": True, "create": False, "edit": False, "delete": False},
        "workflows": {"view": False, "create": False, "edit": False, "delete": False, "execute": False},
        "escalation": {"view": False, "create": False, "edit": False, "delete": False, "acknowledge": False},
        "sla": {"view": False, "create": False, "edit": False, "delete": False},
        "integrations": {"view": False, "create": False, "edit": False, "delete": False},
        "announcements": {"view": True, "create": False, "edit": False, "delete": False},
        "logs": {"view": False, "export": False},
        "settings": {"view": False, "edit": False},
        "reports": {"view": False, "export": False}
    }
}
