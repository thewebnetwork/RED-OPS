"""
Red Ribbon Ops Portal API - V2 (Modular)

This is the refactored version using modular routes.
All routes have been extracted from the monolithic server.py.
"""
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import os
import uuid
import traceback
import asyncio
import logging
from contextlib import asynccontextmanager

# Import database
from database import db
from utils.auth import require_admin

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
    organizations_router,
    projects_router,
    knowledge_base_router,
    crm_router,
    ambassador_router,
    ad_performance_router,
    search_router,
    integrations_router,
    ai_router,
    finance_router,
    onboarding_router,
    exports_router,
    documents_router,
    messages_router,
    support_router,
    project_templates_router,
    push_router,
)
from routes.reports import router as reports_router
from routes.iam import router as iam_router
from routes.documentation import router as documentation_router
from routes.dashboard_v2 import router as dashboard_v2_router
from routes.dashboard_builder import router as dashboard_builder_router
from routes.files import router as files_router
from routes.events import router as events_router
from routes.calendar_sync import router as calendar_sync_router
from routes.drive_sync import router as drive_sync_router
from routes.sheets import router as sheets_router

# Import SLA monitor service
from services.sla_monitor import check_sla_breaches
from services.sla_policy_engine import check_and_process_policies
from services.review_reminder import check_pending_reviews
from services.reminder_worker import run_reminder_worker

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SLA monitor background task
sla_monitor_task = None
reminder_worker_task = None


# ============== CATCH-ALL EXCEPTION MIDDLEWARE ==============
# @app.exception_handler(Exception) doesn't work reliably with
# BaseHTTPMiddleware (Starlette re-raises through TaskGroup).
# Using a middleware ensures the catch-all is outermost.

class UnhandledExceptionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            error_id = uuid.uuid4().hex[:8]
            logger.error(
                "Unhandled exception [%s] on %s %s:\n%s",
                error_id, request.method, request.url.path, traceback.format_exc(),
            )
            return JSONResponse(
                status_code=500,
                content={"error": {"code": 500, "message": "Internal server error", "type": "internal_error", "error_id": error_id}},
            )


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
    from services.recurring_tasks import check_and_create_recurring_tasks
    while True:
        try:
            await check_sla_breaches(db)
            await check_and_process_policies()
            await check_pending_reviews()  # Check for review reminders and auto-close
            await check_pool_transitions(db)  # Check for Pool 1 -> Pool 2 transitions
            await check_and_create_recurring_tasks()  # Create scheduled recurring tasks
        except Exception as e:
            logger.error(f"SLA monitor error: {e}")
        await asyncio.sleep(300)  # Check every 5 minutes


async def ensure_admin_account():
    """Ensure the platform admin account exists on startup."""
    from utils.helpers import hash_password
    import uuid
    from datetime import datetime, timezone

    admin_email = os.environ.get("ADMIN_EMAIL", "redops@redribbongroup.ca").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password:
        logger.warning("ADMIN_PASSWORD env var not set — skipping admin account seed")
        return

    hashed = hash_password(admin_password)

    existing = await db.users.find_one({"email": admin_email})

    if existing:
        # Always reset password + ensure admin role on every startup
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {
                "password": hashed,
                "role": "Administrator",
                "active": True,
                "force_password_change": False,
                "force_otp_setup": False,
                "otp_verified": False,
                "otp_secret": None,
            }}
        )
        logger.info(f"Admin account verified & password reset: {admin_email}")
    else:
        user = {
            "id": str(uuid.uuid4()),
            "name": "Red Ops Admin",
            "email": admin_email,
            "password": hashed,
            "role": "Administrator",
            "account_type": "Internal Staff",
            "specialty_ids": [],
            "primary_specialty_id": None,
            "specialty_id": None,
            "team_id": None,
            "subscription_plan_id": None,
            "dashboard_type_id": None,
            "permissions": {},
            "permission_overrides": None,
            "active": True,
            "can_pick": True,
            "pool_access": "both",
            "force_password_change": False,
            "force_otp_setup": False,
            "otp_verified": False,
            "otp_secret": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
        logger.info(f"Admin account created: {admin_email}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events"""
    global sla_monitor_task, reminder_worker_task

    # Startup
    logger.info("Starting Red Ribbon Ops Portal API V2...")

    # Ensure admin account exists
    try:
        await ensure_admin_account()
    except Exception as e:
        import traceback
        logger.error(f"Admin seed error (non-fatal): {e}\n{traceback.format_exc()}")

    # Start SLA monitor background task
    sla_monitor_task = asyncio.create_task(sla_monitor_loop())
    logger.info("SLA monitor started")

    # Start task-reminder worker (polls task_reminders every 60s)
    try:
        reminder_worker_task = asyncio.create_task(run_reminder_worker(db))
        logger.info("Reminder worker started")
    except Exception as e:
        logger.error(f"Failed to start reminder worker (non-fatal): {e}")

    yield

    # Shutdown
    if sla_monitor_task:
        sla_monitor_task.cancel()
        try:
            await sla_monitor_task
        except asyncio.CancelledError:
            pass
    if reminder_worker_task:
        reminder_worker_task.cancel()
        try:
            await reminder_worker_task
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
_raw_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
# Guard against accidentally JSON-encoded value
if _raw_origins.strip().startswith("["):
    import json, logging
    try:
        _raw_origins = ",".join(json.loads(_raw_origins))
        logging.warning("CORS_ORIGINS was JSON-encoded. Parsed correctly. Use comma-separated format.")
    except Exception:
        pass
_always_allowed = ["https://redops.redribbongroup.ca", "https://red-ops.vercel.app"]
origins = list(set([o.strip() for o in _raw_origins.split(",") if o.strip()] + _always_allowed))
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
    expose_headers=["Content-Disposition"],
)

# Add iframe embedding middleware
app.add_middleware(IframeEmbeddingMiddleware)

# Catch-all exception middleware — added last so it wraps outermost
app.add_middleware(UnhandledExceptionMiddleware)


# Global exception handlers — refs docs/audits/AUDIT_2026-04-16.md §1.1
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.info("HTTP %s on %s %s: %s", exc.status_code, request.method, request.url.path, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.status_code, "message": exc.detail, "type": "http_error"}},
    )


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
app.include_router(organizations_router, prefix="/api")  # Multi-tenant Organizations
app.include_router(projects_router, prefix="/api")  # Projects (Phase 1)
app.include_router(knowledge_base_router, prefix="/api")  # Knowledge Base / SOPs (Phase 2)
app.include_router(crm_router, prefix="/api")  # CRM / Pipeline (Phase 3)
app.include_router(ambassador_router, prefix="/api")  # Ambassador + Marketplace (Phase 4)
app.include_router(files_router, prefix="/api")  # Universal File Management
app.include_router(ad_performance_router, prefix="/api")  # Ad Performance Tracking (Hyros Lite)
app.include_router(events_router, prefix="/api")  # Calendar events (internal + future external sync)
app.include_router(calendar_sync_router, prefix="/api")  # Per-user Google/Outlook OAuth + sync
app.include_router(drive_sync_router, prefix="/api")     # Per-user Google Drive OAuth + file sync
app.include_router(sheets_router, prefix="/api")         # Basic spreadsheet CRUD
app.include_router(search_router, prefix="/api")  # Global Search
app.include_router(integrations_router, prefix="/api")  # Integration Management
app.include_router(ai_router, prefix="/api")  # AI Features
app.include_router(finance_router, prefix="/api")  # Finance Dashboard
app.include_router(onboarding_router, prefix="/api")  # Client Onboarding Checklists
app.include_router(exports_router, prefix="/api")  # CSV Exports
app.include_router(documents_router, prefix="/api")  # Document Editor
app.include_router(messages_router, prefix="/api")  # In-Platform Messaging
app.include_router(support_router, prefix="/api")  # Support Tickets
app.include_router(project_templates_router, prefix="/api")  # Project Templates
app.include_router(push_router, prefix="/api")  # PWA Push Notifications


@app.get("/")
async def root():
    return {"message": "Red Ribbon Ops Portal API V2", "status": "running"}


@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}


@app.post("/api/setup/seed-admin")
async def seed_admin_endpoint(current_user: dict = Depends(require_admin)):
    """Manually trigger admin account creation. Requires admin auth."""
    try:
        await ensure_admin_account()
        admin_email = os.environ.get("ADMIN_EMAIL", "redops@redribbongroup.ca")
        user = await db.users.find_one({"email": admin_email}, {"_id": 0, "password": 0})
        return {"status": "ok", "email": admin_email, "user_exists": user is not None, "user_id": user.get("id") if user else None, "role": user.get("role") if user else None, "active": user.get("active") if user else None}
    except Exception as e:
        import traceback
        return {"status": "error", "detail": str(e), "trace": traceback.format_exc()}


# Bootstrap endpoint REMOVED — was unauthenticated with hardcoded credentials and ?reset=true could wipe all users.
# Admin users are now created via POST /api/users by an existing admin.




@app.post("/api/setup/seed-services")
async def seed_service_templates(overwrite: bool = False, current_user: dict = Depends(require_admin)):
    """Seed default Red Ribbon service templates. Safe to call multiple times."""
    import uuid
    if overwrite:
        await db.service_templates.delete_many({})
    count = await db.service_templates.count_documents({})
    if count > 0 and not overwrite:
        return {"status": "already_seeded", "count": count, "message": "Use ?overwrite=true to reset."}
    templates = [
        {"id": str(uuid.uuid4()), "name": "Video Editing", "description": "Professional short-form and long-form video editing. Reels, YouTube, ads, and branded content.", "icon": "video", "default_title": "Video Editing Request", "turnaround_text": "3-5 business days", "client_visible": True, "active": True, "sort_order": 1, "deliverable_type": "video", "offer_track": "video", "flow_type": None, "hidden_category_l1": None, "hidden_category_l2": None, "form_schema": [{"field": "footage_links", "label": "Footage Links", "type": "textarea", "required": True, "placeholder": "Google Drive, Dropbox, or WeTransfer links", "options": None, "default_value": None, "help_text": "Share links to your raw footage"}, {"field": "reference_links", "label": "Reference / Inspiration", "type": "textarea", "required": False, "placeholder": "YouTube, TikTok, or Instagram links", "options": None, "default_value": None, "help_text": None}, {"field": "music_preference", "label": "Music Preference", "type": "text", "required": False, "placeholder": "e.g. Upbeat, Cinematic, No music", "options": None, "default_value": None, "help_text": None}, {"field": "special_instructions", "label": "Special Instructions", "type": "textarea", "required": False, "placeholder": "Style notes, captions, aspect ratio, etc.", "options": None, "default_value": None, "help_text": None}], "required_fields": ["footage_links"], "default_task_templates": []},
        {"id": str(uuid.uuid4()), "name": "Graphic Design", "description": "Social media graphics, thumbnails, banners, and branded visual assets.", "icon": "palette", "default_title": "Graphic Design Request", "turnaround_text": "2-3 business days", "client_visible": True, "active": True, "sort_order": 2, "deliverable_type": "graphic", "offer_track": "design", "flow_type": None, "hidden_category_l1": None, "hidden_category_l2": None, "form_schema": [{"field": "description", "label": "Design Brief", "type": "textarea", "required": True, "placeholder": "What do you need designed? Include dimensions, colors, and messaging.", "options": None, "default_value": None, "help_text": None}, {"field": "reference_links", "label": "Brand / Reference Links", "type": "textarea", "required": False, "placeholder": "Brand kit, inspiration, existing assets", "options": None, "default_value": None, "help_text": None}, {"field": "delivery_format", "label": "Delivery Format", "type": "select", "required": False, "placeholder": None, "options": ["PNG", "JPG", "PDF", "SVG", "All formats"], "default_value": None, "help_text": None}], "required_fields": ["description"], "default_task_templates": []},
        {"id": str(uuid.uuid4()), "name": "Ad Creative", "description": "High-converting Meta, Google, and TikTok ad creatives - static and video.", "icon": "megaphone", "default_title": "Ad Creative Request", "turnaround_text": "3-4 business days", "client_visible": True, "active": True, "sort_order": 3, "deliverable_type": "ad_creative", "offer_track": "ads", "flow_type": None, "hidden_category_l1": None, "hidden_category_l2": None, "form_schema": [{"field": "description", "label": "Campaign Goal", "type": "textarea", "required": True, "placeholder": "What is the goal of this ad? Who is the target audience?", "options": None, "default_value": None, "help_text": None}, {"field": "video_script", "label": "Script / Copy", "type": "textarea", "required": False, "placeholder": "Ad copy, hook, CTA", "options": None, "default_value": None, "help_text": None}, {"field": "footage_links", "label": "Footage / Assets", "type": "textarea", "required": False, "placeholder": "Raw footage or existing asset links", "options": None, "default_value": None, "help_text": None}, {"field": "delivery_format", "label": "Platform", "type": "select", "required": True, "placeholder": None, "options": ["Meta (Facebook/Instagram)", "TikTok", "YouTube", "Google Display", "All platforms"], "default_value": None, "help_text": None}], "required_fields": ["description", "delivery_format"], "default_task_templates": []},
        {"id": str(uuid.uuid4()), "name": "Social Media Management", "description": "Monthly content planning, creation, scheduling, and community management.", "icon": "share2", "default_title": "Social Media Management Request", "turnaround_text": "Ongoing / Monthly", "client_visible": True, "active": True, "sort_order": 4, "deliverable_type": "social", "offer_track": "smm", "flow_type": None, "hidden_category_l1": None, "hidden_category_l2": None, "form_schema": [{"field": "description", "label": "Brand Overview", "type": "textarea", "required": True, "placeholder": "Tell us about your brand, target audience, and goals.", "options": None, "default_value": None, "help_text": None}, {"field": "special_instructions", "label": "Platforms", "type": "select", "required": True, "placeholder": None, "options": ["Instagram", "TikTok", "Facebook", "LinkedIn", "All platforms"], "default_value": None, "help_text": None}], "required_fields": ["description", "special_instructions"], "default_task_templates": []},
        {"id": str(uuid.uuid4()), "name": "Content Strategy", "description": "Brand positioning, content pillars, competitor research, and 30-day content calendar.", "icon": "layout", "default_title": "Content Strategy Request", "turnaround_text": "5-7 business days", "client_visible": True, "active": True, "sort_order": 5, "deliverable_type": "strategy", "offer_track": "strategy", "flow_type": None, "hidden_category_l1": None, "hidden_category_l2": None, "form_schema": [{"field": "description", "label": "Business Overview", "type": "textarea", "required": True, "placeholder": "What does your business do? Who are your customers? What are your goals?", "options": None, "default_value": None, "help_text": None}, {"field": "reference_links", "label": "Competitor / Inspiration Links", "type": "textarea", "required": False, "placeholder": "Links to competitors or accounts you admire", "options": None, "default_value": None, "help_text": None}], "required_fields": ["description"], "default_task_templates": []}
    ]
    await db.service_templates.insert_many(templates)
    return {"status": "seeded", "count": len(templates), "services": [t["name"] for t in templates]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
