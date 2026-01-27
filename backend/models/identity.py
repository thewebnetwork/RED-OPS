"""Identity and Access Management Models

This module defines the core identity model:
- Roles: Administrator, Operator, Standard User (permissions only)
- Account Type: Partner, Media Client, Internal Staff, Vendor/Freelancer
- Specialty: What the user does (admin-managed)
- Subscription Plan: For Partners only (Core, Engage, Lead-to-Cash, Scale)
- Access Controls: Module-level permissions with overrides
"""
from pydantic import BaseModel
from typing import Optional, List, Dict


# ============== ACCOUNT TYPES ==============
ACCOUNT_TYPES = [
    "Partner",
    "Media Client", 
    "Internal Staff",
    "Vendor/Freelancer"
]

# ============== SUBSCRIPTION PLANS (Partner only) ==============
SUBSCRIPTION_PLANS = [
    "Core",
    "Engage",
    "Lead-to-Cash",
    "Scale"
]

# ============== ROLES (3 only - for permissions) ==============
SYSTEM_ROLES = [
    "Administrator",
    "Operator",
    "Standard User"
]


# ============== SPECIALTY MODELS ==============
class SpecialtyCreate(BaseModel):
    """Create a new specialty (admin-managed)"""
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class SpecialtyUpdate(BaseModel):
    """Update an existing specialty"""
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    active: Optional[bool] = None


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


# ============== SUBSCRIPTION PLAN MODELS ==============
class SubscriptionPlanCreate(BaseModel):
    """Create a new subscription plan (admin-managed)"""
    name: str
    description: Optional[str] = None
    price_monthly: Optional[float] = None
    price_yearly: Optional[float] = None
    features: Optional[List[str]] = None
    sort_order: int = 0


class SubscriptionPlanResponse(BaseModel):
    """Response model for subscription plan"""
    id: str
    name: str
    description: Optional[str] = None
    price_monthly: Optional[float] = None
    price_yearly: Optional[float] = None
    features: Optional[List[str]] = None
    sort_order: int
    active: bool
    user_count: int = 0
    created_at: str


# ============== ACCESS TIER (deprecated - replaced by Subscription Plan) ==============
class AccessTierCreate(BaseModel):
    """Create a new access tier - DEPRECATED, use SubscriptionPlan"""
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class AccessTierResponse(BaseModel):
    """Response model for access tier - DEPRECATED"""
    id: str
    name: str
    description: Optional[str] = None
    sort_order: int
    active: bool
    user_count: int = 0
    created_at: str


# ============== PERMISSION MODULES ==============
PERMISSION_MODULES = {
    "dashboard": {
        "label": "Dashboard",
        "actions": ["view"]
    },
    "my_services": {
        "label": "My Services",
        "actions": ["view"]
    },
    "submit_request": {
        "label": "Submit Request",
        "actions": ["view", "create"]
    },
    "orders": {
        "label": "Orders/Requests",
        "actions": ["view", "create", "edit", "delete", "export", "pick", "assign"]
    },
    "users": {
        "label": "Users",
        "actions": ["view", "create", "edit", "delete"]
    },
    "teams": {
        "label": "Teams",
        "actions": ["view", "create", "edit", "delete"]
    },
    "specialties": {
        "label": "Specialties",
        "actions": ["view", "create", "edit", "delete"]
    },
    "subscription_plans": {
        "label": "Subscription Plans",
        "actions": ["view", "create", "edit", "delete"]
    },
    "categories": {
        "label": "Categories",
        "actions": ["view", "create", "edit", "delete"]
    },
    "workflows": {
        "label": "Workflows",
        "actions": ["view", "create", "edit", "delete", "execute"]
    },
    "sla_policies": {
        "label": "SLA & Escalation",
        "actions": ["view", "create", "edit", "delete", "acknowledge"]
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

# ============== DEFAULT PERMISSIONS BY ROLE ==============
DEFAULT_PERMISSIONS = {
    "Administrator": {
        # Full access to everything
        module: {action: True for action in config["actions"]}
        for module, config in PERMISSION_MODULES.items()
    },
    "Operator": {
        # Internal staff ops - can manage tickets/work queues but NOT system governance
        "dashboard": {"view": True},
        "my_services": {"view": True},
        "submit_request": {"view": True, "create": True},
        "orders": {"view": True, "create": True, "edit": True, "delete": False, "export": True, "pick": True, "assign": True},
        "users": {"view": True, "create": False, "edit": False, "delete": False},
        "teams": {"view": True, "create": False, "edit": False, "delete": False},
        "specialties": {"view": True, "create": False, "edit": False, "delete": False},
        "subscription_plans": {"view": True, "create": False, "edit": False, "delete": False},
        "categories": {"view": True, "create": False, "edit": False, "delete": False},
        "workflows": {"view": True, "create": False, "edit": False, "delete": False, "execute": True},
        "sla_policies": {"view": True, "create": False, "edit": False, "delete": False, "acknowledge": True},
        "integrations": {"view": False, "create": False, "edit": False, "delete": False},
        "announcements": {"view": True, "create": False, "edit": False, "delete": False},
        "logs": {"view": True, "export": False},
        "settings": {"view": False, "edit": False},
        "reports": {"view": True, "export": True}
    },
    "Standard User": {
        # Basic user actions - submit requests, view own data
        "dashboard": {"view": True},
        "my_services": {"view": True},
        "submit_request": {"view": True, "create": True},
        "orders": {"view": True, "create": True, "edit": True, "delete": False, "export": False, "pick": True, "assign": False},
        "users": {"view": False, "create": False, "edit": False, "delete": False},
        "teams": {"view": False, "create": False, "edit": False, "delete": False},
        "specialties": {"view": True, "create": False, "edit": False, "delete": False},
        "subscription_plans": {"view": True, "create": False, "edit": False, "delete": False},
        "categories": {"view": True, "create": False, "edit": False, "delete": False},
        "workflows": {"view": False, "create": False, "edit": False, "delete": False, "execute": False},
        "sla_policies": {"view": False, "create": False, "edit": False, "delete": False, "acknowledge": False},
        "integrations": {"view": False, "create": False, "edit": False, "delete": False},
        "announcements": {"view": True, "create": False, "edit": False, "delete": False},
        "logs": {"view": False, "export": False},
        "settings": {"view": False, "edit": False},
        "reports": {"view": True, "export": False}  # Limited reports access
    }
}

# Backward compatibility aliases
ROLES = SYSTEM_ROLES
