from pydantic import BaseModel
from typing import Optional


class DashboardStats(BaseModel):
    open_count: int
    in_progress_count: int
    pending_count: int
    delivered_count: int
    sla_breaching_count: int
    orders_responded_count: int = 0
    feature_requests_count: int = 0
    bug_reports_count: int = 0


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    related_order_id: Optional[str] = None
    is_read: bool
    created_at: str
