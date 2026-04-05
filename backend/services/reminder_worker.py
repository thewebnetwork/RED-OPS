"""
Reminder Worker — background task that polls task_reminders every 60s
and fires due reminders over the configured channels.

Started from the FastAPI lifespan. Survives per-iteration errors so a
single bad row cannot kill the loop.
"""
import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 60
BATCH_SIZE = 100


async def run_reminder_worker(db):
    """
    Poll task_reminders every 60s, fire any reminders whose
    reminder_at has passed, mark them sent.
    """
    logger.info("Reminder worker started (interval=%ss)", POLL_INTERVAL_SECONDS)
    while True:
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            cursor = db.task_reminders.find(
                {"sent": False, "reminder_at": {"$lte": now_iso}}
            )
            due_reminders = await cursor.to_list(length=BATCH_SIZE)

            for reminder in due_reminders:
                reminder_id = reminder.get("_id")
                try:
                    await _fire_reminder(db, reminder)
                except Exception as e:
                    logger.warning(
                        "Reminder worker: failed to fire reminder %s: %s",
                        reminder_id, e,
                    )
                finally:
                    # Always mark sent even on failure, so we don't spam.
                    await db.task_reminders.update_one(
                        {"_id": reminder_id},
                        {"$set": {"sent": True, "fired_at": datetime.now(timezone.utc).isoformat()}},
                    )

        except asyncio.CancelledError:
            logger.info("Reminder worker cancelled")
            raise
        except Exception as e:
            logger.error("Reminder worker loop error: %s", e)

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def _fire_reminder(db, reminder: dict):
    task_id = reminder.get("task_id")
    user_id = reminder.get("user_id")
    channels = reminder.get("channels") or []

    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "name": 1})
    if not task or not user:
        logger.info(
            "Reminder worker: skipping reminder for missing task/user (task=%s user=%s)",
            task_id, user_id,
        )
        return

    task_title = task.get("title", "Untitled Task")
    due_at = task.get("due_at") or reminder.get("due_at", "soon")
    # Pretty-print due date
    due_str = _format_due(due_at)

    if "email" in channels:
        user_email = user.get("email") or ""
        if user_email:
            try:
                # Local import avoids a circular import at module load.
                from services.email import send_email_notification  # type: ignore
                subject = f"Reminder: {task_title} is due {due_str}"
                plain = f"Task '{task_title}' is due {due_str}."
                html = (
                    '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">'
                    '<h2 style="color:#dc2626">Task Reminder</h2>'
                    f'<p><strong>{_escape(task_title)}</strong> is due {_escape(due_str)}.</p>'
                    '<p><a href="https://redops.redribbongroup.ca/task-board" '
                    'style="background:#dc2626;color:#fff;padding:10px 20px;'
                    'border-radius:6px;text-decoration:none;display:inline-block">'
                    'View Task</a></p>'
                    '</div>'
                )
                await send_email_notification(user_email, subject, plain, html_body=html)
                logger.info("Reminder worker: email sent for task %s -> %s", task_id, user_email)
            except Exception as e:
                logger.warning("Email reminder failed for task %s: %s", task_id, e)
        else:
            logger.info("Reminder worker: no email on user %s for task %s", user_id, task_id)

    if "sms" in channels:
        logger.warning(
            "SMS reminder queued for task %s — Twilio not yet configured", task_id,
        )


def _format_due(due_at) -> str:
    if not due_at:
        return "soon"
    try:
        if isinstance(due_at, datetime):
            dt = due_at
        else:
            dt = datetime.fromisoformat(str(due_at).replace("Z", "+00:00"))
        return dt.strftime("%b %d, %Y at %H:%M UTC")
    except Exception:
        return str(due_at)


def _escape(s: str) -> str:
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
