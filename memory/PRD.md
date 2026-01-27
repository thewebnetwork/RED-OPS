# Red Pulse Platform - Product Requirements Document

## Overview
A comprehensive operations management platform designed as a request and fulfillment system for Partners, Media Clients, and Vendors.

## Current Version: 2.2 (All P0 Blockers Fixed)
**Last Updated:** January 27, 2026
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
- **Preview URL:** https://iam-refactor.preview.emergentagent.com

---

## Sidebar Navigation (Consolidated)

### All Users
1. Dashboard
2. My Services
3. My Requests
4. Submit New Request
5. Report an Issue
6. Opportunity Ribbon (Pool views)
7. Reports

### Admin Only
8. All Orders
9. Identity & Access (consolidated Users, Teams, Specialties, Roles, Plans)
10. Logs
11. Announcements
12. Settings (consolidated hub)

---

## Consolidated Modules

### Identity & Access Management (/iam)
Contains 5 tabs:
- **Users** - Create/edit/delete users with all IAM fields
- **Teams** - Manage team assignments
- **Specialties** - Admin-managed specialty list
- **Roles** - View/edit role permissions (Administrator, Operator, Standard User)
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

## Recent Fixes (P0 Blockers)

### 1. User Create/Edit Dropdowns ✅
- All dropdowns (Role, Specialty, Account Type, Team) now work correctly
- Fixed z-index issue with Select component in Dialog (z-[100])

### 2. Request Type Selector Removed ✅
- Submit New Request: auto-sets type = Request (no selector)
- Report an Issue: auto-sets type = Bug/Incident (no selector)
- "Report an Issue" nav button active state fixed

### 3. Satisfaction Survey Rule ✅
- Confirmed: Surveys only sent on Delivered/Closed by resolver
- Confirmed: Requester cancel does NOT trigger survey

### 4. Module Consolidation ✅
- Identity modules consolidated under IAM
- Settings modules consolidated under Settings Hub
- Sidebar cleaned up significantly

### 5. Branding Updates ✅
- Platform renamed to "Red Pulse"
- Logo pulse animation active
- "The Ribbon Board" → "Opportunity Ribbon"

---

## Identity & Access Model

### Roles (Permissions)
| Role | Description |
|------|-------------|
| Administrator | Full system control |
| Operator | Internal staff ops |
| Standard User | Basic user actions |

### Account Types
| Type | Description |
|------|-------------|
| Partner | Business partners (requires subscription plan) |
| Media Client | A La Carte clients |
| Internal Staff | Company employees |
| Vendor/Freelancer | External contractors |

### Subscription Plans (Partners Only)
- Core, Engage, Lead-to-Cash, Scale

---

## Pool System (Opportunity Ribbon)

### Pool 1 (Partners)
- 24-hour right of first refusal
- Partners can pick from here

### Pool 2 (Vendors)
- After 24 hours in Pool 1
- Vendors can pick from here

---

## Mocked Integrations

| Integration | Status | Endpoint |
|-------------|--------|----------|
| GHL Payments | MOCKED | `/api/webhooks/ghl-payment-mock` |

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@redribbonops.com | Fmtvvl171** |

---

## Next Sprint (Pending Approval)

1. Email notifications for workflow actions
2. Pool assignment notifications to Partners/Vendors
3. Pool pickup analytics views

---

## Testing Status

- All P0 blockers verified and fixed
- Last Test Report: `/app/test_reports/iteration_28.json`
