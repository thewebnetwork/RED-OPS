# Red Ops Platform - Product Requirements Document

## Overview
A comprehensive operations management platform designed as a request and fulfillment system for Partners, Media Clients, and Vendors.

## Current Version: 2.5 (Email Notifications + Announcements - Jan 28, 2026)
**Last Updated:** January 28, 2026
**Platform Name:** Red Ops

---

## Core Architecture

### Tech Stack
- **Frontend:** React 18, TailwindCSS, Shadcn/UI
- **Backend:** FastAPI (Python 3.11), Pydantic
- **Database:** MongoDB
- **Authentication:** JWT-based

### URL Configuration
- **Frontend:** Port 3000
- **Backend:** Port 8001 (all routes prefixed with /api)
- **Preview URL:** https://ticketpro-15.preview.emergentagent.com

---

## Latest Features Implemented (Jan 28, 2026)

### 1. Email Notifications ✅
Complete email notification system for ticket lifecycle:

| Event | Recipient | Includes Survey |
|-------|-----------|-----------------|
| Ticket Created | Requester | No |
| Ticket Assigned | Resolver | No |
| Ticket Picked Up | Requester | No |
| Ticket Resolved/Delivered | Requester | **Yes** |
| Ticket Cancelled (by requester) | Resolver + Admin | **No** |

**Note:** Email is MOCKED if SMTP not configured. Check backend logs for email output.

### 2. Pool Notifications ✅
- **Pool 1 (Partners):** Notified immediately when new ticket is created
- **Pool 2 (Vendors):** Notified after 24 hours via SLA monitor background task

### 3. Announcements System ✅
Full CRUD for multiple announcements with:
- **Priority ordering** (highest priority shown first)
- **Scheduling** (start_at, end_at datetime)
- **Targeting** by teams, roles, or specialties
- **Custom colors** (background, text)
- **List view** with edit/delete
- **Preview** in creation dialog

---

## Previous P0 Blockers Fixed

1. ✅ User creation crash (Pydantic error handling)
2. ✅ Tickets not persisting (database re-seeded)
3. ✅ Reports failing for non-admins
4. ✅ No logs showing (role name fixed)
5. ✅ Sidebar dual highlight bug
6. ✅ Page headers ("Submit New Request" not "Command Center")
7. ✅ Opportunity Ribbon hidden for Media Clients
8. ✅ IAM CRUD for Roles + Account Types
9. ✅ Admin reopen capability

---

## Sidebar Navigation

### All Users
1. Dashboard
2. My Services
3. My Tickets - /my-tickets
4. Submit New Request
5. Report an Issue
6. Opportunity Ribbon (NOT visible to Media Clients)
7. Reports

### Admin Only
8. All Orders (Administrator ONLY)
9. Identity & Access (6 tabs)
10. Logs (Administrator, Operator)
11. Announcements (full CRUD)
12. Settings

---

## Key API Endpoints

### Email (triggered automatically)
- Ticket created → `send_ticket_created_email()`
- Ticket assigned → `send_ticket_assigned_email()`
- Ticket picked up → `send_ticket_picked_up_email()`
- Ticket resolved → `send_ticket_resolved_email()` + survey
- Ticket cancelled → `send_ticket_cancelled_email()` (NO survey)

### Pool Notifications
- Pool 1: Triggered on ticket creation
- Pool 2: Triggered by `check_pool_transitions()` in SLA monitor (every 5 min)

### Announcements
- `GET /api/announcements` - List all (Admin)
- `GET /api/announcements/active` - Get active for current user
- `POST /api/announcements` - Create
- `PATCH /api/announcements/{id}` - Update
- `DELETE /api/announcements/{id}` - Delete

### IAM
- `GET/POST /api/iam/roles` - Role CRUD
- `GET/POST /api/iam/account-types` - Account Type CRUD

### Orders
- `POST /api/orders/{id}/reopen` - Admin reopens closed tickets
- `POST /api/orders/{id}/reassign` - Reassign by user/team/specialty
- `POST /api/orders/{id}/cancel` - Requester cancels

---

## Test Credentials
- **Admin:** admin@redribbonops.com / Fmtvvl171**

---

## Mocked Integrations
- **Email (SMTP):** MOCKED if SMTP_USER/SMTP_PASSWORD not set
- **GHL Payment Webhook:** `/api/webhooks/ghl-payment-mock` (MOCKED)

---

## SMTP Configuration (for real emails)
Set in `/app/backend/.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM=your-email@gmail.com
FRONTEND_URL=https://your-domain.com
```

---

## File References

### Backend
- `/app/backend/services/email.py` - All email templates
- `/app/backend/routes/orders.py` - Ticket lifecycle with emails
- `/app/backend/routes/settings.py` - Announcements CRUD
- `/app/backend/services/sla_monitor.py` - Pool 2 notifications
- `/app/backend/routes/iam.py` - Roles/Account Types CRUD

### Frontend
- `/app/frontend/src/pages/Announcements.js` - Full CRUD UI
- `/app/frontend/src/components/Layout.js` - Sidebar navigation
- `/app/frontend/src/pages/IAMPage.js` - 6-tab IAM
- `/app/frontend/src/pages/CommandCenter.js` - Ticket submission
- `/app/frontend/src/pages/OrderDetail.js` - Reassign, reopen

---

## Test Reports
- `/app/test_reports/iteration_31.json` - Latest (Email + Announcements)
- `/app/backend/tests/test_email_pool_announcements.py` - Automated tests

---

## Future/Backlog
- Advanced analytics with charts
- Slack/Teams notification presets
- Workflow preview simulation
- SLA policy templates
