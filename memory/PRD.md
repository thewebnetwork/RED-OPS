# Red Ops Platform - Product Requirements Document

## Overview
A comprehensive operations management platform designed as a request and fulfillment system for Partners, Media Clients, and Vendors.

## Current Version: 4.5 (Multi-Dashboard System Complete)
**Last Updated:** February 2026
**Platform Name:** Red Ops
**Preview URL:** https://user-auth-36.preview.emergentagent.com

---

## LATEST: P0 Multi-Dashboard System Complete ✅

### Dashboard Builder Features (February 2026)

**4 System Dashboard Templates:**
| Template | Widgets | Default For | Description |
|----------|---------|-------------|-------------|
| **Admin Executive** | 19 | Administrator | Full visibility with all KPIs, analytics, pool metrics |
| **Resolver/Operator** | 11 | Internal Staff | Work-focused with personal workload and SLA tracking |
| **Partner/Vendor** | 9 | Partner | Opportunity-focused with pool access |
| **Requester/Client** | 10 | Media Client | Requester view with submitted tickets only |

**Dashboard Assignment:**
- New "Dashboard Type" dropdown in IAM User Create/Edit form
- Required field - admin must explicitly assign
- Takes effect on user's next login/refresh

**Dashboard Builder UI (Settings → Dashboard Builder):**
- Create custom dashboards
- Clone existing templates
- Drag & drop widget reordering (@dnd-kit)
- Widget size options: Small (4 cols), Medium (6 cols), Large (12 cols)
- Preview as different roles
- Widget library with 7 categories

**Widget Library:**
- KPI Cards (Open, In Progress, Pending, Delivered, Closed)
- SLA Status (On Track, At Risk, Breached)
- Pool Status (Pool 1/2 Available, Pickups, Avg Pick Time)
- My Workload (Working On, Waiting, Delivered 7d)
- Charts (Status Volume, Categories, SLA Trend, Pool Routing)
- Ticket Lists (Working On, Waiting, Pending Review, Recently Delivered)
- Announcements

**Permission-Based Widget Auto-Hide:**
- Widgets have `required_permissions` field
- Auto-hidden if user lacks permission
- Preview API shows visible vs hidden widget counts

**API Endpoints:**
- `GET /api/dashboards/list` - List all dashboard templates
- `POST /api/dashboards` - Create custom dashboard
- `PUT /api/dashboards/{id}` - Update dashboard
- `DELETE /api/dashboards/{id}` - Delete custom dashboard
- `POST /api/dashboards/{id}/clone` - Clone dashboard
- `GET /api/dashboards/{id}/preview?role=X` - Preview as role
- `GET /api/dashboards/widgets` - Widget library

---

## Previous: P0 Dashboard Rebuild Complete ✅

### Category Seeding Complete
| Metric | Count |
|--------|-------|
| **L1 Categories** | 42 |
| **L2 Subcategories** | 403 |
| **Total** | 445 |

**Category Families Covered:**
- Marketing & Creative (6 L1, ~60 L2)
- Production & Media (3 L1, ~30 L2)
- Residential Real Estate (3 L1, ~30 L2)
- Commercial Real Estate (3 L1, ~30 L2)
- Sales & CRM (3 L1, ~28 L2)
- Customer Support (2 L1, ~19 L2)
- IT & Systems (3 L1, ~29 L2)
- Finance & Accounting (4 L1, ~33 L2)
- HR & People Ops (4 L1, ~33 L2)
- Legal & Compliance (2 L1, ~17 L2)
- Operations & Admin (2 L1, ~18 L2)
- Construction & Trades (5 L1, ~47 L2)
- Projects & Initiatives (2 L1, ~17 L2)

**Export Location:** `/app/backups/category_seed/`
- `categories_l1.json`, `categories_l2.json`
- `categories_full.json` (combined)
- `categories_l1.csv`, `categories_l2.csv`

**Re-Import Script:** `/app/backend/scripts/seed_categories.py`

### Documentation Updated
System Documentation Pack now includes Section 9: Categories & Subcategories

**Download Location:** Settings → Documentation
- PDF (161 KB)
- DOCX (50 KB)
- Markdown (31 KB)
- HTML (52 KB)

---

## UAT Ready Checklist ✅

### Deliverable Complete
A comprehensive "Red Pulse System Documentation Pack" has been created with all formats:

| File | Format | Size | Download Path |
|------|--------|------|---------------|
| Red_Pulse_System_Documentation.pdf | PDF | 146 KB | `/api/documentation/system-docs-pack/download/Red_Pulse_System_Documentation.pdf` |
| Red_Pulse_System_Documentation.docx | DOCX | 48 KB | `/api/documentation/system-docs-pack/download/Red_Pulse_System_Documentation.docx` |
| Red_Pulse_System_Documentation.md | Markdown | 27 KB | `/api/documentation/system-docs-pack/download/Red_Pulse_System_Documentation.md` |
| Red_Pulse_System_Documentation.html | HTML | 45 KB | `/api/documentation/system-docs-pack/download/Red_Pulse_System_Documentation.html` |

**Local Path:** `/app/backups/system_docs/`

### API Endpoints
- `GET /api/documentation/system-docs-pack` - List all available doc files
- `GET /api/documentation/system-docs-pack/download/{filename}` - Download specific file

### Document Contents (Table of Contents)
1. Executive Overview
2. Modules & Navigation Map
3. Identity & Access Management (IAM)
4. Ticket Lifecycle & Rules
5. Pools & Opportunity Ribbon
6. Workflow Engine
7. Notifications & Email
8. Reports
9. Integrations
10. Admin Operations
11. Design Rationale – Why We Built It This Way
12. Known Issues / Tech Debt / Open Items

---

## UAT Data Reset Complete ✅

### Data Reset Complete
All operational data has been cleared for UAT testing:

| Collection | Status |
|------------|--------|
| Tickets (orders) | ✅ 0 (backed up 32) |
| Order messages | ✅ 0 (backed up 30) |
| Order files | ✅ 0 (backed up 4) |
| Notifications | ✅ 0 (backed up 51) |
| Announcements | ✅ 0 |
| Activity logs | ✅ 0 (backed up 19) |
| Bug reports | ✅ 0 (backed up 13) |
| Feature requests | ✅ 0 (backed up 4) |
| Pool queues | ✅ Empty |

**Backup Location:** `/app/backups/uat_reset_final/`

### Configuration Preserved
- Users (1 admin)
- Roles, Account Types, Teams, Specialties
- Categories L1/L2
- Workflows, SLA Policies, Escalation Policies
- SMTP Config, Integrations, Settings

### Build Inventory Document
Full system inventory for UAT reference: `/app/memory/Build_Inventory_Snapshot.md`

---

## P0 - Complete Application Translations ✅

### Overview
Full internationalization (i18n) support with comprehensive translations for Spanish and Portuguese. All UI text is now translatable, and administrators can review/correct translations through a new Translation Editor page.

### Languages Supported
| Language | Code | Status |
|----------|------|--------|
| English | en | ✅ Complete (700+ keys) |
| Spanish (España) | es | ✅ Complete (700+ keys) |
| Portuguese (Brasil) | pt | ✅ Complete (700+ keys) |

### Features Implemented
1. **Comprehensive Translation Files** - All three JSON files (`en.json`, `es.json`, `pt.json`) updated with 700+ translation keys covering:
   - Authentication (login, password reset)
   - Navigation (sidebar items)
   - Dashboard (KPIs, SLA status, ticket sections)
   - Orders and tickets
   - User management (IAM)
   - Settings pages
   - Workflows
   - Forms and actions
   - Error messages
   - Success notifications

2. **Translation Editor Page** (`/settings/translations`)
   - Admin-only access
   - Language selector (Spanish/Portuguese)
   - Search functionality to find specific keys
   - Side-by-side English reference and target translation
   - Inline editing capability
   - Save button (logs changes for manual update)

3. **Updated Components**
   - Sidebar navigation: All items use translation keys
   - Dashboard: All hardcoded strings replaced with t() calls
   - Settings Hub: Added Translation Editor card

### New Translation Keys Added
- `nav.reportIssue` - "Report an Issue"
- `nav.opportunityRibbon` - "Opportunity Ribbon"  
- `nav.deletedTickets` - "Deleted Tickets"
- `settings.translations.*` - Translation Editor page strings

### Files Modified/Created
- `/app/frontend/src/i18n/locales/en.json` - Comprehensive English translations
- `/app/frontend/src/i18n/locales/es.json` - Complete Spanish translations
- `/app/frontend/src/i18n/locales/pt.json` - Complete Portuguese translations
- `/app/frontend/src/pages/TranslationEditorPage.js` - **NEW** Translation editor UI
- `/app/frontend/src/pages/SettingsHub.js` - Added Translation Editor link
- `/app/frontend/src/components/Layout.js` - All nav items use labelKey
- `/app/frontend/src/pages/Dashboard.js` - Replaced hardcoded strings with t()
- `/app/frontend/src/App.js` - Added route for TranslationEditorPage

### Testing Status
- ✅ Login page translations verified (EN/ES/PT)
- ✅ Dashboard translations verified
- ✅ Sidebar navigation fully translated
- ✅ Translation Editor page functional
- ✅ Language switcher persists selection

---

## P0 - Configurable Pool Eligibility Rules ✅

### Overview
Pool eligibility is now admin-configurable instead of hard-coded. Admins can control which account types can pick from which pools.

### Settings Location
**Settings → Pool Picker Rules** (`/settings/pool-picker-rules`)

### Configuration Structure
| Account Type | Default can_pick | Default allowed_pools |
|--------------|------------------|----------------------|
| Partner | ✅ true | POOL_1 |
| Internal Staff | ✅ true | POOL_1 |
| Vendor/Freelancer | ✅ true | POOL_2 |
| Media Client | ❌ false | [] |

### Eligibility Logic
```
effective_can_pick = account_type_config.can_pick AND user.can_pick
```
- **Account Type Config:** Controls which pools each account type can access
- **User-level "Can Pick":** Individual user override (in user edit form)
- User can only pick from pools if BOTH conditions are true

### API Endpoints
- `GET /api/pool-picker-rules` - Get all rules
- `PATCH /api/pool-picker-rules/{account_type:path}` - Update rule for account type
- `POST /api/pool-picker-rules/reset-defaults` - Reset to defaults

### User Field Added
- `can_pick`: Boolean field (default: true)
- Available in UserCreate, UserUpdate, UserResponse
- Toggle in user edit form: "Can pick opportunities from pools"

### Files Modified
- `/app/backend/routes/settings.py` - Pool picker rules endpoints
- `/app/backend/routes/orders.py` - `get_pool_picker_config()`, `get_eligible_pool_users()`, `determine_pool_routing()`
- `/app/backend/routes/users.py` - `can_pick` field
- `/app/frontend/src/pages/PoolPickerRulesPage.js` - Admin UI
- `/app/frontend/src/pages/IAMPage.js` - "Can Pick" toggle in user form

---

## Pool 1 Routing Fix - Partners + Internal Staff ✅

### A) Data Model Changes ✅
- **From:** Single `specialty_id` (one-to-one)
- **To:** Multiple specialties via `specialty_ids` array (many-to-many)
- **New User Fields:**
  - `specialty_ids`: Array of specialty IDs
  - `primary_specialty_id`: Which specialty is marked as primary
  - `specialties`: Array of objects with `{id, name, is_primary}`
- **Backwards Compatibility:** Legacy `specialty_id` and `specialty_name` still returned (set to primary or first specialty)

### B) User Create/Edit UI ✅
- **Multi-select:** Specialty field is now a scrollable checklist with checkboxes
- **Primary Badge:** Can mark one specialty as "Primary" using "Set Primary" badges
- **Selection Indicator:** Shows "Selected: N specialties • Primary: [name]"
- **Validation:** At least one specialty is required

### C) Routing & Pool Logic Updated ✅
- **ANY Match Rule:** User is eligible for Pool 1/Pool 2 if ANY of their specialties match the ticket's routing specialty
- **Query:** `$or: [{specialty_ids: routing_specialty_id}, {specialty_id: routing_specialty_id}]`
- **Notifications:** Only users with a matching specialty receive pool notifications

### D) Migration Endpoint ✅
- **Endpoint:** `POST /api/users/migrate/single-to-multi-specialty`
- **Function:** Converts users with `specialty_id` to `specialty_ids` array
- **Status:** 39 users already migrated

### E) Files Modified
- `/app/backend/routes/users.py` - UserCreate, UserUpdate, UserResponse models updated
- `/app/backend/routes/orders.py` - Pool routing uses multi-specialty queries
- `/app/frontend/src/pages/IAMPage.js` - Multi-select specialty UI

---

## P0 Features - Documentation Download + Pool Routing Fix ✅

### A) Documentation Download (Admin-only) ✅
- **Location:** Settings → System Documentation
- **Features:**
  - View rendered markdown content inline
  - Download as .md file
  - Download as PDF (client-side generation via jspdf)
  - Last updated timestamp displayed
- **Access Control:** Administrator role only (non-admins get 403)
- **Endpoints:**
  - `GET /api/documentation/system-logic-snapshot` - Get markdown content
  - `GET /api/documentation/system-logic-snapshot/download?format=md` - Download .md
  - `GET /api/documentation/system-logic-snapshot/download?format=pdf` - Get content for PDF
- **Files:**
  - Backend: `/app/backend/routes/documentation.py`
  - Frontend: `/app/frontend/src/pages/DocumentationPage.js`
  - Source: `/app/memory/System_Logic_Snapshot.md`

### B) Smart Pool Routing Logic ✅
- **Problem Solved:** Tickets were routing to Pool 1 even when no eligible Partners existed
- **New Logic:**
  1. When ticket becomes Open, determine `routing_specialty_id` from category L2/L1
  2. Query eligible Partners (account_type=Partner, matching specialty, active=true)
  3. If eligible Partners > 0 → `pool_stage = POOL_1`, set `pool1_expires_at` = now + 24h
  4. If eligible Partners = 0 → Skip Pool 1, `pool_stage = POOL_2` immediately
  5. After 24h in Pool 1, automatically promote to Pool 2
- **New Order Fields:**
  - `pool_stage`: "POOL_1" or "POOL_2"
  - `routing_specialty_id`: Specialty ID for routing
  - `routing_specialty_name`: Specialty name for display
  - `pool1_expires_at`: When Pool 1 access expires
- **Notifications:** Only users matching the ticket's specialty receive notifications
- **Files Modified:**
  - `/app/backend/routes/orders.py` - Added `determine_pool_routing()` and `notify_pool_users()`
  - `/app/backend/utils/helpers.py` - Added pool fields to `normalize_order()`
  - `/app/backend/routes/categories.py` - Added `specialty_id` to CategoryL2Update

---

## System Logic Snapshot Document ✅

A comprehensive **System Logic Snapshot** has been created at `/app/memory/System_Logic_Snapshot.md` for UAT preparation.

**Contents:**
1. Core Ticket Lifecycle + Status Rules (all statuses, transitions, permissions, required fields)
2. Routing Logic (Pool 1/Pool 2 conditions, specialty filtering, reassignment)
3. Workflow Engine Logic (triggers, actions, conditions, category evaluation)
4. IAM Logic (role permissions, overrides, account types, module restrictions)
5. Notifications + Email + Surveys (in-app events, email triggers, survey logic)
6. Reports Module (data sources, role access, export formats)
7. Test Harness / Data Reset (reset procedures, preservation guidelines)

---

## P0 - Force Password Change & OTP/2FA Security Flow ✅

### A) Forced Password Change ✅
- **Trigger:** `force_password_change = true` flag on user
- **Flow:** User redirected to `/force-password-change` after login
- **Page:** `ForcePasswordChange.js` - Clean form with password requirements
- **Requirements:**
  - 8+ characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 number
- **Endpoint:** `POST /api/auth/force-change-password`
- **Result:** Flag cleared, user proceeds to app (or OTP setup if required)

### B) Two-Factor Authentication (OTP) Setup ✅
- **Trigger:** `force_otp_setup = true` flag on user
- **Flow:** After password change (if required), user redirected to `/setup-otp`
- **Page:** `SetupOTP.js` - QR code display with manual secret option
- **Dependencies:** `pyotp` (backend), `qrcode.react` (frontend)
- **Endpoints:**
  - `GET /api/auth/otp/setup` - Get QR code URI and secret
  - `POST /api/auth/otp/verify` - Verify OTP code during setup
- **Trust Device:** 30-day trust option to skip OTP on trusted devices
- **Result:** `otp_verified = true`, `force_otp_setup = false`

### C) OTP Login Verification ✅
- **Trigger:** User has `otp_verified = true` (OTP enabled)
- **Page:** `VerifyOTP.js` - 6-digit code entry
- **Endpoint:** `POST /api/auth/otp/verify-login`
- **Trust Device:** Option to remember device for 30 days

### D) Admin Controls ✅
- **User Creation:** Toggles for "Force Password Change" and "Force OTP Setup"
- **User Edit:** Can set/clear flags at any time
- **Disable OTP:** `DELETE /api/auth/otp/disable` (Admin only)

---

## P1 - Live Email Notifications for Ticket Status Changes ✅

### A) Email Types Implemented ✅
| Email Type | Trigger | Recipients |
|------------|---------|------------|
| ticket_created | Order creation | Requester |
| ticket_picked_up | Order picked from pool | Requester |
| ticket_assigned | Order assigned to resolver | Resolver |
| ticket_status_changed | Status → In Progress/Pending/Delivered/Closed | Requester |
| ticket_pending_review | Status → Pending | Requester (action required) |
| ticket_closed | Ticket closed by admin/requester | Requester (if closed by admin) |
| ticket_reopened | Ticket reopened by admin | Requester + Editor |
| ticket_reassigned | Ticket reassigned | Old Editor + New Resolver + Requester |
| ticket_cancelled | Ticket cancelled | Resolver + Admins |

### B) Email Features ✅
- **HTML Formatting:** Professional templates with Red Ops branding
- **Status-Specific Colors:** Visual status indicators in emails (blue for Open, amber for In Progress, purple for Pending, green for Delivered, gray for Closed)
- **Direct Links:** Each email includes link to view ticket in Red Ops
- **SMTP:** Live Gmail configuration (admin@redribbongroup.ca)

### C) Implementation Details ✅
- **notify_status_change()**: Enhanced to send emails alongside in-app notifications
- **close_order()**: Sends email to requester when admin closes ticket
- **reopen_order()**: Sends email to requester and editor
- **reassign_order()**: Sends email to all affected parties

---

## P0 - Admin Ticket Soft-Delete ✅

### A) Soft-Delete Functionality ✅
- **Delete Button:** Visible on Order Detail page for Administrators only
- **Mandatory Reason:** Admin must provide reason for deletion (audit trail)
- **Soft-Delete Fields:** `deleted`, `deleted_at`, `deleted_by_id`, `deleted_by_name`, `deletion_reason`
- **API Endpoints:**
  - `DELETE /api/orders/{id}` - Soft-delete with reason
  - `POST /api/orders/{id}/restore` - Restore deleted ticket
  - `GET /api/orders/deleted/list` - List all deleted tickets

### B) Deleted Tickets Management Page ✅
- **Route:** `/deleted-tickets` (Admin only)
- **Features:**
  - Search by ticket code, title, requester, or deletion reason
  - Table showing: Ticket info, Status before delete, Deleted by, Deleted at, Reason
  - View button to see full ticket details
  - Restore button with confirmation dialog
- **Navigation:** Added to sidebar for Administrators

### C) Access Control ✅
- Non-admin users cannot see Delete button
- Non-admin users cannot access /deleted-tickets route
- Delete button hidden for already-deleted tickets

---

## P1 - SLA Policy Templates ✅

### A) Templates Tab ✅
- **Location:** SLA & Escalation Policies page → "Templates" tab
- **Purpose:** Pre-configured SLA policy templates for quick policy creation

### B) Available Templates ✅
| Template | Duration | Escalations | Description |
|----------|----------|-------------|-------------|
| Standard SLA | 24h | 2 | Standard response/resolution with 4h at-risk warning |
| Urgent SLA | 4h | 3 | High-priority with immediate escalation chain |
| Business Hours SLA | 8h | 2 | Business hours only (9AM-5PM) |
| Premium Partner SLA | 2h | 4 | Top-tier partners with aggressive escalation |
| Extended SLA | 72h | 3 | Complex requests with 3-day window |
| First Response SLA | 1h | 2 | Focused on initial acknowledgment |

### C) Use Template Flow ✅
1. Click "Use Template" button
2. Policy dialog opens with pre-filled values
3. Customize scope, escalation actions
4. Save as new policy

---

## P1 - Logo Animation Fix ✅

### Issue
Logo in sidebar had constant pulse animation that was distracting.

### Fix ✅
- **Before:** `animate-ping` + `animate-pulse` CSS animations
- **After:** Subtle glow effect with `bg-white/20 blur-sm`
- **Result:** Professional, non-distracting logo appearance

---

## P0 - IAM Searchable Dropdowns & Email Alerts ✅

### A) Searchable Dropdowns ✅
- **All IAM dropdowns** now use `SearchableSelect` component with type-to-filter functionality
- **User Create/Edit Dialog:**
  - Role dropdown (searchable)
  - Account Type dropdown (searchable)
  - Team dropdown (searchable, optional)
  - Specialty dropdown (searchable)
  - Subscription Plan dropdown (searchable, for Partners only)
- **Team Edit Dialog:**
  - Related Specialties multi-select (searchable, with badge display)
- **Component:** `/app/frontend/src/components/ui/searchable-select.jsx`

### B) Team-Specialty Relationship ✅
- **Backend:** `teams` model includes `related_specialty_ids` field
- **UI:** Team edit dialog has multi-select for assigning specialties to teams
- **User Filtering:** When creating/editing users, if a team is selected that has related specialties, the specialty dropdown filters to only show those specialties
- **Team Cards:** Display related specialty names as badges

### C) User Account Email Alerts ✅
- **Account Created Email:**
  - Sends welcome email with username, temporary password, role, login URL
  - HTML formatted with Red Ops branding
  - Security notes about password change and OTP setup
  - Toggle in Add User dialog: "Send welcome email with login credentials" (ON by default)
- **Account Disabled Email:** Notification when account is deactivated
- **Account Reactivated Email:** Notification when account is restored
- **SMTP:** Live Gmail configuration (admin@redribbongroup.ca)

### D) Temp Password Generation ✅
- **Auto-Generated:** 12-character random password on new user creation
- **Editable:** Admin can modify before saving
- **Show/Hide:** Eye icon toggle on password field
- **Regenerate:** Refresh button to generate new password

---

## P0 - Role Permission Matrix Restored ✅

### Issue
The granular permissions matrix (checkboxes) was missing from IAM → Roles, preventing access control validation.

### Fix Applied ✅
- **Permission Matrix UI restored** in Role edit dialog
- **6 Collapsible Modules:**
  - Dashboard (view)
  - Orders/Tickets (view, create, edit, delete, export, pick, assign)
  - Users (view, create, edit, delete)
  - Teams (view, create, edit, delete)
  - Settings (view, edit)
  - Reports (view, export)
- **Enable All / Disable All** buttons per module
- **Individual checkboxes** for each action
- **Save persists** permissions to backend via `PATCH /api/iam/roles/{id}`

### Note
Admin account was accidentally deactivated - has been reactivated.

---

## Workflow Editor Fixes

### A) P0 - ResizeObserver Crash Fixed ✅
- **Issue:** Workflow editor crashed with "ResizeObserver loop completed with undelivered notifications"
- **Fix:** Added window.onerror handler to suppress benign ResizeObserver loop errors
- **Verified:** Opened 5+ workflows back-to-back without crashes

### B) P1 - "Route to Specialty" Action Added ✅
- **New Action:** `assign_specialty` - Routes tickets to users with a specific specialty
- **Config Options:**
  - **Specialty Dropdown:** Select target specialty
  - **Pool Preference:** Any pool / Pool 1 (Partners) / Pool 2 (Vendors)
  - **Fallback:** Leave unassigned / Route to Admin queue / Assign to any specialty
- **Backend:** `workflow_engine.py` handles action - sets `required_specialty_id` on order and auto-assigns if eligible user found

---

## SMTP Email Configuration ✅
- **Host:** smtp.gmail.com:587
- **Login:** fmtvvlb@gmail.com
- **From Address:** admin@redribbongroup.ca (alias)
- **Status:** LIVE - All email notifications now working

---

## Pool Notifications & Reports Module Validated

### A) Pool 1 → Pool 2 Transitions ✅
- **Logic:** Tickets open >24 hours automatically move from Pool 1 to Pool 2
- **Background Task:** `check_pool_transitions()` runs every 5 minutes via `server_v2.py`
- **Notification:** Vendors receive email when tickets enter Pool 2 (MOCKED - SMTP not configured)
- **Filtering:** Partners see Pool 1, Vendors see Pool 2, Admins see both

### B) Reports Module Validated ✅
- **13 Canned Reports:** Volume (2), Aging (1), Performance (2), SLA (2), Distribution (4), Escalation (1), Workflow (1)
- **Filters:** Date range, Status, Category L1/L2, Team, Assignee, Specialty, Access Tier, SLA State, Search
- **Export:** CSV (proper headers, downloads) and PDF (JSON data for jsPDF frontend generation)
- **Reports Available:**
  - Tickets Created / Closed (day/week/month breakdown)
  - Open Ticket Aging (0-24h, 1-3d, 3-7d, 7-14d, 14d+ buckets)
  - Avg Time to First Response / Resolution
  - SLA Compliance Summary (compliance_rate)
  - Tickets by Assignee/Team/Specialty/Category
  - Escalation Events Report
  - SLA Policy Effectiveness
  - Stale Pending Review Tickets (24h/5d workflow)

---

## P1 Improvements Completed

### A) Categories - Move Subcategories ✅
- **Feature:** Subcategories can now be moved to different Level 1 (parent) categories
- **How:** Edit dialog shows Parent Category dropdown with "(change to move)" hint
- **Backend:** `PATCH /api/categories/l2/{id}` accepts `category_l1_id` field
- **Validation:** New parent must exist, `category_l1_name` auto-updated

### B) Logs Module Improvements ✅
- **Empty States:** Descriptive messages for each log type (system, api, ui, user)
- **Control Labels:** Clearer labels with tooltips - "Live Stream", "Poll (5s)", "Download"
- **Real Data:** Logs from `activity_logs` collection, no sample/mock data
- **Header:** Updated to "View and export application logs across all modules"

### C) Announcements 24h Retention ✅
- **Feature:** Expired announcements retained for 24 hours before auto-deletion
- **Backend:** `GET /api/announcements` filters out announcements expired > 24h and auto-deletes
- **UI:** Status badge shows "Expired (24h retention)" for expired announcements
- **Purpose:** Allows admins to review/reactivate recently expired announcements

---

## UAT Round 3 Fixes Completed

### A) Dashboard Restructured ✅
- **Old:** "Recent Orders" list
- **New:** "Tickets I'm Working On" + "Tickets Delivered" sections for ALL roles
- **Added:** "My Submitted Tickets" KPI widget linking to /my-tickets
- **Endpoint:** `GET /api/dashboard/my-work` returns `working_on`, `delivered`, `my_submitted_count`

### B) Sidebar Renamed ✅
- **Old:** "My Tickets"
- **New:** "My Submitted Tickets"

### C) "Manage Users" Button Removed ✅
- Removed from Admin dashboard (use sidebar navigation instead)

### D) File Upload Fixed ✅
- **New Endpoint:** `POST /api/orders/{order_id}/files/upload` (multipart/form-data)
- **Download:** `GET /api/orders/{order_id}/files/{file_id}/download`
- Files saved to `/app/uploads/{order_id}/`

### E) Workflow "Auto-Assign Role" Dropdown Fixed ✅
- **Issue:** Dropdown was empty due to filtering by `can_pick_orders` field
- **Fix:** Removed filter, now shows all roles (Administrator, Privileged User, Standard User)

### F) Bug/Issue Tickets Visibility Fixed ✅
- **Issue:** Bug reports not showing in All Orders or My Submitted Tickets
- **Fix:** Bug reports now create BOTH `bug_reports` AND `orders` records
- **Result:** Admins see all tickets in All Orders, requesters see in My Submitted Tickets

### G) Pool Filtering Fixed ✅
- **Issue:** Partners seeing Support/Issue tickets they shouldn't handle
- **Fix:** Pool endpoint now excludes Issue/Bug/Support tickets unless user has support specialty
- **Rules:** Partners/Vendors only see service tickets matching their specialty

### H) Announcements Instant Clear ✅
- Polling reduced from 60s to 10s for faster banner updates

---

## UAT Round 2 Fixes Completed

### A) Ticket Creation Fixed ✅
- **Issue:** Submit button not showing for some categories (e.g., Photography)
- **Fix:** Added `GenericRequestForm` that shows for ALL L2 category selections that don't have special forms
- **Result:** Submit button ALWAYS appears after L2 category selection

### B) Report an Issue Fixed ✅
- **Issue:** Page showing "Failed to load" 
- **Fix:** Same GenericRequestForm fix + proper error handling
- **Route:** `/command-center?type=issue`

### C) Opportunity Ribbon Clarification ✅
- **Behavior:** Pool shows UNASSIGNED tickets only (by design)
- **Assigned tickets:** Go to resolver's "My Assigned Tickets" (new endpoint)
- **New endpoint:** `GET /api/orders/my-assigned`

### D) Admin Force to Pool 2 ✅
- **New Feature:** Admin can bypass 24h right-of-first-refusal
- **Endpoint:** `POST /api/orders/{id}/force-pool-2`
- **UI:** "Force to Pool 2" button on OrderDetail for Admin
- **Requirements:** Ticket must be Open AND unassigned
- **Audit:** Logged with timestamp, admin name, reason

### E) Dashboard Button Removed ✅
- **Issue:** Duplicate "+NEW REQUEST" button
- **Fix:** Removed from Dashboard.js - users should use sidebar navigation

### F) My Tickets Renamed ✅
- **Old:** "My Tickets"
- **New:** "My Submitted Tickets"
- **Clarifies:** These are tickets the user submitted (not assigned to them)

---

## Pool System Explained

### Pool 1 (Partners)
- **Who sees it:** Partners
- **When tickets appear:** Immediately on creation
- **Contains:** Open + unassigned tickets

### Pool 2 (Vendors/Freelancers)
- **Who sees it:** Vendors/Freelancers
- **When tickets appear:** After 24 hours (right-of-first-refusal expired)
- **Contains:** Open + unassigned tickets, pool_entered_at > 24h ago
- **Admin override:** "Force to Pool 2" bypasses 24h wait

### Assigned Tickets
- **Where they go:** Removed from pools, appear in resolver's work queue
- **Endpoint:** `GET /api/orders/my-assigned`

---

## Test Reports
- Latest: `/app/test_reports/iteration_40.json` (91.7% pass - Email notifications verified)
- Previous: `/app/test_reports/iteration_39.json` (100% pass - P0/P1 features)
- Earlier: `/app/test_reports/iteration_38.json` (100% pass)

---

## Key API Endpoints

### Orders
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/orders` | POST | Create ticket |
| `/api/orders/my-requests` | GET | My submitted tickets |
| `/api/orders/my-assigned` | GET | Tickets assigned to me (resolver) |
| `/api/orders/pool/1` | GET | Pool 1 (Partners) |
| `/api/orders/pool/2` | GET | Pool 2 (Vendors) |
| `/api/orders/{id}/force-pool-2` | POST | Admin force to Pool 2 |
| `/api/orders/{id}/pick` | POST | Pick ticket from pool |
| `/api/orders/{id}/reassign` | POST | Reassign ticket |
| `/api/orders/{id}/reopen` | POST | Admin reopen closed ticket |
| `/api/orders/{id}/cancel` | POST | Requester cancel ticket |

### Announcements
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/announcements` | GET | List all (Admin) |
| `/api/announcements` | POST | Create |
| `/api/announcements/{id}` | PATCH | Update |
| `/api/announcements/{id}` | DELETE | Delete |
| `/api/announcements/active` | GET | Get active for user |

### IAM
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/iam/roles` | GET/POST | Role CRUD |
| `/api/iam/account-types` | GET/POST | Account Type CRUD |

---

## Forms in CommandCenter

| Form | Condition |
|------|-----------|
| EditingRequestForm | `triggers_editor_workflow` |
| FeatureRequestForm | L2 name matches "Feature Request" pattern |
| BugReportForm | L2 name matches "Bug" pattern |
| **GenericRequestForm** | **All other L2 selections** |

---

## Sidebar Navigation

### All Users
- Dashboard
- My Services
- **My Submitted Tickets** (renamed)
- Submit New Request
- Report an Issue
- Opportunity Ribbon (NOT for Media Clients)
- Reports

### Admin Only
- All Orders
- Identity & Access (6 tabs)
- Logs
- Announcements
- Settings

---

## Test Credentials
- **Admin:** admin@redribbonops.com / Fmtvvl171**

---

## Mocked Integrations
- **Email (SMTP):** MOCKED if SMTP credentials not configured
- **GHL Payment:** `/api/webhooks/ghl-payment-mock`

---

## Test Reports
- Latest: `/app/test_reports/iteration_32.json` (100% pass)

---

## File References

### Frontend (Key Changes)
- `CommandCenter.js` - GenericRequestForm added
- `OrderDetail.js` - Force to Pool 2 button
- `Dashboard.js` - +NEW REQUEST button removed
- `MyRequests.js` - Renamed to "My Submitted Tickets"
- `RibbonBoard.js` - Pool visibility (unassigned only)

### Backend (Key Changes)
- `routes/orders.py` - `/my-assigned`, `/force-pool-2` endpoints
- `routes/settings.py` - Announcements CRUD
- `services/email.py` - Email notification templates
