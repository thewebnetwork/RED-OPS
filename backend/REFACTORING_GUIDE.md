# Backend Refactoring Guide

## Current State (January 2026)

The backend has been **fully refactored** from a monolithic `server.py` to a modular structure.

### Progress Summary
- **Phase 1 (Models)**: ✅ COMPLETED - All Pydantic models extracted to `/app/backend/models/`
- **Phase 2 (Routes)**: ✅ COMPLETED - All 15 route modules extracted (100+ endpoints)
- **Phase 3 (Switchover)**: ✅ COMPLETED - Application now runs on modular `server_v2.py`

## Extracted Route Modules (15/15) ✅

| Module | Routes | Status |
|--------|--------|--------|
| `auth.py` | 7 | ✅ Done |
| `users.py` | 5 | ✅ Done |
| `roles.py` | 6 | ✅ Done |
| `teams.py` | 7 | ✅ Done |
| `categories.py` | 11 | ✅ Done |
| `dashboard.py` | 3 | ✅ Done |
| `notifications.py` | 6 | ✅ Done |
| `sla.py` | 7 | ✅ Done |
| `api_keys.py` | 5 | ✅ Done |
| `webhooks.py` | 8 | ✅ Done |
| `ratings.py` | 5 | ✅ Done |
| `orders.py` | 14 | ✅ Done |
| `workflows.py` | 18 | ✅ Done |
| `settings.py` | 11 | ✅ Done |
| `feedback.py` | 8 | ✅ Done |

**Total: 121+ routes in 15 modules**

## Final Modular Structure

```
/app/backend/
├── config.py           # Configuration constants (JWT, SLA, enums)
├── database.py         # MongoDB connection
├── server.py           # Entry point (imports server_v2)
├── server_v2.py        # Main application with all routers
├── server_legacy.py    # Backup of old monolithic server
├── models/             # ✅ Pydantic models
│   ├── __init__.py
│   ├── auth.py         # LoginRequest, LoginResponse, etc.
│   ├── user.py         # UserCreate, UserUpdate, UserResponse
│   ├── role.py         # RoleCreate, RoleUpdate, RoleResponse
│   ├── team.py         # TeamCreate, TeamUpdate, TeamResponse
│   ├── category.py     # CategoryL1/L2 models
│   ├── order.py        # OrderCreate, OrderUpdate, OrderResponse, Messages, Files
│   ├── workflow.py     # WorkflowCreate, WorkflowNode, etc.
│   ├── settings.py     # UISettings, SMTP, Announcements
│   ├── feedback.py     # FeatureRequest, BugReport, Ratings
│   └── dashboard.py    # DashboardStats, NotificationResponse
├── routes/             # ✅ API route handlers
│   ├── __init__.py     # Re-exports all routers
│   ├── auth.py         # Authentication routes
│   ├── users.py        # User management
│   ├── roles.py        # Role management
│   ├── teams.py        # Team management
│   ├── categories.py   # Category L1/L2 CRUD
│   ├── dashboard.py    # Dashboard stats
│   ├── notifications.py # User notifications
│   ├── sla.py          # SLA management and alerts
│   ├── api_keys.py     # API key management
│   ├── webhooks.py     # Outgoing webhooks
│   ├── ratings.py      # Satisfaction ratings
│   ├── orders.py       # Order CRUD + messages + files
│   ├── workflows.py    # Workflow builder + templates
│   ├── settings.py     # UI settings, SMTP, announcements, logs
│   └── feedback.py     # Feature requests, bug reports
├── services/           # ✅ Business logic
│   ├── email.py
│   ├── notifications.py
│   ├── sla_monitor.py
│   ├── webhooks.py
│   └── workflow_engine.py
└── utils/              # ✅ Helper utilities
    ├── auth.py         # get_current_user, require_roles
    └── helpers.py      # hash_password, create_access_token, etc.
```

## How to Use

### Importing Routes
```python
from routes import (
    auth_router,
    users_router,
    roles_router,
    # ... all routers
)
```

### Importing Models
```python
from models import UserCreate, UserResponse, OrderCreate
```

### Importing Utilities
```python
from utils.auth import get_current_user, require_roles
from utils.helpers import get_utc_now, hash_password
```

## Route Template

When adding new routes, follow this pattern:

```python
# /app/backend/routes/example.py
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Optional
from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import get_utc_now
from models.example import ExampleCreate, ExampleResponse

router = APIRouter(prefix="/examples", tags=["Examples"])

@router.post("", response_model=ExampleResponse)
async def create_example(
    data: ExampleCreate,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    # Implementation
    pass

@router.get("", response_model=List[ExampleResponse])
async def list_examples(current_user: dict = Depends(get_current_user)):
    # Implementation
    pass
```

## Testing

After any changes:
1. Run backend: `sudo supervisorctl restart backend`
2. Check logs: `tail -f /var/log/supervisor/backend.err.log`
3. Test endpoints with curl
4. Verify frontend still works

## Notes

- The legacy `server_legacy.py` is kept as a backup
- All routes use the same authentication middleware from `utils/auth.py`
- Database connection is shared via `database.py`
- Background tasks (SLA monitor) are managed in `server_v2.py`
