# Red Ops Platform - Product Requirements Document

## Overview
A comprehensive operations management platform designed as a request and fulfillment system for Partners, Media Clients, and Vendors.

## Current Version: 2.4 (UAT P0 Blockers Fixed - Jan 28, 2026)
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

## P0 Blockers Fixed (UAT Jan 28, 2026)

### 1. CRASH on User Creation ✅
- **Issue:** React crash rendering Pydantic validation error objects
- **Fix:** IAMPage.js now handles array validation errors and displays readable messages

### 2. Tickets Not Being Created/Persisted ✅
- **Issue:** Database was wiped, seed data missing
- **Fix:** Re-seeded Admin user, categories, specialties, teams, roles, account types

### 3. Reports Module Failing (Non-Admins) ✅
- **Issue:** Reports endpoint required "Admin" role (wrong role name)
- **Fix:** Changed to allow all authenticated users (get_current_user)

### 4. No Logs Showing ✅
- **Issue:** Logs endpoint required "Admin" role (wrong role name)
- **Fix:** Changed to "Administrator", "Operator" roles

### 5. Sidebar Active State Bug ✅
- **Issue:** Both "Submit New Request" and "Report an Issue" highlighted
- **Fix:** Logic correctly checks location.search for type=issue

### 6. Page Header "Command Center" ✅
- **Issue:** Page showed "Command Center" instead of "Submit New Request"
- **Fix:** Updated CommandCenter.js to show context-aware titles

### 7. Opportunity Ribbon Visibility ✅
- **Issue:** Media Clients should NOT see Opportunity Ribbon
- **Fix:** Added excludeAccountTypes filter to nav items in Layout.js

### 8. IAM CRUD Issues ✅
- **Issue:** Could not create/edit roles and account types
- **Fix:** Backend /api/iam/roles and /api/iam/account-types endpoints working, frontend IAMPage has 6 tabs

### 9. Ticket Reopen Rule ✅
- **Issue:** Admin needed ability to reopen closed tickets
- **Fix:** Added POST /api/orders/{id}/reopen endpoint (Admin only)

---

## Sidebar Navigation

### All Users
1. Dashboard
2. My Services
3. **My Tickets** (renamed from My Requests) - /my-tickets
4. Submit New Request
5. Report an Issue
6. **Opportunity Ribbon** (NOT visible to Media Clients)
7. Reports

### Admin Only
8. **All Orders** (Administrator ONLY)
9. Identity & Access (6 tabs)
10. Logs (Administrator, Operator)
11. Announcements
12. Settings

---

## Identity & Access Management (/iam)

Contains **6 tabs**:
- **Users** - Full CRUD with Pydantic error handling
- **Teams** - Full CRUD
- **Specialties** - Full CRUD
- **Roles** - Full CRUD (system roles protected)
- **Account Types** - Full CRUD (system types protected)
- **Plans** - Subscription plans for Partners

---

## Ticket Lifecycle Rules

### Status Flow
Open → In Progress → Delivered → Closed

### Permissions
- **Cancel:** Requester can cancel own tickets with reason
- **Close:** Requester or Admin can close tickets
- **Reopen:** **Admin ONLY** can reopen closed/canceled tickets
- **Reassign:** Admin, Operator, or current resolver can reassign

### Satisfaction Survey Rules
- ✅ Sent when resolver delivers/closes ticket
- ❌ NOT sent when requester cancels ticket

---

## Key API Endpoints

### IAM APIs
- `GET/POST /api/iam/roles` - Role CRUD
- `GET/POST /api/iam/account-types` - Account Type CRUD

### Order Lifecycle
- `POST /api/orders/{id}/reopen` - Admin reopens closed tickets
- `POST /api/orders/{id}/reassign` - Reassign by user/team/specialty
- `POST /api/orders/{id}/cancel` - Requester cancels with reason

### Logs
- `GET /api/logs/{log_type}` - Get logs (system, api, ui, user)

### Reports
- `GET /api/reports/available` - List available reports
- `POST /api/reports/{id}/generate` - Generate report

---

## Test Credentials
- **Admin:** admin@redribbonops.com / Fmtvvl171**

---

## Mocked Integrations
- **GHL Payment Webhook:** `/api/webhooks/ghl-payment-mock` (MOCKED)

---

## Upcoming Tasks (Pending User Approval)

### Email Notifications (Approved Sprint)
- Ticket Created → email to requester
- Ticket Assigned → email to resolver
- Ticket Picked Up → email to requester
- Ticket Resolved/Delivered → email to requester + satisfaction survey
- Ticket Cancelled (by requester) → email to resolver, NO satisfaction survey

### Pool Assignment Notifications
- Notify Partners when ticket enters Pool 1
- Notify Vendors when ticket enters Pool 2

### Announcements Module Improvements
- Multiple overlapping announcements
- List view with edit/delete
- Targeting by role/team/specialty

---

## File References

### Frontend
- `/app/frontend/src/components/Layout.js` - Sidebar, account_type filtering
- `/app/frontend/src/pages/IAMPage.js` - 6-tab IAM, error handling
- `/app/frontend/src/pages/CommandCenter.js` - Context-aware page titles
- `/app/frontend/src/pages/Logs.js` - Correct API path
- `/app/frontend/src/pages/OrderDetail.js` - Reassign, reopen UI

### Backend
- `/app/backend/routes/iam.py` - Roles/Account Types CRUD
- `/app/backend/routes/orders.py` - Reopen, reassign, cancel
- `/app/backend/routes/reports.py` - All authenticated users
- `/app/backend/routes/settings.py` - Logs with correct roles
