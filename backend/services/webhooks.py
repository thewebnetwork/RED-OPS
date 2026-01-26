"""Webhook services"""
import uuid
import logging
import httpx
from datetime import datetime, timezone

async def trigger_webhooks(db, event: str, payload: dict):
    """Trigger all active outgoing webhooks for a given event"""
    webhooks = await db.webhooks.find({
        "direction": "outgoing",
        "is_active": True,
        "events": event
    }, {"_id": 0}).to_list(100)
    
    if not webhooks:
        return
    
    timestamp = datetime.now(timezone.utc).isoformat()
    
    for webhook in webhooks:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    webhook["url"],
                    json={
                        "event": event,
                        "timestamp": timestamp,
                        "data": payload
                    },
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Event": event,
                        "X-Webhook-Source": "red-ops"
                    }
                )
                
                # Log webhook delivery
                await db.webhook_logs.insert_one({
                    "id": str(uuid.uuid4()),
                    "webhook_id": webhook["id"],
                    "webhook_name": webhook["name"],
                    "event": event,
                    "url": webhook["url"],
                    "status_code": response.status_code,
                    "success": 200 <= response.status_code < 300,
                    "response_body": response.text[:500] if response.text else None,
                    "timestamp": timestamp
                })
                
                # Update last triggered
                await db.webhooks.update_one(
                    {"id": webhook["id"]},
                    {"$set": {"last_triggered": timestamp}}
                )
                
        except Exception as e:
            logging.error(f"Webhook delivery failed for {webhook['name']}: {e}")
            await db.webhook_logs.insert_one({
                "id": str(uuid.uuid4()),
                "webhook_id": webhook["id"],
                "webhook_name": webhook["name"],
                "event": event,
                "url": webhook["url"],
                "status_code": None,
                "success": False,
                "error": str(e),
                "timestamp": timestamp
            })
