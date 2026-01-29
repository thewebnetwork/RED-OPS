# Red Pulse System Documentation Pack
## Official System Reference v4.1

**Document Version:** 1.0  
**Platform:** Red Pulse (Red Ops)  
**Generated:** December 2025  
**Environment:** https://translate-redops.preview.emergentagent.com

---

# Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Modules & Navigation Map](#2-modules--navigation-map)
3. [Identity & Access Management (IAM)](#3-identity--access-management-iam)
4. [Ticket Lifecycle & Rules](#4-ticket-lifecycle--rules)
5. [Pools & Opportunity Ribbon](#5-pools--opportunity-ribbon)
6. [Workflow Engine](#6-workflow-engine)
7. [Notifications & Email](#7-notifications--email)
8. [Reports](#8-reports)
9. [Categories & Subcategories](#9-categories--subcategories)
10. [Integrations](#10-integrations)
11. [Admin Operations](#11-admin-operations)
12. [Design Rationale – Why We Built It This Way](#12-design-rationale--why-we-built-it-this-way)
13. [Known Issues / Tech Debt / Open Items](#13-known-issues--tech-debt--open-items)

---

# 1. Executive Overview

## What is Red Pulse?

Red Pulse is a **command-center ticketing platform** designed to manage requests from multiple user types through a pool-based distribution system. It combines:

- **Request Management** – Clients submit tickets that flow through a defined lifecycle
- **Pool-Based Distribution** – Work opportunities are distributed to service providers through tiered pools
- **Identity & Access Management** – Granular role and permission control
- **Workflow Automation** – Configurable triggers and actions for common processes
- **SLA Monitoring** – Service level tracking with escalation policies

## Primary User Types

| User Type | Role | Primary Actions |
|-----------|------|-----------------|
| **Media Client** | Requester | Submit tickets, track progress, provide feedback |
| **Partner** | Premium Service Provider | Pick tickets from Pool 1 (first 24h), deliver work |
| **Internal Staff** | Internal Team | Pick tickets from Pool 1, manage operations |
| **Vendor/Freelancer** | Extended Service Provider | Pick tickets from Pool 2 (after 24h), deliver work |
| **Administrator** | System Admin | Full configuration, user management, reporting |

## Core Value Proposition

Red Pulse solves the **"fair distribution problem"** in service delivery:
- Premium partners get first access to opportunities (Pool 1)
- Extended workforce gets access to overflow work (Pool 2)
- Clients get consistent service regardless of who picks up their request
- Administrators have full visibility and control

---

# 2. Modules & Navigation Map

## Main Sidebar Navigation

| Module | Route | Access | Description |
|--------|-------|--------|-------------|
| Dashboard | `/` | All Users | Role-specific KPIs and overview |
| My Services | `/my-services` | All Users | Personal service information (Markdown) |
| My Submitted Tickets | `/my-tickets` | All Users | User's own submitted requests |
| Submit New Request | `/command-center` | All Users | Create new ticket/request |
| Report an Issue | `/report-issue` | All Users | Report bugs/issues |
| Opportunity Ribbon | `/ribbon-board` | Non-Media Clients | Pool 1 & Pool 2 ticket pools |
| All Orders | `/orders` | Admin Only | Full ticket management |
| Deleted Tickets | `/deleted-tickets` | Admin Only | Soft-deleted tickets view |
| Reports | `/reports` | All Users | Canned reports module |
| Identity & Access | `/iam` | Admin Only | User/Team/Role management |
| Logs | `/logs` | Admin, Operator | Activity/system logs |
| Announcements | `/announcements` | Admin Only | System announcements |
| Settings | `/settings` | Admin Only | Settings hub |

## Settings Hub (Admin-Only Subpages)

| Subpage | Route | Purpose |
|---------|-------|---------|
| Categories | `/categories` | L1/L2 category management |
| Workflows | `/workflows` | Visual workflow builder |
| SLA & Escalation | `/sla-policies` | SLA policies + escalation rules |
| Email Settings | `/email-settings` | SMTP configuration |
| Integrations | `/integrations` | API keys, webhooks |
| Pool Picker Rules | `/settings/pool-picker-rules` | Pool eligibility configuration |
| Documentation | `/settings/documentation` | System logic snapshot viewer |
| Translation Editor | `/settings/translations` | i18n translation editor |
| UI Customizations | `/settings/ui` | Field labels, branding |

## IAM Page Tabs

| Tab | Description |
|-----|-------------|
| Users | Create/edit/deactivate user accounts |
| Teams | Team management with specialty associations |
| Specialties | Service specialties (used for routing) |
| Roles | Role definitions with permission matrices |
| Account Types | Partner, Internal Staff, Vendor, Media Client |
| Plans | Subscription plans for Partners |

---

# 3. Identity & Access Management (IAM)

## 3.1 Roles & Permission Model

Red Pulse uses a **minimal role system** with three base roles:

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **Administrator** | Full system access | All CRUD operations, settings, user management |
| **Operator** | Team lead/supervisor | View all tickets, limited settings, no system governance |
| **Standard User** | Regular user | Create tickets, view own tickets, pick from eligible pools |

### Permission Merge Logic

Permissions are calculated in two steps:

```
Final Permissions = Role Base Permissions + User-Level Overrides
```

**Rule:** User-level overrides ALWAYS win over role defaults.

**Example:**
- Role "Standard User" has `orders.delete = false`
- User has override `orders.delete = true`
- **Result:** User CAN delete orders

### Permission Matrix (Modules × Roles)

| Module | Administrator | Operator | Standard User |
|--------|:-------------:|:--------:|:-------------:|
| dashboard | ✅ Full | ✅ Full | ✅ View |
| orders | ✅ Full | ✅ No delete | ✅ Own only |
| users | ✅ Full | 👁️ View | ❌ None |
| teams | ✅ Full | 👁️ View | ❌ None |
| specialties | ✅ Full | 👁️ View | 👁️ View |
| workflows | ✅ Full | 👁️ View + Execute | ❌ None |
| sla_policies | ✅ Full | 👁️ View + Acknowledge | ❌ None |
| settings | ✅ Full | ❌ None | ❌ None |
| reports | ✅ Full + Export | ✅ Full + Export | 👁️ View only |

## 3.2 Account Types

Account types determine **pool access** and **business relationships**:

| Account Type | Pool Access | Subscription Required | Use Case |
|--------------|-------------|----------------------|----------|
| **Partner** | Pool 1 only | ✅ Yes | Premium external partners |
| **Internal Staff** | Pool 1 only | ❌ No | Internal team members |
| **Vendor/Freelancer** | Pool 2 only | ❌ No | Extended workforce |
| **Media Client** | None (requester) | ❌ No | End clients who submit requests |

## 3.3 Multi-Specialty Support

Users can have **multiple specialties** assigned:

- `specialty_ids`: Array of specialty IDs the user can handle
- `primary_specialty_id`: The user's main specialty (for display)

**Pool Routing Match:** A user sees a ticket if ANY of their specialties matches the ticket's routing specialty.

## 3.4 "Can Pick" Override

Each user has a `can_pick` boolean field that acts as a **master switch**:

```
Effective Can Pick = Account Type Allows + User.can_pick is TRUE
```

This allows admins to:
- Temporarily disable a user's pool access without changing their account type
- Grant pool access to users whose account type normally wouldn't allow it

## 3.5 Known Limitations

1. No support for custom roles (only 3 system roles)
2. Permission overrides are per-user, not per-team
3. Account types cannot be changed without admin intervention

---

# 4. Ticket Lifecycle & Rules

## 4.1 All Statuses

| Status | Description |
|--------|-------------|
| **Draft** | Incomplete ticket saved by requester; not visible in pools |
| **Open** | Submitted ticket; visible in Pool 1/Pool 2; awaiting pickup |
| **In Progress** | Picked up by resolver; actively being worked on |
| **Pending** | Submitted for review; awaiting requester response |
| **Delivered** | Final work delivered; awaiting requester close/feedback |
| **Closed** | Ticket resolved and closed |
| **Canceled** | Ticket canceled |

## 4.2 Status Transitions

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
Draft ──► Open ──► In Progress ──► Pending ──► Delivered ──► Closed
           │            │            │   ▲
           │            │            │   │ (Revision)
           │            │            └───┘
           │            │
           ▼            ▼
       Canceled     Canceled
           │
           │ (Restore - Admin only)
           ▼
         Open
```

### Transition Rules

| From | To | Who Can Perform | Required Fields |
|------|-----|-----------------|-----------------|
| Draft | Open | Requester only | Title, Category |
| Open | In Progress | Anyone who picks | None |
| Open | Canceled | Admin only | `cancel_reason` |
| In Progress | Pending | Assigned resolver | None |
| In Progress | Delivered | Assigned resolver | `resolution_notes` |
| In Progress | Open (Release) | Assigned resolver, Admin | None |
| Pending | In Progress | Requester (responds), Admin | Message text |
| Pending | Delivered | Requester (accepts) | None |
| Delivered | Closed | Requester, Admin, Auto (7 days) | Optional `reason` |
| Delivered | In Progress (Reopen) | Requester (within 7 days) | `reopen_reason` |
| Canceled | Open (Restore) | Admin only | None |
| Any | Soft-Deleted | Admin only | None |

## 4.3 Required Fields by Action

| Action | Required Fields | Character Limits |
|--------|-----------------|------------------|
| **Cancel** | `reason` (from predefined list), optional `notes` | Notes: 1-500 chars |
| **Deliver** | `resolution_notes` | 1-2000 chars |
| **Close** | `reason` (optional free text) | 1-500 chars |
| **Reopen** | `reason` | 1-500 chars |

**Cancel Reason Options:**
- "No longer needed"
- "Changed my mind"
- "Found a different solution"
- "Fixed the issue myself"
- "Duplicate ticket"
- "Other" (requires notes)

## 4.4 Who Can Do What

| Action | Administrator | Operator | Standard User |
|--------|:-------------:|:--------:|:-------------:|
| Create Ticket | ✅ | ✅ | ✅ |
| Cancel Ticket | ✅ | ❌ | ❌ (can cancel own before pickup) |
| Close Ticket | ✅ | ❌ | ✅ (as requester) |
| Reopen Ticket | ✅ | ❌ | ✅ (as requester, within 7 days) |
| Soft-Delete | ✅ | ❌ | ❌ |
| Restore Deleted | ✅ | ❌ | ❌ |
| Permanent Delete | N/A | N/A | N/A (not implemented) |

---

# 5. Pools & Opportunity Ribbon

## 5.1 Pool Architecture

Red Pulse uses a **two-tier pool system** for fair work distribution:

| Pool | Name | Duration | Eligible Users |
|------|------|----------|----------------|
| **Pool 1** | Opportunity Ribbon | First 24 hours | Partners, Internal Staff |
| **Pool 2** | Opportunity Pool | After 24 hours | Vendors/Freelancers |

## 5.2 Pool Routing Logic

When a ticket becomes `Open`:

```
1. Ticket submitted → Status = "Open"
2. System determines routing_specialty_id:
   - From Category L2's specialty_id
   - Fallback to Category L1's specialty_id
   - Fallback to null (no specialty filter)
3. Query Pool 1 eligible users (matching specialty)
4. IF eligible users > 0:
   → Assign to POOL_1
   → Set pool1_expires_at = now + 24 hours
5. ELSE (no Pool 1 users available):
   → Skip Pool 1 entirely
   → Assign to POOL_2 immediately
6. Background service promotes POOL_1 → POOL_2 after expiry
```

## 5.3 Pool Eligibility Configuration

Pool eligibility is **admin-configurable** via Settings → Pool Picker Rules:

| Account Type | Can Pick | Default Pools |
|--------------|----------|---------------|
| Partner | ✅ Yes | POOL_1 |
| Internal Staff | ✅ Yes | POOL_1 |
| Vendor/Freelancer | ✅ Yes | POOL_2 |
| Media Client | ❌ No | [] |

**API Endpoint:** `GET/POST /api/pool-picker-rules`

## 5.4 Pick Flow

When a user picks a ticket:

1. User views ticket on Ribbon Board
2. User clicks "Pick" button
3. System validates:
   - User's account type is allowed for this pool
   - User's `can_pick` flag is true
   - User has matching specialty (if required)
4. If valid:
   - `assigned_to` = picker's user ID
   - `status` = "In Progress"
   - `pool_stage` = null (removed from pool)
5. Ticket appears in user's "Tickets I'm Working On" section
6. Notification sent to requester: "Your ticket has been picked up by [name]"

## 5.5 Admin Override Actions

Administrators can:
- **Force to Pool 2:** `POST /api/orders/{id}/force-pool-2` – Immediately moves ticket to Pool 2
- **Reassign:** `POST /api/orders/{id}/reassign` – Assign to specific user, team, or specialty
- **Return to Pool:** Release assigned ticket back to appropriate pool

## 5.6 Pool Notifications

| Event | Notification Type | Recipients |
|-------|-------------------|------------|
| Ticket enters Pool 1 | In-app + Email | Eligible Partners/Staff with matching specialty |
| Ticket enters Pool 2 | In-app + Email | Eligible Vendors with matching specialty |
| Ticket picked | In-app | Requester |
| Pool 1 → Pool 2 promotion | In-app | Eligible Pool 2 users |

---

# 6. Workflow Engine

## 6.1 Supported Trigger Events

| Trigger | When It Fires |
|---------|---------------|
| `order.created` | Ticket submitted (not drafts) |
| `order.submitted` | Draft converted to Open |
| `order.status_changed` | Any status transition |
| `order.assigned` | Editor picks or is assigned |
| `order.delivered` | Resolver delivers work |
| `order.pending_review` | Status changes to Pending |
| `order.sla_warning` | X hours before SLA breach |
| `order.sla_breached` | SLA deadline passes |

## 6.2 Supported Action Types

| Action | Description | Status |
|--------|-------------|--------|
| `assign_role` | Auto-assign to user by role | ✅ Active |
| `assign_specialty` | Route to users with specific specialty | ✅ Active |
| `forward_ticket` | Move to different category/team | ✅ Active |
| `update_status` | Change ticket status | ✅ Active |
| `notify` | Send in-app notification | ✅ Active |
| `email_user` | Send email to specific address | ✅ Active |
| `email_requester` | Send email to ticket requester | ✅ Active |
| `webhook` | Trigger external webhook | ✅ Active |
| `route_to_pool` | Route ticket to Pool 1 or Pool 2 | ✅ Active |
| `apply_sla_policy` | Apply specific SLA policy | ✅ Active |
| `send_payment_link` | Send GHL payment link | ⚠️ MOCKED |

## 6.3 Category/Specialty Evaluation

Workflows can be restricted by category:

1. `trigger_category_id = null`: Workflow fires for ALL tickets
2. `trigger_category_id = X`: Workflow fires ONLY for tickets in category X

**Evaluation Order:**
1. Find all active workflows for the trigger event
2. Filter by category restriction (if any)
3. Execute matching workflows in creation order

## 6.4 Background Services/Timers

| Service | Purpose | Interval |
|---------|---------|----------|
| Pool Promotion | Move expired Pool 1 tickets to Pool 2 | Every 5 minutes |
| Review Reminder | Email requesters with delivered tickets | Daily |
| SLA Monitor | Check for at-risk and breached tickets | Every minute |
| Auto-Close | Close delivered tickets after 7 days | Daily |

## 6.5 Existing Workflow Templates

Workflows are fully customizable via the UI. No hardcoded templates exist – all workflows are stored in the database and editable by administrators.

## 6.6 Known Limitations

1. **No Undo/Redo:** Workflow editor changes are immediate
2. **Form Nodes:** Defined in schema but runtime UI is limited
3. **No Versioning:** Editing a workflow affects all future executions
4. **No Dry-Run:** Cannot preview workflow execution before deployment
5. **Single Field Conditions:** Condition nodes support one field comparison only

---

# 7. Notifications & Email

## 7.1 In-App Notification Matrix

| Event | Recipients | Type |
|-------|------------|------|
| Ticket Created | Admins | `new_order` |
| Ticket Picked Up | Requester | `order_picked` |
| Status Change | Requester + Editor (if not actor) | `status_change` |
| New Message | Other party | `new_message` |
| File Uploaded | Other party | `file_uploaded` |
| Workflow Triggered | Target user | `workflow_notification` |
| Feature Request | Admins | `new_feature_request` |
| Bug Report | Admins | `new_bug_report` |
| Pool Assignment | Eligible pool users | `pool_assignment` |
| SLA Warning | Admin | `sla_warning` |
| SLA Breached | Admin | `sla_breached` |

## 7.2 Email Notification Matrix

| Event | Recipients | Template |
|-------|------------|----------|
| User Created | New user | Welcome email with credentials |
| Password Reset | User | Reset link |
| Ticket Created | Requester | Confirmation |
| Ticket Assigned | Resolver | Assignment notification |
| Ticket Picked | Requester | Pickup notification |
| Ticket Delivered | Requester | Delivery + survey link |
| Ticket Canceled | Requester + Editor | Cancellation notice |
| Ticket Reopened | Editor | Reopen notification |
| Ticket Closed | Requester | Closure confirmation |
| Pool Assignment | Pool users | Opportunity notification |
| Account Disabled | User | Deactivation notice |
| Account Reactivated | User | Reactivation notice |

## 7.3 SMTP Configuration

| Setting | Status |
|---------|--------|
| SMTP Provider | **LIVE** – Gmail SMTP |
| Configuration | Via environment variables |
| Fallback | Logs to console if not configured |

**Environment Variables:**
- `SMTP_HOST` – SMTP server hostname
- `SMTP_PORT` – SMTP port (587 for TLS)
- `SMTP_USER` – Authentication username
- `SMTP_PASSWORD` – Authentication password
- `SMTP_FROM` – From email address

## 7.4 Satisfaction Survey Rules

### When Surveys ARE Sent
- Resolver delivers work (status → Delivered)
- Resolver submits for review (status → Pending, then → Delivered)

### When Surveys are NOT Sent
- ❌ Requester cancels ticket
- ❌ Admin cancels ticket
- ❌ Ticket reopened and canceled again (no duplicate)

### Survey Flow
1. Resolver delivers → System creates `rating_surveys` record with unique token
2. Email sent to requester with survey link
3. Requester clicks link → Rating page (1-5 stars + optional feedback)
4. Survey submitted → Marked as completed
5. Rating stored in `ratings` collection, linked to order and resolver

---

# 8. Reports

## 8.1 Canned Reports

| Report ID | Name | Description | Chart Type |
|-----------|------|-------------|------------|
| `tickets_created` | Tickets Created | Volume over time | Line/Bar |
| `tickets_closed` | Tickets Closed | Volume over time | Line/Bar |
| `open_ticket_aging` | Open Ticket Aging | Age buckets (0-24h, 1-3d, etc.) | Bar |
| `avg_first_response` | Avg Time to First Response | Performance metric | Gauge |
| `avg_resolution_time` | Avg Time to Resolution | Performance metric | Gauge |
| `tickets_by_category` | Tickets by Category | L1/L2 breakdown | Pie |
| `tickets_by_status` | Tickets by Status | Current distribution | Pie |
| `tickets_by_priority` | Tickets by Priority | Priority distribution | Pie |
| `tickets_by_team` | Tickets by Team | Team workload | Bar |
| `editor_performance` | Editor Performance | Per-assignee metrics | Table |
| `sla_compliance` | SLA Compliance | On-track vs breached | Gauge |
| `pool_metrics` | Pool Metrics | Pickup rates, times | Table |

## 8.2 Role-Based Access

| Role | Access Level |
|------|--------------|
| Administrator | All reports, all filters, all exports |
| Operator | All reports, all filters, all exports |
| Standard User | Limited reports (own tickets only), no export |

## 8.3 Export Formats

| Format | Status | Method |
|--------|--------|--------|
| **CSV** | ✅ Working | Server-side generation |
| **PDF** | ✅ Working | Client-side via jsPDF |

**API Endpoint:** `GET /api/reports/{report_id}?format=csv` or `?format=pdf`

---

# 9. Categories & Subcategories

## 9.1 Category Library Overview

The platform includes a comprehensive category tree designed for marketing + real estate organizations with broad applicability.

| Metric | Count |
|--------|-------|
| **Level 1 Categories** | 42 |
| **Level 2 Subcategories** | 403 |
| **Total Categories** | 445 |

## 9.2 Category Families

| Family | L1 Categories | Example Subcategories |
|--------|--------------|----------------------|
| **Marketing & Creative** | 6 | Brand Strategy, Campaign Planning, Social Media Graphics, Email Copy |
| **Production & Media** | 3 | Video Editing, Photo Shoot, Podcast Recording |
| **Residential Real Estate** | 3 | New Listing Setup, Showing Request, Virtual Staging |
| **Commercial Real Estate** | 3 | Commercial Listing Setup, Lease Proposal, Property Condition Report |
| **Sales & CRM** | 3 | Lead Assignment, CRM Data Entry, Landing Page Request |
| **Customer Support** | 2 | General Inquiry, Client Onboarding |
| **IT & Systems** | 3 | Password Reset, New Laptop Request, Access Request |
| **Finance & Accounting** | 4 | Invoice Submission, Expense Report, Paycheck Question |
| **HR & People Ops** | 4 | Job Posting Request, New Hire Setup, Time Off Request |
| **Legal & Compliance** | 2 | Contract Review Request, Compliance Question |
| **Operations & Admin** | 2 | Meeting Room Booking, Purchase Request |
| **Construction & Trades** | 5 | Roof Repair, Leak Repair, Electrical Repair, AC Repair, General Repair |
| **Projects & Initiatives** | 2 | New Project Request, Process Review Request |

## 9.3 Complete L1 Category List

1. Marketing & Creative
2. Graphic Design
3. Copywriting & Content
4. Digital Marketing
5. Social Media
6. Email Marketing
7. Video Production
8. Photography
9. Audio & Podcast
10. Residential Listings
11. Residential Sales Support
12. Property Staging
13. Commercial Listings
14. Commercial Leasing
15. Commercial Due Diligence
16. Sales Operations
17. CRM & Automations
18. Lead Generation
19. Customer Support
20. Client Services
21. IT Support
22. Hardware & Devices
23. Security & Access
24. Accounts Payable
25. Accounts Receivable
26. Expense & Reimbursement
27. Payroll
28. Hiring & Recruiting
29. Onboarding
30. Employee Services
31. Offboarding
32. Contracts & Agreements
33. Compliance & Risk
34. Facilities & Office
35. Procurement
36. Roofing & Exterior
37. Plumbing
38. Electrical
39. HVAC
40. Handyman & General
41. Project Requests
42. Process Improvement

## 9.4 Category Routing

Categories can be linked to:
- **Specialties** – For automatic pool routing to qualified users
- **Workflows** – To trigger automated actions when tickets are created
- **SLA Policies** – To apply specific response/resolution targets

### Routing Logic
1. User selects L1 category
2. User selects L2 subcategory
3. System looks up `specialty_id` on L2 (fallback to L1)
4. Ticket is routed to users with matching specialty in the appropriate pool

## 9.5 Admin Operations

| Action | Permission | API Endpoint |
|--------|-----------|--------------|
| List L1 Categories | All Users | `GET /api/categories/l1` |
| Create L1 Category | Admin | `POST /api/categories/l1` |
| Edit L1 Category | Admin | `PATCH /api/categories/l1/{id}` |
| Delete L1 Category | Admin | `DELETE /api/categories/l1/{id}` |
| List L2 Subcategories | All Users | `GET /api/categories/l2?parent_id={id}` |
| Create L2 Subcategory | Admin | `POST /api/categories/l2` |
| Edit L2 Subcategory | Admin | `PATCH /api/categories/l2/{id}` |
| Delete L2 Subcategory | Admin | `DELETE /api/categories/l2/{id}` |

## 9.6 Data Export

Category seed data is available for backup/re-import:

| File | Location | Format |
|------|----------|--------|
| `categories_l1.json` | `/app/backups/category_seed/` | JSON |
| `categories_l2.json` | `/app/backups/category_seed/` | JSON |
| `categories_full.json` | `/app/backups/category_seed/` | JSON (combined) |
| `categories_l1.csv` | `/app/backups/category_seed/` | CSV |
| `categories_l2.csv` | `/app/backups/category_seed/` | CSV |

### Re-Import Script
```bash
cd /app/backend
python3 scripts/seed_categories.py
```

---

# 10. Integrations

## 10.1 Webhook/API Status

| Integration | Status | Notes |
|-------------|--------|-------|
| **GoHighLevel (GHL) Payment** | ⚠️ **MOCKED** | `/api/webhooks/ghl-payment-mock` simulates payment |
| **SMTP (Gmail)** | ✅ **LIVE** | Real email delivery |
| **Custom Webhooks** | ✅ **LIVE** | Admin-configurable outbound webhooks |
| **API Keys** | ✅ **LIVE** | Issue keys for external integrations |

## 9.2 GHL Payment Webhook

The GHL payment integration is currently **MOCKED**:

- Endpoint: `POST /api/webhooks/ghl-payment-mock`
- Behavior: Immediately marks payment as received
- Next Step: Replace with real GHL webhook listener when ready

## 9.3 API Key Module

Administrators can:
- Create API keys for external systems
- Set permissions per key
- Revoke keys as needed

**Note:** Usage analytics (charts/dashboard) not yet implemented.

## 9.4 Outbound Webhooks

Configure webhooks to notify external systems:

| Event | Payload Includes |
|-------|------------------|
| Ticket Created | Ticket details, requester info |
| Status Changed | Ticket ID, old status, new status |
| Ticket Delivered | Ticket details, resolution notes |

---

# 10. Admin Operations

## 10.1 Data Reset Procedures

### UAT Reset Script

Location: `/app/backend/scripts/uat_reset.py`

**What it clears (operational data):**
- Tickets (orders)
- Order messages
- Order files
- Notifications
- Activity logs
- Escalation history
- Workflow executions
- Announcements
- Bug reports / Feature requests
- Ratings / Surveys

**What it preserves (configuration):**
- Users
- Roles
- Account Types
- Teams
- Specialties
- Categories (L1/L2)
- Workflows
- SLA Policies
- SMTP Config
- Settings

### Running the Reset

```bash
cd /app/backend
python3 scripts/uat_reset.py
```

## 10.2 Backup Strategy

**Backup Location:** `/app/backups/`

Backups are created:
- Before UAT resets
- As JSON files per collection
- With timestamp in folder name

## 10.3 Logs Module

The Logs module (`/logs`) provides:

| Feature | Behavior |
|---------|----------|
| Live Stream | Polls for new logs every 5 seconds |
| Filtering | By user, action type, date range |
| Export | CSV download of filtered results |

**What's Logged:**
- User actions (login, logout, profile updates)
- Ticket actions (create, pick, deliver, etc.)
- Admin actions (user management, settings changes)
- Workflow executions

---

# 11. Design Rationale – Why We Built It This Way

## 11.1 Why Pools Exist

**Problem:** In service delivery businesses, work needs to be distributed fairly across different tiers of service providers, while giving premium partners first access to opportunities.

**Solution:** The two-tier pool system ensures:
- **Partners** (who pay subscription fees) get priority access to new work
- **Vendors** (extended workforce) handle overflow after 24 hours
- **No work gets stuck** – automatic promotion ensures tickets move forward
- **Specialty matching** ensures the right skills are applied

**Why 24 hours?** Based on business analysis: most partners who will pick up work do so within the first day. After that, the ticket likely needs the extended workforce.

## 11.2 Why IAM Uses Minimal Roles + Overrides

**Problem:** Complex role systems become unmanageable. Every new permission requires defining it across dozens of roles.

**Solution:** Three simple roles (Admin, Operator, Standard User) cover 95% of use cases. For edge cases, user-level overrides provide flexibility without role proliferation.

**Benefits:**
- Easy to understand (3 roles vs 15+)
- Easy to audit (who has what access)
- Flexible where needed (individual overrides)

## 11.3 Why Survey Triggers Only on Delivery

**Problem:** Surveys sent when requesters cancel create bad experiences and skewed data.

**Solution:** Surveys are ONLY sent when the resolver delivers work:
- If requester cancels → No survey (they didn't receive service)
- If admin cancels → No survey (operational decision, not quality issue)
- If delivered → Survey sent (requester experienced the service)

This ensures satisfaction data reflects actual service quality.

## 11.4 Why Specialty-Based Routing

**Problem:** Random assignment leads to poor quality and inefficiency.

**Solution:** Each category is linked to a specialty. Tickets are only visible to users with matching specialties.

**Benefits:**
- Work goes to qualified people
- Users only see relevant opportunities
- Reduces "cherry-picking" of easy tickets

## 11.5 Why Configurable Pool Rules

**Problem:** Business rules change. Hard-coded pool logic requires developer intervention for every change.

**Solution:** Pool eligibility is stored in the database and editable via UI:
- Admin can add/remove account types from pools
- Admin can enable/disable pool access per account type
- Changes take effect immediately

---

# 12. Known Issues / Tech Debt / Open Items

## 12.1 Partially Implemented Features

| Feature | Status | Notes |
|---------|--------|-------|
| Form Nodes in Workflows | ⚠️ Partial | Node type exists, runtime UI limited |
| Workflow Preview/Simulation | ❌ Not Built | Planned feature |
| API Key Analytics | ⚠️ Partial | Usage logged, no charts |
| Bulk Operations | ❌ Not Built | Bulk restore/delete tickets |
| Email Preferences | ❌ Not Built | User-level email opt-out |
| Backup Codes for OTP | ❌ Not Built | Recovery codes for 2FA |

## 12.2 Technical Debt

| Item | Description | Impact |
|------|-------------|--------|
| Large Files | `orders.py`, `users.py`, `IAMPage.js` exceed 500 lines | Maintainability |
| Pool Logic | Complex routing in `orders.py` should be extracted | Testability |
| Legacy Compatibility | Code handles both `specialty_id` and `specialty_ids` | Confusion |

## 12.3 Mocked Integrations

| Integration | Current State | To Be Done |
|-------------|---------------|------------|
| GHL Payment | Mocked webhook | Real GHL integration |

## 12.4 Known Bugs

**None identified** – Clean UAT baseline established.

---

# Appendix A: Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Administrator | admin@redribbonops.com | Admin123! |

**Note:** Create additional test users via IAM page for role-specific testing.

---

# Appendix B: API Quick Reference

## Authentication
```
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

## Tickets
```
GET    /api/orders
POST   /api/orders
GET    /api/orders/{id}
PATCH  /api/orders/{id}
DELETE /api/orders/{id}
POST   /api/orders/{id}/pick
POST   /api/orders/{id}/deliver
POST   /api/orders/{id}/reassign
POST   /api/orders/{id}/force-pool-2
```

## Pools
```
GET    /api/orders/pool/1
GET    /api/orders/pool/2
GET    /api/pool-picker-rules
POST   /api/pool-picker-rules
```

## Users
```
GET    /api/users
POST   /api/users
GET    /api/users/{id}
PATCH  /api/users/{id}
DELETE /api/users/{id}
```

---

**End of Document**

*Red Pulse System Documentation Pack v1.0*
*Generated: December 2025*
