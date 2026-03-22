from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class ReferralStatus(str, Enum):
    PENDING = "pending"
    CONTACTED = "contacted"
    CONVERTED = "converted"
    EXPIRED = "expired"


class CommissionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PAID = "paid"


class MarketplaceListingStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class MarketplaceListingCategory(str, Enum):
    SERVICE = "service"
    TEMPLATE = "template"
    AUTOMATION = "automation"
    CONSULTATION = "consultation"


class MarketplacePricingType(str, Enum):
    ONE_TIME = "one_time"
    RECURRING = "recurring"
    CUSTOM = "custom"


class MarketplaceOrderStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    REFUNDED = "refunded"
    DISPUTED = "disputed"


# =====================
# REFERRAL MODELS
# =====================

class ReferralBase(BaseModel):
    referred_name: str
    referred_email: str
    referred_company: Optional[str] = None
    notes: Optional[str] = None


class ReferralCreate(ReferralBase):
    pass


class ReferralUpdate(BaseModel):
    status: Optional[ReferralStatus] = None
    commission_rate: Optional[float] = None
    commission_amount: Optional[float] = None
    commission_status: Optional[CommissionStatus] = None
    converted_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None


class ReferralResponse(BaseModel):
    id: str
    org_id: str
    referrer_user_id: str
    referral_code: str
    referral_link: str
    referred_name: str
    referred_email: str
    referred_company: Optional[str]
    status: ReferralStatus
    commission_rate: float
    commission_amount: float
    commission_status: CommissionStatus
    converted_at: Optional[datetime]
    paid_at: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =====================
# MARKETPLACE LISTING MODELS
# =====================

class MarketplaceListingBase(BaseModel):
    title: str
    description: str
    category: MarketplaceListingCategory
    price: float
    currency: str = "CAD"
    pricing_type: MarketplacePricingType
    tags: List[str] = Field(default_factory=list)
    image_url: Optional[str] = None
    featured: bool = False


class MarketplaceListingCreate(MarketplaceListingBase):
    pass


class MarketplaceListingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[MarketplaceListingCategory] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    pricing_type: Optional[MarketplacePricingType] = None
    tags: Optional[List[str]] = None
    image_url: Optional[str] = None
    featured: Optional[bool] = None
    status: Optional[MarketplaceListingStatus] = None


class MarketplaceListingResponse(BaseModel):
    id: str
    org_id: str
    seller_user_id: str
    title: str
    description: str
    category: MarketplaceListingCategory
    price: float
    currency: str
    pricing_type: MarketplacePricingType
    status: MarketplaceListingStatus
    tags: List[str]
    image_url: Optional[str]
    featured: bool
    purchase_count: int
    rating_avg: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =====================
# MARKETPLACE ORDER MODELS
# =====================

class MarketplaceOrderBase(BaseModel):
    listing_id: str
    amount: float
    currency: str = "CAD"
    notes: Optional[str] = None


class MarketplaceOrderCreate(MarketplaceOrderBase):
    pass


class MarketplaceOrderUpdate(BaseModel):
    status: Optional[MarketplaceOrderStatus] = None
    notes: Optional[str] = None
    paid_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class MarketplaceOrderResponse(BaseModel):
    id: str
    listing_id: str
    buyer_org_id: str
    buyer_user_id: str
    seller_org_id: str
    seller_user_id: str
    amount: float
    currency: str
    status: MarketplaceOrderStatus
    paid_at: Optional[datetime]
    delivered_at: Optional[datetime]
    completed_at: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =====================
# STATS/RESPONSE MODELS
# =====================

class ReferralStats(BaseModel):
    total_referrals: int
    converted_count: int
    pending_count: int
    contacted_count: int
    expired_count: int
    total_commission_pending: float
    total_commission_approved: float
    total_commission_paid: float


class MarketplaceStats(BaseModel):
    total_listings: int
    active_listings: int
    total_orders: int
    pending_orders: int
    completed_orders: int
    total_revenue: float
    average_rating: float
