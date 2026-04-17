"""
Google Drive sync — per-user OAuth connection, pulls files so they
appear alongside RED OPS files in the Drive page.

Reuses the calendar_connections pattern but with scope drive.readonly
and a separate provider key 'gdrive' so a user can connect Calendar
and Drive independently.

Required env vars (backend):
  GOOGLE_OAUTH_CLIENT_ID
  GOOGLE_OAUTH_CLIENT_SECRET
  GDRIVE_OAUTH_REDIRECT_URI   (e.g. https://api.redops.../api/drive-sync/google/callback)

If vars are missing, /auth returns 503 with a clear message. The rest
of the data path still works for inspection.
"""
import os
import uuid
import logging
import secrets
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import httpx
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user
from utils.tenancy import resolve_org_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/drive-sync", tags=["Drive Sync"])

PROVIDER = "gdrive"  # kept distinct from calendar's 'google'


# ============== MODELS ==============

class DriveConnectionInfo(BaseModel):
    provider: str
    connected: bool
    email: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    file_count: Optional[int] = None


class ExternalFile(BaseModel):
    id: str
    provider: str
    name: str
    mime_type: Optional[str] = None
    size: Optional[int] = None
    web_view_link: Optional[str] = None
    icon_link: Optional[str] = None
    modified_time: Optional[datetime] = None


# ============== HELPERS ==============

def _org_id(user: dict) -> str:
    return resolve_org_id(user)


def _oauth_config() -> dict:
    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    redirect_uri = os.environ.get("GDRIVE_OAUTH_REDIRECT_URI")
    if not all([client_id, client_secret, redirect_uri]):
        raise HTTPException(
            status_code=503,
            detail="Google Drive OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID, "
                   "GOOGLE_OAUTH_CLIENT_SECRET, GDRIVE_OAUTH_REDIRECT_URI on the backend.",
        )
    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scope": "openid email https://www.googleapis.com/auth/drive.readonly",
    }


async def _save_connection(user_id: str, org_id: str, token_data: dict, account_email: Optional[str]) -> None:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=int(token_data.get("expires_in", 3600)))
    await db.drive_connections.update_one(
        {"user_id": user_id, "provider": PROVIDER},
        {
            "$set": {
                "user_id": user_id,
                "org_id": org_id,
                "provider": PROVIDER,
                "access_token": token_data.get("access_token"),
                "refresh_token": token_data.get("refresh_token"),
                "expires_at": expires_at,
                "account_email": account_email,
                "scope": token_data.get("scope"),
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )


async def _valid_access_token(connection: dict) -> str:
    expires_at = connection.get("expires_at")
    if expires_at:
        ea = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
        if ea > datetime.now(timezone.utc) + timedelta(seconds=60):
            return connection["access_token"]
    refresh = connection.get("refresh_token")
    if not refresh:
        raise HTTPException(status_code=401, detail="Google Drive token expired — reconnect from Settings")
    cfg = _oauth_config()
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(cfg["token_url"], data={
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "refresh_token": refresh,
            "grant_type": "refresh_token",
        })
        if r.status_code >= 400:
            raise HTTPException(status_code=401, detail="Google Drive re-auth required")
        new_token = r.json()
    if not new_token.get("refresh_token"):
        new_token["refresh_token"] = refresh
    await _save_connection(connection["user_id"], connection["org_id"], new_token, connection.get("account_email"))
    return new_token["access_token"]


# ============== ROUTES ==============

@router.get("/connections", response_model=List[DriveConnectionInfo])
async def list_connections(current_user: dict = Depends(get_current_user)):
    """Return the current user's Google Drive connection state."""
    c = await db.drive_connections.find_one({"user_id": current_user["id"], "provider": PROVIDER})
    if not c:
        return [DriveConnectionInfo(provider=PROVIDER, connected=False)]
    file_count = await db.external_files.count_documents({"user_id": current_user["id"], "provider": PROVIDER})
    return [DriveConnectionInfo(
        provider=PROVIDER,
        connected=True,
        email=c.get("account_email"),
        last_synced_at=c.get("last_synced_at"),
        file_count=file_count,
    )]


@router.get("/google/auth")
async def begin_oauth(current_user: dict = Depends(get_current_user)):
    """Build the Google Drive OAuth URL."""
    cfg = _oauth_config()
    nonce = secrets.token_urlsafe(16)
    state = f"{current_user['id']}:{nonce}"
    await db.drive_oauth_states.insert_one({
        "state": state,
        "user_id": current_user["id"],
        "created_at": datetime.now(timezone.utc),
    })
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": cfg["redirect_uri"],
        "response_type": "code",
        "scope": cfg["scope"],
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    return {"auth_url": f"{cfg['auth_url']}?{urllib.parse.urlencode(params)}"}


@router.get("/google/callback")
async def oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
):
    frontend = os.environ.get("FRONTEND_URL", "/")
    if error:
        return RedirectResponse(f"{frontend}/settings?drive_error={urllib.parse.quote(error)}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    state_doc = await db.drive_oauth_states.find_one({"state": state})
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired state")
    await db.drive_oauth_states.delete_one({"state": state})

    user = await db.users.find_one({"id": state_doc["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    cfg = _oauth_config()
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(cfg["token_url"], data={
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "code": code,
            "redirect_uri": cfg["redirect_uri"],
            "grant_type": "authorization_code",
        })
        if r.status_code >= 400:
            logger.warning(f"Drive token exchange failed: {r.status_code} {r.text[:200]}")
            return RedirectResponse(f"{frontend}/settings?drive_error=token_exchange_failed")
        token_data = r.json()

        # Fetch account email
        email = None
        er = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        if er.status_code == 200:
            email = er.json().get("email")

    await _save_connection(user["id"], _org_id(user), token_data, email)
    return RedirectResponse(f"{frontend}/drive?drive_connected=1")


@router.delete("")
async def disconnect(current_user: dict = Depends(get_current_user)):
    """Disconnect Google Drive. Cached external_files rows are also removed."""
    res = await db.drive_connections.delete_one({"user_id": current_user["id"], "provider": PROVIDER})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not connected")
    await db.external_files.delete_many({"user_id": current_user["id"], "provider": PROVIDER})
    return {"ok": True}


@router.post("/google/sync")
async def sync_drive(current_user: dict = Depends(get_current_user)):
    """Fetch the user's recently-modified Google Drive files and cache them
    in the external_files collection so the Drive page can render them."""
    connection = await db.drive_connections.find_one({"user_id": current_user["id"], "provider": PROVIDER})
    if not connection:
        raise HTTPException(status_code=404, detail="Not connected")
    access_token = await _valid_access_token(connection)

    files = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            headers={"Authorization": f"Bearer {access_token}"},
            params={
                "pageSize": 200,
                "orderBy": "modifiedTime desc",
                "q": "trashed = false",
                "fields": "files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)",
            },
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Google Drive API error: {r.text[:200]}")
        files = r.json().get("files", [])

    # Wipe and rewrite this user's cache (simpler than diffing)
    await db.external_files.delete_many({"user_id": current_user["id"], "provider": PROVIDER})
    now = datetime.now(timezone.utc)
    if files:
        docs = []
        for f in files:
            mt = f.get("modifiedTime")
            modified = None
            if mt:
                try:
                    modified = datetime.fromisoformat(mt.replace("Z", "+00:00"))
                except ValueError:
                    pass
            docs.append({
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "org_id": _org_id(current_user),
                "provider": PROVIDER,
                "external_id": f.get("id"),
                "name": f.get("name") or "(untitled)",
                "mime_type": f.get("mimeType"),
                "size": int(f["size"]) if f.get("size") and str(f["size"]).isdigit() else None,
                "web_view_link": f.get("webViewLink"),
                "icon_link": f.get("iconLink"),
                "modified_time": modified,
                "synced_at": now,
            })
        await db.external_files.insert_many(docs)

    await db.drive_connections.update_one(
        {"user_id": current_user["id"], "provider": PROVIDER},
        {"$set": {"last_synced_at": now}},
    )
    return {"ok": True, "synced": len(files)}


@router.get("/files", response_model=List[ExternalFile])
async def list_external_files(current_user: dict = Depends(get_current_user)):
    """Return the current user's cached external Drive files (for the
    Drive page to merge with internal files)."""
    cursor = db.external_files.find(
        {"user_id": current_user["id"], "provider": PROVIDER},
        {"_id": 0}
    ).sort("modified_time", -1).limit(500)
    return [ExternalFile(
        id=d["external_id"],
        provider=PROVIDER,
        name=d.get("name"),
        mime_type=d.get("mime_type"),
        size=d.get("size"),
        web_view_link=d.get("web_view_link"),
        icon_link=d.get("icon_link"),
        modified_time=d.get("modified_time"),
    ) async for d in cursor]
