"""
Red Ribbon Ops Portal API - V2 (Modular)

This is the refactored version using modular routes.
All routes have been extracted from the monolithic server.py.
"""
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import os
import asyncio
import logging
from contextlib import asynccontextmanager

# Import database
from database import db

# Import modular routes
from routes import (
    auth_router,
    users_router,
    roles_router,
    teams_router,
    categories_router,
    dashboard_router,
    notifications_router,
    sla_router,
    api_keys_router,
    webhooks_router,
    ratings_router,
    orders_router,
    feedback_router,
    settings_router,
    workflows_router,
    escalation_router,
    specialties_router,
    access_tiers_router,
    subscription_plans_router,
    sla_policies_router,
    tasks_router,
    service_templates_router,
)
from routes.reports import router as reports_router
from routes.iam import router as iam_router
from routes.documentation import router as documentation_router
from routes.dashboard_v2 import router as dashboard_v2_router
from routes.dashboard_builder import router as dashboard_builder_router

# Import SLA monitor service
from services.sla_monitor import check_sla_breaches
from services.sla_policy_engine import check_and_process_policies
from services.review_reminder import check_pending_reviews

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SLA monitor background task
sla_monitor_task = None


# ============== IFRAME EMBEDDING MIDDLEWARE ==============

class IframeEmbeddingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to configure headers for iframe embedding support.
    Configurable via environment variables:
    - ALLOW_IFRAME_EMBEDDING: 'true' to allow embedding (default: true)
    - FRAME_ANCESTORS: Space-separated list of allowed parent domains (default: '*')
    """
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Check if iframe embedding is allowed
        allow_embedding = os.environ.get("ALLOW_IFRAME_EMBEDDING", "true").lower() == "true"
        frame_ancestors = os.environ.get("FRAME_ANCESTORS", "*")
        
        if allow_embedding:
            # Remove X-Frame-Options if present (we use CSP instead)
            if "X-Frame-Options" in response.headers:
                del response.headers["X-Frame-Options"]
            
            # Set Content-Security-Policy with frame-ancestors
            # frame-ancestors controls which parents can embed this page
            if frame_ancestors == "*":
                csp = "frame-ancestors *"
            else:
                csp = f"frame-ancestors 'self' {frame_ancestors}"
            
            response.headers["Content-Security-Policy"] = csp
        else:
            # Restrict embedding in production if needed
            response.headers["X-Frame-Options"] = "SAMEORIGIN"
            response.headers["Content-Security-Policy"] = "frame-ancestors 'self'"
        
        return response


async def sla_monitor_loop():
    """Background task to periodically check SLA breaches, process policies, review reminders, and pool transitions"""
    from services.sla_monitor import check_pool_transitions
    while True:
        try:
            await check_sla_breaches(db)
            await check_and_process_policies()
            await check_pending_reviews()  # Check for review reminders and auto-close
            await check_pool_transitions(db)  # Check for Pool 1 -> Pool 2 transitions
        except Exception as e:
            logger.error(f"SLA monitor error: {e}")
        await asyncio.sleep(300)  # Check every 5 minutes


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events"""
    global sla_monitor_task
    
    # Startup
    logger.info("Starting Red Ribbon Ops Portal API V2...")
    
    # Start SLA monitor background task
    sla_monitor_task = asyncio.create_task(sla_monitor_loop())
    logger.info("SLA monitor started")
    
    yield
    
    # Shutdown
    if sla_monitor_task:
        sla_monitor_task.cancel()
        try:
            await sla_monitor_task
        except asyncio.CancelledError:
            pass
    logger.info("Red Ribbon Ops Portal API V2 shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Red Ribbon Ops Portal API - V2",
    description="Modular version of the API with all routes extracted",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
origins = os.environ.get("CORS_ORIGINS", "").split(",") + ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Add iframe embedding middleware
app.add_middleware(IframeEmbeddingMiddleware)

# Include all routers with /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(roles_router, prefix="/api")
app.include_router(teams_router, prefix="/api")
app.include_router(categories_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(sla_router, prefix="/api")
app.include_router(api_keys_router, prefix="/api")
app.include_router(webhooks_router, prefix="/api")
app.include_router(ratings_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(feedback_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(workflows_router, prefix="/api")
app.include_router(escalation_router, prefix="/api")
app.include_router(specialties_router, prefix="/api")
app.include_router(access_tiers_router, prefix="/api")
app.include_router(subscription_plans_router, prefix="/api")
app.include_router(sla_policies_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(iam_router, prefix="/api")
app.include_router(documentation_router, prefix="/api")
app.include_router(dashboard_v2_router, prefix="/api")
app.include_router(dashboard_builder_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")  # MVP Task Board
app.include_router(service_templates_router, prefix="/api")  # Service Templates


@app.get("/")
async def root():
    return {"message": "Red Ribbon Ops Portal API V2", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}


# TEMPORARY SETUP ENDPOINTS - Remove after setup is complete
@app.post("/api/setup/bootstrap")
async def bootstrap_admin(reset: bool = False):
    """Create or reset the first admin user."""
    if reset:
        await db.users.delete_many({})
    
    count = await db.users.count_documents({})
    if count > 0:
        # Return info about existing user to help debug
        existing = await db.users.find_one({}, {"_id": 0, "email": 1, "role": 1, "active": 1})
        return {"status": "already_setup", "message": f"{count} user(s) exist.", "sample": existing}

    import uuid
    from utils.helpers import hash_password, get_utc_now

    pw = "RedOps2024!"
    hashed = hash_password(pw)
    admin_user = {
        "id": str(uuid.uuid4()),
        "name": "Admin",
        "email": "admin@redops.com",
        "password": hashed,
        "role": "Administrator",
        "account_type": "Internal Staff",
        "active": True,
        "force_password_change": True,
        "force_otp_setup": False,
        "otp_verified": False,
        "can_pick": True,
        "pool_access": "both",
        "created_at": get_utc_now(),
    }
    await db.users.insert_one(admin_user)
    return {
        "status": "created",
        "credentials": {"email": "admin@redops.com", "password": pw},
        "hash_preview": hashed[:20] + "...",
    }



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
