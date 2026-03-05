# Red Ribbon Ops (RED OPS) - Product Requirements Document

## Original Problem Statement
A full-stack task/request management platform ("Red Ribbon Ops") for managing service requests, editing orders, and team operations. The platform serves multiple user roles (Admin, Account Manager, Client) with a portal-based navigation system, multilingual support (EN/PT/ES), and workflow automation.

## Core Architecture
- **Frontend**: React + Shadcn/UI + i18next (multilingual)
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT-based with OTP/2FA support
- **Portals**: Client Portal, Operator Console, Admin Studio

## What's Been Implemented

### Task Board (Completed - Feb 2026)
- Three-mode Task Board for Admin, Account Manager, Client
- Optimistic UI updates for task creation
- Role-specific dialogs and workflows
- Backend endpoint: `GET /api/users/client-assignments`

### i18n Bug Fix (Completed - Mar 5, 2026)
- **Root Cause**: `en.json` had duplicate top-level JSON keys (`commandCenter`, `categories`, `status`, `sla`, etc.) where the last occurrence overwrote the first, losing 194 translation keys
- **Fix**: Merged all 194 missing keys into `en.json` using proper English translations
- **Safety**: Updated `i18n.js` `parseMissingKeyHandler` to only show `[MISSING: ...]` on localhost; returns empty string in preview/production
- **Files Changed**: `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/i18n.js`
- **Testing**: 100% pass rate - all pages verified (Command Center, Settings, Reports, IAM, Announcements, Categories, Language switch)

## Key API Endpoints
- `POST /api/auth/login` - User login
- `GET /api/users/client-assignments` - Admin: client-to-AM assignments
- `POST /api/tasks` - Create task
- `GET /api/tasks` - List tasks
- `PATCH /api/tasks/{task_id}` - Update task
- `GET /api/tasks/assignable-users` - Assignable users for tasks

## Credentials
- Admin: `admin@redribbonops.com` / `Admin123!`
- Client: `test2@client.com` / `Client123!`
- Account Manager: `matheus.pessanha@redribbonops.com` / `Admin123!`

## Mocked APIs
- `/api/webhooks/ghl-payment-mock` (GoHighLevel)

## Prioritized Backlog

### P1 - Upcoming
- Advanced Analytics: Charts for API key usage
- Slack/Teams Integration: Notification presets

### P2 - Future
- Workflow preview feature
- Translate all remaining pages/components
- Bulk-restore or permanently purge deleted requests
- "My Email Preferences" section in user settings
- Backup code system for OTP recovery
- Deployment assistance (Vercel/Railway + MongoDB Atlas)

## 3rd Party Integrations
- Gmail SMTP
- GoHighLevel (mocked)
- pyotp, qrcode.react, recharts, @dnd-kit/core, i18next
