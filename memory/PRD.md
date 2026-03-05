# Red Ribbon Ops - Product Requirements Document

**Last Updated:** March 2026  
**Version:** 6.0 - Three-Mode Task Board UX Complete

## Recent Updates (March 2026)

### Three-Mode Task Board UX (COMPLETED - March 2026)
Implemented three distinctly different user experiences on a shared Kanban board:

**Admin Mode:**
- Title: "Task Board" / "Manage and track all work across your team"
- Full filter set: Search, Assignee (grouped Team/Clients), Status (all 6 columns)
- Admin-only: "Account Managers" management dialog to set/change client AMs
- Task dialog: All status pills, grouped assignee picker, visibility toggle (Internal/Client/Both), linked request, task type
- Cards: Full metadata with visibility badges, linked request indicators, edit pencils
- Inline "+" column create on all columns

**Account Manager Mode:**
- Title: "My Client Tasks" / "Manage tasks for your assigned clients"
- Focused filters: Search + Client filter (only their clients)
- No admin-only controls (no AM management, no visibility toggle)
- Task dialog: Status pills, assignee picker, description (no visibility, linked request, or type fields)
- Cards: Assignee names, due dates, linked requests (no visibility badges)

**Client Mode:**
- Title: "My Tasks" / "Track progress on your account"
- Minimal controls: Search + "New Request" button (outline)
- No column "+" buttons, no assignee/status/visibility filters
- Client-friendly assignee picker: "Assign to me" / "Assign to my account manager [name]" / "No one yet"
- Simplified dialog: "What do you need help with?", 3 status pills (To Do/Doing/Review), "Submit Request"
- Cards: "You" or "Account Manager" labels, due dates only — no visibility, type, or request badges

**New Backend Endpoint:**
- `GET /api/tasks/client-assignments` — Admin-only: Returns all clients with their AM assignments + internal staff list

**Testing:** 100% pass rate (backend + frontend) via testing_agent iteration_60

### Previous Completed Work
- Task Board MVP Backend API (tasks CRUD, RBAC, reordering)
- Task Auto-Generation from Request Events (9 templates, 5 trigger events)
- Account Manager Relationship & Role-Aware Assignment
- Fast Task Creation & Assignment UX (inline create, quick dialog)
- Task Board Frontend Kanban Board with @dnd-kit

### Phase 1: MVP Blocker Fixes (COMPLETED)
- Backend RBAC alignment (Administrator/Operator/Standard User)
- Frontend mode enforcement via PrivateRoute
- Service Catalog flow with query parameters
- ClientHome API endpoint fix
- Terminology cleanup ("Ticket" → "Request") in UI
- i18n sync for ES/PT translations

### Phase 2: Document Implementation (COMPLETED - Dec 2024)
1. Real Service Catalog Endpoint (8 RRM services)
2. Comprehensive "Ticket" → "Request" Cleanup
3. Translation Enhancements

## Original Problem Statement
Enterprise ticket management and operations platform with full multilingual support (English, Spanish, Portuguese). The platform handles service requests, bug reports, feature requests, and editing workflows with SLA tracking, pool-based ticket assignment, and comprehensive IAM controls.

## Core Requirements
1. **Full i18n Coverage (P0)** - All UI elements must translate when switching between EN/ES/PT
2. **Dashboard with Dynamic Widgets** - Role-based dashboard rendering
3. **Request Lifecycle Management** - Submit, pick, deliver, review, close workflows
4. **Pool-Based Assignment** - Pool 1 and Pool 2 opportunity ribbons with access controls
5. **SLA Tracking** - On-track, at-risk, breached status monitoring
6. **IAM System** - Users, teams, roles, specialties, account types, subscription plans
7. **Category Management** - L1/L2 categories with translations
8. **Three-Mode Frontend Architecture** - Client Portal, Operator Console, Admin Studio

## What's Been Implemented

### Frontend Restructuring - 3 Modes (COMPLETED)
- **Client Portal**: Home, Request a Service, My Requests, Tasks, My Account
- **Operator Console**: My Queue, Tasks, All Requests, Reports
- **Admin Studio**: Dashboard, Tasks, IAM, Settings, Reports, Logs, Announcements

### Task System (COMPLETED)
- Full CRUD API with RBAC at `/api/tasks`
- Drag-and-drop Kanban board with 6 columns
- 3 distinct UI modes (Admin/Manager/Client)
- Automated task generation from request lifecycle
- Account Manager relationship management
- Inline column creation and quick task dialog

## Known Mocked APIs
- `/api/webhooks/ghl-payment-mock` - GoHighLevel payment webhook
- `/api/categories/catalog` - Falls back to static catalog (8 services)

## Test Credentials
- Admin: admin@redribbonops.com / Admin123!
- Client: test@client.com / Client123!

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI + react-i18next + @dnd-kit
- Backend: FastAPI + MongoDB
- Auth: JWT-based with OTP support

## Upcoming Tasks (P1)
1. Advanced analytics for API key usage with charts
2. Slack/Teams notification integration presets

## Future Tasks (P2)
1. Workflow preview/simulation feature
2. Complete i18n translation for all pages
3. Bulk restore/purge deleted tickets
4. "My Email Preferences" in user settings
5. Backup code system for OTP recovery
6. Deployment assistance (Vercel/Railway + MongoDB Atlas)

## Key Files
- `/app/backend/models/task.py` - Task model and enums
- `/app/backend/routes/tasks.py` - Task API endpoints with RBAC
- `/app/backend/services/task_generator.py` - Task automation
- `/app/backend/server_v2.py` - Main server
- `/app/frontend/src/pages/TaskBoard.js` - Three-mode Kanban board
- `/app/frontend/src/config/rrmServices.js` - Canonical service definitions
