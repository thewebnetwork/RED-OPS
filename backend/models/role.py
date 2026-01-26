from pydantic import BaseModel
from typing import Optional, Literal


class RoleCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    role_type: Literal["system", "service_provider", "custom"] = "custom"
    icon: Optional[str] = None
    color: Optional[str] = None
    can_pick_orders: bool = False  # Whether this role can pick orders from pool
    can_create_orders: bool = False  # Whether this role can create orders/requests


class RoleUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    can_pick_orders: Optional[bool] = None
    can_create_orders: Optional[bool] = None
    active: Optional[bool] = None


class RoleResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str] = None
    role_type: str
    icon: Optional[str] = None
    color: Optional[str] = None
    can_pick_orders: bool
    can_create_orders: bool
    active: bool
    created_at: str
