# RED OPS PORTAL - Product Requirements Document

## Original Problem Statement
Build a simplified ticketing/order management system for video editing services. Replace WhatsApp + folder chaos with a single place to manage orders, communicate, and track deliverables.

**V2 Update**: Transform the app into a "Command Center" - a multi-purpose request portal handling various request types using a two-level category system.

**V3 Update (Current)**: Transform into a "Service Hub Platform" with dynamic roles, custom workflows, and form builder capabilities.

## User Personas (Dynamic Roles)
Roles are now dynamic and stored in database. Initial seed includes:

### System Roles (2)
1. **Admin** - Full system access, manages users/roles/categories
2. **Requester** - Can submit requests and orders

### Service Provider Roles (29)
Real estate and marketing professionals who can pick orders from the pool:
- **Video/Photo**: Video Editor, Photographer, Videographer, Drone Operator
- **Staging**: Home Stager, Virtual Stager
- **Technical**: Floor Plan Designer, Home Inspector, Appraiser, Land Surveyor
- **Financial**: Mortgage Broker, Title Company
- **Trades**: General Contractor, Electrician, Plumber, HVAC Technician, Roofer, Painter, Landscaper, Cleaner, Pest Control, Locksmith
- **Marketing**: Graphic Designer, Social Media Manager, Copywriter, SEO Specialist, Web Developer, Print Specialist, Sign Installer

## Current Order Workflow (5 Statuses)
1. **Open** - New order created by Requester, visible in Service Provider pool
2. **In Progress** - Service Provider picked the order and is working on it
3. **Pending** - Service Provider submitted for review, waiting on Requester feedback
4. **Delivered** - Order completed
5. **Closed** - Requester closed the ticket (with reason)

## What's Been Implemented

### Phase 19: Iframe Embedding & Mobile Responsiveness ✅ (January 26, 2026)

**Iframe Embedding Support:**
- Added `IframeEmbeddingMiddleware` to backend
- Configurable via environment variables (`ALLOW_IFRAME_EMBEDDING`, `FRAME_ANCESTORS`)
- Sets `Content-Security-Policy: frame-ancestors` header (no `X-Frame-Options: DENY`)
- JWT-based auth works in iframes (no cookies needed)

**Mobile Responsiveness (Already Present):**
- ✅ Collapsible sidebar with hamburger menu
- ✅ Responsive grid layouts (adapts to screen size)
- ✅ Touch-friendly navigation
- ✅ All primary workflows work on mobile

**Documentation:**
- Created `/app/docs/IFRAME_EMBEDDING.md` with configuration guide

### Phase 18: Bug Fixes & QA Verification ✅ (January 26, 2026)

**Fixed Issues:**
1. **Category Routes** - Fixed `/api/categories/l1` and `/api/categories/l2` paths (were using wrong prefix)
2. **Dashboard Editor/Requester Routes** - Added missing `/api/dashboard/editor` and `/api/dashboard/requester` endpoints
3. **Ratings My-Stats** - Added missing `/api/ratings/my-stats` endpoint
4. **Notifications Unread-Count** - Added missing `/api/notifications/unread-count` endpoint alias
5. **Teams Page Runtime Error** - Fixed `teamMembers.map is not a function` error by extracting `members` array from API response
6. **Logo Text** - Changed "Red Ops" to "RED OPS" (all caps)
7. **Logo Pulse Animation** - Added pulse animation with 3s duration
8. **Announcement Banner** - Re-enabled expired announcement with scrolling marquee

**Verified Working:**
- Dashboard, Command Center, Teams, Workflows, Workflow Editor, Categories
- Announcement banner with scrolling animation
- All modular backend routes

### Phase 17: Backend Refactor Complete ✅ (January 26, 2026)

**COMPLETED: Full Backend Modularization**
The monolithic `server.py` (4,255 lines) has been fully refactored into a modular structure:

**All 15 Route Modules Extracted (121+ endpoints):**
| Module | Routes | Description |
|--------|--------|-------------|
| `auth.py` | 7 | Login, profile, password management |
| `users.py` | 5 | User CRUD operations |
| `roles.py` | 6 | Role management |
| `teams.py` | 7 | Team CRUD + members |
| `categories.py` | 11 | Category L1/L2 CRUD |
| `dashboard.py` | 3 | Stats endpoints |
| `notifications.py` | 6 | User notifications |
| `sla.py` | 7 | SLA management and alerts |
| `api_keys.py` | 5 | API key management |
| `webhooks.py` | 8 | Outgoing webhooks |
| `ratings.py` | 5 | Satisfaction ratings |
| `orders.py` | 14 | Order CRUD + messages + files |
| `workflows.py` | 18 | Workflow builder + templates |
| `settings.py` | 11 | UI settings, SMTP, announcements, logs |
| `feedback.py` | 8 | Feature requests, bug reports |

**Architecture:**
- `server.py` - Entry point (imports from server_v2)
- `server_v2.py` - Main FastAPI app with all routers included
- `server_legacy.py` - Backup of original monolithic server
- `routes/__init__.py` - Re-exports all routers
- `models/` - All Pydantic models (11 files)
- `services/` - Business logic modules
- `utils/` - Helper utilities

**Key Changes:**
- Fixed `normalize_order()` to include `request_type` field
- Updated `REFACTORING_GUIDE.md` with completion status
- All API endpoints tested and working

### Phase 16: Bug Fixes + Extended Route Extraction ✅ (January 26, 2026)

**Bug Fixes:**
1. **Announcement Banner Animation** - Fixed: Banner now scrolls/moves with marquee animation
2. **Date Picker Timezone** - Fixed: Date selection no longer shows wrong day
3. **Workflow Editor Unsaved Changes** - Fixed: Now prompts before leaving with unsaved work (dialog with Cancel/Discard/Save options)

**Extended Route Extraction (11 modules, 70 endpoints)**
- `routes/categories.py` - 11 routes (L1/L2 CRUD, tree view)
- `routes/sla.py` - 7 routes (stats, alerts, breached/at-risk orders)
- `routes/api_keys.py` - 5 routes (CRUD, usage analytics)
- `routes/webhooks.py` - 8 routes (CRUD, test, logs)
- `routes/ratings.py` - 5 routes (submit, list, stats, resolver stats)

### Phase 15: Backend Refactor Phase 2 (Routes Extraction) ✅ (January 26, 2026)

**Routes Extracted (6 modules, 34 endpoints)**
- `routes/auth.py` - 7 routes (login, me, profile, change-password, forgot-password, reset-password, verify-reset-token)
- `routes/users.py` - 5 routes (CRUD operations for user management)
- `routes/roles.py` - 6 routes (CRUD + list all roles)
- `routes/teams.py` - 7 routes (CRUD + member listing)
- `routes/dashboard.py` - 3 routes (stats, activity, quick-stats)
- `routes/notifications.py` - 6 routes (list, count, mark-read, delete)

**Infrastructure Updates**
- Created `server_v2.py` - Modular server using new route imports (for testing)
- Updated `utils/helpers.py` - Added `get_next_code()` and `create_notification()` helper functions
- Updated `REFACTORING_GUIDE.md` - Progress tracking and migration instructions

**Remaining Routes to Extract (9 modules)**
- `categories.py` - Category L1/L2 management
- `orders.py` - Order CRUD, messages, files (largest module)
- `workflows.py` - Workflow builder and execution
- `settings.py` - UI settings, SMTP, announcements
- `feedback.py` - Feature requests, bug reports
- `webhooks.py` - Outgoing webhook configuration
- `sla.py` - SLA monitoring and alerts
- `api_keys.py` - API key management and analytics
- `ratings.py` - Customer satisfaction ratings

### Phase 14: Enhancement Features ✅ (January 26, 2026)

**1. Workflow Templates Gallery**
- 6 pre-built workflow templates:
  - Editor Assignment (Assignment) - Notifies editors on new orders
  - SLA Escalation (Escalation) - Auto-escalates when SLA at risk
  - Customer Feedback Request (Feedback) - Sends survey after delivery
  - Auto-Close Inactive Tickets (Automation) - Closes stale tickets
  - Priority-Based Routing (Routing) - Routes high priority to senior team
  - External System Sync (Integration) - Webhook to external systems
- One-click install functionality
- Category filtering (All, Escalation, Feedback, Automation, Routing, Integration, Assignment)
- Popularity scores and node/edge counts displayed
- API: `GET/POST /api/workflow-templates`, `POST /api/workflow-templates/{id}/install`

**2. API Key Usage Analytics**
- Summary dashboard with cards: Total Keys, Requests Today, This Week, All Time
- Per-key usage table with Today/Week/Total breakdown
- API: `GET /api/api-keys/analytics/summary`, `GET /api/api-keys/{id}/usage`
- New tab "Analytics" in Integrations page

**3. Real-time Log Streaming**
- "Live Stream" button for SSE-based real-time logs
- "Poll (5s)" button for interval-based refresh
- Streaming status banner shows count of received logs
- Backend SSE endpoint: `GET /api/logs/stream/{log_type}`
- Supports system, api, ui, user log types

### Phase 13: Workflow Validation & Backend Refactor Start ✅ (January 26, 2026)

**1. Test Workflow Validation**
- Created test order **RRG-000037** to validate workflow execution
- Workflow "New Request Notification Workflow" triggered successfully
- Execution ID: `c72d4de8-6a10-4570-94a8-069764eae3eb` (status: completed)

**2. Editor Workflow (Visual Workflow)**
- Created new visual workflow "Editor Workflow" (ID: `224f96a5-6797-4c35-8eef-db6b96bfa73a`)
- Automatically notifies editors when new orders are created
- 3 nodes: Trigger → Notify Editors → Email Editor Team
- Color: Green (#10B981)
- Configured to trigger on `order.created` event

**3. Backend Refactoring - Phase 1 (Models Extraction)**
- Created `/app/backend/models/` directory with modular Pydantic models:
  - `auth.py` - LoginRequest, LoginResponse, PasswordChange, etc.
  - `user.py` - UserCreate, UserUpdate, UserResponse
  - `role.py` - RoleCreate, RoleUpdate, RoleResponse
  - `team.py` - TeamCreate, TeamUpdate, TeamResponse
  - `category.py` - CategoryL1/L2 models
  - `order.py` - OrderCreate, OrderResponse, Message/File models
  - `workflow.py` - WorkflowCreate, WorkflowNode, WorkflowEdge, etc.
  - `settings.py` - UISettings, SMTP, Announcements
  - `feedback.py` - FeatureRequest, BugReport, Ratings
  - `dashboard.py` - DashboardStats, NotificationResponse
- Created `/app/backend/routes/__init__.py` scaffolding
- Created `/app/backend/REFACTORING_GUIDE.md` with migration plan

### Phase 12: UI Fixes & Enhanced Announcements ✅ (January 26, 2026)
Three fixes and one major feature enhancement:

**1. Banner/Announcement UI Redesign**
- Moved banner inline to header row (same line as ratings and profile)
- Black megaphone icon, black bold text, white background
- No close/dismiss button - always visible when active
- Sticky/static with header as page scrolls

**2. SMTP Configuration**
- Configured Gmail SMTP with fmtvvlb@gmail.com
- Sends FROM admin@redribbongroup.ca
- Test email sent successfully with subject "email coming from emergent test platform"

**3. Categories Module Cleanup**
- Removed "About Editor Workflow" info card
- Removed "Editor Workflow" badges from subcategories
- Removed "Enable Editor Workflow" toggle from subcategory form
- Categories now only manages L1/L2 categories (workflow logic moved to Workflows module)

**4. Enhanced Announcement Targeting System**
- New data model with audience targeting fields:
  - `send_to_all` (boolean) - show to everyone
  - `target_teams` (array of team_ids)
  - `target_roles` (array of role_ids)
  - `start_at` / `end_at` (optional schedule)
- UI changes:
  - "Send to All" toggle - when ON, hides selectors, shows "This will be shown to everyone"
  - When OFF, shows team/role multi-select checkboxes with badges
  - Helper text: "Users who match ANY selected team or role will see this"
  - Validation: requires at least one team/role if send_to_all is OFF
- Delivery logic: OR-based matching (user in ANY target team OR has ANY target role)
- Admin preview shows how banner looks in header

### Phase 11: P2/P3 Complete Implementation ✅ (January 26, 2026)
Major backend refactoring and new features:

**P2: Backend Refactoring**
- Created modular `/app/backend/services/` directory with:
  - `notifications.py` - Notification creation and status change alerts
  - `webhooks.py` - Webhook trigger function for outgoing webhooks
  - `email.py` - Email notification services (MOCKED)
  - `workflow_engine.py` - Workflow execution engine
  - `sla_monitor.py` - SLA breach checking and alerts
- All services imported and used by main `server.py`

**P3: Workflow Execution Engine**
- `execute_workflow()` runs workflows when orders are created
- Supports node types: trigger, action, condition, form
- Action types: assign_role, update_status, notify, email_user, forward_ticket, webhook
- Test endpoint: `POST /api/workflows/{id}/test`
- Execution logs: `GET /api/workflow-executions`
- Frontend: Workflows page has "Execution Logs" tab showing recent executions with status

**P3: SLA Breach Alerts**
- Background task runs every 15 minutes checking for SLA breaches
- Creates alerts for breaches (SLA exceeded) and warnings (4 hours before deadline)
- Notifications sent to assigned editors and all admins (for breaches)
- API endpoints:
  - `GET /api/sla-alerts` - List alerts
  - `GET /api/sla-alerts/statistics` - Get stats (on_track, at_risk, breached counts)
  - `POST /api/sla-alerts/{id}/acknowledge` - Acknowledge an alert
  - `POST /api/sla-check` - Manually trigger SLA check
- Frontend: SLA page has stats cards and "Alerts" tab with Refresh/Check Now buttons

### Phase 10: P2-3 Outgoing Webhooks ✅ (January 26, 2026)
Complete webhook system for external integrations:

- **Webhook Infrastructure**:
  - `trigger_webhooks()` function sends POST to configured URLs on events
  - Events supported: `order.created`, `order.updated`, `order.delivered`, `order.closed`, `message.sent`, `user.created`
  - Webhook delivery runs as background task (non-blocking)
  - Logs all deliveries to `webhook_logs` collection (success/failure, status code, response)

- **API Endpoints**:
  - `GET/POST /api/webhooks` - List and create webhooks
  - `PATCH /api/webhooks/{id}` - Update webhook (toggle active)
  - `DELETE /api/webhooks/{id}` - Delete webhook
  - `POST /api/webhooks/{id}/test` - Send test payload
  - `GET /api/webhooks/{id}/logs` - Get logs for specific webhook
  - `GET /api/webhook-logs` - Get all delivery logs

- **Frontend Integration**:
  - Integrations page now uses real API (not mock data)
  - Test button sends test payload and shows success/failure toast
  - Toggle and delete buttons work with backend
  - Webhook logs can be viewed

### Phase 9: P0-2 Completion & P2-1 Bug Fix ✅ (January 26, 2026)
Completed P0-2 unsaved changes guard on all remaining pages and fixed P2-1 user role assignment bug:

- **P0-2: Unsaved Changes Guard (COMPLETE)**:
  - Integrations page: API Key and Webhook dialogs show warning AlertDialog
  - SLA page: Create/Edit SLA dialog shows warning AlertDialog
  - EmailSettings page: Shows yellow "You have unsaved changes" text above Save button
  - Workflows page: Create and Duplicate workflow dialogs show warning AlertDialog
  - All warning dialogs have "Stay" and "Leave without saving" buttons
  - z-index set to 100 to ensure warnings appear above main dialogs
  - Browser refresh/close triggers beforeunload confirmation

- **P2-1: User Role Assignment Bug (FIXED)**:
  - Fixed default role logic in Users.js handleOpenDialog
  - New users now default to "Requester" role (not "Editor")
  - Users can select any role and are created with that role correctly

### Phase 8: New P0 Requirements ✅ (January 25, 2026)
Two critical P0 features implemented:

- **P0-1: Message Notifications (Resolver Alert)**:
  - When requester sends message on ticket, resolver gets notification via bell icon
  - If no resolver assigned, admins get notified instead
  - Notification includes ticket reference (order_code) and message preview (first 50 chars)
  - Long messages truncated with ellipsis
  - Works both ways: resolver messages notify requester

- **P0-2: Unsaved Changes Guard (Partial - Users, Categories, Announcements)**:
  - Users page: Add/Edit User dialog shows "Unsaved changes" warning
  - Categories page: Create/Edit Category dialog shows warning
  - Announcements page: Shows "You have unsaved changes" text, beforeunload handler
  - Warning dialog has "Stay" and "Leave without saving" options
  - Browser refresh/close triggers beforeunload confirmation

### Phase 7: P1 Requirements ✅ (January 25, 2026)
All 8 P1 features implemented:

- **P1-1: Branding Update**:
  - Changed "Red Ribbon" to "Red Ops" throughout the app
  - Sidebar header shows "Red Ops" with pulse animation on logo
  - Login page footer updated to "Red Ops Portal"

- **P1-2: Announcement Ticker**:
  - `/announcements` page for admin-controlled ticker management
  - Enable/disable toggle, message input, color pickers
  - Live preview shows ticker appearance
  - Ticker scrolls across top of all pages when active
  - Users can dismiss ticker for their session

- **P1-3: Workflow Location Fix**:
  - Added "Triggers" tab to `/workflows` page
  - Lists all L2 categories with workflow trigger toggles
  - Moved workflow trigger configuration from Categories to Workflows module

- **P1-4: Logs Module**:
  - New `/logs` page with System, API, UI, User tabs
  - Search input for filtering logs by message
  - Level filter dropdown (All, Error, Warning, Info, Success, Debug)
  - Auto-refresh toggle for live updates
  - Download button to export logs as text file
  - Backend: `/api/logs/{log_type}` endpoint

- **P1-5: Integrations Module**:
  - New `/integrations` page with API Keys and Webhooks tabs
  - API Keys: Create, view, revoke keys with permissions
  - Webhooks: Create, enable/disable, delete webhooks
  - Events selection for outgoing webhooks
  - Backend: `/api/api-keys`, `/api/webhooks` endpoints

- **P1-6: User Provisioning**:
  - "Force Password Change" toggle in Add/Edit User form
  - "Force OTP Setup" toggle in Add/Edit User form
  - OTP code (6 digits) logged to console (MOCKED email)
  - Backend: `force_password_change`, `force_otp_setup` fields on User model

- **P1-7: Edit User Enhancements**:
  - Team assignment dropdown in user form
  - Can re-trigger security flags when editing existing users
  - Security Options section with clear descriptions

- **P1-8: SLA Module**:
  - New `/sla` page for SLA management
  - Create SLA with name, description, priority
  - Response time and resolution time in hours
  - Assign SLA to role or team
  - Enable/disable, edit, delete SLAs
  - Backend: `/api/sla` CRUD endpoints

### Phase 6: P0 Requirements ✅ (January 25, 2026)
Core P0 requirements for ticket management:

- **P0-1: Requester Visibility**:
  - "Assigned to" field now visible in My Requests list (CommandCenter.js)
  - "Assigned to" field visible in Order Detail sidebar
  - Backend `/api/my-requests` includes `assigned_to_name` field

- **P0-2: Ticket Timestamps**:
  - "Created" timestamp with date and time visible in Order Detail
  - "Last Updated" timestamp visible in Order Detail
  - "Closed At" timestamp appears when ticket is closed

- **P0-3: Requester-side Close**:
  - "Close Ticket" button visible for requesters on their own open tickets
  - Close dialog requires reason (1-500 characters)
  - Backend `/api/orders/{order_id}/close` endpoint
  - New "Closed" status added to ORDER_STATUSES
  - "Close Reason" displayed in Order Info sidebar after closing

- **P0-4: Label Change**:
  - Changed "Editor" to "Assigned to" throughout the application
  - Orders.js filter dropdown: "Editor" → "Assigned to"
  - Orders.js table header: Shows "Assigned to"
  - OrderDetail.js sidebar: Shows "Assigned to" label

### Phase 5: Full i18n & Mobile Responsiveness ✅ (January 25, 2026)
Complete internationalization of all pages and mobile-responsive design:

- **Full-App Translations**:
  - Dashboard page with all KPI cards, sections, and buttons translated
  - Users page with table headers, buttons, and dialogs translated
  - Teams page with titles, stats, and dialogs translated
  - Categories page with dialog and labels translated
  - Sidebar navigation fully translated
  - Language switcher persists preference in localStorage

- **Mobile Responsiveness**:
  - Dashboard: KPI cards display in 2-column grid on mobile
  - Users page: Shows card-based layout instead of table on mobile (md:hidden)
  - Teams page: Stats stack vertically on mobile
  - Command Center: Form fields stack properly on mobile
  - All dialogs are responsive

- **Dynamic Database Content Translation**:
  - Categories now support multi-language names (name_en, name_pt, name_es)
  - Backend models updated: CategoryL1Create, CategoryL2Create include language fields
  - Frontend Categories dialog shows translation inputs with country flags
  - getCategoryName helper function displays correct translation based on current language

### Phase 4: UI Customization Module ✅ (January 25, 2026)
Admin-controllable UI text customization:

- **Backend**:
  - UI Settings CRUD API (`/api/ui-settings`)
  - 28 default UI settings organized by category (branding, navigation, buttons, labels, statuses, messages)
  - Auto-seed on startup if no settings exist

- **Frontend**:
  - UI Settings page (`/settings`) with search and category tabs
  - Editable text fields grouped by category
  - Reset to Defaults and Save Changes buttons
  - Settings linked from sidebar for Admin users

### Phase 3: Branding & i18n Foundation ✅ (January 24, 2026)
Custom branding and language switching:

- **Branding**:
  - Custom login page with background image and company logos
  - Sidebar with brand colors (Pantone 187 C red)
  - Circular logo on login form

- **i18n Foundation**:
  - react-i18next library integration
  - Language switcher component (compact and default variants)
  - Translation files for English, Portuguese, Spanish

### Phase 2: Visual Workflow Builder ✅ (January 24, 2026)
A drag-and-drop visual workflow builder similar to Go High Level / Microsoft Visio:

- **Backend**:
  - Full workflow CRUD API (`/api/workflows`)
  - Workflow models support: nodes (with position), edges (connections), node-specific data
  - 5 node types: Trigger, Form, Action, Condition, End
  - Action types: assign_role, forward_ticket, email_user, email_requester, update_status, notify, webhook
  - **Workflow Assignment**: Assign workflows to roles AND teams
  - **Category Triggers**: Auto-trigger workflows when tickets created in specific categories
  - Meta endpoints for available actions and form field types
  - Duplicate workflow functionality

- **Frontend**:
  - Workflows management page (`/workflows`) with card grid view
  - Visual workflow editor using React Flow library
  - Node palette with 5 node types (color-coded)
  - Canvas with grid background, drag-and-drop support
  - Node configuration side panel with type-specific settings
  - **Workflow Settings Panel**: Assign to Roles, Teams, and Trigger Categories
  - Save, clear, and back navigation
  - Duplicate and delete workflows

- **Node Types**:
  - **Trigger** (Green): Start point - Manual, Form Submit, Ticket Created, Status Changed, Schedule, Webhook
  - **Form** (Blue): Collect user data with customizable fields
    - **Dynamic Fields**: Text, Textarea, Number, Email, Phone, Date, Dropdown, Multi-Select, Checkbox, File
    - **Field Options**: For dropdown/multiselect types
    - **Trigger Flag**: Mark fields as triggers for workflow conditions
    - **Conditional Sub-Fields**: Show additional fields based on parent field value (e.g., if Category="Renovation", show "How many bedrooms?")
  - **Action** (Amber): Auto-assign role, forward ticket, email user/requester, update status, notify, webhook
  - **Condition** (Purple): Branch logic with Yes/No outputs
  - **End** (Red): Workflow completion

### Phase 1: Dynamic Roles System ✅ (January 24, 2026)
- **Backend**:
  - Roles CRUD endpoints (`/api/roles`)
  - Role validation for user creation/update
  - Pre-seeded 31 roles (2 system + 29 service providers)
  - `can_pick_orders` and `can_create_orders` permissions
  - System roles protected from modification/deletion
  
- **Frontend**:
  - Roles management page (`/roles`) with tabs by type
  - Role cards showing icon, color, description, permissions
  - Add/Edit role dialog with icon and color picker
  - Users page updated with dynamic role dropdown (grouped by type)
  - Sidebar updated with "Roles" link for Admin

### V2 Command Center ✅ (January 24, 2026)
- Command Center page with category-driven request forms
- 2-level category system (L1/L2)
- Feature Requests and Bug Reports tracking
- Profile page with avatar upload and password change
- Quick links for common actions

### V1 MVP ✅
- JWT authentication
- Order management workflow
- Messages and files per order
- Notifications system
- SLA tracking

## Admin Credentials
- Email: admin@redribbonops.com
- Password: Fmtvvl171**

## API Endpoints

### Workflows (NEW)
- GET `/api/workflows` - List all workflows
- GET `/api/workflows/{id}` - Get specific workflow
- GET `/api/workflows/by-role/{role_name}` - Get workflows for role
- GET `/api/workflows/by-team/{team_id}` - Get workflows for team
- GET `/api/workflows/by-category/{category_id}` - Get workflows triggered by category
- POST `/api/workflows` - Create workflow (Admin)
- PUT `/api/workflows/{id}` - Full update with nodes/edges (Admin)
- PATCH `/api/workflows/{id}` - Partial update (Admin)
- POST `/api/workflows/{id}/duplicate?new_name=X` - Duplicate workflow (Admin)
- DELETE `/api/workflows/{id}` - Soft delete workflow (Admin)
- GET `/api/workflows/meta/actions` - Available action types
- GET `/api/workflows/meta/field-types` - Available form field types

### Roles
- GET `/api/roles` - List all roles (filter by role_type, active_only)
- GET `/api/roles/service-providers` - List service providers
- POST `/api/roles` - Create role (Admin)
- PATCH `/api/roles/{id}` - Update role (Admin, non-system only)
- DELETE `/api/roles/{id}` - Deactivate role (Admin, non-system only)

### Users (uses dynamic roles)
- POST `/api/users` - Create user with any valid role
- PATCH `/api/users/{id}` - Update user including role change

## Tech Stack
- **Frontend**: React, React Router, Axios, Shadcn/UI, TailwindCSS, **React Flow**, **i18next**
- **Backend**: FastAPI, Pydantic, PyJWT, passlib
- **Database**: MongoDB (Motor async driver)

## Branding
- **Primary Color**: Pantone 187 C (#A2182C) - Red Ribbon Red
- **Secondary Color**: Pantone 730 C (#97662D) - Gold/Brown
- **Accent Color**: Pantone 5523 C (#AEC6C8) - Light Teal
- **Logo Assets**: `/public/assets/logos/` (logo-full.jpg, logo-badge.jpg, logo-icon.jpg, house-palm.jpg)

## Internationalization (i18n)
- **English** (primary) - Default language
- **Portuguese - Brazil** (secondary)
- **Spanish - Spain** (third option)
- Language preference stored in localStorage
- Translation files: `/src/i18n/locales/` (en.json, pt.json, es.json)

## MOCKED Features
- **SMTP email notifications** - Logged but not sent
- **OTP email delivery** - 6-digit codes logged to console

## Next Phases (Roadmap)

### P2: Integrations 🟠 (In Progress)
- Integrate Real SMTP (user provides credentials) - Backend ready, UI ready
- ~~Execute outgoing webhooks on events~~ ✅ DONE

### P2: Refactoring ✅ DONE
- ~~Refactor monolithic server.py into modular structure~~ ✅ DONE

### P3: Backend Improvements ✅ DONE
- ~~Workflow Execution Engine~~ ✅ DONE
- ~~SLA breach alerts and notifications~~ ✅ DONE
- Real-time log streaming for Logs module (remaining)

### P3: Backend Improvements 🟣
- Workflow Execution Engine (execute workflows on ticket creation)
- Real-time log streaming for Logs module

### P3: Future Enhancements 🟤
- SLA breach alerts and notifications
- API key usage analytics
- Webhook delivery logs and retry mechanism
- User activity audit trail

## Test Reports
- `/app/test_reports/iteration_1.json` - V1 MVP
- `/app/test_reports/iteration_2.json` - Simplified workflow
- `/app/test_reports/iteration_3.json` - V2 Command Center (100% pass)
- `/app/test_reports/iteration_4.json` - Phase 1 Dynamic Roles (100% pass)
- `/app/test_reports/iteration_5.json` - Phase 2 Visual Workflow Builder (100% pass)
- `/app/test_reports/iteration_6.json` - Workflow Builder Enhancements (100% pass)
- `/app/test_reports/iteration_7.json` - Branding & Internationalization (100% pass)
- `/app/test_reports/iteration_8.json` - Full i18n translations (100% pass)
- `/app/test_reports/iteration_9.json` - Mobile responsiveness & Categories multilang (95% pass)
- `/app/test_reports/iteration_10.json` - P0 Ticket features (100% pass)
- `/app/test_reports/iteration_11.json` - P1 Requirements (100% pass)
- `/app/test_reports/iteration_12.json` - P0 Message Notifications & Unsaved Changes (100% pass)
- `/app/test_reports/iteration_13.json` - P0-2 Completion & P2-1 Role Bug Fix (100% pass)
- `/app/test_reports/iteration_14.json` - P2-3 Outgoing Webhooks (100% pass)
- `/app/test_reports/iteration_15.json` - P2/P3 Refactor, Workflow Engine, SLA Alerts (100% pass)
