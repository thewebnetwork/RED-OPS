"""Satisfaction ratings routes"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List

from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import get_utc_now

router = APIRouter(prefix="/ratings", tags=["Ratings"])


# ============== MODELS ==============

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
    rating_distribution: dict


# ============== ROUTES ==============

@router.post("")
async def submit_rating(rating_data: RatingCreate):
    """Submit a satisfaction rating (public endpoint with token)"""
    # Verify the rating token
    token_record = await db.rating_tokens.find_one({
        "token": rating_data.token,
        "used": False
    }, {"_id": 0})
    
    if not token_record:
        raise HTTPException(status_code=400, detail="Invalid or expired rating token")
    
    # Get order details
    order = await db.orders.find_one({"id": token_record["order_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Create rating
    rating = {
        "id": str(uuid.uuid4()),
        "order_id": order["id"],
        "order_code": order["order_code"],
        "requester_id": order["requester_id"],
        "requester_name": order.get("requester_name", "Unknown"),
        "resolver_id": order.get("editor_id"),
        "resolver_name": order.get("editor_name", "Unknown"),
        "rating": rating_data.rating,
        "comment": rating_data.comment,
        "created_at": get_utc_now()
    }
    
    await db.ratings.insert_one(rating)
    
    # Mark token as used
    await db.rating_tokens.update_one(
        {"token": rating_data.token},
        {"$set": {"used": True, "used_at": get_utc_now()}}
    )
    
    return {"message": "Thank you for your feedback!", "rating_id": rating["id"]}


@router.get("", response_model=List[RatingResponse])
async def list_ratings(
    resolver_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """List all ratings (Admin only)"""
    query = {}
    if resolver_id:
        query["resolver_id"] = resolver_id
    
    ratings = await db.ratings.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [RatingResponse(**r) for r in ratings]


@router.get("/my-ratings", response_model=List[RatingResponse])
async def get_my_ratings(current_user: dict = Depends(get_current_user)):
    """Get ratings for current user's resolved orders"""
    # If requester, get ratings they gave
    # If resolver, get ratings they received
    role = current_user["role"]
    
    if role == "Requester":
        query = {"requester_id": current_user["id"]}
    else:
        query = {"resolver_id": current_user["id"]}
    
    ratings = await db.ratings.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return [RatingResponse(**r) for r in ratings]


@router.get("/my-stats")
async def get_my_rating_stats(current_user: dict = Depends(get_current_user)):
    """Get rating statistics for current user"""
    role = current_user["role"]
    
    if role == "Requester":
        query = {"requester_id": current_user["id"]}
    else:
        query = {"resolver_id": current_user["id"]}
    
    ratings = await db.ratings.find(query, {"_id": 0}).to_list(100)
    
    if not ratings:
        return {
            "total_ratings": 0,
            "average_rating": 0,
            "total_delivered": 0
        }
    
    total = len(ratings)
    avg = sum(r["rating"] for r in ratings) / total if total > 0 else 0
    
    # Get delivered count
    delivered_count = 0
    if role != "Requester":
        delivered_count = await db.orders.count_documents({
            "editor_id": current_user["id"],
            "status": "Delivered"
        })
    
    return {
        "total_ratings": total,
        "average_rating": round(avg, 2),
        "total_delivered": delivered_count
    }


@router.get("/stats")
async def get_rating_stats(current_user: dict = Depends(require_roles(["Admin"]))):
    """Get overall rating statistics"""
    pipeline = [
        {"$group": {
            "_id": None,
            "total_ratings": {"$sum": 1},
            "average_rating": {"$avg": "$rating"},
            "rating_1": {"$sum": {"$cond": [{"$eq": ["$rating", 1]}, 1, 0]}},
            "rating_2": {"$sum": {"$cond": [{"$eq": ["$rating", 2]}, 1, 0]}},
            "rating_3": {"$sum": {"$cond": [{"$eq": ["$rating", 3]}, 1, 0]}},
            "rating_4": {"$sum": {"$cond": [{"$eq": ["$rating", 4]}, 1, 0]}},
            "rating_5": {"$sum": {"$cond": [{"$eq": ["$rating", 5]}, 1, 0]}},
        }}
    ]
    
    result = await db.ratings.aggregate(pipeline).to_list(1)
    
    if not result:
        return {
            "total_ratings": 0,
            "average_rating": 0,
            "distribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
        }
    
    stats = result[0]
    return {
        "total_ratings": stats["total_ratings"],
        "average_rating": round(stats.get("average_rating", 0), 2),
        "distribution": {
            "1": stats["rating_1"],
            "2": stats["rating_2"],
            "3": stats["rating_3"],
            "4": stats["rating_4"],
            "5": stats["rating_5"]
        }
    }


@router.get("/resolver-stats", response_model=List[ResolverStatsResponse])
async def get_resolver_stats(current_user: dict = Depends(require_roles(["Admin"]))):
    """Get ratings statistics grouped by resolver"""
    pipeline = [
        {"$group": {
            "_id": "$resolver_id",
            "resolver_name": {"$first": "$resolver_name"},
            "total_ratings": {"$sum": 1},
            "average_rating": {"$avg": "$rating"},
            "rating_1": {"$sum": {"$cond": [{"$eq": ["$rating", 1]}, 1, 0]}},
            "rating_2": {"$sum": {"$cond": [{"$eq": ["$rating", 2]}, 1, 0]}},
            "rating_3": {"$sum": {"$cond": [{"$eq": ["$rating", 3]}, 1, 0]}},
            "rating_4": {"$sum": {"$cond": [{"$eq": ["$rating", 4]}, 1, 0]}},
            "rating_5": {"$sum": {"$cond": [{"$eq": ["$rating", 5]}, 1, 0]}},
        }},
        {"$sort": {"average_rating": -1}}
    ]
    
    results = await db.ratings.aggregate(pipeline).to_list(100)
    
    resolver_stats = []
    for r in results:
        if r["_id"]:  # Skip if no resolver_id
            # Get total delivered count for this resolver
            delivered_count = await db.orders.count_documents({
                "editor_id": r["_id"],
                "status": "Delivered"
            })
            
            resolver_stats.append(ResolverStatsResponse(
                resolver_id=r["_id"],
                resolver_name=r["resolver_name"],
                total_delivered=delivered_count,
                total_ratings=r["total_ratings"],
                average_rating=round(r.get("average_rating", 0), 2),
                rating_distribution={
                    "1": r["rating_1"],
                    "2": r["rating_2"],
                    "3": r["rating_3"],
                    "4": r["rating_4"],
                    "5": r["rating_5"]
                }
            ))
    
    return resolver_stats
