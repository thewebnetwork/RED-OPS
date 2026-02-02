# Red Ribbon Ops - Product Requirements Document

## Original Problem Statement
Enterprise ticket management and operations platform with full multilingual support (English, Spanish, Portuguese). The platform handles service requests, bug reports, feature requests, and editing workflows with SLA tracking, pool-based ticket assignment, and comprehensive IAM controls.

## Core Requirements
1. **Full i18n Coverage (P0)** - All UI elements must translate when switching between EN/ES/PT
2. **Dashboard with Dynamic Widgets** - Role-based dashboard rendering
3. **Ticket Lifecycle Management** - Submit, pick, deliver, review, close workflows
4. **Pool-Based Assignment** - Pool 1 and Pool 2 opportunity ribbons with access controls
5. **SLA Tracking** - On-track, at-risk, breached status monitoring
6. **IAM System** - Users, teams, roles, specialties, account types, subscription plans
7. **Category Management** - L1/L2 categories with translations

## What's Been Implemented

### P0 - UAT-Critical Pages i18n (COMPLETED - Feb 2025)
All 6 UAT-critical pages now fully translated:
1. **Tickets.js** - List page, status filters, table headers, empty states
2. **TicketDetail.js** - Status dropdown, cancel/resolve/reassign modals
3. **RibbonBoard.js** - Pool tabs, descriptions, pick dialog, empty states
4. **WorkflowEditor.js** - Node palette, settings sheet, save/discard dialogs
5. **Categories.js** - L1/L2 CRUD, move subcategory, unsaved changes warning
6. **Reports.js** - All filters, date presets, export buttons, results display
7. **Announcements.js** - Full CRUD, targeting labels, preview, confirmations

New translation keys added:
- `tickets.*` - Ticket-related strings (allStatuses, status.open/waiting/closed, etc.)
- `ribbon.*` - Opportunity ribbon strings (pool descriptions, pick dialog, etc.)
- `workflow.*` - Workflow editor strings (settings, node config, dialogs, etc.)
- `categories.*` - Category management strings (L1/L2, move, confirmations, etc.)
- `reports.*` - Reports page strings (filters, presets, export, results, etc.)
- `announcements.*` - Announcement strings (CRUD, targeting, preview, etc.)

### Core Pages i18n (COMPLETED - Dec 2025)
- **Dashboard.js** - Fully translated with t() function for all KPIs, charts, labels
- **CommandCenter.js** - Forms, validation messages, toasts all translated
- **SettingsHub.js** - All settings modules dynamically translated
- **IAMPage.js** - Title, tabs, stats, table headers all translated

### i18n Audit System (COMPLETED - Dec 2025)
- **Audit Script** (`scripts/i18n-audit.js`) - Full codebase scanner
- **CI Check Script** (`scripts/i18n-ci.js`) - CI-friendly check
- **Key Sync Script** (`scripts/i18n-sync.js`) - Syncs missing keys
- **npm commands**: `i18n:audit`, `i18n:ci`, `i18n:sync`, `i18n:audit:strict`
- **GitHub Actions** (`.github/workflows/i18n-check.yml`) - PR/push checks
- **Documentation** (`docs/i18n-audit.md`) - Usage guide

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
