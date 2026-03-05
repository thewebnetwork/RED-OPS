# Red Ops — Product Requirements Document

## Original Problem Statement
Build a user-first, service-driven client portal ("Red Ops") that replaces a generic internal ticketing system. Clients submit requests via service cards, see progress via linked tasks, and communicate with their Account Manager — all without exposure to internal jargon.

## Core Architecture
- **Backend**: FastAPI + MongoDB (schemaless)
- **Frontend**: React + Shadcn/UI + Tailwind
- **Auth**: JWT + TOTP 2FA
- **Integrations**: Gmail SMTP, GoHighLevel (mocked), pyotp, recharts, @dnd-kit, i18next

## What's Been Implemented

### Phase 1 — MVP Foundation (Complete)
- Service-template-driven intake flow (`/services`)
- Request detail page (`/requests/:id`) with service-specific data
- Account Manager visibility on ClientHome and OrderDetail
- Auto-assignment to queues via `assigned_queue_key`
- Sticky UI modes (`active_app_mode`) for admin/operator roles
- Route hardening — clients blocked from internal pages
- Operational `/queue` page with filters (status, queue, search)
- IAM and Users pages cleaned of subscription UI
- MVP Lockdown — removed pools, subscriptions, billing, partner marketplace

### Phase 2 — Auto-Tasking & Task Dashboard (Complete — Mar 5, 2026)
- **Auto-create Progress Tasks**: Every new request spawns a "Progress task" linked to the request, assigned to the client's AM
- **Status Sync**: Progress task status mirrors request status (Open→todo, In Progress→doing, Pending→review, Delivered/Closed/Canceled→done)
- **Linked Tasks Bug Fix**: OrderDetail now correctly displays linked tasks (fixed `setLinkedTasks` parsing + cross-org visibility for admin/internal)
- **My Tasks Card**: ClientHome dashboard shows task counts (open + waiting) with link to TaskBoard
- **Client TaskBoard**: Button label changed from "New Request" to "New Task", empty state CTA updated
- **AM TaskBoard Default Filter**: Defaults to "Assigned to me" so AMs see newly assigned work immediately
- **Cross-org task visibility**: Admin/Internal staff can view tasks across orgs when querying by request_id; Internal staff see tasks assigned to them regardless of org
- **requester_team_id stored on orders**: Enables reliable org routing for lifecycle events
- **Non-destructive template seeding**: `ensure_seed_templates()` uses upsert, safe to run repeatedly
- **Cleanup**: Deleted unused `CreateOrder.js`

## Key Data Models
- **service_templates**: `{offer_track, flow_type, cta_url, cta_label, form_schema}`
- **orders**: `{service_template_id, assigned_queue_key, requester_team_id, service_name, service_fields}`
- **task_templates**: `{id, service_id, trigger_event, title_template, visibility, task_type, default_status, assign_target_type, active}`
- **tasks**: `{id, org_id, request_id, template_id, trigger_event, status, assignee_user_id, visibility, task_type, created_source}`

## Key API Endpoints
- `GET /api/service-templates` — Catalog for client intake
- `POST /api/orders` — Create request (auto-generates tasks)
- `GET /api/orders` — List with filters (status, queue, search)
- `GET /api/tasks` — List tasks (RBAC-enforced, cross-org for admin+request_id)
- `GET /api/users/me/account-manager` — Client's assigned AM

## Prioritized Backlog

### P1
- Deprecate/remove `frontend/src/utils/rrmServices.js` (obsolete static config)
- Full i18n translation pass (recurring incomplete)

### P2
- Advanced Analytics (charts for API key usage)
- Slack/Teams integration for notifications
- Workflow preview feature
- Bulk restore/purge for deleted requests
- "My Email Preferences" in user settings
- Backup code system for OTP recovery
- Deployment to Vercel/Railway + MongoDB Atlas

## Credentials
- **Admin**: admin@redribbonops.com / Admin123!
- **Client**: info@redribbonrealty.ca / Client1234!
- **AM**: matheus.pessanha@redribbonops.com (password needs reset)
