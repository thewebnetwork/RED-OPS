"""Application configuration and constants"""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Config
SECRET_KEY = os.environ.get('JWT_SECRET', 'red-ribbon-ops-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
RESET_TOKEN_EXPIRE_HOURS = 1

# SLA Config
SLA_DAYS = 7
SLA_WARNING_HOURS = 24  # Hours before SLA breach to trigger warning

# Frontend URL
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://user-auth-36.preview.emergentagent.com')

# Enums
SYSTEM_ROLES = ["Admin", "Requester"]
ORDER_STATUSES = ["Draft", "Open", "In Progress", "Pending", "Delivered", "Closed", "Canceled"]

# Cancellation reasons
CANCELLATION_REASONS = [
    "No longer needed",
    "Changed my mind",
    "Found a different solution",
    "Fixed the issue myself",
    "Duplicate ticket",
    "Other"
]
REQUEST_TYPES = ["Request", "Bug"]
PRIORITIES = ["Low", "Normal", "High", "Urgent"]
BUG_SEVERITIES = ["Low", "Normal", "High", "Urgent"]
BROWSERS = ["Chrome", "Safari", "Firefox", "Edge", "Other"]
DEVICES = ["Desktop", "Mobile", "Tablet"]
ROLE_TYPES = ["system", "service_provider", "custom"]

# Workflow Action Types
ACTION_TYPES = ["assign_role", "forward_ticket", "email_user", "email_requester", "update_status", "notify", "webhook"]

# Workflow Trigger Events
WORKFLOW_TRIGGER_EVENTS = [
    "order.created",
    "order.submitted",  # When draft is submitted
    "order.status_changed",
    "order.assigned",
    "order.delivered",
    "order.pending_review",  # When ticket enters Pending (needs requester review)
    "order.sla_warning",
    "order.sla_breached",
]

# Review reminder configuration (in hours/days)
REVIEW_REMINDER_HOURS = 24  # Send email reminder after 24 hours
REVIEW_AUTO_CLOSE_DAYS = 5  # Auto-close after 5 days

# Webhook Events
WEBHOOK_EVENTS = [
    "order.created",
    "order.status_changed",
    "order.assigned",
    "order.delivered",
    "order.message_added",
    "order.file_uploaded",
    "order.sla_warning",
    "order.sla_breached",
    "test",
]
