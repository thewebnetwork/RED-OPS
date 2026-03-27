# Routes package
# Re-export all routers for easy importing

from .auth import router as auth_router
from .users import router as users_router
from .roles import router as roles_router
from .teams import router as teams_router
from .categories import router as categories_router
from .dashboard import router as dashboard_router
from .notifications import router as notifications_router
from .sla import router as sla_router
from .api_keys import router as api_keys_router
from .webhooks import router as webhooks_router
from .ratings import router as ratings_router
from .orders import router as orders_router
from .feedback import router as feedback_router
from .settings import router as settings_router
from .workflows import router as workflows_router
from .escalation import router as escalation_router
from .specialties import router as specialties_router
from .access_tiers import router as access_tiers_router
from .subscription_plans import router as subscription_plans_router
from .sla_policies import router as sla_policies_router
from .tasks import router as tasks_router  # MVP Task Board
from .service_templates import router as service_templates_router
from .organizations import router as organizations_router
from .projects import router as projects_router
from .knowledge_base import router as knowledge_base_router
from .crm import router as crm_router
from .ambassador import router as ambassador_router
from .ad_performance import router as ad_performance_router
from .search import router as search_router
from .integrations import router as integrations_router
from .ai import router as ai_router
from .finance import router as finance_router
from .onboarding import router as onboarding_router
from .exports import router as exports_router
from .documents import router as documents_router

__all__ = [
    "auth_router",
    "users_router",
    "roles_router",
    "teams_router",
    "categories_router",
    "dashboard_router",
    "notifications_router",
    "sla_router",
    "api_keys_router",
    "webhooks_router",
    "ratings_router",
    "orders_router",
    "feedback_router",
    "settings_router",
    "workflows_router",
    "escalation_router",
    "specialties_router",
    "access_tiers_router",
    "subscription_plans_router",
    "sla_policies_router",
    "tasks_router",
    "service_templates_router",
    "organizations_router",
    "projects_router",
    "knowledge_base_router",
    "crm_router",
    "ambassador_router",
    "ad_performance_router",
    "search_router",
    "integrations_router",
    "ai_router",
    "finance_router",
    "onboarding_router",
    "exports_router",
    "documents_router",
]
