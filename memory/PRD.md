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

### P0 - i18n Coverage (COMPLETED - Dec 2025)
- **Dashboard.js** - Fully translated with t() function for all KPIs, charts, labels
- **CommandCenter.js** - Forms, validation messages, toasts all translated
- **SettingsHub.js** - All settings modules dynamically translated
- **IAMPage.js** - Title, tabs, stats, table headers all translated
- **Translation Files** - Complete en.json, es.json, pt.json with:
  - `dashboardLabels.*` - All dashboard KPI and section labels
  - `chartLabels.*` - Chart legend labels
  - `forms.*` - Form field labels and placeholders
  - `formValidation.*` - Validation error messages
  - `formSuccess.*` - Success toast messages
  - `formButtons.*` - Button labels
  - `settings.modules.*` - Settings page module names/descriptions
  - `iam.*` - IAM page labels
  - `commandCenter.*` - Command center form labels
  - `fileValidation.*` - File upload validation messages

### i18n Audit System (COMPLETED - Dec 2025)
- **Audit Script** (`scripts/i18n-audit.js`) - Full codebase scanner for:
  - Missing translation keys across locales
  - Hardcoded UI strings in JSX
  - Suggested key namespaces for fixes
- **CI Check Script** (`scripts/i18n-ci.js`) - Lightweight CI-friendly check
- **Key Sync Script** (`scripts/i18n-sync.js`) - Syncs missing keys with placeholders
- **npm commands**:
  - `npm run i18n:audit` - Full audit with suggestions
  - `npm run i18n:ci` - CI check (fails on missing keys)
  - `npm run i18n:sync` - Sync keys across locales
  - `npm run i18n:audit:strict` - Strict mode (fails on hardcoded strings)
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
