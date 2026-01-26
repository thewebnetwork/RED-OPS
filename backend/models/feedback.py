from pydantic import BaseModel, Field
from typing import Optional, Literal


# Satisfaction Ratings
class RatingCreate(BaseModel):
    token: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class RatingResponse(BaseModel):
    id: str
    order_id: str
    order_code: str
    requester_id: str
    requester_name: str
    resolver_id: str
    resolver_name: str
    rating: int
    comment: Optional[str] = None
    created_at: str


class ResolverStatsResponse(BaseModel):
    resolver_id: str
    resolver_name: str
    total_delivered: int
    total_ratings: int
    average_rating: float
    rating_distribution: dict  # {1: count, 2: count, ...5: count}


# Feature Request
class FeatureRequestCreate(BaseModel):
    title: str
    category_l1_id: Optional[str] = None
    category_l2_id: Optional[str] = None
    description: str
    why_important: Optional[str] = None
    who_is_for: Optional[str] = None
    reference_links: Optional[str] = None
    priority: Literal["Low", "Normal", "High"] = "Normal"


class FeatureRequestResponse(BaseModel):
    id: str
    request_code: str
    request_type: str
    requester_id: str
    requester_name: str
    title: str
    category_l1_id: Optional[str] = None
    category_l1_name: Optional[str] = None
    category_l2_id: Optional[str] = None
    category_l2_name: Optional[str] = None
    description: str
    why_important: Optional[str] = None
    who_is_for: Optional[str] = None
    reference_links: Optional[str] = None
    priority: str
    status: str
    created_at: str
    updated_at: str


# Bug Report
class BugReportCreate(BaseModel):
    title: str
    category_l1_id: Optional[str] = None
    category_l2_id: Optional[str] = None
    bug_type: str
    steps_to_reproduce: str
    expected_behavior: str
    actual_behavior: str
    browser: Optional[str] = None
    device: Optional[str] = None
    url_page: Optional[str] = None
    severity: Literal["Low", "Normal", "High", "Urgent"] = "Normal"


class BugReportResponse(BaseModel):
    id: str
    report_code: str
    request_type: str
    requester_id: str
    requester_name: str
    title: str
    category_l1_id: Optional[str] = None
    category_l1_name: Optional[str] = None
    category_l2_id: Optional[str] = None
    category_l2_name: Optional[str] = None
    bug_type: str
    steps_to_reproduce: str
    expected_behavior: str
    actual_behavior: str
    browser: Optional[str] = None
    device: Optional[str] = None
    url_page: Optional[str] = None
    severity: str
    status: str
    created_at: str
    updated_at: str


# Unified Request Response (for My Requests list)
class UnifiedRequestResponse(BaseModel):
    id: str
    code: str
    request_type: str  # "Editing", "Feature", "Bug"
    title: str
    category_l1_name: Optional[str] = None
    category_l2_name: Optional[str] = None
    status: str
    priority_or_severity: str
    assigned_to_name: Optional[str] = None  # Who the ticket is assigned to
    created_at: str
    updated_at: str
