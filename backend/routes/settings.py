"""Settings routes - UI Settings, Announcements, SMTP Config, Logs"""
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import asyncio
import logging
import os

from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import get_utc_now
from models.settings import (
    UISettingUpdate, UISettingResponse,
    SMTPConfigUpdate, SMTPConfigResponse, EmailTestRequest,
    AnnouncementTickerUpdate, AnnouncementTickerResponse
)

router = APIRouter(tags=["Settings"])


# ============== LOG MODELS ==============

class LogEntry(BaseModel):
    id: str
    timestamp: str
    level: str
    message: str
    source: str
    details: Optional[dict] = None


class LogsResponse(BaseModel):
    logs: List[LogEntry]
    total: int


# ============== UI SETTINGS ROUTES ==============

@router.get("/ui-settings", response_model=List[UISettingResponse])
async def get_ui_settings(category: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all UI settings"""
    query = {}
    if category:
        query["category"] = category
    
    settings = await db.ui_settings.find(query, {"_id": 0}).to_list(1000)
    return [UISettingResponse(**s) for s in settings]


@router.get("/ui-settings/{key}", response_model=UISettingResponse)
async def get_ui_setting(key: str, current_user: dict = Depends(get_current_user)):
    """Get a specific UI setting"""
    setting = await db.ui_settings.find_one({"key": key}, {"_id": 0})
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return UISettingResponse(**setting)


@router.patch("/ui-settings/{key}", response_model=UISettingResponse)
async def update_ui_setting(key: str, data: UISettingUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update a UI setting value"""
    setting = await db.ui_settings.find_one({"key": key}, {"_id": 0})
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    await db.ui_settings.update_one({"key": key}, {"$set": {"value": data.value}})
    
    updated = await db.ui_settings.find_one({"key": key}, {"_id": 0})
    return UISettingResponse(**updated)


@router.post("/ui-settings/bulk-update")
async def bulk_update_ui_settings(settings: dict, current_user: dict = Depends(require_roles(["Admin"]))):
    """Bulk update multiple UI settings"""
    updated_count = 0
    for key, value in settings.items():
        result = await db.ui_settings.update_one({"key": key}, {"$set": {"value": value}})
        if result.modified_count > 0:
            updated_count += 1
    
    return {"message": f"Updated {updated_count} settings"}


@router.post("/ui-settings/reset")
async def reset_ui_settings(current_user: dict = Depends(require_roles(["Admin"]))):
    """Reset all UI settings to defaults"""
    default_settings = get_default_ui_settings()
    
    for setting in default_settings:
        await db.ui_settings.update_one(
            {"key": setting["key"]},
            {"$set": {"value": setting["default_value"]}},
            upsert=True
        )
    
    return {"message": "UI settings reset to defaults"}


def get_default_ui_settings():
    """Return default UI settings"""
    return [
        # Branding
        {"key": "app_name", "value": "Red Ribbon Ops", "default_value": "Red Ribbon Ops", "category": "branding", "description": "Application name shown in header and login"},
        {"key": "app_tagline", "value": "Operations Portal", "default_value": "Operations Portal", "category": "branding", "description": "Tagline shown under app name"},
        {"key": "logo_text", "value": "RR", "default_value": "RR", "category": "branding", "description": "Text shown in logo placeholder"},
        
        # Navigation
        {"key": "nav_dashboard", "value": "Dashboard", "default_value": "Dashboard", "category": "navigation", "description": "Dashboard menu item"},
        {"key": "nav_command_center", "value": "Command Center", "default_value": "Command Center", "category": "navigation", "description": "Command Center menu item"},
        {"key": "nav_orders", "value": "All Orders", "default_value": "All Orders", "category": "navigation", "description": "Orders menu item"},
        {"key": "nav_users", "value": "Users", "default_value": "Users", "category": "navigation", "description": "Users menu item"},
        {"key": "nav_teams", "value": "Teams", "default_value": "Teams", "category": "navigation", "description": "Teams menu item"},
        {"key": "nav_roles", "value": "Roles", "default_value": "Roles", "category": "navigation", "description": "Roles menu item"},
        {"key": "nav_categories", "value": "Categories", "default_value": "Categories", "category": "navigation", "description": "Categories menu item"},
        {"key": "nav_workflows", "value": "Workflows", "default_value": "Workflows", "category": "navigation", "description": "Workflows menu item"},
        
        # Buttons
        {"key": "btn_create_request", "value": "Create New Request", "default_value": "Create New Request", "category": "buttons", "description": "Create request button text"},
        {"key": "btn_submit", "value": "Submit", "default_value": "Submit", "category": "buttons", "description": "Generic submit button"},
        {"key": "btn_save", "value": "Save", "default_value": "Save", "category": "buttons", "description": "Generic save button"},
        {"key": "btn_cancel", "value": "Cancel", "default_value": "Cancel", "category": "buttons", "description": "Generic cancel button"},
        {"key": "btn_login", "value": "Sign In", "default_value": "Sign In", "category": "buttons", "description": "Login button text"},
        
        # Labels
        {"key": "label_email", "value": "Email", "default_value": "Email", "category": "labels", "description": "Email field label"},
        {"key": "label_password", "value": "Password", "default_value": "Password", "category": "labels", "description": "Password field label"},
        {"key": "label_name", "value": "Name", "default_value": "Name", "category": "labels", "description": "Name field label"},
        {"key": "label_role", "value": "Role", "default_value": "Role", "category": "labels", "description": "Role field label"},
        {"key": "label_team", "value": "Team", "default_value": "Team", "category": "labels", "description": "Team field label"},
        
        # Status labels
        {"key": "status_open", "value": "Open", "default_value": "Open", "category": "statuses", "description": "Open status label"},
        {"key": "status_in_progress", "value": "In Progress", "default_value": "In Progress", "category": "statuses", "description": "In Progress status label"},
        {"key": "status_pending", "value": "Pending", "default_value": "Pending", "category": "statuses", "description": "Pending status label"},
        {"key": "status_delivered", "value": "Delivered", "default_value": "Delivered", "category": "statuses", "description": "Delivered status label"},
        
        # Messages
        {"key": "msg_welcome", "value": "Welcome back!", "default_value": "Welcome back!", "category": "messages", "description": "Login success message"},
        {"key": "msg_logout", "value": "Logged out successfully", "default_value": "Logged out successfully", "category": "messages", "description": "Logout message"},
        {"key": "msg_no_data", "value": "No data found", "default_value": "No data found", "category": "messages", "description": "Empty state message"},
    ]


# ============== ANNOUNCEMENT TICKER ROUTES ==============

@router.get("/announcement-ticker", response_model=AnnouncementTickerResponse)
async def get_announcement_ticker(current_user: dict = Depends(get_current_user)):
    """Get current announcement ticker for the logged-in user"""
    ticker = await db.announcement_ticker.find_one({}, {"_id": 0})
    
    # Default inactive ticker response
    default_response = AnnouncementTickerResponse(
        message="",
        is_active=False,
        send_to_all=True,
        target_teams=[],
        target_roles=[],
        target_team_names=[],
        target_role_names=[],
        background_color="#A2182C",
        text_color="#FFFFFF",
        updated_at=get_utc_now(),
        updated_by_name=None
    )
    
    if not ticker:
        return default_response
    
    if not ticker.get("is_active", False):
        return default_response
    
    # Check schedule
    now = datetime.now(timezone.utc)
    if ticker.get("start_at"):
        try:
            start_dt = datetime.fromisoformat(ticker["start_at"].replace('Z', '+00:00'))
            if now < start_dt:
                return default_response
        except (ValueError, TypeError):
            pass
    
    if ticker.get("end_at"):
        try:
            end_dt = datetime.fromisoformat(ticker["end_at"].replace('Z', '+00:00'))
            if now > end_dt:
                return default_response
        except (ValueError, TypeError):
            pass
    
    # Check targeting
    send_to_all = ticker.get("send_to_all", True)
    if not send_to_all:
        target_teams = ticker.get("target_teams", [])
        target_roles = ticker.get("target_roles", [])
        
        user_team_ids = current_user.get("team_ids", [])
        user_role = current_user.get("role", "")
        
        # Get user's role ID from roles collection
        user_role_ids = []
        role_doc = await db.roles.find_one({"name": user_role}, {"_id": 0})
        if role_doc:
            user_role_ids.append(role_doc.get("id", ""))
        
        # OR logic: user matches if in any target team OR has any target role
        team_match = bool(set(user_team_ids) & set(target_teams)) if target_teams else False
        role_match = bool(set(user_role_ids) & set(target_roles)) if target_roles else False
        
        if not team_match and not role_match:
            return default_response
    
    return AnnouncementTickerResponse(**ticker)


@router.get("/announcement-ticker/admin", response_model=AnnouncementTickerResponse)
async def get_announcement_ticker_admin(current_user: dict = Depends(require_roles(["Admin"]))):
    """Get full announcement ticker data for admin editing"""
    ticker = await db.announcement_ticker.find_one({}, {"_id": 0})
    if not ticker:
        return AnnouncementTickerResponse(
            message="",
            is_active=False,
            send_to_all=True,
            target_teams=[],
            target_roles=[],
            target_team_names=[],
            target_role_names=[],
            background_color="#A2182C",
            text_color="#FFFFFF",
            updated_at=get_utc_now(),
            updated_by_name=None
        )
    
    # Resolve team and role names
    target_team_names = []
    for team_id in ticker.get("target_teams", []):
        team = await db.teams.find_one({"id": team_id}, {"_id": 0})
        if team:
            target_team_names.append(team.get("name", "Unknown"))
    
    target_role_names = []
    for role_id in ticker.get("target_roles", []):
        role = await db.roles.find_one({"id": role_id}, {"_id": 0})
        if role:
            target_role_names.append(role.get("name", "Unknown"))
    
    ticker["target_team_names"] = target_team_names
    ticker["target_role_names"] = target_role_names
    
    return AnnouncementTickerResponse(**ticker)


@router.put("/announcement-ticker", response_model=AnnouncementTickerResponse)
async def update_announcement_ticker(ticker_data: AnnouncementTickerUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update announcement ticker (Admin only)"""
    # Validation: If send_to_all is OFF, require at least one team or role
    if not ticker_data.send_to_all:
        if not ticker_data.target_teams and not ticker_data.target_roles:
            raise HTTPException(
                status_code=400, 
                detail="Select at least one team or role, or turn on 'Send to all'"
            )
    
    now = get_utc_now()
    
    existing = await db.announcement_ticker.find_one({}, {"_id": 0})
    
    # Resolve team and role names
    target_team_names = []
    for team_id in ticker_data.target_teams:
        team = await db.teams.find_one({"id": team_id}, {"_id": 0})
        if team:
            target_team_names.append(team.get("name", "Unknown"))
    
    target_role_names = []
    for role_id in ticker_data.target_roles:
        role = await db.roles.find_one({"id": role_id}, {"_id": 0})
        if role:
            target_role_names.append(role.get("name", "Unknown"))
    
    ticker = {
        "id": existing.get("id") if existing else str(uuid.uuid4()),
        "message": ticker_data.message,
        "is_active": ticker_data.is_active,
        "send_to_all": ticker_data.send_to_all,
        "target_teams": ticker_data.target_teams,
        "target_roles": ticker_data.target_roles,
        "target_team_names": target_team_names,
        "target_role_names": target_role_names,
        "start_at": ticker_data.start_at,
        "end_at": ticker_data.end_at,
        "priority": ticker_data.priority,
        "background_color": ticker_data.background_color or "#A2182C",
        "text_color": ticker_data.text_color or "#FFFFFF",
        "updated_at": now,
        "updated_by_id": current_user["id"],
        "updated_by_name": current_user["name"],
        "created_at": existing.get("created_at") if existing else now,
        "created_by_id": existing.get("created_by_id") if existing else current_user["id"],
        "created_by_name": existing.get("created_by_name") if existing else current_user["name"]
    }
    
    await db.announcement_ticker.update_one(
        {},
        {"$set": ticker},
        upsert=True
    )
    
    return AnnouncementTickerResponse(**ticker)


# ============== SMTP CONFIG ROUTES ==============

@router.get("/smtp-config", response_model=SMTPConfigResponse)
async def get_smtp_config(current_user: dict = Depends(require_roles(["Admin"]))):
    """Get current SMTP configuration (password hidden)"""
    config = await db.smtp_config.find_one({}, {"_id": 0})
    if not config:
        return SMTPConfigResponse(
            smtp_host="",
            smtp_port=587,
            smtp_user="",
            smtp_from="",
            smtp_use_tls=True,
            is_configured=False,
            last_test_status=None,
            last_test_at=None
        )
    return SMTPConfigResponse(
        smtp_host=config.get("smtp_host", ""),
        smtp_port=config.get("smtp_port", 587),
        smtp_user=config.get("smtp_user", ""),
        smtp_from=config.get("smtp_from", ""),
        smtp_use_tls=config.get("smtp_use_tls", True),
        is_configured=bool(config.get("smtp_host") and config.get("smtp_user")),
        last_test_status=config.get("last_test_status"),
        last_test_at=config.get("last_test_at")
    )


@router.put("/smtp-config", response_model=SMTPConfigResponse)
async def update_smtp_config(config_data: SMTPConfigUpdate, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update SMTP configuration"""
    config = {
        "smtp_host": config_data.smtp_host,
        "smtp_port": config_data.smtp_port,
        "smtp_user": config_data.smtp_user,
        "smtp_from": config_data.smtp_from,
        "smtp_use_tls": config_data.smtp_use_tls,
        "updated_at": get_utc_now(),
        "updated_by_id": current_user["id"]
    }
    
    # Only update password if provided
    if config_data.smtp_password:
        config["smtp_password"] = config_data.smtp_password
    
    existing = await db.smtp_config.find_one({})
    if existing:
        await db.smtp_config.update_one({}, {"$set": config})
    else:
        await db.smtp_config.insert_one(config)
    
    return SMTPConfigResponse(
        smtp_host=config["smtp_host"],
        smtp_port=config["smtp_port"],
        smtp_user=config["smtp_user"],
        smtp_from=config["smtp_from"],
        smtp_use_tls=config["smtp_use_tls"],
        is_configured=bool(config["smtp_host"] and config["smtp_user"]),
        last_test_status=existing.get("last_test_status") if existing else None,
        last_test_at=existing.get("last_test_at") if existing else None
    )


@router.post("/smtp-config/test")
async def test_smtp_config(test_data: EmailTestRequest, current_user: dict = Depends(require_roles(["Admin"]))):
    """Test SMTP configuration by sending a test email"""
    config = await db.smtp_config.find_one({}, {"_id": 0})
    if not config or not config.get("smtp_host") or not config.get("smtp_user"):
        raise HTTPException(status_code=400, detail="SMTP not configured. Please save configuration first.")
    
    try:
        msg = MIMEMultipart()
        msg['From'] = config.get("smtp_from", config["smtp_user"])
        msg['To'] = test_data.to_email
        msg['Subject'] = "SMTP Configuration Test"
        
        body = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #DC2626;">SMTP Configuration Test</h2>
            <p>This is a test email from Red Ops Portal.</p>
            <p>If you received this email, your SMTP configuration is working correctly!</p>
            <hr>
            <p style="color: #6b7280; font-size: 12px;">
                Sent at: {get_utc_now()}<br>
                Server: {config["smtp_host"]}:{config["smtp_port"]}
            </p>
        </body>
        </html>
        """
        msg.attach(MIMEText(body, 'html'))
        
        with smtplib.SMTP(config["smtp_host"], int(config["smtp_port"])) as server:
            if config.get("smtp_use_tls", True):
                server.starttls()
            server.login(config["smtp_user"], config.get("smtp_password", ""))
            server.send_message(msg)
        
        await db.smtp_config.update_one({}, {"$set": {
            "last_test_status": "success",
            "last_test_at": get_utc_now()
        }})
        
        return {"message": f"Test email sent successfully to {test_data.to_email}", "status": "success"}
        
    except Exception as e:
        await db.smtp_config.update_one({}, {"$set": {
            "last_test_status": f"failed: {str(e)}",
            "last_test_at": get_utc_now()
        }})
        raise HTTPException(status_code=500, detail=f"Failed to send test email: {str(e)}")


# ============== LOGS ROUTES ==============

@router.get("/logs/{log_type}", response_model=LogsResponse)
async def get_logs(log_type: str, limit: int = 500, current_user: dict = Depends(require_roles(["Admin"]))):
    """Get logs by type (system, api, ui, user)."""
    if log_type not in ['system', 'api', 'ui', 'user']:
        raise HTTPException(status_code=400, detail="Invalid log type")
    
    logs = await db.activity_logs.find(
        {"source": log_type},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return LogsResponse(logs=logs, total=len(logs))


@router.post("/logs")
async def create_log(log_data: dict, current_user: dict = Depends(get_current_user)):
    """Create a new log entry"""
    log_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": get_utc_now(),
        "level": log_data.get("level", "info"),
        "message": log_data.get("message", ""),
        "source": log_data.get("source", "system"),
        "details": log_data.get("details"),
        "user_id": current_user["id"],
        "user_name": current_user["name"]
    }
    await db.activity_logs.insert_one(log_entry)
    return {"message": "Log created", "id": log_entry["id"]}


@router.get("/logs/stream/{log_type}")
async def stream_logs(log_type: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Stream logs in real-time using Server-Sent Events"""
    if log_type not in ['system', 'api', 'ui', 'user']:
        raise HTTPException(status_code=400, detail="Invalid log type")
    
    async def event_generator():
        last_log_id = None
        
        while True:
            try:
                query = {"source": log_type}
                if last_log_id:
                    query["id"] = {"$gt": last_log_id}
                
                logs = await db.activity_logs.find(
                    query,
                    {"_id": 0}
                ).sort("timestamp", -1).limit(10).to_list(10)
                
                if logs:
                    last_log_id = logs[0].get("id")
                    import json
                    for log in reversed(logs):
                        yield f"data: {json.dumps(log)}\n\n"
                
                await asyncio.sleep(2)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logging.error(f"SSE error: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                await asyncio.sleep(5)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )
