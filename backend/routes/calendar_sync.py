"""
Calendar sync — per-user OAuth connections to Google Calendar and Outlook
(Microsoft Graph), with stored tokens and a manual pull-sync endpoint.

OAuth secrets are read from env vars at request time. If the secrets
aren't configured, the connect endpoint returns a 503 with a clear
message — the rest of the routes still work for testing the data path.

Required env vars (set on the backend Railway service):
  Google:
    GOOGLE_OAUTH_CLIENT_ID
    GOOGLE_OAUTH_CLIENT_SECRET
    GOOGLE_OAUTH_REDIRECT_URI   (e.g. https://api.redops.../api/calendar-sync/google/callback)
  Microsoft (Outlook):
    MS_OAUTH_CLIENT_ID
    MS_OAUTH_CLIENT_SECRET
    MS_OAUTH_REDIRECT_URI       (e.g. https://api.redops.../api/calendar-sync/outlook/callback)
    MS_OAUTH_TENANT             (default: "common" — supports both work and personal accounts)

Synced events land in the existing calendar_events collection with
source='google' or 'outlook' and external_id set, so the Calendar
page renders them on the same grid as internal events.
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
from utils.auth import get_current_user, require_roles

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar-sync", tags=["Calendar Sync"])


# ============== MODELS ==============

class ConnectionInfo(BaseModel):
    provider: str           # 'google' | 'outlook'
    connected: bool
    email: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    event_count: Optional[int] = None


class TeamMemberConnections(BaseModel):
    user_id: str
    name: str
    email: Optional[str] = None
    google: bool
    outlook: bool
    last_synced_at: Optional[datetime] = None


# ============== HELPERS ==============

def _org_id(user: dict) -> str:
    return user.get("org_id") or user.get("team_id") or user.get("id")


def _provider_config(provider: str) -> dict:
    """Read provider-specific OAuth config from env. Raises 503 if missing."""
    if provider == "google":
        client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
        client_secret = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
        redirect_uri = os.environ.get("GOOGLE_OAUTH_REDIRECT_URI")
        if not all([client_id, client_secret, redirect_uri]):
            raise HTTPException(
                status_code=503,
                detail="Google Calendar OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID, "
                       "GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI on the backend.",
            )
        return {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
            "token_url": "https://oauth2.googleapis.com/token",
            "scope": "openid email https://www.googleapis.com/auth/calendar.readonly",
        }
    if provider == "outlook":
        client_id = os.environ.get("MS_OAUTH_CLIENT_ID")
        client_secret = os.environ.get("MS_OAUTH_CLIENT_SECRET")
        redirect_uri = os.environ.get("MS_OAUTH_REDIRECT_URI")
        tenant = os.environ.get("MS_OAUTH_TENANT", "common")
        if not all([client_id, client_secret, redirect_uri]):
            raise HTTPException(
                status_code=503,
                detail="Outlook OAuth not configured. Set MS_OAUTH_CLIENT_ID, "
                       "MS_OAUTH_CLIENT_SECRET, MS_OAUTH_REDIRECT_URI on the backend.",
            )
        return {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "auth_url": f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
            "token_url": f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
            "scope": "openid email offline_access Calendars.Read",
        }
    raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")


async def _save_connection(user_id: str, org_id: str, provider: str, token_data: dict, account_email: Optional[str]) -> None:
    """Store or update the user's OAuth tokens for a provider."""
    now = datetime.now(timezone.utc)
    expires_at = None
    if "expires_in" in token_data:
        expires_at = now + timedelta(seconds=int(token_data["expires_in"]))

    await db.calendar_connections.update_one(
        {"user_id": user_id, "provider": provider},
        {
            "$set": {
                "user_id": user_id,
                "org_id": org_id,
                "provider": provider,
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


async def _refresh_token_if_needed(connection: dict, provider: str) -> str:
    """Return a valid access_token, refreshing if expired."""
    expires_at = connection.get("expires_at")
    access_token = connection.get("access_token")

    # If we have time on the clock, reuse
    if expires_at:
        # Mongo returns datetime; ensure tz-aware compare
        ea = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
        if ea > datetime.now(timezone.utc) + timedelta(seconds=60):
            return access_token

    refresh = connection.get("refresh_token")
    if not refresh:
        # Token expired and no refresh — caller must reconnect
        raise HTTPException(status_code=401, detail=f"{provider} token expired — reconnect from Settings")

    cfg = _provider_config(provider)
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            cfg["token_url"],
            data={
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "refresh_token": refresh,
                "grant_type": "refresh_token",
            },
        )
        if r.status_code >= 400:
            logger.warning(f"Refresh failed for {provider}: {r.status_code} {r.text[:200]}")
            raise HTTPException(status_code=401, detail=f"{provider} re-auth required — reconnect from Settings")
        new_token = r.json()

    # Save updated tokens (refresh_token may not always rotate; preserve old one if missing)
    if not new_token.get("refresh_token"):
        new_token["refresh_token"] = refresh

    await _save_connection(connection["user_id"], connection["org_id"], provider, new_token, connection.get("account_email"))
    return new_token["access_token"]


# ============== ROUTES — CONNECTIONS LIST / DISCONNECT ==============

@router.get("/connections", response_model=List[ConnectionInfo])
async def list_my_connections(current_user: dict = Depends(get_current_user)):
    """Return the current user's calendar connections (one entry per provider)."""
    cursor = db.calendar_connections.find({"user_id": current_user["id"]})
    found = {c["provider"]: c async for c in cursor}

    out: List[ConnectionInfo] = []
    for provider in ("google", "outlook"):
        c = found.get(provider)
        if c:
            ev_count = await db.calendar_events.count_documents({
                "org_id": c["org_id"],
                "source": provider,
                "external_id": {"$ne": None},
            })
            out.append(ConnectionInfo(
                provider=provider,
                connected=True,
                email=c.get("account_email"),
                last_synced_at=c.get("last_synced_at"),
                event_count=ev_count,
            ))
        else:
            out.append(ConnectionInfo(provider=provider, connected=False))
    return out


@router.delete("/{provider}")
async def disconnect_provider(provider: str, current_user: dict = Depends(get_current_user)):
    """Remove the user's connection for a provider. Synced events stay in the
    calendar (read-only) until the next sync from another source. Pass
    ?purge_events=true to also remove the events."""
    if provider not in ("google", "outlook"):
        raise HTTPException(status_code=400, detail="Unknown provider")
    res = await db.calendar_connections.delete_one({"user_id": current_user["id"], "provider": provider})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not connected")
    return {"ok": True}


# ============== ROUTES — OAUTH BEGIN / CALLBACK ==============

@router.get("/{provider}/auth")
async def begin_oauth(provider: str, current_user: dict = Depends(get_current_user)):
    """Build the provider's OAuth URL and redirect the browser to it.
    The state token carries enough info to re-identify the user on callback."""
    cfg = _provider_config(provider)

    # State = user_id:nonce, stored briefly for verification
    nonce = secrets.token_urlsafe(16)
    state = f"{current_user['id']}:{nonce}"
    await db.calendar_oauth_states.insert_one({
        "state": state,
        "user_id": current_user["id"],
        "provider": provider,
        "created_at": datetime.now(timezone.utc),
    })

    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": cfg["redirect_uri"],
        "response_type": "code",
        "scope": cfg["scope"],
        "state": state,
        "access_type": "offline",   # Google — get a refresh_token
        "prompt": "consent",        # Force refresh_token issuance
    }
    auth_url = f"{cfg['auth_url']}?{urllib.parse.urlencode(params)}"
    return {"auth_url": auth_url}


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
):
    """Provider sends the user here after consent. We exchange the code for
    tokens, stash them, then redirect the user back to /settings."""
    frontend = os.environ.get("FRONTEND_URL", "/")
    if error:
        return RedirectResponse(f"{frontend}/settings?calendar_error={urllib.parse.quote(error)}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    state_doc = await db.calendar_oauth_states.find_one({"state": state})
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired state")
    await db.calendar_oauth_states.delete_one({"state": state})

    user = await db.users.find_one({"id": state_doc["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    cfg = _provider_config(provider)
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            cfg["token_url"],
            data={
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "code": code,
                "redirect_uri": cfg["redirect_uri"],
                "grant_type": "authorization_code",
            },
        )
        if r.status_code >= 400:
            logger.warning(f"OAuth token exchange failed: {r.status_code} {r.text[:200]}")
            return RedirectResponse(f"{frontend}/settings?calendar_error=token_exchange_failed")
        token_data = r.json()

    # Pull the user's email from the provider so we can show "Connected as foo@bar.com"
    account_email = await _fetch_account_email(provider, token_data["access_token"])

    org = _org_id(user)
    await _save_connection(user["id"], org, provider, token_data, account_email)
    return RedirectResponse(f"{frontend}/settings?calendar_connected={provider}")


async def _fetch_account_email(provider: str, access_token: str) -> Optional[str]:
    """Best-effort lookup of the connected account's email."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if provider == "google":
                r = await client.get(
                    "https://openidconnect.googleapis.com/v1/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if r.status_code == 200:
                    return r.json().get("email")
            elif provider == "outlook":
                r = await client.get(
                    "https://graph.microsoft.com/v1.0/me",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if r.status_code == 200:
                    return r.json().get("mail") or r.json().get("userPrincipalName")
    except Exception:
        pass
    return None


# ============== ROUTES — SYNC EVENTS ==============

@router.post("/{provider}/sync")
async def sync_provider(provider: str, current_user: dict = Depends(get_current_user)):
    """Pull events for the next 90 days from the connected provider and upsert
    them into the calendar_events collection so the Calendar page renders them."""
    if provider not in ("google", "outlook"):
        raise HTTPException(status_code=400, detail="Unknown provider")

    connection = await db.calendar_connections.find_one({"user_id": current_user["id"], "provider": provider})
    if not connection:
        raise HTTPException(status_code=404, detail="Not connected")

    access_token = await _refresh_token_if_needed(connection, provider)

    now = datetime.now(timezone.utc)
    window_start = (now - timedelta(days=7)).isoformat()
    window_end = (now + timedelta(days=90)).isoformat()

    events = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        if provider == "google":
            r = await client.get(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "timeMin": window_start,
                    "timeMax": window_end,
                    "singleEvents": "true",
                    "orderBy": "startTime",
                    "maxResults": 250,
                },
            )
            if r.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"Google API error: {r.text[:200]}")
            for e in r.json().get("items", []):
                events.append(_normalize_google(e))
        else:  # outlook
            r = await client.get(
                "https://graph.microsoft.com/v1.0/me/calendarview",
                headers={"Authorization": f"Bearer {access_token}", "Prefer": 'outlook.timezone="UTC"'},
                params={
                    "startDateTime": window_start,
                    "endDateTime": window_end,
                    "$top": 250,
                    "$orderby": "start/dateTime",
                },
            )
            if r.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"Microsoft Graph error: {r.text[:200]}")
            for e in r.json().get("value", []):
                events.append(_normalize_outlook(e))

    # Upsert into calendar_events keyed on (provider, external_id)
    upserted = 0
    org_id = connection["org_id"]
    for ev in events:
        if not ev.get("external_id"):
            continue
        await db.calendar_events.update_one(
            {"org_id": org_id, "source": provider, "external_id": ev["external_id"]},
            {
                "$set": {
                    "title": ev["title"],
                    "description": ev.get("description"),
                    "starts_at": ev["starts_at"],
                    "ends_at": ev.get("ends_at"),
                    "all_day": ev.get("all_day", False),
                    "color": None,
                    "location": ev.get("location"),
                    "source": provider,
                    "external_id": ev["external_id"],
                    "updated_at": datetime.now(timezone.utc),
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "org_id": org_id,
                    "created_by_user_id": current_user["id"],
                    "created_at": datetime.now(timezone.utc),
                },
            },
            upsert=True,
        )
        upserted += 1

    await db.calendar_connections.update_one(
        {"user_id": current_user["id"], "provider": provider},
        {"$set": {"last_synced_at": datetime.now(timezone.utc)}},
    )

    return {"ok": True, "synced": upserted, "provider": provider}


def _normalize_google(e: dict) -> dict:
    start = e.get("start", {})
    end = e.get("end", {})
    all_day = "date" in start and "dateTime" not in start
    if all_day:
        starts_at = datetime.fromisoformat(start["date"] + "T00:00:00+00:00")
        ends_at = datetime.fromisoformat(end["date"] + "T00:00:00+00:00") if end.get("date") else None
    else:
        starts_at = datetime.fromisoformat(start.get("dateTime", "").replace("Z", "+00:00")) if start.get("dateTime") else None
        ends_at = datetime.fromisoformat(end.get("dateTime", "").replace("Z", "+00:00")) if end.get("dateTime") else None
    return {
        "external_id": e.get("id"),
        "title": e.get("summary") or "(No title)",
        "description": e.get("description"),
        "starts_at": starts_at,
        "ends_at": ends_at,
        "all_day": all_day,
        "location": e.get("location"),
    }


def _normalize_outlook(e: dict) -> dict:
    all_day = bool(e.get("isAllDay"))
    s = (e.get("start") or {}).get("dateTime")
    en = (e.get("end") or {}).get("dateTime")
    starts_at = datetime.fromisoformat(s) if s else None
    if starts_at and starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=timezone.utc)
    ends_at = datetime.fromisoformat(en) if en else None
    if ends_at and ends_at.tzinfo is None:
        ends_at = ends_at.replace(tzinfo=timezone.utc)
    return {
        "external_id": e.get("id"),
        "title": e.get("subject") or "(No title)",
        "description": (e.get("bodyPreview") or None),
        "starts_at": starts_at,
        "ends_at": ends_at,
        "all_day": all_day,
        "location": ((e.get("location") or {}).get("displayName") or None),
    }


# ============== ROUTES — ADMIN VIEW ==============

@router.get("/admin/team", response_model=List[TeamMemberConnections])
async def admin_team_connections(current_user: dict = Depends(require_roles(["Administrator"]))):
    """Admin-only — show every active internal user's calendar connection state."""
    org_id = _org_id(current_user)

    # Fetch internal users in the org
    users = await db.users.find(
        {
            "$or": [{"org_id": org_id}, {"team_id": org_id}, {"id": org_id}],
            "active": {"$ne": False},
            "account_type": {"$ne": "Media Client"},
            "role": {"$ne": "Media Client"},
        },
        {"_id": 0, "id": 1, "name": 1, "full_name": 1, "email": 1},
    ).to_list(500)

    user_ids = [u["id"] for u in users]
    conns = await db.calendar_connections.find({"user_id": {"$in": user_ids}}).to_list(2000)

    by_user: dict = {}
    for c in conns:
        by_user.setdefault(c["user_id"], {})[c["provider"]] = c

    out = []
    for u in users:
        c = by_user.get(u["id"], {})
        last = None
        for prov in ("google", "outlook"):
            t = (c.get(prov) or {}).get("last_synced_at")
            if t and (not last or t > last):
                last = t
        out.append(TeamMemberConnections(
            user_id=u["id"],
            name=u.get("full_name") or u.get("name") or u.get("email", ""),
            email=u.get("email"),
            google=bool(c.get("google")),
            outlook=bool(c.get("outlook")),
            last_synced_at=last,
        ))
    # Connected users first
    out.sort(key=lambda r: (-(int(r.google) + int(r.outlook)), r.name.lower()))
    return out
