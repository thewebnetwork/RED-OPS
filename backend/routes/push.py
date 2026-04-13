"""
Push notification routes for RED OPS PWA.

Handles Web Push subscription storage (MongoDB) and push delivery (pywebpush).
Integrates with existing notification system — when a notification is created,
it can also fire a push to the user's device.
"""
import os
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from database import db
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/push", tags=["Push Notifications"])

# Lazy import pywebpush — only needed when actually sending
_webpush = None

def _get_webpush():
    global _webpush
    if _webpush is None:
        from pywebpush import webpush, WebPushException
        _webpush = (webpush, WebPushException)
    return _webpush


# ============== MODELS ==============

class PushSubscribeRequest(BaseModel):
    subscription: dict  # Full PushSubscription JSON from browser
    device: Optional[str] = "unknown"  # "ios", "android", "desktop"

class PushUnsubscribeRequest(BaseModel):
    endpoint: str  # The subscription endpoint URL

class PushSendRequest(BaseModel):
    user_id: str
    title: str
    body: str
    url: Optional[str] = "/"
    tag: Optional[str] = None
    notification_id: Optional[str] = None


# ============== ROUTES ==============

@router.post("/subscribe")
async def push_subscribe(req: PushSubscribeRequest, user=Depends(get_current_user)):
    """Save or update a push subscription for the authenticated user."""
    user_id = user["id"]

    # Validate subscription has required fields
    sub = req.subscription
    if not sub.get("endpoint") or not sub.get("keys"):
        raise HTTPException(status_code=400, detail="Invalid push subscription object")

    # Upsert — one subscription per user per endpoint
    await db.push_subscriptions.update_one(
        {"user_id": user_id, "subscription.endpoint": sub["endpoint"]},
        {"$set": {
            "user_id": user_id,
            "subscription": sub,
            "device": req.device,
            "updated_at": datetime.now(timezone.utc),
        },
        "$setOnInsert": {
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    return {"status": "subscribed", "device": req.device}


@router.post("/unsubscribe")
async def push_unsubscribe(req: PushUnsubscribeRequest, user=Depends(get_current_user)):
    """Remove a push subscription."""
    user_id = user["id"]

    result = await db.push_subscriptions.delete_one({
        "user_id": user_id,
        "subscription.endpoint": req.endpoint,
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")

    return {"status": "unsubscribed"}


@router.get("/status")
async def push_status(user=Depends(get_current_user)):
    """Check if the current user has any active push subscriptions."""
    user_id = user["id"]
    count = await db.push_subscriptions.count_documents({"user_id": user_id})
    return {"subscribed": count > 0, "subscription_count": count}


# ============== INTERNAL SEND FUNCTION ==============
# Call this from anywhere in the backend (e.g., notification creation, webhooks)

async def send_push_to_user(user_id: str, title: str, body: str, url: str = "/", tag: str = None, notification_id: str = None):
    """
    Send a push notification to all of a user's subscribed devices.
    Call this from other routes/services when you want to push.

    Example:
        from routes.push import send_push_to_user
        await send_push_to_user("user123", "New Call Booked", "John Smith booked a strategy call", "/pipeline")
    """
    vapid_private_key = os.environ.get("VAPID_PRIVATE_KEY")
    vapid_public_key = os.environ.get("VAPID_PUBLIC_KEY")

    if not vapid_private_key or not vapid_public_key:
        logger.warning("VAPID keys not configured — skipping push notification")
        return 0

    webpush, WebPushException = _get_webpush()

    # Get all subscriptions for this user
    cursor = db.push_subscriptions.find({"user_id": user_id})
    sent_count = 0
    stale_endpoints = []

    async for record in cursor:
        sub_info = record["subscription"]
        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url,
            "tag": tag or "redops-notification",
            "notification_id": notification_id,
        })

        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": "mailto:vitto@redribbongroup.ca"},
            )
            sent_count += 1
        except WebPushException as e:
            status_code = getattr(e, 'response', None)
            if status_code and hasattr(status_code, 'status_code') and status_code.status_code in (404, 410):
                # Subscription expired or unsubscribed — mark for cleanup
                stale_endpoints.append(sub_info["endpoint"])
                logger.info(f"Stale push subscription for {user_id}, marking for removal")
            else:
                logger.error(f"Push failed for {user_id}: {e}")
        except Exception as e:
            logger.error(f"Unexpected push error for {user_id}: {e}")

    # Clean up stale subscriptions
    if stale_endpoints:
        await db.push_subscriptions.delete_many({
            "user_id": user_id,
            "subscription.endpoint": {"$in": stale_endpoints},
        })

    return sent_count


# ============== ADMIN/INTERNAL SEND ENDPOINT ==============

@router.post("/send")
async def push_send(req: PushSendRequest, user=Depends(get_current_user)):
    """Send a push notification to a specific user (admin/internal use)."""
    # Only allow admins or sending to self
    if user.get("role") not in ("admin", "administrator") and req.user_id != user["id"]:
        raise HTTPException(status_code=403, detail="Can only send push to yourself or must be admin")

    sent = await send_push_to_user(
        user_id=req.user_id,
        title=req.title,
        body=req.body,
        url=req.url,
        tag=req.tag,
        notification_id=req.notification_id,
    )

    return {"status": "sent", "devices_reached": sent}


@router.post("/test")
async def push_test(user=Depends(get_current_user)):
    """Send a test push to the current user — for verifying setup."""
    sent = await send_push_to_user(
        user_id=user["id"],
        title="RED OPS Test",
        body="Push notifications are working.",
        url="/settings",
        tag="redops-test",
    )

    if sent == 0:
        raise HTTPException(status_code=404, detail="No push subscriptions found. Enable notifications first.")

    return {"status": "test_sent", "devices_reached": sent}
