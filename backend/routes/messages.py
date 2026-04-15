"""
In-Platform Messaging System

Supports three thread types:
- channel: group chats for agency team
- dm: direct messages between two users
- request: message thread attached to a service request/order
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user
from services.notifications import create_notification
from routes.push import send_push_to_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/messages", tags=["Messages"])


# ============== MODELS ==============

class ThreadCreate(BaseModel):
    type: str  # "channel" | "dm" | "request"
    name: Optional[str] = None
    members: List[str] = []
    reference_id: Optional[str] = None  # order_id for request threads


class MessageCreate(BaseModel):
    body: str = ""
    attachment_ids: List[str] = []
    mentions: Optional[List[str]] = []
    metadata: Optional[dict] = {}


# ============== HELPERS ==============

def get_org_id(user: dict) -> str:
    return user.get("org_id") or user.get("team_id") or user.get("id")


def is_client(user: dict) -> bool:
    return user.get("account_type") == "Media Client" or user.get("role") == "Media Client"


async def create_thread_for_request(order_id: str, order_title: str, members: List[str], org_id: str, created_by: str) -> dict:
    """Auto-create a request thread when an order is created."""
    now = datetime.now(timezone.utc).isoformat()
    thread = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "type": "request",
        "name": order_title,
        "members": members,
        "reference_id": order_id,
        "created_by": created_by,
        "created_at": now,
        "last_message_at": now,
        "last_message_preview": None,
    }
    await db.threads.insert_one(thread)
    return thread


# ============== THREAD ENDPOINTS ==============

@router.get("/threads")
async def list_threads(
    type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List all threads the current user is a member of."""
    user_id = current_user["id"]
    query = {"members": user_id}

    # Clients can only see DMs and request threads
    if is_client(current_user):
        query["type"] = {"$in": ["dm", "request"]}
    elif type:
        query["type"] = type

    threads = await db.threads.find(query, {"_id": 0}).sort("last_message_at", -1).to_list(200)

    # Collect all unique member IDs across DM threads for avatar lookup
    dm_member_ids = set()
    for t in threads:
        if t.get("type") == "dm":
            for mid in (t.get("members") or []):
                if mid != user_id:
                    dm_member_ids.add(mid)

    dm_avatars = {}
    if dm_member_ids:
        async for u in db.users.find(
            {"id": {"$in": list(dm_member_ids)}},
            {"_id": 0, "id": 1, "avatar": 1}
        ):
            dm_avatars[u["id"]] = u.get("avatar") or None

    # Enrich with unread count + other-party avatar for DMs
    for t in threads:
        unread = await db.messages.count_documents({
            "thread_id": t["id"],
            "sender_id": {"$ne": user_id},
            "read_by": {"$nin": [user_id]},
        })
        t["unread_count"] = unread
        if t.get("type") == "dm":
            other_id = next((m for m in (t.get("members") or []) if m != user_id), None)
            t["other_avatar"] = dm_avatars.get(other_id) if other_id else None

    return threads


@router.post("/threads")
async def create_thread(
    body: ThreadCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new channel or DM thread."""
    if body.type not in ["channel", "dm", "request"]:
        raise HTTPException(status_code=400, detail="type must be channel, dm, or request")

    # Clients cannot create channels
    if is_client(current_user) and body.type == "channel":
        raise HTTPException(status_code=403, detail="Clients cannot create channels")

    org_id = get_org_id(current_user)
    now = datetime.now(timezone.utc).isoformat()

    # For DMs, check if a thread already exists between these two users
    if body.type == "dm" and len(body.members) == 1:
        other_id = body.members[0]
        existing = await db.threads.find_one({
            "type": "dm",
            "members": {"$all": [current_user["id"], other_id], "$size": 2},
        }, {"_id": 0})
        if existing:
            return existing

    members = list(set([current_user["id"]] + body.members))

    thread = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "type": body.type,
        "name": body.name,
        "members": members,
        "reference_id": body.reference_id,
        "created_by": current_user["id"],
        "created_at": now,
        "last_message_at": now,
        "last_message_preview": None,
    }

    await db.threads.insert_one(thread)
    thread.pop("_id", None)
    return thread


@router.get("/threads/{thread_id}")
async def get_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single thread."""
    thread = await db.threads.find_one({"id": thread_id}, {"_id": 0})
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if current_user["id"] not in thread.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this thread")

    return thread


@router.patch("/threads/{thread_id}")
async def update_thread(
    thread_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    """Rename a thread or update its icon. DMs cannot be renamed."""
    thread = await db.threads.find_one({"id": thread_id}, {"_id": 0})
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if current_user["id"] not in thread.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this thread")
    if thread.get("type") == "dm":
        raise HTTPException(status_code=400, detail="DM threads cannot be renamed")

    updates = {}
    if "name" in body and isinstance(body["name"], str):
        name = body["name"].strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        updates["name"] = name
    if "icon" in body and isinstance(body["icon"], str):
        updates["icon"] = body["icon"][:8]  # emoji or short string

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db.threads.update_one({"id": thread_id}, {"$set": updates})
    updated = await db.threads.find_one({"id": thread_id}, {"_id": 0})
    return updated


@router.delete("/threads/{thread_id}")
async def delete_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a thread. Only the creator (or an admin) can delete a channel.
    DM threads cannot be deleted. Members use leave instead."""
    thread = await db.threads.find_one({"id": thread_id}, {"_id": 0})
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if thread.get("type") == "dm":
        raise HTTPException(status_code=400, detail="DM threads cannot be deleted. Use 'leave' or delete individual messages.")

    is_creator = thread.get("created_by") == current_user["id"]
    is_admin = current_user.get("role") in ("Administrator", "Admin")
    if not (is_creator or is_admin):
        raise HTTPException(status_code=403, detail="Only the creator or an admin can delete this thread")

    # Delete all messages in the thread + the thread itself
    await db.messages.delete_many({"thread_id": thread_id})
    await db.threads.delete_one({"id": thread_id})
    return {"status": "deleted", "id": thread_id}


@router.post("/threads/{thread_id}/leave")
async def leave_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove the current user from a channel thread."""
    thread = await db.threads.find_one({"id": thread_id}, {"_id": 0})
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread.get("type") == "dm":
        raise HTTPException(status_code=400, detail="Cannot leave a DM thread")
    if current_user["id"] not in thread.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member")

    await db.threads.update_one(
        {"id": thread_id},
        {"$pull": {"members": current_user["id"]}}
    )
    return {"status": "left", "id": thread_id}


@router.patch("/threads/{thread_id}/members")
async def update_thread_members(
    thread_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    """Add or remove members from a thread."""
    thread = await db.threads.find_one({"id": thread_id}, {"_id": 0})
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if current_user["id"] not in thread.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this thread")

    add_ids = body.get("add", [])
    remove_ids = body.get("remove", [])

    if add_ids:
        await db.threads.update_one(
            {"id": thread_id},
            {"$addToSet": {"members": {"$each": add_ids}}}
        )
    if remove_ids:
        await db.threads.update_one(
            {"id": thread_id},
            {"$pull": {"members": {"$in": remove_ids}}}
        )

    updated = await db.threads.find_one({"id": thread_id}, {"_id": 0})
    return updated


@router.patch("/threads/{thread_id}/messages/{message_id}")
async def edit_message(
    thread_id: str,
    message_id: str,
    body: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Edit a message. Only the sender can edit."""
    msg = await db.messages.find_one({"id": message_id, "thread_id": thread_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.get("sender_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")

    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"body": body.body.strip(), "edited_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "message_id": message_id}


@router.delete("/threads/{thread_id}/messages/{message_id}")
async def delete_message(
    thread_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a message. Only the sender or admin can delete."""
    msg = await db.messages.find_one({"id": message_id, "thread_id": thread_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    is_sender = msg.get("sender_id") == current_user["id"]
    is_admin = current_user.get("role") in ["Administrator", "Admin"]
    if not is_sender and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")

    await db.messages.delete_one({"id": message_id})
    return {"success": True, "deleted_message_id": message_id}


@router.get("/threads/by-reference/{reference_id}")
async def get_thread_by_reference(
    reference_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the thread linked to a request/order by reference_id."""
    thread = await db.threads.find_one(
        {"reference_id": reference_id, "type": "request"},
        {"_id": 0}
    )
    if not thread:
        return None

    # Auto-add current user to members if not already
    if current_user["id"] not in thread.get("members", []):
        await db.threads.update_one(
            {"id": thread["id"]},
            {"$addToSet": {"members": current_user["id"]}}
        )
        thread["members"].append(current_user["id"])

    return thread


# ============== MESSAGE ENDPOINTS ==============

@router.get("/threads/{thread_id}/messages")
async def list_messages(
    thread_id: str,
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user)
):
    """Get paginated messages for a thread."""
    thread = await db.threads.find_one({"id": thread_id}, {"_id": 0, "members": 1})
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if current_user["id"] not in thread.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this thread")

    messages = await db.messages.find(
        {"thread_id": thread_id}, {"_id": 0}
    ).sort("created_at", 1).skip(offset).limit(limit).to_list(limit)

    # Enrich each message with the sender's current avatar (so photo changes
    # retroactively reflect on old messages — cheaper than storing on write).
    sender_ids = list({m.get("sender_id") for m in messages if m.get("sender_id")})
    avatars = {}
    if sender_ids:
        async for u in db.users.find(
            {"id": {"$in": sender_ids}},
            {"_id": 0, "id": 1, "avatar": 1}
        ):
            avatars[u["id"]] = u.get("avatar") or None
    for m in messages:
        m["sender_avatar"] = avatars.get(m.get("sender_id"))

    # Mark all as read by current user
    unread_ids = [m["id"] for m in messages if current_user["id"] not in (m.get("read_by") or [])]
    if unread_ids:
        await db.messages.update_many(
            {"id": {"$in": unread_ids}},
            {"$addToSet": {"read_by": current_user["id"]}}
        )

    return messages


@router.post("/threads/{thread_id}/messages")
async def send_message(
    thread_id: str,
    body: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Send a message to a thread."""
    body_text = (body.body or "").strip()
    attachment_ids = body.attachment_ids or []
    if not body_text and not attachment_ids:
        raise HTTPException(status_code=400, detail="Message body or attachments required")

    thread = await db.threads.find_one({"id": thread_id}, {"_id": 0, "members": 1, "org_id": 1})
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if current_user["id"] not in thread.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this thread")

    # Resolve attachments into embedded metadata so clients can render
    # without an extra lookup.
    attachments = []
    if attachment_ids:
        async for f in db.files.find(
            {"id": {"$in": attachment_ids}, "uploaded_by_user_id": current_user["id"]},
            {"_id": 0, "id": 1, "original_filename": 1, "label": 1,
             "content_type": 1, "file_size": 1},
        ):
            attachments.append({
                "id": f["id"],
                "filename": f.get("original_filename") or f.get("label") or "file",
                "content_type": f.get("content_type"),
                "file_size": f.get("file_size"),
                "download_url": f"/api/files/{f['id']}/download",
            })

    now = datetime.now(timezone.utc).isoformat()
    message = {
        "id": str(uuid.uuid4()),
        "org_id": thread.get("org_id"),
        "thread_id": thread_id,
        "thread_type": thread.get("type"),
        "sender_id": current_user["id"],
        "sender_name": current_user.get("name") or current_user.get("email"),
        "body": body_text,
        "created_at": now,
        "read_by": [current_user["id"]],
        "attachments": attachments,
        "mentions": body.mentions or [],
        "metadata": body.metadata or {},
    }

    await db.messages.insert_one(message)

    # Include sender avatar in the response so optimistic UI shows photo
    message["sender_avatar"] = current_user.get("avatar") or None

    # Notify mentioned users
    for mentioned_user_id in (body.mentions or []):
        if mentioned_user_id != current_user["id"]:
            try:
                await create_notification(
                    db,
                    user_id=mentioned_user_id,
                    type="mention",
                    title=f"{current_user.get('name')} mentioned you",
                    message=body_text[:120],
                )
            except Exception:
                pass  # non-fatal

    # If the sender is a Media Client, ping their Account Manager so the AM
    # gets an in-app notification + lock-screen push. Skip if the AM is
    # already a thread member (they'll see the message directly) or if the
    # AM was mentioned (already notified above).
    try:
        if current_user.get("account_type") == "Media Client" or current_user.get("role") == "Media Client":
            am_id = current_user.get("account_manager")
            if (
                am_id
                and am_id != current_user["id"]
                and am_id not in (body.mentions or [])
                and am_id not in thread.get("members", [])
            ):
                sender_name = current_user.get("name") or current_user.get("email") or "A client"
                preview_text = body_text[:120] if body_text else f"Sent {len(attachments)} attachment(s)"
                await create_notification(
                    db,
                    user_id=am_id,
                    type="client_message",
                    title=f"New message from {sender_name}",
                    message=preview_text,
                )
                try:
                    await send_push_to_user(
                        user_id=am_id,
                        title=f"{sender_name} sent a message",
                        body=preview_text,
                        url="/conversations",
                        tag=f"client-msg-{current_user['id']}",
                    )
                except Exception:
                    pass  # push is best-effort — in-app notif still lands
    except Exception:
        pass  # AM notification is non-fatal for the message send itself

    # Update thread's last message
    preview = body_text[:80] if body_text else f"📎 {len(attachments)} attachment{'s' if len(attachments) != 1 else ''}"
    await db.threads.update_one(
        {"id": thread_id},
        {"$set": {"last_message_at": now, "last_message_preview": preview}}
    )

    message.pop("_id", None)
    return message


@router.patch("/threads/{thread_id}/messages/{message_id}/read")
async def mark_message_read(
    thread_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a single message as read."""
    await db.messages.update_one(
        {"id": message_id, "thread_id": thread_id},
        {"$addToSet": {"read_by": current_user["id"]}}
    )
    return {"success": True}


@router.get("/unread-count")
async def get_unread_count(
    current_user: dict = Depends(get_current_user)
):
    """Get total unread message count for current user."""
    user_id = current_user["id"]

    # Get threads user is a member of
    thread_ids = await db.threads.distinct("id", {"members": user_id})
    if not thread_ids:
        return {"count": 0}

    count = await db.messages.count_documents({
        "thread_id": {"$in": thread_ids},
        "sender_id": {"$ne": user_id},
        "read_by": {"$nin": [user_id]},
    })

    return {"count": count}
