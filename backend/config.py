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

# Frontend URL
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://servicehub-191.preview.emergentagent.com')

# Enums
SYSTEM_ROLES = ["Admin", "Requester"]
ORDER_STATUSES = ["Open", "In Progress", "Pending", "Delivered", "Closed"]
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
    "order.status_changed",
    "order.assigned",
    "order.delivered",
    "order.sla_warning",
    "order.sla_breached",
]
