"""Integration management — connect third-party services."""
import uuid
import os
import httpx
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Literal

from database import db
from utils.auth import get_current_user, require_roles

router = APIRouter(prefix="/integrations", tags=["Integrations"])
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class IntegrationConfig(BaseModel):
    api_key: Optional[str] = None
    webhook_url: Optional[str] = None
    # Nextcloud / WebDAV specific
    url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    # Email SMTP specific
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None      # "Red Ops <no-reply@...>" or just the address
    smtp_use_tls: Optional[bool] = True

class IntegrationConnect(BaseModel):
    provider: str
    auth_type: Literal["api_key", "webhook", "webdav", "smtp"] = "api_key"
    config: IntegrationConfig

# ============== SUPPORTED PROVIDERS ==============

SUPPORTED_PROVIDERS = {
    "openai":        {"name": "OpenAI",        "auth_type": "api_key"},
    "slack_webhook": {"name": "Slack",         "auth_type": "webhook"},
    "stripe":        {"name": "Stripe",        "auth_type": "api_key"},
    "ghl":           {"name": "GoHighLevel",   "auth_type": "api_key"},
    "nextcloud":     {"name": "Nextcloud",     "auth_type": "webdav"},
    "zapier":        {"name": "Zapier",        "auth_type": "webhook"},
    "email_smtp":    {"name": "Email (SMTP)",  "auth_type": "smtp"},
}

def _org_id(user: dict) -> str:
    return user.get("org_id") or user.get("team_id") or user.get("id")

def _mask(key: str) -> str:
    """Mask an API key for safe display."""
    if not key or len(key) < 12:
        return "****"
    return key[:4] + "..." + key[-4:]

# ============== CONNECTION TESTERS ==============

async def _test_openai(config: dict) -> bool:
    try:
        import openai
        client = openai.OpenAI(api_key=config["api_key"])
        client.models.list()
        return True
    except Exception:
        return False

async def _test_slack(config: dict) -> bool:
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(config["webhook_url"], json={"text": "Red Ops connection test ✓"})
            return r.status_code == 200
    except Exception:
        return False

async def _test_stripe(config: dict) -> bool:
    try:
        import stripe
        stripe.api_key = config["api_key"]
        stripe.Customer.list(limit=1)
        return True
    except Exception:
        return False

async def _test_nextcloud(config: dict) -> bool:
    """PROPFIND the user's root — verifies URL + credentials in one request."""
    url = (config.get("url") or "").rstrip("/")
    username = config.get("username") or ""
    password = config.get("password") or ""
    if not url or not username or not password:
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            r = await client.request(
                "PROPFIND",
                f"{url}/remote.php/dav/files/{username}/",
                auth=(username, password),
                headers={"Depth": "0"},
            )
            # 207 Multi-Status = success, 401 = bad credentials, 404 = bad URL
            return r.status_code == 207
    except Exception as e:
        logger.warning(f"Nextcloud test failed: {e}")
        return False

async def _test_email_smtp(config: dict) -> bool:
    """Open an SMTP connection and attempt login — no message sent."""
    import smtplib
    host = config.get("smtp_host")
    port = int(config.get("smtp_port") or 587)
    user = config.get("smtp_user")
    password = config.get("smtp_password")
    use_tls = bool(config.get("smtp_use_tls", True))
    if not host or not user or not password:
        return False
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=10) as s:
                s.login(user, password)
        else:
            with smtplib.SMTP(host, port, timeout=10) as s:
                if use_tls:
                    s.starttls()
                s.login(user, password)
        return True
    except Exception as e:
        logger.warning(f"SMTP test failed: {e}")
        return False


async def test_integration(provider: str, config: dict) -> bool:
    if provider == "openai" and config.get("api_key"):
        return await _test_openai(config)
    if provider == "slack_webhook" and config.get("webhook_url"):
        return await _test_slack(config)
    if provider == "stripe" and config.get("api_key"):
        return await _test_stripe(config)
    if provider == "nextcloud":
        return await _test_nextcloud(config)
    if provider == "email_smtp":
        return await _test_email_smtp(config)
    # For others, accept if non-empty credential provided
    return bool(config.get("api_key") or config.get("webhook_url"))

# ============== ROUTES ==============

@router.get("")
async def list_integrations(current_user: dict = Depends(get_current_user)):
    """List all integrations for the org (secrets masked)."""
    org_id = _org_id(current_user)
    integrations = await db.integrations.find(
        {"org_id": org_id}, {"_id": 0}
    ).to_list(50)

    # Mask secrets before returning
    for i in integrations:
        cfg = i.get("config", {})
        if cfg.get("api_key"):
            cfg["api_key"] = _mask(cfg["api_key"])
        if cfg.get("webhook_url"):
            cfg["webhook_url"] = _mask(cfg["webhook_url"])
        if cfg.get("password"):
            cfg["password"] = _mask(cfg["password"])
        if cfg.get("smtp_password"):
            cfg["smtp_password"] = _mask(cfg["smtp_password"])
    return integrations


@router.get("/{provider}")
async def get_integration(provider: str, current_user: dict = Depends(get_current_user)):
    """Get a single integration (secrets masked)."""
    integration = await db.integrations.find_one(
        {"org_id": _org_id(current_user), "provider": provider}, {"_id": 0}
    )
    if not integration:
        raise HTTPException(status_code=404, detail=f"{provider} not connected")
    cfg = integration.get("config", {})
    if cfg.get("api_key"):
        cfg["api_key"] = _mask(cfg["api_key"])
    if cfg.get("webhook_url"):
        cfg["webhook_url"] = _mask(cfg["webhook_url"])
    if cfg.get("password"):
        cfg["password"] = _mask(cfg["password"])
    return integration


@router.post("/{provider}/connect")
async def connect_integration(
    provider: str,
    data: IntegrationConnect,
    current_user: dict = Depends(require_roles(["Administrator", "Operator"]))
):
    """Connect a new integration or update an existing one."""
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    org_id = _org_id(current_user)
    config = data.config.dict(exclude_none=True)
    now = datetime.now(timezone.utc).isoformat()

    # Test credentials
    valid = await test_integration(provider, config)
    status = "connected" if valid else "error"

    existing = await db.integrations.find_one({"org_id": org_id, "provider": provider})

    if existing:
        await db.integrations.update_one(
            {"org_id": org_id, "provider": provider},
            {"$set": {"config": config, "status": status, "last_tested": now, "connected_by": current_user["id"]}}
        )
    else:
        await db.integrations.insert_one({
            "id": str(uuid.uuid4()),
            "provider": provider,
            "auth_type": data.auth_type,
            "config": config,
            "status": status,
            "connected_by": current_user["id"],
            "connected_at": now,
            "last_tested": now,
            "org_id": org_id,
        })

    return {"provider": provider, "status": status, "message": f"{SUPPORTED_PROVIDERS[provider]['name']} {'connected' if valid else 'failed to connect — check credentials'}"}


@router.delete("/{provider}")
async def disconnect_integration(
    provider: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Disconnect an integration."""
    result = await db.integrations.delete_one(
        {"org_id": _org_id(current_user), "provider": provider}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"{provider} not connected")
    return {"message": f"{provider} disconnected"}


@router.post("/{provider}/test")
async def test_integration_endpoint(
    provider: str,
    current_user: dict = Depends(get_current_user)
):
    """Test if an integration's credentials are still valid."""
    integration = await db.integrations.find_one(
        {"org_id": _org_id(current_user), "provider": provider}
    )
    if not integration:
        raise HTTPException(status_code=404, detail=f"{provider} not connected")

    valid = await test_integration(provider, integration["config"])
    now = datetime.now(timezone.utc).isoformat()

    await db.integrations.update_one(
        {"id": integration["id"]},
        {"$set": {"last_tested": now, "status": "connected" if valid else "error"}}
    )

    return {"provider": provider, "status": "connected" if valid else "error", "tested_at": now}
