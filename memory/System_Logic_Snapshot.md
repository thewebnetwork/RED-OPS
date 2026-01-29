# Red Ops - System Logic Snapshot
**Version:** 1.0  
**Generated:** December 2025  
**Purpose:** UAT Preparation Document

---

## Table of Contents
1. [Core Ticket Lifecycle + Status Rules](#1-core-ticket-lifecycle--status-rules)
2. [Routing Logic (Pools / Specialty / Team)](#2-routing-logic-pools--specialty--team)
3. [Workflow Engine Logic](#3-workflow-engine-logic)
4. [IAM Logic](#4-iam-logic)
5. [Notifications + Email + Surveys](#5-notifications--email--surveys)
6. [Reports Module](#6-reports-module)
7. [Test Harness / Data Reset](#7-test-harness--data-reset)

---

## 1. Core Ticket Lifecycle + Status Rules

### 1.1 All Statuses
| Status | Description |
|--------|-------------|
| **Draft** | Incomplete ticket saved by requester; not visible in pools |
| **Open** | Submitted ticket; visible in Pool 1/Pool 2; awaiting pickup |
| **In Progress** | Picked up by resolver; actively being worked on |
| **Pending** | Submitted for review; awaiting requester response |
| **Delivered** | Final work delivered; awaiting requester close/feedback |
| **Closed** | Ticket resolved and closed by requester or admin |
| **Canceled** | Ticket canceled (by requester or admin) |

### 1.2 Allowed Status Transitions

```
Draft → Open (via Submit)
Open → In Progress (via Pick)
Open → Canceled (by Requester/Admin)
In Progress → Pending (via Deliver/Request Review)
In Progress → Delivered (via Deliver)
In Progress → Canceled (by Requester/Admin)
In Progress → Open (via Release - returns to pool)
Pending → In Progress (Requester responds with message)
Pending → Closed (Requester accepts)
Pending → Canceled
Delivered → Closed (by Requester/Admin)
Closed → Open (Reopen - by Admin only)
Canceled → Open (Restore - by Admin only)
```

### 1.3 Who Can Perform Each Transition

| Action | Administrator | Operator | Standard User |
|--------|:-------------:|:--------:|:-------------:|
| Create Draft | ✅ | ✅ | ✅ (own) |
| Submit Draft | ✅ | ✅ | ✅ (own) |
| Pick from Pool | ✅ | ✅ | ✅ (Pool-eligible) |
| Deliver/Submit for Review | ✅ | ✅ | ✅ (assigned resolver) |
| Close Ticket | ✅ | ❌ | ✅ (requester only) |
| Cancel Ticket | ✅ | ✅ | ✅ (requester only) |
| Reopen Ticket | ✅ | ❌ | ❌ |
| Restore Deleted Ticket | ✅ | ❌ | ❌ |
| Force to Pool 2 | ✅ | ❌ | ❌ |
| Reassign Ticket | ✅ | ✅ | ❌ |
| Soft-Delete Ticket | ✅ | ❌ | ❌ |

### 1.4 Required Fields at Each Transition

| Transition | Required Fields |
|------------|-----------------|
| **Cancel** | `reason` (from predefined list: "No longer needed", "Changed my mind", "Found a different solution", "Fixed the issue myself", "Duplicate ticket", "Other"), optional `notes` |
| **Deliver** | `resolution_notes` (1-2000 chars) |
| **Close** | `reason` (free text, 1-500 chars) |
| **Reopen** | `reason` (required text explaining why reopening) |

---

## 2. Routing Logic (Pools / Specialty / Team)

### 2.1 Pool 1 (Partner Pool) - First 24 Hours

**Visibility Conditions:**
- Ticket status = `Open`
- Ticket has no assigned `editor_id`
- Ticket age < 24 hours from `pool_entered_at` (or `created_at` if not set)

**Who Can Access Pool 1:**
- Users with `account_type = "Partner"` 
- Users with role `Administrator` or `Operator`

**Pool 1 Specialty Filtering:**
- Partners only see tickets matching their `specialty_id`
- Support/Issue tickets excluded UNLESS user has a specialty containing "support"

### 2.2 Pool 2 (Vendor Pool) - After 24 Hours

**Handoff Timing:**
- Automatic after 24 hours if ticket remains unpicked
- Can be forced immediately via Admin action (`POST /api/orders/{id}/force-pool-2`)

**Visibility Conditions:**
- Ticket status = `Open`
- Ticket has no assigned `editor_id`
- Ticket age >= 24 hours from `pool_entered_at`
- OR `forced_to_pool_2 = true`

**Who Can Access Pool 2:**
- Users with `account_type = "Vendor/Freelancer"`
- Users with role `Administrator` or `Operator`

**Pool 2 Notifications:**
- When ticket enters Pool 2, email sent to all eligible Vendor/Freelancer users
- Controlled by `pool_2_notified` flag (prevents duplicate emails)

### 2.3 No Workflow for Category/Subcategory

If no workflow exists for a ticket's category:
- Ticket goes directly to Pool 1 (Partners)
- After 24 hours, automatically escalates to Pool 2 (Vendors)
- No automatic assignment occurs
- Default SLA is applied (7 days from creation)

### 2.4 Reassignment Logic

**Reassignment Types:**
1. **To User** - Direct assignment to specific user by ID
2. **To Team** - Assigns to any available member of a team
3. **To Specialty** - Routes to users with matching specialty
4. **Return to Pool** - Releases ticket back to Open status

**Permissions:**
- `Administrator`: Can reassign any ticket to any user/team/specialty
- `Operator`: Can reassign tickets within their scope
- `Standard User`: Cannot reassign (must release to pool instead)

**Reassignment Endpoint:**
```
POST /api/orders/{order_id}/reassign
Body: {
  "new_editor_id": "user-uuid" (optional),
  "team_id": "team-uuid" (optional),
  "specialty_id": "specialty-uuid" (optional),
  "reason": "Explanation text" (required)
}
```

---

## 3. Workflow Engine Logic

### 3.1 Trigger Events

| Trigger | When It Fires |
|---------|---------------|
| `order.created` | When ticket submitted (not drafts) |
| `order.submitted` | When draft converted to Open |
| `order.status_changed` | Any status transition |
| `order.assigned` | When editor picks or is assigned |
| `order.delivered` | When resolver delivers work |
| `order.pending_review` | When status changes to Pending |
| `order.sla_warning` | X hours before SLA breach |
| `order.sla_breached` | When SLA deadline passes |

### 3.2 Available Actions

| Action Type | Description | Status |
|-------------|-------------|--------|
| `assign_role` | Auto-assign to user with specific role | ✅ ACTIVE |
| `update_status` | Change ticket status | ✅ ACTIVE |
| `notify` | Send in-app notification | ✅ ACTIVE |
| `email_user` | Send email to specific address | ✅ ACTIVE |
| `email_requester` | Send email to ticket requester | ✅ ACTIVE |
| `webhook` | Trigger external webhook | ✅ ACTIVE |
| `forward_ticket` | Move to different category/team | ✅ ACTIVE |
| `assign_specialty` | Route to users with specific specialty | ✅ ACTIVE |
| `apply_sla_policy` | Apply specific SLA policy to ticket | ✅ ACTIVE |
| `auto_escalate` | Legacy - redirects to apply_sla_policy | ✅ ACTIVE (deprecated) |

### 3.3 Condition Evaluation

Workflows support condition nodes with these operators:
- `equals` - Exact match
- `not_equals` - Not equal
- `contains` - Substring match
- `greater_than` - Numeric comparison
- `less_than` - Numeric comparison

**Fields available for conditions:** All ticket fields including `status`, `priority`, `category_l1_id`, `category_l2_id`, `requester_id`, etc.

### 3.4 Category/Subcategory Evaluation

Workflows are matched by:
1. `trigger_event` - Must match the event type
2. `trigger_category_id` - If set, only fires for tickets in that category
3. If `trigger_category_id` is null/not set, workflow fires for ALL tickets

**Evaluation Order:**
1. Find all active workflows for the trigger event
2. Filter by category if workflow has category restriction
3. Execute matching workflows in order of creation

---

## 4. IAM Logic

### 4.1 Role + Permission Merge (Precedence Rules)

**Step 1: Load Base Permissions from Role**
```
Role → Default Permissions Dict
```

**Step 2: Apply User-Level Overrides**
```python
# Precedence: Override > Role Default
for module, actions in user.permission_overrides:
    for action, value in actions:
        effective_permissions[module][action] = value  # Override wins
```

**Result:** Final permissions = Role defaults + User overrides (overrides always win)

### 4.2 System Roles (3 only)

| Role | Description |
|------|-------------|
| **Administrator** | Full access to all modules and actions |
| **Operator** | Ticket management + limited admin views (NO system governance) |
| **Standard User** | Basic ticket submission, pool pickup, view own data |

### 4.3 Account Types (4 types)

| Account Type | Pool Access | Subscription Required |
|--------------|-------------|----------------------|
| **Partner** | Pool 1 only | Yes (Core/Engage/Lead-to-Cash/Scale) |
| **Media Client** | Requester only | No |
| **Internal Staff** | Based on role | No |
| **Vendor/Freelancer** | Pool 2 only | No |

### 4.4 Module-Level Permissions

| Module | Actions | Admin | Operator | Standard |
|--------|---------|:-----:|:--------:|:--------:|
| dashboard | view | ✅ | ✅ | ✅ |
| my_services | view | ✅ | ✅ | ✅ |
| submit_request | view, create | ✅ | ✅ | ✅ |
| orders | view, create, edit, delete, export, pick, assign | ✅ | ✅ (no delete) | ✅ (limited) |
| users | view, create, edit, delete | ✅ | view only | ❌ |
| teams | view, create, edit, delete | ✅ | view only | ❌ |
| specialties | view, create, edit, delete | ✅ | view only | view only |
| subscription_plans | view, create, edit, delete | ✅ | view only | view only |
| categories | view, create, edit, delete | ✅ | view only | view only |
| workflows | view, create, edit, delete, execute | ✅ | view, execute | ❌ |
| sla_policies | view, create, edit, delete, acknowledge | ✅ | view, acknowledge | ❌ |
| integrations | view, create, edit, delete | ✅ | ❌ | ❌ |
| announcements | view, create, edit, delete | ✅ | view only | view only |
| logs | view, export | ✅ | view only | ❌ |
| settings | view, edit | ✅ | ❌ | ❌ |
| reports | view, export | ✅ | ✅ | view only |

### 4.5 Restrictions by Module

**Reports Module:**
- Standard Users: Can only view basic reports, no export
- Operators: Full view + export
- Administrators: Full access

**Opportunity Ribbon (Pools):**
- Partners: Pool 1 only, filtered by specialty
- Vendors: Pool 2 only, filtered by specialty
- Admin/Operator: Both pools, no filtering

---

## 5. Notifications + Email + Surveys

### 5.1 In-App Notification Events

| Event | Recipients | Notification Type |
|-------|------------|-------------------|
| Ticket Created | All Editors | `new_order` |
| Ticket Picked Up | Requester | `order_picked` |
| Status Change | Requester + Editor (if not actor) | `status_change` |
| New Message | Other party (requester/editor) | `new_message` |
| File Uploaded | Other party | `file_uploaded` |
| Workflow Triggered | Target user | `workflow_notification` |
| Feature Request Submitted | Admins | `new_feature_request` |
| Bug Report Submitted | Admins | `new_bug_report` |

### 5.2 Email Events

| Event | Recipients | SMTP Status |
|-------|------------|-------------|
| Ticket Created | Requester | ✅ LIVE (Gmail SMTP) |
| Ticket Assigned | Resolver | ✅ LIVE |
| Ticket Picked Up | Requester | ✅ LIVE |
| Ticket Resolved/Delivered | Requester | ✅ LIVE |
| Ticket Cancelled | Requester + Editor | ✅ LIVE |
| Ticket Status Changed | Requester (for key statuses) | ✅ LIVE |
| Pending Review | Requester | ✅ LIVE |
| Ticket Reopened | Requester + Editor | ✅ LIVE |
| Ticket Reassigned | Previous + New Editor | ✅ LIVE |
| Ticket Closed | Requester | ✅ LIVE |
| Pool Assignment | Pool-eligible users | ✅ LIVE |
| Password Reset | User | ✅ LIVE |
| Account Created | New User | ✅ LIVE |
| Account Disabled | User | ✅ LIVE |
| Account Reactivated | User | ✅ LIVE |
| Satisfaction Survey | Requester (on delivery) | ✅ LIVE |

**SMTP Configuration:** Gmail SMTP configured and LIVE (not mocked).

### 5.3 Satisfaction Survey Logic

**When Surveys ARE Sent:**
- Resolver delivers work (`POST /api/orders/{id}/deliver`)
- Status changes to `Delivered` or `Pending`
- Survey email sent to requester with unique token link

**When Surveys are NOT Sent:**
- Requester cancels ticket (no survey)
- Admin cancels ticket (no survey)
- Ticket reopened and then cancelled (no duplicate survey)

**Survey Flow:**
1. Resolver delivers → System creates `rating_surveys` record with token
2. Email sent to requester with survey link
3. Requester submits rating (1-5 stars + optional feedback)
4. Survey marked as completed

---

## 6. Reports Module

### 6.1 Data Sources

| Report | Primary Collection | Related Collections |
|--------|-------------------|---------------------|
| Tickets Created | `orders` | - |
| Tickets Closed | `orders` | - |
| Open Ticket Aging | `orders` | - |
| Avg First Response | `orders`, `order_messages` | - |
| Avg Resolution Time | `orders` | - |
| SLA Compliance | `orders`, `sla_policies` | - |
| Tickets by Assignee | `orders`, `users` | - |
| Tickets by Team | `orders`, `teams` | - |
| Tickets by Specialty | `orders`, `specialties` | - |
| Tickets by Category | `orders`, `categories_l1`, `categories_l2` | - |
| Escalation Events | `escalation_events` | `orders`, `sla_policies` |
| SLA Policy Effectiveness | `orders`, `sla_policies` | - |
| Stale Pending Review | `orders` | - |

### 6.2 Role-Based Access

| Role | Access Level |
|------|--------------|
| Administrator | All reports, all filters, all exports |
| Operator | All reports, all filters, all exports |
| Standard User | Limited reports (own tickets only), no export |

### 6.3 Export Formats

| Format | Status | Notes |
|--------|--------|-------|
| **CSV** | ✅ Supported | All reports support CSV export |
| **PDF** | ✅ Supported | Available via `/api/reports/export/{report_id}?format=pdf` |

---

## 7. Test Harness / Data Reset

### 7.1 Data Reset Options

**⚠️ IMPORTANT:** There is no single "reset all" endpoint. Data must be cleared per collection.

### 7.2 Available Reset Operations

| Data Type | Method | Backup Created | Endpoint/UI Path |
|-----------|--------|----------------|------------------|
| **Tickets** | MongoDB Delete | ❌ No | Manual: `db.orders.deleteMany({})` |
| **Announcements** | Delete via UI | ❌ No | Settings → Announcements → Delete each |
| **Notifications** | Delete via API | ❌ No | `DELETE /api/notifications` (per user) |
| **Logs** | Manual DB delete | ❌ No | Manual: `db.activity_logs.deleteMany({})` |
| **UI Settings** | Reset to defaults | ❌ No | `POST /api/ui-settings/reset` |
| **Deleted Tickets** | Permanent purge | ❌ No | Manual: `db.orders.deleteMany({deleted: true})` |

### 7.3 Admin Endpoints for Reset

```bash
# Reset UI Settings to Defaults (Admin only)
POST /api/ui-settings/reset

# Delete all user notifications
DELETE /api/notifications

# Soft-delete cleanup would require direct DB access or custom endpoint
```

### 7.4 Safe Test Reset Procedure

**Recommended UAT Reset Steps:**

1. **Tickets:** 
   ```javascript
   // MongoDB Shell
   db.orders.deleteMany({})
   db.order_messages.deleteMany({})
   db.order_files.deleteMany({})
   ```

2. **Announcements:**
   ```javascript
   db.announcements.deleteMany({})
   db.announcement_ticker.deleteMany({})
   ```

3. **Notifications:**
   ```javascript
   db.notifications.deleteMany({})
   ```

4. **Logs (Activity/Workflow):**
   ```javascript
   db.activity_logs.deleteMany({})
   db.workflow_executions.deleteMany({})
   ```

5. **Surveys/Ratings:**
   ```javascript
   db.rating_surveys.deleteMany({})
   ```

6. **Escalations:**
   ```javascript
   db.escalation_events.deleteMany({})
   ```

### 7.5 What to Preserve During Reset

| Collection | Preserve? | Reason |
|------------|-----------|--------|
| `users` | ✅ Yes | User accounts needed for testing |
| `teams` | ✅ Yes | Team structure needed |
| `roles` | ✅ Yes | Role definitions needed |
| `specialties` | ✅ Yes | Specialty definitions needed |
| `categories_l1` | ✅ Yes | Category hierarchy needed |
| `categories_l2` | ✅ Yes | Subcategory definitions needed |
| `workflows` | ✅ Yes | Workflow definitions needed |
| `sla_policies` | ✅ Yes | SLA policy definitions needed |
| `smtp_config` | ✅ Yes | Email configuration |

---

## Appendix A: Quick Reference - API Endpoints

### Ticket Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/orders` | POST | Create ticket |
| `/api/orders/{id}/submit` | POST | Submit draft |
| `/api/orders/{id}/pick` | POST | Pick from pool |
| `/api/orders/{id}/deliver` | POST | Deliver work |
| `/api/orders/{id}/close` | POST | Close ticket |
| `/api/orders/{id}/cancel` | POST | Cancel ticket |
| `/api/orders/{id}/reopen` | POST | Reopen closed ticket |
| `/api/orders/{id}/reassign` | POST | Reassign ticket |
| `/api/orders/{id}/force-pool-2` | POST | Force to Pool 2 |
| `/api/orders/{id}` | DELETE | Soft-delete |
| `/api/orders/{id}/restore` | POST | Restore deleted |
| `/api/orders/deleted/list` | GET | List deleted tickets |

### Pools
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/orders/pool` | GET | All open tickets |
| `/api/orders/pool/1` | GET | Pool 1 (Partners) |
| `/api/orders/pool/2` | GET | Pool 2 (Vendors) |

---

## Appendix B: MOCKED vs LIVE Components

| Component | Status | Notes |
|-----------|--------|-------|
| Gmail SMTP | ✅ LIVE | Fully configured |
| GoHighLevel Webhook | ⚠️ MOCKED | `/api/webhooks/ghl-payment-mock` |
| All other webhooks | ✅ LIVE | Configurable via Integrations |
| Workflow Engine | ✅ LIVE | All actions operational |
| SLA Engine | ✅ LIVE | Escalations active |

---

**Document End**

*For questions or clarifications during UAT, reference specific section numbers.*
