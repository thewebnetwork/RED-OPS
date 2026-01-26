# Backend Refactoring Guide

## Current State (January 2026)

The backend is in the process of being refactored from a monolithic `server.py` to a modular structure.

### Progress Summary
- **Phase 1 (Models)**: ✅ COMPLETED - All Pydantic models extracted to `/app/backend/models/`
- **Phase 2 (Routes)**: 🔄 IN PROGRESS - 6 route modules extracted

## Extracted Route Modules (6/15)

| Module | Routes | Status |
|--------|--------|--------|
| `auth.py` | 7 | ✅ Done |
| `users.py` | 5 | ✅ Done |
| `roles.py` | 6 | ✅ Done |
| `teams.py` | 7 | ✅ Done |
| `dashboard.py` | 3 | ✅ Done |
| `notifications.py` | 6 | ✅ Done |
| `categories.py` | 8 | ⏳ Pending |
| `orders.py` | 14 | ⏳ Pending |
| `workflows.py` | 18 | ⏳ Pending |
| `settings.py` | 11 | ⏳ Pending |
| `feedback.py` | - | ⏳ Pending |
| `webhooks.py` | - | ⏳ Pending |
| `sla.py` | - | ⏳ Pending |
| `api_keys.py` | - | ⏳ Pending |
| `ratings.py` | - | ⏳ Pending |

## New Modular Structure

The following modular structure has been created to support incremental migration:

```
/app/backend/
├── config.py           # Configuration constants (JWT, SLA, enums)
├── database.py         # MongoDB connection
├── server.py           # Main application (monolith - to be refactored)
├── models/             # ✅ Created - Pydantic models
│   ├── __init__.py     # Re-exports all models
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
├── routes/             # 🔄 Scaffolded - API route handlers
│   └── __init__.py     # Route imports (routes not yet extracted)
├── services/           # ✅ Created - Business logic
│   ├── email.py
│   ├── notifications.py
│   ├── sla_monitor.py
│   ├── webhooks.py
│   └── workflow_engine.py
└── utils/              # ✅ Created - Helper utilities
    ├── auth.py         # get_current_user, require_roles
    └── helpers.py      # hash_password, create_access_token, etc.
```

## Migration Steps

### Phase 1: Models (✅ COMPLETED)
All Pydantic models have been extracted to `/app/backend/models/`.

Usage:
```python
from models import UserCreate, UserResponse, OrderCreate
```

### Phase 2: Route Extraction (TODO)
Extract routes from server.py to individual files in `/app/backend/routes/`:

1. **auth.py** - Lines 971-1104 in server.py
   - POST /auth/login
   - GET /auth/me
   - PATCH /auth/profile
   - POST /auth/change-password
   - POST /auth/forgot-password
   - POST /auth/reset-password
   - GET /auth/verify-reset-token

2. **users.py** - User CRUD routes
3. **roles.py** - Role management
4. **teams.py** - Team management
5. **categories.py** - Category L1/L2
6. **orders.py** - Order CRUD + messages + files
7. **workflows.py** - Workflow builder
8. **settings.py** - UI settings, SMTP, announcements
9. **feedback.py** - Feature requests, bug reports
10. **dashboard.py** - Stats endpoints
11. **notifications.py** - User notifications
12. **webhooks.py** - Outgoing webhooks config
13. **sla.py** - SLA stats and alerts
14. **api_keys.py** - API key management
15. **ratings.py** - Satisfaction ratings

### Phase 3: Update server.py
After routes are extracted, update server.py to:
```python
from fastapi import FastAPI
from routes import (
    auth_router, users_router, roles_router,
    teams_router, categories_router, orders_router,
    workflows_router, settings_router, feedback_router,
    dashboard_router, notifications_router, webhooks_router,
    sla_router, api_keys_router, ratings_router
)

app = FastAPI(title="Red Ribbon Ops Portal API - V2")

# Include all routers
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
# ... etc
```

## Route Template

When extracting routes, use this template:

```python
# /app/backend/routes/example.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List
from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import get_utc_now
from models import ExampleCreate, ExampleResponse

router = APIRouter(tags=["examples"])

@router.post("/examples", response_model=ExampleResponse)
async def create_example(
    data: ExampleCreate,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    # Implementation
    pass

@router.get("/examples", response_model=List[ExampleResponse])
async def list_examples(current_user: dict = Depends(get_current_user)):
    # Implementation
    pass
```

## Testing After Migration

After each route extraction:
1. Run backend tests: `cd /app/backend && pytest`
2. Test endpoints with curl
3. Verify frontend still works

## Notes

- The models/ directory is ready for immediate use
- Migration should be done incrementally (one route file at a time)
- Keep server.py working until all routes are migrated
- Test thoroughly after each extraction
