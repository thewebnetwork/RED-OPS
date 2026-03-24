"""Notification routes"""
import uuid
import json
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

from database import db
from utils.auth import get_current_user, get_user_from_token
from utils.helpers import get_utc_now
from services.sse import subscribe, unsubscribe

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ============== MODELS ==============

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    related_order_id: Optional[str] = None
    is_read: bool
    created_at: str


# ============== SSE STREAM ==============

@router.get("/stream")
async def notification_stream(token: str = Query(...)):
    """SSE endpoint for real-time notifications. Auth via query param (EventSource doesn't support headers)."""
    user = await get_user_from_token(token)
    user_id = user["id"]

    async def event_generator():
        queue = await subscribe(user_id)
        try:
            yield f"event: connected\ndata: {json.dumps({'user_id': user_id})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    # Strip MongoDB _id if present
                    event.pop("_id", None)
                    yield f"event: notification\ndata: {json.dumps(event, default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield f"event: heartbeat\ndata: {json.dumps({'ts': datetime.now(timezone.utc).isoformat()})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            unsubscribe(user_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# ============== ROUTES ==============

@router.get("", response_model=List[NotificationResponse])
async def get_notifications(
    limit: int = 50,
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for current user"""
    query = {"user_id": current_user["id"]}
    if unread_only:
        query["is_read"] = False

    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    return [NotificationResponse(**n) for n in notifications]


@router.get("/count")
async def get_notification_count(current_user: dict = Depends(get_current_user)):
    """Get unread notification count"""
    count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "is_read": False
    })
    return {"unread_count": count}


@router.get("/unread-count")
async def get_unread_notification_count(current_user: dict = Depends(get_current_user)):
    """Get unread notification count (alias for /count)"""
    count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "is_read": False
    })
    return {"unread_count": count}


@router.patch("/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"message": "Notification marked as read"}


@router.patch("/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    result = await db.notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )

    return {"message": f"Marked {result.modified_count} notifications as read"}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a notification"""
    result = await db.notifications.delete_one({
        "id": notification_id,
        "user_id": current_user["id"]
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"message": "Notification deleted"}


@router.delete("")
async def delete_all_notifications(current_user: dict = Depends(get_current_user)):
    """Delete all notifications for current user"""
    result = await db.notifications.delete_many({"user_id": current_user["id"]})
    return {"message": f"Deleted {result.deleted_count} notifications"}
