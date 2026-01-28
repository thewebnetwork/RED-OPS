# Red Pulse Platform - Product Requirements Document

## Overview
A comprehensive operations management platform designed as a request and fulfillment system for Partners, Media Clients, and Vendors.

## Current Version: 2.3 (All P0 Blockers Fixed - Jan 28, 2026)
**Last Updated:** January 28, 2026
**Platform Name:** Red Pulse

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

## Sidebar Navigation (Updated)

### All Users
1. Dashboard
2. My Services
3. **My Tickets** (renamed from My Requests) - /my-tickets
4. Submit New Request
5. Report an Issue
6. Opportunity Ribbon (Pool views)
7. Reports

### Admin Only
8. **All Orders** (Administrator ONLY, not Operator)
9. Identity & Access (consolidated - 6 tabs)
10. Logs
11. Announcements
12. Settings (consolidated hub)

---

## Consolidated Modules

### Identity & Access Management (/iam)
Contains **6 tabs** (updated):
- **Users** - Create/edit/delete users with all IAM fields
- **Teams** - Manage team assignments
- **Specialties** - Admin-managed specialty list
- **Roles** - Full CRUD: Add/Edit/Delete roles with color and permissions
- **Account Types** - Full CRUD: Add/Edit/Delete account types (SEPARATE tab from Roles)
- **Plans** - Subscription plans for Partners

### Settings Hub (/settings)
Contains 6 modules:
- **UI Customizations** - Field labels, branding
- **Categories** - Service categories
- **Workflows** - Automation and routing
- **Email Settings** - SMTP and templates
- **SLA & Escalation** - Policies
- **Integrations** - API keys, webhooks

---

## P0 Blockers Fixed (January 28, 2026)

### 1. Sidebar Active State Bug ✅
- **Fixed:** Only ONE item highlighted at a time
- "Report an Issue" and "Submit New Request" no longer both highlight simultaneously
- Logic checks location.search for type=issue to determine correct active state

### 2. My Requests → My Tickets Rename ✅
- **Renamed:** "My Requests" → "My Tickets" in sidebar
- **Route changed:** /my-requests → /my-tickets
- **Removed:** Module-level "My Requests" tabs inside forms

### 3. Form Header Update ✅
- **Changed:** "Create a request" → "Fill Out Form" (neutral header)
- **Removed:** "My Requests" tab from inside CommandCenter form

### 4. All Orders Admin-Only ✅
- **Enforced:** Only Administrator role can access /orders page
- **Removed:** Operator access to All Orders

### 5. IAM CRUD for Roles + Account Types ✅
- **Separated:** Roles and Account Types are now separate tabs
- **Roles Tab:** Add Role button, edit/delete existing roles (system roles protected)
- **Account Types Tab:** Add Account Type button, edit/delete (system types protected)
- **Backend:** New /api/iam/roles and /api/iam/account-types endpoints

### 6. Resolver Reassign Capability ✅
- **Added:** "Reassign" button on Order Detail page
- **Options:** Reassign by User, Team, or Specialty
- **Permissions:** Admin, Operator, or current resolver can reassign
- **Logging:** Reassignment logged in activity with from/to/by/reason
- **Backend:** POST /api/orders/{id}/reassign endpoint

---

## Identity & Access Model

### Roles (Permissions)
| Role | Description |
|------|-------------|
| Administrator | Full system control |
| Operator | Manage orders, limited admin |
| Standard User | Create/view own requests |

### Account Types (Routing)
| Type | Description |
|------|-------------|
| Partner | Business partners with subscription plans |
| Media Client | Media service clients (A La Carte) |
| Internal Staff | Company employees |
| Vendor/Freelancer | External contractors |

---

## Key API Endpoints

### IAM APIs (New)
- `GET /api/iam/roles` - List active roles
- `POST /api/iam/roles` - Create role
- `PATCH /api/iam/roles/{id}` - Update role
- `DELETE /api/iam/roles/{id}` - Delete role (soft delete)
- `GET /api/iam/account-types` - List active account types
- `POST /api/iam/account-types` - Create account type
- `PATCH /api/iam/account-types/{id}` - Update account type
- `DELETE /api/iam/account-types/{id}` - Delete account type

### Order Reassign APIs (New)
- `GET /api/orders/{id}/reassign-options` - Get users/teams/specialties for reassign
- `POST /api/orders/{id}/reassign` - Reassign ticket

### Existing Core APIs
- `GET /api/orders/pool/1` - Partner pool tickets
- `GET /api/orders/pool/2` - Vendor pool tickets
- `GET /api/orders/my-requests` - User's own tickets

---

## Mocked Integrations
- **GHL Payment Webhook:** `/api/webhooks/ghl-payment-mock` (MOCKED)

---

## Test Credentials
- **Admin:** admin@redribbonops.com / Fmtvvl171**

---

## Upcoming Tasks (Next Sprint)

### P0 - Approved for Implementation
1. **Email Notifications** - Workflow emails for:
   - Ticket Created
   - Ticket Assigned
   - Ticket Picked Up
   - Ticket Resolved/Delivered
   - Ticket Cancelled

2. **Pool Assignment Notifications** - Notify Partners (Pool 1) and Vendors (Pool 2) when tickets enter their pools

### Future/Backlog
- Advanced analytics for API key usage with charts
- Slack/Teams notification integration presets
- Workflow preview/simulation feature
- SLA & Escalation policy templates

---

## File References

### Frontend
- `/app/frontend/src/components/Layout.js` - Sidebar, navigation
- `/app/frontend/src/pages/IAMPage.js` - 6-tab IAM hub
- `/app/frontend/src/pages/CommandCenter.js` - Form submission
- `/app/frontend/src/pages/MyRequests.js` - My Tickets page
- `/app/frontend/src/pages/OrderDetail.js` - Reassign functionality
- `/app/frontend/src/App.js` - Route definitions

### Backend
- `/app/backend/server_v2.py` - Main server
- `/app/backend/routes/iam.py` - Roles/Account Types CRUD
- `/app/backend/routes/orders.py` - Orders including reassign
- `/app/backend/routes/users.py` - User management
