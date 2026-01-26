# Models package
# Re-export all models for easy importing

from .auth import (
    LoginRequest, LoginResponse, 
    ForgotPasswordRequest, ResetPasswordRequest,
    PasswordChange, ProfileUpdate
)
from .user import UserCreate, UserUpdate, UserResponse
from .role import RoleCreate, RoleUpdate, RoleResponse
from .team import TeamCreate, TeamUpdate, TeamResponse
from .category import (
    CategoryL1Create, CategoryL1Response,
    CategoryL2Create, CategoryL2Response
)
from .order import (
    OrderCreate, OrderUpdate, OrderResponse,
    CloseOrderRequest, MessageCreate, MessageResponse,
    FileCreate, FileResponse
)
from .workflow import (
    ConditionalSubField, FormFieldSchema, NodeAction,
    WorkflowCondition, WorkflowNode, WorkflowEdge,
    WorkflowCreate, WorkflowUpdate, WorkflowResponse,
    WorkflowStepCreate, WorkflowStep, FormFieldCreate, FormField
)
from .settings import (
    UISettingUpdate, UISettingResponse,
    SMTPConfigUpdate, SMTPConfigResponse, EmailTestRequest,
    AnnouncementTickerUpdate, AnnouncementTickerResponse
)
from .feedback import (
    FeatureRequestCreate, FeatureRequestResponse,
    BugReportCreate, BugReportResponse,
    UnifiedRequestResponse, RatingCreate, RatingResponse,
    ResolverStatsResponse
)
from .dashboard import DashboardStats, NotificationResponse

__all__ = [
    # Auth
    "LoginRequest", "LoginResponse", "ForgotPasswordRequest", 
    "ResetPasswordRequest", "PasswordChange", "ProfileUpdate",
    # User
    "UserCreate", "UserUpdate", "UserResponse",
    # Role
    "RoleCreate", "RoleUpdate", "RoleResponse",
    # Team
    "TeamCreate", "TeamUpdate", "TeamResponse",
    # Category
    "CategoryL1Create", "CategoryL1Response",
    "CategoryL2Create", "CategoryL2Response",
    # Order
    "OrderCreate", "OrderUpdate", "OrderResponse",
    "CloseOrderRequest", "MessageCreate", "MessageResponse",
    "FileCreate", "FileResponse",
    # Workflow
    "ConditionalSubField", "FormFieldSchema", "NodeAction",
    "WorkflowCondition", "WorkflowNode", "WorkflowEdge",
    "WorkflowCreate", "WorkflowUpdate", "WorkflowResponse",
    "WorkflowStepCreate", "WorkflowStep", "FormFieldCreate", "FormField",
    # Settings
    "UISettingUpdate", "UISettingResponse",
    "SMTPConfigUpdate", "SMTPConfigResponse", "EmailTestRequest",
    "AnnouncementTickerUpdate", "AnnouncementTickerResponse",
    # Feedback
    "FeatureRequestCreate", "FeatureRequestResponse",
    "BugReportCreate", "BugReportResponse",
    "UnifiedRequestResponse", "RatingCreate", "RatingResponse",
    "ResolverStatsResponse",
    # Dashboard
    "DashboardStats", "NotificationResponse",
]
