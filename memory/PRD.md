# Red Ribbon Ops Portal - Product Requirements Document

## Overview
A comprehensive operations management platform designed as a request and fulfillment system for Partners, Media Clients, and Vendors.

## Current Version: 2.0 (IAM Sprint Complete)
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

### Specialties (Admin-Managed)
56+ specialties including: Video Editor, Photographer, Drone Operator, Home Stager, Floor Plan Designer, General Contractor, etc.

---

## Completed Features (P0)

### 1. Identity & Access Model Rework ✅
- [x] Simplified roles (Administrator, Operator, Standard User)
- [x] Account Type field (Partner, Media Client, Internal Staff, Vendor/Freelancer)
- [x] Specialty field (admin-managed, 56 seeded)
- [x] Conditional Subscription Plans (Partners only)
- [x] Per-user Access Controls (checkbox matrix)
- [x] User creation with all new fields
- [x] Identity config API endpoint

### 2. Ticket Lifecycle Actions ✅
- [x] Requester cancellation with reasons (dropdown + free text)
- [x] Resolver delivery notes (required modal)
- [x] Activity logging for both actions

### 3. UI Sidebar Changes ✅
- [x] Added "My Services" page
- [x] "Submit New Request" replaced "Command Center"
- [x] Reports accessible to all users (scoped)

### 4. Workflow Templates ✅
- [x] Pool Routing (24h Right of First Refusal)
  - Routes to Partner pool → 24h delay → Vendor pool
  - 6 nodes, 5 edges, editable
- [x] Payments + Status Progression
  - MOCKED GHL payment webhook
  - NEW → OPEN on payment confirmation → Pool routing
  - 9 nodes, 8 edges

---

## Completed Features (P1)

### 1. Admin UIs ✅
- [x] Specialties Management page (/specialties)
- [x] Subscription Plans Management page (/subscription-plans)

### 2. Banner Targeting ✅
- [x] Specialty targeting added to announcement banner

### 3. Data Reset ✅
- [x] Backup created at /app/backups/ticket_backup_*.json
- [x] Tickets, notifications, activity logs cleared for UAT

---

## API Endpoints

### Identity & Access
- `GET /api/users/identity-config` - Get roles, account types, plans
- `GET /api/users` - List users with new IAM fields
- `POST /api/users` - Create user with account_type, specialty, etc.
- `PATCH /api/users/{id}` - Update user

### Specialties
- `GET /api/specialties` - List all specialties
- `POST /api/specialties` - Create specialty (Admin)
- `PATCH /api/specialties/{id}` - Update specialty (Admin)
- `DELETE /api/specialties/{id}` - Delete specialty (Admin)

### Subscription Plans
- `GET /api/subscription-plans` - List all plans
- `POST /api/subscription-plans` - Create plan (Admin)
- `PATCH /api/subscription-plans/{id}` - Update plan (Admin)
- `DELETE /api/subscription-plans/{id}` - Delete plan (Admin)

### Workflow Templates
- `GET /api/workflow-templates` - List all templates
- `POST /api/workflow-templates/{id}/install` - Install from template

### Mocked Payment (GHL)
- `POST /api/webhooks/ghl-payment-mock` - Receive payment webhook
- `POST /api/simulate-payment/{order_id}` - Admin simulate payment

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
| Test Partner | partner@test.com | Test123! |

---

## Future Tasks (Backlog)

### P2 - Refinements
- [ ] Real GHL payment integration
- [ ] Email notifications for workflow actions
- [ ] Pool assignment notifications

### P3 - Enhancements
- [ ] Advanced analytics for API key usage
- [ ] Slack/Teams integration presets
- [ ] Workflow preview/simulation feature
- [ ] SLA policy templates

---

## File Structure

```
/app/
├── backend/
│   ├── models/
│   │   ├── identity.py          # IAM model
│   │   └── ...
│   ├── routes/
│   │   ├── users.py             # User CRUD
│   │   ├── specialties.py       # Specialty management
│   │   ├── subscription_plans.py # Plan management
│   │   └── workflows.py         # Templates included
│   └── server_v2.py
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Users.js         # New IAM fields
│       │   ├── MyServices.js    # New page
│       │   ├── SpecialtiesAdmin.js
│       │   └── SubscriptionPlansAdmin.js
│       └── components/
│           └── Layout.js        # Updated sidebar
└── memory/
    └── PRD.md
```

---

## Testing Status

- **Backend Tests:** 22/22 passed (100%)
- **Frontend Tests:** All UI features verified (100%)
- **Last Test Report:** /app/test_reports/iteration_27.json
