"""API Key management routes"""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

from database import db
from utils.auth import require_roles
from utils.helpers import get_utc_now

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


# ============== MODELS ==============

class ApiKeyCreate(BaseModel):
    name: str
    permissions: str = "read"  # "read" or "read_write"


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_preview: str
    permissions: str
    created_at: str
    last_used: Optional[str] = None
    is_active: bool = True
    total_requests: int = 0
    requests_today: int = 0
    requests_this_week: int = 0


# ============== ROUTES ==============

@router.post("")
async def create_api_key(key_data: ApiKeyCreate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new API key (Admin only)"""
    # Generate unique key
    key_prefix = "rrops_"
    full_key = key_prefix + str(uuid.uuid4()).replace("-", "")[:24]
    
    api_key = {
        "id": str(uuid.uuid4()),
        "name": key_data.name,
        "key": full_key,
        "key_preview": full_key[:8] + "..." + full_key[-4:],
        "permissions": key_data.permissions,
        "is_active": True,
        "created_by": current_user["id"],
        "created_at": get_utc_now(),
        "last_used": None
    }
    
    await db.api_keys.insert_one(api_key)
    
    # Return full key only on creation (won't be shown again)
    return {
        "id": api_key["id"],
        "name": api_key["name"],
        "key": full_key,  # Only returned on creation
        "key_preview": api_key["key_preview"],
        "permissions": api_key["permissions"],
        "created_at": api_key["created_at"],
        "message": "Save this key now - it won't be shown again!"
    }


@router.get("", response_model=List[ApiKeyResponse])
async def list_api_keys(current_user: dict = Depends(require_roles(["Admin"]))):
    """List all API keys (Admin only)"""
    keys = await db.api_keys.find({"is_active": True}, {"_id": 0, "key": 0}).to_list(100)
    
    result = []
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    
    for key in keys:
        # Get usage stats
        total = await db.api_key_logs.count_documents({"api_key_id": key["id"]})
        today_count = await db.api_key_logs.count_documents({
            "api_key_id": key["id"],
            "timestamp": {"$gte": today.isoformat()}
        })
        week_count = await db.api_key_logs.count_documents({
            "api_key_id": key["id"],
            "timestamp": {"$gte": week_ago.isoformat()}
        })
        
        result.append(ApiKeyResponse(
            id=key["id"],
            name=key["name"],
            key_preview=key.get("key_preview", "****"),
            permissions=key.get("permissions", "read"),
            created_at=key["created_at"],
            last_used=key.get("last_used"),
            is_active=key.get("is_active", True),
            total_requests=total,
            requests_today=today_count,
            requests_this_week=week_count
        ))
    
    return result


@router.delete("/{key_id}")
async def revoke_api_key(key_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Revoke an API key (Admin only)"""
    result = await db.api_keys.delete_one({"id": key_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key revoked"}


@router.get("/{key_id}/usage")
async def get_api_key_usage(key_id: str, days: int = 30, current_user: dict = Depends(require_roles(["Admin"]))):
    """Get usage analytics for a specific API key"""
    api_key = await db.api_keys.find_one({"id": key_id}, {"_id": 0})
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get daily stats
    pipeline = [
        {"$match": {"api_key_id": key_id, "timestamp": {"$gte": start_date.isoformat()}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$dateFromString": {"dateString": "$timestamp"}}}},
            "count": {"$sum": 1},
            "avg_response_time": {"$avg": "$response_time_ms"},
            "errors": {"$sum": {"$cond": [{"$gte": ["$status_code", 400]}, 1, 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    daily_stats = await db.api_key_logs.aggregate(pipeline).to_list(100)
    
    # Get usage by endpoint
    endpoint_pipeline = [
        {"$match": {"api_key_id": key_id, "timestamp": {"$gte": start_date.isoformat()}}},
        {"$group": {
            "_id": "$endpoint",
            "count": {"$sum": 1},
            "avg_response_time": {"$avg": "$response_time_ms"}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    
    endpoint_stats = await db.api_key_logs.aggregate(endpoint_pipeline).to_list(10)
    
    # Calculate totals
    total_requests = sum(d.get("count", 0) for d in daily_stats)
    total_errors = sum(d.get("errors", 0) for d in daily_stats)
    avg_response_time = sum(d.get("avg_response_time", 0) for d in daily_stats) / len(daily_stats) if daily_stats else 0
    error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0
    
    return {
        "key_id": key_id,
        "key_name": api_key.get("name", "Unknown"),
        "total_requests": total_requests,
        "requests_by_day": [{"date": d["_id"], "count": d["count"]} for d in daily_stats],
        "requests_by_endpoint": [{"endpoint": d["_id"], "count": d["count"], "avg_ms": round(d.get("avg_response_time", 0), 2)} for d in endpoint_stats],
        "avg_response_time_ms": round(avg_response_time, 2),
        "error_rate": round(error_rate, 2)
    }


@router.get("/analytics/summary")
async def get_api_keys_analytics_summary(current_user: dict = Depends(require_roles(["Admin"]))):
    """Get summary analytics for all API keys"""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    
    # Get all active keys
    keys = await db.api_keys.find({"is_active": True}, {"_id": 0, "key": 0}).to_list(100)
    
    summary = []
    for key in keys:
        # Count requests for this key
        total = await db.api_key_logs.count_documents({"api_key_id": key["id"]})
        today_count = await db.api_key_logs.count_documents({
            "api_key_id": key["id"],
            "timestamp": {"$gte": today.isoformat()}
        })
        week_count = await db.api_key_logs.count_documents({
            "api_key_id": key["id"],
            "timestamp": {"$gte": week_ago.isoformat()}
        })
        
        summary.append({
            "id": key["id"],
            "name": key["name"],
            "key_preview": key.get("key_preview", "****"),
            "permissions": key.get("permissions", "read"),
            "created_at": key["created_at"],
            "last_used": key.get("last_used"),
            "is_active": key.get("is_active", True),
            "total_requests": total,
            "requests_today": today_count,
            "requests_this_week": week_count
        })
    
    return {
        "keys": summary,
        "totals": {
            "total_keys": len(keys),
            "total_requests_all_time": sum(k["total_requests"] for k in summary),
            "total_requests_today": sum(k["requests_today"] for k in summary),
            "total_requests_week": sum(k["requests_this_week"] for k in summary)
        }
    }
