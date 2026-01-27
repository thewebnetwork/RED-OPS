# Red Ribbon Ops Portal - Product Requirements Document

## Overview
A comprehensive operations management platform designed as a request and fulfillment system for Partners, Media Clients, and Vendors.

## Current Version: 2.1 (P0 Blockers Fixed)
**Last Updated:** January 27, 2026

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

## Sidebar Navigation Structure

### All Users
1. Dashboard
2. My Services
3. **My Requests** (NEW)
4. Submit New Request
5. **Report an Issue** (NEW)
6. **The Ribbon Board** (NEW - Pool views)
7. Reports

### Admin/Operator Only
8. All Orders
9. Workflows
10. SLA & Escalation
11. Users
12. Teams
13. **Identity & Access** (Renamed from "Roles")
14. Specialties
15. Subscription Plans
16. Categories
17. Logs
18. Integrations
19. Announcements
20. Email Settings
21. Settings

**REMOVED:** Quick Actions section at bottom

---

## Identity & Access Model (IAM) - v2.0

### Simplified Roles (Permissions Only)
| Role | Description |
|------|-------------|
| Administrator | Full system control |
| Operator | Internal staff ops, manage tickets/queues |
| Standard User | Basic user actions |

### Account Types (Classification)
| Type | Description | Subscription Required |
|------|-------------|----------------------|
| Partner | Business partners | Yes (Plan required) |
| Media Client | Media service clients | No (A La Carte) |
| Internal Staff | Company employees | No |
| Vendor/Freelancer | External contractors | No |

### Subscription Plans (Partners Only)
- **Core** - Basic Support, Standard SLA
- **Engage** - Priority Support, Enhanced SLA, Analytics
- **Lead-to-Cash** - Premium SLA, Advanced Analytics, Lead Tools
- **Scale** - Dedicated Support, Custom SLA, All Features

---

## The Ribbon Board (Pool System)

### Pool 1 (Partners)
- Tickets available for Partners to pick
- 24-hour right of first refusal
- Visible to: Admins, Operators, Partners

### Pool 2 (Vendors/Freelancers)
- Tickets that moved from Pool 1 after 24 hours
- Visible to: Admins, Operators, Vendors/Freelancers

---

## Completed Features (P0 Sprint)

### 1. Identity & Access Model Rework ✅
- [x] Simplified roles (Administrator, Operator, Standard User)
- [x] Account Type field (Partner, Media Client, Internal Staff, Vendor/Freelancer)
- [x] Specialty field (admin-managed, 56 seeded)
- [x] Conditional Subscription Plans (Partners only)
- [x] Per-user Access Controls (checkbox matrix)
- [x] Identity & Access Management page

### 2. Ticket Lifecycle Actions ✅
- [x] Requester cancellation with reasons (dropdown + free text)
- [x] Resolver delivery notes (required modal)
- [x] Activity logging for both actions

### 3. UI/Navigation Changes ✅
- [x] Added "My Services" page
- [x] Added "My Requests" page (dedicated)
- [x] "Submit New Request" in sidebar
- [x] "Report an Issue" as separate sidebar entry
- [x] "Identity & Access" renamed from "Roles"
- [x] Quick Actions section REMOVED
- [x] Logo pulse animation restored
- [x] Attachments moved under Categorization (compact)

### 4. The Ribbon Board ✅
- [x] Pool 1 (Partners) view
- [x] Pool 2 (Vendors/Freelancers) view
- [x] Role-based visibility
- [x] Pick functionality with pool eligibility checks

### 5. Workflow Templates ✅
- [x] Pool Routing (24h Right of First Refusal)
- [x] Payments + Status Progression (MOCKED GHL)

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

## Testing Status

- **Test Report:** /app/test_reports/iteration_28.json
- **Frontend Tests:** 100% pass (All P0 blockers verified)
- **Backend Tests:** 100% pass (22/22)

---

## Next Sprint (Pending User Approval)

1. Email notifications for workflow actions
2. Pool assignment notifications to Partners/Vendors
3. Pool dashboard enhancement (admin full view)

---

## Future Tasks (Backlog)

- Real GHL payment integration (replace mock)
- Advanced analytics for API key usage
- Slack/Teams integration presets
- Workflow preview/simulation feature
- SLA policy templates
