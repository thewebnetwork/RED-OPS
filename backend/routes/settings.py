"""Settings routes - UI Settings, Announcements, SMTP Config, Logs"""
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
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
        target_specialties = ticker.get("target_specialties", [])
        
        user_team_ids = current_user.get("team_ids", [])
        user_role = current_user.get("role", "")
        user_specialty_id = current_user.get("specialty_id", "")
        
        # Get user's role ID from roles collection
        user_role_ids = []
        role_doc = await db.roles.find_one({"name": user_role}, {"_id": 0})
        if role_doc:
            user_role_ids.append(role_doc.get("id", ""))
        
        # OR logic: user matches if in any target team OR has any target role OR has any target specialty
        team_match = bool(set(user_team_ids) & set(target_teams)) if target_teams else False
        role_match = bool(set(user_role_ids) & set(target_roles)) if target_roles else False
        specialty_match = user_specialty_id in target_specialties if target_specialties else False
        
        if not team_match and not role_match and not specialty_match:
            return default_response
    
    return AnnouncementTickerResponse(**ticker)


@router.get("/announcement-ticker/admin", response_model=AnnouncementTickerResponse)
async def get_announcement_ticker_admin(current_user: dict = Depends(require_roles(["Administrator"]))):
    """Get full announcement ticker data for admin editing"""
    ticker = await db.announcement_ticker.find_one({}, {"_id": 0})
    if not ticker:
        return AnnouncementTickerResponse(
            message="",
            is_active=False,
            send_to_all=True,
            target_teams=[],
            target_roles=[],
            target_specialties=[],
            target_team_names=[],
            target_role_names=[],
            target_specialty_names=[],
            background_color="#A2182C",
            text_color="#FFFFFF",
            updated_at=get_utc_now(),
            updated_by_name=None
        )
    
    # Resolve team, role, and specialty names
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
    
    target_specialty_names = []
    for specialty_id in ticker.get("target_specialties", []):
        specialty = await db.specialties.find_one({"id": specialty_id}, {"_id": 0})
        if specialty:
            target_specialty_names.append(specialty.get("name", "Unknown"))
    
    ticker["target_team_names"] = target_team_names
    ticker["target_role_names"] = target_role_names
    ticker["target_specialties"] = ticker.get("target_specialties", [])
    ticker["target_specialty_names"] = target_specialty_names
    
    return AnnouncementTickerResponse(**ticker)


@router.put("/announcement-ticker", response_model=AnnouncementTickerResponse)
async def update_announcement_ticker(ticker_data: AnnouncementTickerUpdate, current_user: dict = Depends(require_roles(["Administrator"]))):
    """Update announcement ticker (Admin only)"""
    # Validation: If send_to_all is OFF, require at least one team, role, or specialty
    if not ticker_data.send_to_all:
        has_targets = (ticker_data.target_teams or ticker_data.target_roles or ticker_data.target_specialties)
        if not has_targets:
            raise HTTPException(
                status_code=400, 
                detail="Select at least one role, team, or specialty, or turn on 'Send to all'"
            )
    
    now = get_utc_now()
    
    existing = await db.announcement_ticker.find_one({}, {"_id": 0})
    
    # Resolve team, role, and specialty names
    target_team_names = []
    for team_id in (ticker_data.target_teams or []):
        team = await db.teams.find_one({"id": team_id}, {"_id": 0})
        if team:
            target_team_names.append(team.get("name", "Unknown"))
    
    target_role_names = []
    for role_id in (ticker_data.target_roles or []):
        role = await db.roles.find_one({"id": role_id}, {"_id": 0})
        if role:
            target_role_names.append(role.get("name", "Unknown"))
    
    target_specialty_names = []
    for specialty_id in (ticker_data.target_specialties or []):
        specialty = await db.specialties.find_one({"id": specialty_id}, {"_id": 0})
        if specialty:
            target_specialty_names.append(specialty.get("name", "Unknown"))
    
    ticker = {
        "id": existing.get("id") if existing else str(uuid.uuid4()),
        "message": ticker_data.message,
        "is_active": ticker_data.is_active,
        "send_to_all": ticker_data.send_to_all,
        "target_teams": ticker_data.target_teams or [],
        "target_roles": ticker_data.target_roles or [],
        "target_specialties": ticker_data.target_specialties or [],
        "target_team_names": target_team_names,
        "target_role_names": target_role_names,
        "target_specialty_names": target_specialty_names,
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


# ============== ANNOUNCEMENTS (MULTIPLE) ROUTES ==============

class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)
    is_active: bool = True
    send_to_all: bool = True
    target_teams: Optional[List[str]] = []
    target_roles: Optional[List[str]] = []
    target_specialties: Optional[List[str]] = []
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    priority: int = 1  # Higher priority = shown first
    background_color: str = "#A2182C"
    text_color: str = "#FFFFFF"


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    is_active: Optional[bool] = None
    send_to_all: Optional[bool] = None
    target_teams: Optional[List[str]] = None
    target_roles: Optional[List[str]] = None
    target_specialties: Optional[List[str]] = None
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    priority: Optional[int] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None


class AnnouncementResponse(BaseModel):
    id: str
    title: str
    message: str
    is_active: bool
    send_to_all: bool
    target_teams: List[str] = []
    target_roles: List[str] = []
    target_specialties: List[str] = []
    target_team_names: List[str] = []
    target_role_names: List[str] = []
    target_specialty_names: List[str] = []
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    priority: int = 1
    background_color: str = "#A2182C"
    text_color: str = "#FFFFFF"
    created_at: str
    created_by_name: Optional[str] = None
    updated_at: str
    updated_by_name: Optional[str] = None


@router.get("/announcements", response_model=List[AnnouncementResponse])
async def list_announcements(
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """List all announcements (Admin only) - expired announcements retained for 24 hours"""
    now = datetime.now(timezone.utc)
    twenty_four_hours_ago = now - timedelta(hours=24)
    
    # Filter: show active announcements OR expired within last 24 hours
    all_announcements = await db.announcements.find({}, {"_id": 0}).sort("priority", -1).to_list(100)
    
    result = []
    for ann in all_announcements:
        # Check if expired more than 24 hours ago
        if ann.get("end_at"):
            try:
                end_dt = datetime.fromisoformat(ann["end_at"].replace('Z', '+00:00'))
                if end_dt < twenty_four_hours_ago:
                    # Expired more than 24 hours ago - auto-delete from DB
                    await db.announcements.delete_one({"id": ann["id"]})
                    continue
            except (ValueError, TypeError):
                pass
        
        # Resolve target names
        target_team_names = []
        for team_id in ann.get("target_teams", []):
            team = await db.teams.find_one({"id": team_id}, {"_id": 0, "name": 1})
            if team:
                target_team_names.append(team["name"])
        
        target_role_names = []
        for role_id in ann.get("target_roles", []):
            role = await db.roles.find_one({"id": role_id}, {"_id": 0, "name": 1})
            if role:
                target_role_names.append(role["name"])
        
        target_specialty_names = []
        for spec_id in ann.get("target_specialties", []):
            spec = await db.specialties.find_one({"id": spec_id}, {"_id": 0, "name": 1})
            if spec:
                target_specialty_names.append(spec["name"])
        
        ann["target_team_names"] = target_team_names
        ann["target_role_names"] = target_role_names
        ann["target_specialty_names"] = target_specialty_names
        result.append(AnnouncementResponse(**ann))
    
    return result


@router.get("/announcements/active", response_model=Optional[AnnouncementResponse])
async def get_active_announcement(current_user: dict = Depends(get_current_user)):
    """Get the highest priority active announcement for the current user"""
    all_active = await get_all_active_announcements_for_user(current_user)
    return all_active[0] if all_active else None


@router.get("/announcements/active/all", response_model=List[AnnouncementResponse])
async def get_all_active_announcements(current_user: dict = Depends(get_current_user)):
    """Get ALL active announcements for the current user, sorted by priority (highest first)"""
    return await get_all_active_announcements_for_user(current_user)


async def get_all_active_announcements_for_user(current_user: dict) -> List[AnnouncementResponse]:
    """Helper function to get all active announcements matching the user's targeting criteria"""
    now = datetime.now(timezone.utc)
    
    # Get all active announcements, sorted by priority (highest first)
    announcements = await db.announcements.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("priority", -1).to_list(100)
    
    # Get user's role ID once
    user_role_ids = []
    role_doc = await db.roles.find_one({"name": current_user.get("role", "")}, {"_id": 0, "id": 1})
    if role_doc:
        user_role_ids.append(role_doc.get("id", ""))
    
    result = []
    for ann in announcements:
        # Check schedule
        if ann.get("start_at"):
            try:
                start_dt = datetime.fromisoformat(ann["start_at"].replace('Z', '+00:00'))
                if now < start_dt:
                    continue
            except (ValueError, TypeError):
                pass
        
        if ann.get("end_at"):
            try:
                end_dt = datetime.fromisoformat(ann["end_at"].replace('Z', '+00:00'))
                if now > end_dt:
                    continue
            except (ValueError, TypeError):
                pass
        
        # Check targeting
        if not ann.get("send_to_all", True):
            target_teams = ann.get("target_teams", [])
            target_roles = ann.get("target_roles", [])
            target_specialties = ann.get("target_specialties", [])
            
            user_team_id = current_user.get("team_id", "")
            user_specialty_id = current_user.get("specialty_id", "")
            
            team_match = user_team_id in target_teams if target_teams else False
            role_match = bool(set(user_role_ids) & set(target_roles)) if target_roles else False
            specialty_match = user_specialty_id in target_specialties if target_specialties else False
            
            if not team_match and not role_match and not specialty_match:
                continue
        
        # This announcement matches - add to result
        ann["target_team_names"] = []
        ann["target_role_names"] = []
        ann["target_specialty_names"] = []
        result.append(AnnouncementResponse(**ann))
    
    return result


@router.post("/announcements", response_model=AnnouncementResponse)
async def create_announcement(
    data: AnnouncementCreate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Create a new announcement"""
    if not data.send_to_all:
        if not (data.target_teams or data.target_roles or data.target_specialties):
            raise HTTPException(status_code=400, detail="Select at least one target or enable 'Send to all'")
    
    now = get_utc_now()
    announcement = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "message": data.message,
        "is_active": data.is_active,
        "send_to_all": data.send_to_all,
        "target_teams": data.target_teams or [],
        "target_roles": data.target_roles or [],
        "target_specialties": data.target_specialties or [],
        "start_at": data.start_at,
        "end_at": data.end_at,
        "priority": data.priority,
        "background_color": data.background_color,
        "text_color": data.text_color,
        "created_at": now,
        "created_by_id": current_user["id"],
        "created_by_name": current_user["name"],
        "updated_at": now,
        "updated_by_id": current_user["id"],
        "updated_by_name": current_user["name"]
    }
    
    await db.announcements.insert_one(announcement)
    announcement["target_team_names"] = []
    announcement["target_role_names"] = []
    announcement["target_specialty_names"] = []
    
    return AnnouncementResponse(**announcement)


@router.get("/announcements/{announcement_id}", response_model=AnnouncementResponse)
async def get_announcement(
    announcement_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Get a specific announcement"""
    ann = await db.announcements.find_one({"id": announcement_id}, {"_id": 0})
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    ann["target_team_names"] = []
    ann["target_role_names"] = []
    ann["target_specialty_names"] = []
    
    return AnnouncementResponse(**ann)


@router.patch("/announcements/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: str,
    data: AnnouncementUpdate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Update an announcement"""
    ann = await db.announcements.find_one({"id": announcement_id}, {"_id": 0})
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    # Validate targeting
    send_to_all = update_data.get("send_to_all", ann.get("send_to_all", True))
    if not send_to_all:
        target_teams = update_data.get("target_teams", ann.get("target_teams", []))
        target_roles = update_data.get("target_roles", ann.get("target_roles", []))
        target_specialties = update_data.get("target_specialties", ann.get("target_specialties", []))
        if not (target_teams or target_roles or target_specialties):
            raise HTTPException(status_code=400, detail="Select at least one target or enable 'Send to all'")
    
    update_data["updated_at"] = get_utc_now()
    update_data["updated_by_id"] = current_user["id"]
    update_data["updated_by_name"] = current_user["name"]
    
    await db.announcements.update_one({"id": announcement_id}, {"$set": update_data})
    
    updated = await db.announcements.find_one({"id": announcement_id}, {"_id": 0})
    updated["target_team_names"] = []
    updated["target_role_names"] = []
    updated["target_specialty_names"] = []
    
    return AnnouncementResponse(**updated)


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Delete an announcement"""
    ann = await db.announcements.find_one({"id": announcement_id}, {"_id": 0})
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    await db.announcements.delete_one({"id": announcement_id})
    return {"message": "Announcement deleted"}


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
async def get_logs(log_type: str, limit: int = 500, current_user: dict = Depends(require_roles(["Administrator", "Operator"]))):
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
async def stream_logs(log_type: str, current_user: dict = Depends(require_roles(["Administrator", "Operator"]))):
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


# ============== IDENTITY MIGRATION ==============

@router.post("/migrate-identity")
async def run_identity_migration(current_user: dict = Depends(require_roles(["Administrator"]))):
    """Run identity model migration - converts old roles to new structure (Admin only)"""
    from services.identity_migration import run_migration
    
    results = await run_migration(db)
    return {
        "message": "Identity migration completed",
        "results": results
    }



# ============== MY SERVICES CONTENT ==============

class MyServicesContentUpdate(BaseModel):
    content: str


@router.get("/settings/my-services-content")
async def get_my_services_content(current_user: dict = Depends(get_current_user)):
    """Get the My Services page content"""
    content = await db.settings.find_one({"key": "my_services_content"}, {"_id": 0})
    if content:
        return {"content": content.get("value", "")}
    return {"content": None}


@router.put("/settings/my-services-content")
async def update_my_services_content(
    data: MyServicesContentUpdate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Update the My Services page content (Admin only)"""
    await db.settings.update_one(
        {"key": "my_services_content"},
        {"$set": {"value": data.content, "updated_at": get_utc_now(), "updated_by": current_user["id"]}},
        upsert=True
    )
    return {"message": "Content updated", "content": data.content}
