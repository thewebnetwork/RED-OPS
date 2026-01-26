from pydantic import BaseModel
from typing import Optional, List


class UISettingUpdate(BaseModel):
    value: str


class UISettingResponse(BaseModel):
    key: str
    value: str
    category: str
    description: Optional[str] = None


# SMTP/Email Settings
class SMTPConfigUpdate(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True


class SMTPConfigResponse(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_from: str
    smtp_use_tls: bool
    is_configured: bool
    last_test_status: Optional[str] = None
    last_test_at: Optional[str] = None


class EmailTestRequest(BaseModel):
    to_email: str


# Announcement Ticker
class AnnouncementTickerUpdate(BaseModel):
    message: str
    is_active: bool = True
    send_to_all: bool = True
    target_teams: List[str] = []
    target_roles: List[str] = []
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    priority: Optional[str] = None
    background_color: Optional[str] = "#A2182C"
    text_color: Optional[str] = "#FFFFFF"


class AnnouncementTickerResponse(BaseModel):
    id: Optional[str] = None
    message: str
    is_active: bool
    send_to_all: bool = True
    target_teams: List[str] = []
    target_roles: List[str] = []
    target_team_names: List[str] = []
    target_role_names: List[str] = []
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    priority: Optional[str] = None
    background_color: str
    text_color: str
    updated_at: str
    updated_by_name: Optional[str] = None
    created_at: Optional[str] = None
    created_by_name: Optional[str] = None
