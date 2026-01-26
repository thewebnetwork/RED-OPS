"""Webhook management routes"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

from database import db
from utils.auth import require_roles
from utils.helpers import get_utc_now
from config import WEBHOOK_EVENTS

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


# ============== MODELS ==============

class WebhookCreate(BaseModel):
    name: str
    url: str
    events: List[str]
    is_active: bool = True
    secret: Optional[str] = None


class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    events: Optional[List[str]] = None
    is_active: Optional[bool] = None
    secret: Optional[str] = None


class WebhookResponse(BaseModel):
    id: str
    name: str
    url: str
    events: List[str]
    is_active: bool
    secret_preview: Optional[str] = None
    created_at: str
    last_triggered: Optional[str] = None
    success_count: int = 0
    failure_count: int = 0


class WebhookLogResponse(BaseModel):
    id: str
    webhook_id: str
    webhook_name: str
    event: str
    status_code: Optional[int] = None
    success: bool
    response_time_ms: Optional[float] = None
    error_message: Optional[str] = None
    created_at: str


# ============== ROUTES ==============

@router.post("", response_model=WebhookResponse)
async def create_webhook(webhook_data: WebhookCreate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new outgoing webhook (Admin only)"""
    # Validate events
    invalid_events = [e for e in webhook_data.events if e not in WEBHOOK_EVENTS]
    if invalid_events:
        raise HTTPException(status_code=400, detail=f"Invalid events: {invalid_events}")
    
    webhook = {
        "id": str(uuid.uuid4()),
        "name": webhook_data.name,
        "url": webhook_data.url,
        "events": webhook_data.events,
        "is_active": webhook_data.is_active,
        "secret": webhook_data.secret,
        "created_by": current_user["id"],
        "created_at": get_utc_now(),
        "last_triggered": None,
        "success_count": 0,
        "failure_count": 0
    }
    
    await db.webhooks.insert_one(webhook)
    
    return WebhookResponse(
        id=webhook["id"],
        name=webhook["name"],
        url=webhook["url"],
        events=webhook["events"],
        is_active=webhook["is_active"],
        secret_preview="****" if webhook["secret"] else None,
        created_at=webhook["created_at"],
        last_triggered=None,
        success_count=0,
        failure_count=0
    )


@router.get("", response_model=List[WebhookResponse])
async def list_webhooks(current_user: dict = Depends(require_roles(["Admin"]))):
    """List all webhooks (Admin only)"""
    webhooks = await db.webhooks.find({}, {"_id": 0}).to_list(100)
    
    return [
        WebhookResponse(
            id=w["id"],
            name=w["name"],
            url=w["url"],
            events=w.get("events", []),
            is_active=w.get("is_active", True),
            secret_preview="****" if w.get("secret") else None,
            created_at=w["created_at"],
            last_triggered=w.get("last_triggered"),
            success_count=w.get("success_count", 0),
            failure_count=w.get("failure_count", 0)
        )
        for w in webhooks
    ]


@router.get("/events")
async def list_webhook_events(current_user: dict = Depends(require_roles(["Admin"]))):
    """List available webhook events"""
    return {"events": WEBHOOK_EVENTS}


@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(webhook_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Get a specific webhook"""
    webhook = await db.webhooks.find_one({"id": webhook_id}, {"_id": 0})
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    return WebhookResponse(
        id=webhook["id"],
        name=webhook["name"],
        url=webhook["url"],
        events=webhook.get("events", []),
        is_active=webhook.get("is_active", True),
        secret_preview="****" if webhook.get("secret") else None,
        created_at=webhook["created_at"],
        last_triggered=webhook.get("last_triggered"),
        success_count=webhook.get("success_count", 0),
        failure_count=webhook.get("failure_count", 0)
    )


@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(webhook_id: str, webhook_data: WebhookUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update a webhook (Admin only)"""
    webhook = await db.webhooks.find_one({"id": webhook_id}, {"_id": 0})
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    update_dict = {k: v for k, v in webhook_data.model_dump().items() if v is not None}
    
    if "events" in update_dict:
        invalid_events = [e for e in update_dict["events"] if e not in WEBHOOK_EVENTS]
        if invalid_events:
            raise HTTPException(status_code=400, detail=f"Invalid events: {invalid_events}")
    
    if update_dict:
        await db.webhooks.update_one({"id": webhook_id}, {"$set": update_dict})
    
    updated = await db.webhooks.find_one({"id": webhook_id}, {"_id": 0})
    
    return WebhookResponse(
        id=updated["id"],
        name=updated["name"],
        url=updated["url"],
        events=updated.get("events", []),
        is_active=updated.get("is_active", True),
        secret_preview="****" if updated.get("secret") else None,
        created_at=updated["created_at"],
        last_triggered=updated.get("last_triggered"),
        success_count=updated.get("success_count", 0),
        failure_count=updated.get("failure_count", 0)
    )


@router.delete("/{webhook_id}")
async def delete_webhook(webhook_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Delete a webhook (Admin only)"""
    result = await db.webhooks.delete_one({"id": webhook_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"message": "Webhook deleted"}


@router.post("/{webhook_id}/test")
async def test_webhook(webhook_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Send a test event to webhook"""
    from services.webhooks import trigger_webhooks
    
    webhook = await db.webhooks.find_one({"id": webhook_id}, {"_id": 0})
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    test_payload = {
        "event": "test",
        "timestamp": get_utc_now(),
        "data": {
            "message": "This is a test webhook event",
            "webhook_id": webhook_id,
            "triggered_by": current_user["name"]
        }
    }
    
    # Trigger the webhook
    await trigger_webhooks("test", test_payload["data"])
    
    return {"message": "Test event sent", "payload": test_payload}


# ============== WEBHOOK LOGS ==============

@router.get("/logs/all", response_model=List[WebhookLogResponse])
async def get_webhook_logs(
    webhook_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Get webhook delivery logs"""
    query = {}
    if webhook_id:
        query["webhook_id"] = webhook_id
    
    logs = await db.webhook_logs.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [WebhookLogResponse(**log) for log in logs]
