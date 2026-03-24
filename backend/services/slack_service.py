"""Slack webhook notification service."""
import httpx
import logging

logger = logging.getLogger(__name__)


async def send_slack_notification(webhook_url: str, message: str, title: str = None) -> bool:
    """Send a notification to Slack via incoming webhook."""
    if not webhook_url:
        return False
    text = f"*{title}*\n{message}" if title else message
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(webhook_url, json={"text": text})
            if r.status_code == 200:
                return True
            logger.warning(f"Slack webhook returned {r.status_code}")
            return False
    except Exception as e:
        logger.error(f"Slack webhook error: {e}")
        return False
