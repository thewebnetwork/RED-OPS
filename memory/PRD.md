# Red Ribbon Ops - Product Requirements Document

**Last Updated:** December 2024  
**Version:** 4.0 - Document Implementation Complete

## Recent Updates (Dec 2024)

### Phase 1: MVP Blocker Fixes (COMPLETED)
- Backend RBAC alignment (Administrator/Operator/Standard User)
- Frontend mode enforcement via PrivateRoute
- Service Catalog flow with query parameters
- ClientHome API endpoint fix
- Terminology cleanup ("Ticket" → "Request") in UI
- i18n sync for ES/PT translations

### Phase 2: Document Implementation (COMPLETED - Dec 2024)
**From RedOps_Emergent_Brief_Complete.docx**

1. **Real Service Catalog Endpoint** ✅
   - Built `/api/categories/catalog` returning 8 RRM services
   - Services: Video Editing (60s, Stories, Long-form), Thumbnail Design, Content Writing, Social Media Graphics, Email Campaigns, Website Updates
   - Updated ServiceCatalog.js fallback to match

2. **Comprehensive "Ticket" → "Request" Cleanup** ✅
   - RibbonBoard.js: All variables renamed (pool1Requests, handlePickRequest, PoolRequestCard, etc.)
   - en.json: 40+ "ticket" references replaced with "request"
   - Test IDs updated (my-requests-page, pool-request-*, pick-request-*)
   - All component links updated

3. **Translation Enhancements** ✅
   - Added missing ribbon/pool translations
   - Synced ES/PT files with new RRM service catalog
   - All client-facing text uses "Request" terminology

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

### Frontend Restructuring - 3 Modes (COMPLETED - Feb 2025)
Restructured frontend into 3 distinct modes based on account_type and role:

**1. Client Portal** (for Media Client account_type)
- 4 nav items only: Home, Request a Service, My Requests, My Account
- New pages: ClientHome.js, ServiceCatalog.js, MyAccount.js
- Clean, simplified experience for clients
- No access to operator/admin features

**2. Operator Console** (for Partners with capabilities, Vendors, Internal Staff)
- Nav items: My Queue, Pool, All Requests (staff only), Reports (staff only)
- Work management focused
- Pool picking available for authorized users

**3. Admin Studio** (for Administrator role)
- Full access: Dashboard, IAM, Settings, Reports, Logs, Announcements
- Can switch between all 3 modes via dropdown
- "Preview as Client" feature for QA testing

**Global Renames:**
- 'ticket' → 'request' (in all UI labels)
- 'Command Center' → 'Request a Service'
- 'My Services' → 'My Account'
- Routes: /tickets → /requests, /orders → /all-requests

**Service Catalog:**
- Browseable page with 8 service cards
- Each card: name, description, turnaround, included/addon badge, popular badge
- Search functionality
- "Start Request" CTA on each card

**New Files:**
- `/app/frontend/src/hooks/useAppMode.js` - Mode determination logic
- `/app/frontend/src/components/LayoutNew.js` - Mode-based layout
- `/app/frontend/src/pages/ServiceCatalog.js` - Browseable catalog
- `/app/frontend/src/pages/ClientHome.js` - Client home page
- `/app/frontend/src/pages/MyAccount.js` - Combined profile/plan/security

### P0 - UAT-Critical Pages i18n (COMPLETED - Feb 2025)
All 6 UAT-critical pages now fully translated:
1. **Tickets.js** - List page, status filters, table headers, empty states
2. **TicketDetail.js** - Status dropdown, cancel/resolve/reassign modals
3. **RibbonBoard.js** - Pool tabs, descriptions, pick dialog, empty states
4. **WorkflowEditor.js** - Node palette, settings sheet, save/discard dialogs
5. **Categories.js** - L1/L2 CRUD, move subcategory, unsaved changes warning
6. **Reports.js** - All filters, date presets, export buttons, results display
7. **Announcements.js** - Full CRUD, targeting labels, preview, confirmations

### i18n Audit System (COMPLETED - Dec 2025)
- **Audit Script** (`scripts/i18n-audit.js`) - Full codebase scanner
- **CI Check Script** (`scripts/i18n-ci.js`) - CI-friendly check
- **Key Sync Script** (`scripts/i18n-sync.js`) - Syncs missing keys
- **npm commands**: `i18n:audit`, `i18n:ci`, `i18n:sync`, `i18n:audit:strict`
- **GitHub Actions** (`.github/workflows/i18n-check.yml`) - PR/push checks

### Previous Work Completed
- Dashboard propagation fix (dynamic rendering from user-assigned layouts)
- Dashboard click-through navigation (KPIs link to filtered views)
- Pool access controls (`can_pick`, `pool_access` fields)
- Category restoration and translation (445 categories with name_en/es/pt)
- User creation/editing with pool access settings
- SLA policy management
- Workflow automation builder
- Email notification system

## Known Mocked APIs
- `/api/webhooks/ghl-payment-mock` - GoHighLevel payment webhook
- `/api/categories/catalog` - Falls back to static catalog (8 services)

## Test Credentials
- Admin: admin@redribbonops.com / Admin123!

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI + react-i18next
- Backend: FastAPI + MongoDB
- Auth: JWT-based with OTP support

## Upcoming Tasks (P1)
1. Advanced analytics for API key usage with charts
2. Slack/Teams notification integration presets

## Future Tasks (P2)
1. Workflow preview/simulation feature
2. Bulk restore/purge deleted tickets
3. "My Email Preferences" in user settings
4. Backup code system for OTP recovery

## Files of Reference
- `/app/frontend/src/pages/Dashboard.js` - Dynamic dashboard renderer
- `/app/frontend/src/pages/CommandCenter.js` - Ticket submission forms
- `/app/frontend/src/pages/SettingsHub.js` - Settings navigation
- `/app/frontend/src/pages/IAMPage.js` - User/team management
- `/app/frontend/src/i18n/locales/*.json` - Translation files
- `/app/frontend/src/utils/i18nHelpers.js` - Translation helper utilities
