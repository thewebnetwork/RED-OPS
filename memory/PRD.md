# RED RIBBON OPS PORTAL - Product Requirements Document

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

## Next Phases (Roadmap)

### P1: Verify User Role Assignment Bug 🔴
- Re-test user creation to ensure correct role is assigned
- Check handleSaveUser function in Users.js
- Fix if still broken

### P2: Integrate Real SMTP 🟠
- User provides SMTP credentials
- Enable actual email sending for password resets and notifications

### P2: GHL/Marketplace Webhooks 🟠
- External integration webhooks
- Marketplace connectivity

### P3: Workflow Execution Engine 🟣
- Execute workflows when tickets are created
- Automatic role assignment based on workflow rules
- Email notifications using workflow actions
- Status updates based on workflow conditions

### P3: Refactor Backend 🟤
- Split monolithic server.py into modules
- Organize routes, models, and services

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
