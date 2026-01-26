# Routes package
# Re-export all routers for easy importing

from .auth import router as auth_router
from .users import router as users_router
from .roles import router as roles_router
from .teams import router as teams_router
from .dashboard import router as dashboard_router
from .notifications import router as notifications_router

# TODO: Extract these from server.py
# from .categories import router as categories_router
# from .orders import router as orders_router
# from .workflows import router as workflows_router
# from .settings import router as settings_router
# from .feedback import router as feedback_router
# from .webhooks import router as webhooks_router
# from .sla import router as sla_router
# from .api_keys import router as api_keys_router
# from .ratings import router as ratings_router

__all__ = [
    "auth_router",
    "users_router", 
    "roles_router",
    "teams_router",
    "dashboard_router",
    "notifications_router",
]
