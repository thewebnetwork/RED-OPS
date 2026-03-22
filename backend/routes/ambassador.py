import string
import random
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from database import db
from utils.auth import get_current_user
from models.ambassador import (
    ReferralCreate,
    ReferralUpdate,
    ReferralResponse,
    ReferralStatus,
    CommissionStatus,
    MarketplaceListingCreate,
    MarketplaceListingUpdate,
    MarketplaceListingResponse,
    MarketplaceListingStatus,
    MarketplaceOrderCreate,
    MarketplaceOrderUpdate,
    MarketplaceOrderResponse,
    MarketplaceOrderStatus,
    ReferralStats,
    MarketplaceStats,
)

router = APIRouter(prefix="/ambassador", tags=["Ambassador & Marketplace"])


# =====================
# HELPER FUNCTIONS
# =====================

def _get_org_id(user: dict) -> str:
    """Extract org_id from user context."""
    org_id = user.get("org_id") or user.get("team_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization context.")
    return org_id


def _get_org_role(user: dict) -> str:
    """Get org role with fallback to system role."""
    org_role = user.get("org_role")
    if org_role:
        return org_role
    sys_role = user.get("role", "")
    if sys_role == "Administrator":
        return "admin"
    if sys_role == "Operator":
        return "manager"
    return "member"


def _generate_referral_code() -> str:
    """Generate a unique 8-character referral code."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _generate_referral_link(code: str) -> str:
    """Generate referral link from code."""
    return f"https://redribbongroup.ca/ref/{code}"


def _get_unique_referral_code() -> str:
    """Generate a unique referral code, checking for collisions."""
    max_attempts = 10
    for _ in range(max_attempts):
        code = _generate_referral_code()
        existing = db.referrals.find_one({"referral_code": code})
        if not existing:
            return code
    raise HTTPException(status_code=500, detail="Failed to generate unique referral code.")


# =====================
# REFERRAL ENDPOINTS
# =====================

@router.post("/referrals")
async def create_referral(payload: ReferralCreate, current_user: dict = None):
    """Create a new referral with unique code and link."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)
    user_id = current_user["id"]

    referral_code = _get_unique_referral_code()
    referral_link = _generate_referral_link(referral_code)

    referral_doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "referrer_user_id": user_id,
        "referral_code": referral_code,
        "referral_link": referral_link,
        "referred_name": payload.referred_name,
        "referred_email": payload.referred_email,
        "referred_company": payload.referred_company,
        "status": ReferralStatus.PENDING,
        "commission_rate": 0.10,
        "commission_amount": 0.0,
        "commission_status": CommissionStatus.PENDING,
        "converted_at": None,
        "paid_at": None,
        "notes": payload.notes,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = db.referrals.insert_one(referral_doc)
    referral_doc["_id"] = result.inserted_id

    return ReferralResponse(**referral_doc)


@router.get("/referrals")
async def list_referrals(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    current_user: dict = None,
):
    """List referrals (filtered by org_id, filtered by status if provided)."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)
    user_id = current_user["id"]
    org_role = _get_org_role(current_user)

    query = {"org_id": org_id}

    if org_role != "admin":
        query["referrer_user_id"] = user_id

    if status:
        query["status"] = status

    referrals = list(
        db.referrals.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    total = db.referrals.count_documents(query)

    return {
        "data": [ReferralResponse(**ref) for ref in referrals],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/referrals/{referral_id}")
async def get_referral(referral_id: str, current_user: dict = None):
    """Get referral details by ID."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)
    user_id = current_user["id"]
    org_role = _get_org_role(current_user)

    referral = db.referrals.find_one(
        {"id": referral_id, "org_id": org_id}, {"_id": 0}
    )

    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found.")

    if org_role != "admin" and referral["referrer_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized.")

    return ReferralResponse(**referral)


@router.patch("/referrals/{referral_id}")
async def update_referral(
    referral_id: str,
    payload: ReferralUpdate,
    current_user: dict = None,
):
    """Update referral status and details."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)
    user_id = current_user["id"]
    org_role = _get_org_role(current_user)

    referral = db.referrals.find_one(
        {"id": referral_id, "org_id": org_id}, {"_id": 0}
    )

    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found.")

    if org_role != "admin" and referral["referrer_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized.")

    update_data = {}
    if payload.status is not None:
        update_data["status"] = payload.status
    if payload.commission_rate is not None:
        update_data["commission_rate"] = payload.commission_rate
    if payload.commission_amount is not None:
        update_data["commission_amount"] = payload.commission_amount
    if payload.commission_status is not None:
        update_data["commission_status"] = payload.commission_status
    if payload.converted_at is not None:
        update_data["converted_at"] = payload.converted_at
    if payload.paid_at is not None:
        update_data["paid_at"] = payload.paid_at
    if payload.notes is not None:
        update_data["notes"] = payload.notes

    update_data["updated_at"] = datetime.utcnow()

    db.referrals.update_one(
        {"id": referral_id, "org_id": org_id},
        {"$set": update_data},
    )

    updated = db.referrals.find_one(
        {"id": referral_id, "org_id": org_id}, {"_id": 0}
    )

    return ReferralResponse(**updated)


@router.get("/referrals-stats")
async def get_referral_stats(current_user: dict = None):
    """Get referral statistics for the current user or org (admin gets org-wide)."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)
    user_id = current_user["id"]
    org_role = _get_org_role(current_user)

    query = {"org_id": org_id}
    if org_role != "admin":
        query["referrer_user_id"] = user_id

    all_referrals = list(db.referrals.find(query))

    total_referrals = len(all_referrals)
    converted_count = sum(1 for r in all_referrals if r["status"] == ReferralStatus.CONVERTED)
    pending_count = sum(1 for r in all_referrals if r["status"] == ReferralStatus.PENDING)
    contacted_count = sum(1 for r in all_referrals if r["status"] == ReferralStatus.CONTACTED)
    expired_count = sum(1 for r in all_referrals if r["status"] == ReferralStatus.EXPIRED)

    total_commission_pending = sum(
        r["commission_amount"]
        for r in all_referrals
        if r["commission_status"] == CommissionStatus.PENDING
    )
    total_commission_approved = sum(
        r["commission_amount"]
        for r in all_referrals
        if r["commission_status"] == CommissionStatus.APPROVED
    )
    total_commission_paid = sum(
        r["commission_amount"]
        for r in all_referrals
        if r["commission_status"] == CommissionStatus.PAID
    )

    return ReferralStats(
        total_referrals=total_referrals,
        converted_count=converted_count,
        pending_count=pending_count,
        contacted_count=contacted_count,
        expired_count=expired_count,
        total_commission_pending=total_commission_pending,
        total_commission_approved=total_commission_approved,
        total_commission_paid=total_commission_paid,
    )


@router.post("/referrals/{referral_id}/approve-commission")
async def approve_commission(referral_id: str, current_user: dict = None):
    """Approve pending commission (admin only)."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)
    org_role = _get_org_role(current_user)

    if org_role != "admin":
        raise HTTPException(status_code=403, detail="Admin only.")

    referral = db.referrals.find_one(
        {"id": referral_id, "org_id": org_id}, {"_id": 0}
    )

    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found.")

    if referral["commission_status"] != CommissionStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Commission must be in pending status to approve.",
        )

    db.referrals.update_one(
        {"id": referral_id, "org_id": org_id},
        {
            "$set": {
                "commission_status": CommissionStatus.APPROVED,
                "updated_at": datetime.utcnow(),
            }
        },
    )

    updated = db.referrals.find_one(
        {"id": referral_id, "org_id": org_id}, {"_id": 0}
    )

    return ReferralResponse(**updated)


# =====================
# MARKETPLACE LISTING ENDPOINTS
# =====================

@router.post("/marketplace/listings")
async def create_marketplace_listing(
    payload: MarketplaceListingCreate,
    current_user: dict = None,
):
    """Create a new marketplace listing."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)
    user_id = current_user["id"]

    listing_doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "seller_user_id": user_id,
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "price": payload.price,
        "currency": payload.currency,
        "pricing_type": payload.pricing_type,
        "status": MarketplaceListingStatus.DRAFT,
        "tags": payload.tags,
        "image_url": payload.image_url,
        "featured": payload.featured,
        "purchase_count": 0,
        "rating_avg": 0.0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = db.marketplace_listings.insert_one(listing_doc)
    listing_doc["_id"] = result.inserted_id

    return MarketplaceListingResponse(**listing_doc)


@router.get("/marketplace/listings")
async def list_marketplace_listings(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    category: str = Query(None),
    current_user: dict = None,
):
    """List all active marketplace listings (public within platform)."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)

    query = {
        "org_id": org_id,
        "status": MarketplaceListingStatus.ACTIVE,
    }

    if category:
        query["category"] = category

    listings = list(
        db.marketplace_listings.find(query, {"_id": 0})
        .sort("featured", -1)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    total = db.marketplace_listings.count_documents(query)

    return {
        "data": [MarketplaceListingResponse(**listing) for listing in listings],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/marketplace/listings/{listing_id}")
async def get_marketplace_listing(listing_id: str, current_user: dict = None):
    """Get marketplace listing details by ID."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)

    listing = db.marketplace_listings.find_one(
        {"id": listing_id, "org_id": org_id}, {"_id": 0}
    )

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found.")

    return MarketplaceListingResponse(**listing)


@router.patch("/marketplace/listings/{listing_id}")
async def update_marketplace_listing(
    listing_id: str,
    payload: MarketplaceListingUpdate,
    current_user: dict = None,
):
    """Update marketplace listing (owner only)."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)
    user_id = current_user["id"]

    listing = db.marketplace_listings.find_one(
        {"id": listing_id, "org_id": org_id}, {"_id": 0}
    )

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found.")

    if listing["seller_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized.")

    update_data = {}
    if payload.title is not None:
        update_data["title"] = payload.title
    if payload.description is not None:
        update_data["description"] = payload.description
    if payload.category is not None:
        update_data["category"] = payload.category
    if payload.price is not None:
        update_data["price"] = payload.price
    if payload.currency is not None:
        update_data["currency"] = payload.currency
    if payload.pricing_type is not None:
        update_data["pricing_type"] = payload.pricing_type
    if payload.tags is not None:
        update_data["tags"] = payload.tags
    if payload.image_url is not None:
        update_data["image_url"] = payload.image_url
    if payload.featured is not None:
        update_data["featured"] = payload.featured
    if payload.status is not None:
        update_data["status"] = payload.status

    update_data["updated_at"] = datetime.utcnow()

    db.marketplace_listings.update_one(
        {"id": listing_id, "org_id": org_id},
        {"$set": update_data},
    )

    updated = db.marketplace_listings.find_one(
        {"id": listing_id, "org_id": org_id}, {"_id": 0}
    )

    return MarketplaceListingResponse(**updated)


@router.delete("/marketplace/listings/{listing_id}")
async def delete_marketplace_listing(listing_id: str, current_user: dict = None):
    """Delete marketplace listing (owner/admin only)."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)
    user_id = current_user["id"]
    org_role = _get_org_role(current_user)

    listing = db.marketplace_listings.find_one(
        {"id": listing_id, "org_id": org_id}, {"_id": 0}
    )

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found.")

    if org_role != "admin" and listing["seller_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized.")

    db.marketplace_listings.delete_one({"id": listing_id, "org_id": org_id})

    return JSONResponse(
        status_code=200, content={"message": "Listing deleted successfully."}
    )


@router.get("/marketplace/my-listings")
async def get_my_listings(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = None,
):
    """Get current user's marketplace listings."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)
    user_id = current_user["id"]

    query = {
        "org_id": org_id,
        "seller_user_id": user_id,
    }

    listings = list(
        db.marketplace_listings.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    total = db.marketplace_listings.count_documents(query)

    return {
        "data": [MarketplaceListingResponse(**listing) for listing in listings],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


# =====================
# MARKETPLACE ORDER ENDPOINTS
# =====================

@router.post("/marketplace/orders")
async def create_marketplace_order(
    payload: MarketplaceOrderCreate,
    current_user: dict = None,
):
    """Create a marketplace order (buyer purchases listing)."""
    if not current_user:
        current_user = get_current_user()

    buyer_org_id = _get_org_id(current_user)
    buyer_user_id = current_user["id"]

    listing = db.marketplace_listings.find_one(
        {"id": payload.listing_id}, {"_id": 0}
    )

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found.")

    if listing["status"] != MarketplaceListingStatus.ACTIVE:
        raise HTTPException(
            status_code=400, detail="Listing is not available for purchase."
        )

    order_doc = {
        "id": str(uuid.uuid4()),
        "listing_id": payload.listing_id,
        "buyer_org_id": buyer_org_id,
        "buyer_user_id": buyer_user_id,
        "seller_org_id": listing["org_id"],
        "seller_user_id": listing["seller_user_id"],
        "amount": payload.amount,
        "currency": payload.currency,
        "status": MarketplaceOrderStatus.PENDING,
        "paid_at": None,
        "delivered_at": None,
        "completed_at": None,
        "notes": payload.notes,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = db.marketplace_orders.insert_one(order_doc)
    order_doc["_id"] = result.inserted_id

    return MarketplaceOrderResponse(**order_doc)


@router.get("/marketplace/orders")
async def list_marketplace_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    current_user: dict = None,
):
    """List marketplace orders (buyer or seller perspective)."""
    if not current_user:
        current_user = get_current_user()

    buyer_org_id = _get_org_id(current_user)
    user_id = current_user["id"]

    query = {
        "$or": [
            {"buyer_org_id": buyer_org_id},
            {"seller_org_id": buyer_org_id},
        ]
    }

    if status:
        query["status"] = status

    orders = list(
        db.marketplace_orders.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    total = db.marketplace_orders.count_documents(query)

    return {
        "data": [MarketplaceOrderResponse(**order) for order in orders],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/marketplace/orders/{order_id}")
async def get_marketplace_order(order_id: str, current_user: dict = None):
    """Get marketplace order details by ID."""
    if not current_user:
        current_user = get_current_user()

    buyer_org_id = _get_org_id(current_user)

    order = db.marketplace_orders.find_one(
        {
            "id": order_id,
            "$or": [
                {"buyer_org_id": buyer_org_id},
                {"seller_org_id": buyer_org_id},
            ],
        },
        {"_id": 0},
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    return MarketplaceOrderResponse(**order)


@router.patch("/marketplace/orders/{order_id}/status")
async def update_marketplace_order_status(
    order_id: str,
    payload: MarketplaceOrderUpdate,
    current_user: dict = None,
):
    """Update marketplace order status (seller can mark as delivered/completed, buyer can dispute)."""
    if not current_user:
        current_user = get_current_user()

    buyer_org_id = _get_org_id(current_user)
    user_id = current_user["id"]

    order = db.marketplace_orders.find_one(
        {
            "id": order_id,
            "$or": [
                {"buyer_org_id": buyer_org_id},
                {"seller_org_id": buyer_org_id},
            ],
        },
        {"_id": 0},
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if payload.status and payload.status == MarketplaceOrderStatus.PAID:
        if order["buyer_user_id"] != user_id and order["seller_user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized.")

    if payload.status and payload.status == MarketplaceOrderStatus.DELIVERED:
        if order["seller_user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Only seller can mark as delivered.")

    if payload.status and payload.status == MarketplaceOrderStatus.COMPLETED:
        if order["buyer_user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Only buyer can mark as completed.")

    update_data = {}
    if payload.status is not None:
        update_data["status"] = payload.status
    if payload.paid_at is not None:
        update_data["paid_at"] = payload.paid_at
    if payload.delivered_at is not None:
        update_data["delivered_at"] = payload.delivered_at
    if payload.completed_at is not None:
        update_data["completed_at"] = payload.completed_at
    if payload.notes is not None:
        update_data["notes"] = payload.notes

    update_data["updated_at"] = datetime.utcnow()

    db.marketplace_orders.update_one(
        {"id": order_id},
        {"$set": update_data},
    )

    updated = db.marketplace_orders.find_one({"id": order_id}, {"_id": 0})

    return MarketplaceOrderResponse(**updated)


@router.get("/marketplace-stats")
async def get_marketplace_stats(current_user: dict = None):
    """Get marketplace statistics (seller perspective or org-wide for admin)."""
    if not current_user:
        current_user = get_current_user()

    org_id = _get_org_id(current_user)
    user_id = current_user["id"]
    org_role = _get_org_role(current_user)

    if org_role == "admin":
        listings_query = {"org_id": org_id}
        orders_query = {"seller_org_id": org_id}
    else:
        listings_query = {"org_id": org_id, "seller_user_id": user_id}
        orders_query = {"seller_org_id": org_id, "seller_user_id": user_id}

    all_listings = list(db.marketplace_listings.find(listings_query))
    all_orders = list(db.marketplace_orders.find(orders_query))

    total_listings = len(all_listings)
    active_listings = sum(
        1 for l in all_listings if l["status"] == MarketplaceListingStatus.ACTIVE
    )

    total_orders = len(all_orders)
    pending_orders = sum(
        1 for o in all_orders if o["status"] == MarketplaceOrderStatus.PENDING
    )
    completed_orders = sum(
        1 for o in all_orders if o["status"] == MarketplaceOrderStatus.COMPLETED
    )

    total_revenue = sum(o["amount"] for o in all_orders)

    ratings = [l["rating_avg"] for l in all_listings if l["rating_avg"] > 0]
    average_rating = sum(ratings) / len(ratings) if ratings else 0.0

    return MarketplaceStats(
        total_listings=total_listings,
        active_listings=active_listings,
        total_orders=total_orders,
        pending_orders=pending_orders,
        completed_orders=completed_orders,
        total_revenue=total_revenue,
        average_rating=average_rating,
    )
