# Red Ops Platform - Build Inventory Snapshot
## UAT Testing Reference (December 2025)

**Platform Name:** Red Ops
**Preview URL:** https://user-auth-36.preview.emergentagent.com
**Version:** 4.0
**Generated:** December 2025

---

## A) MODULES LIVE (Sidebar + Admin Hubs)

### Main Sidebar Navigation
| Module | Route | Roles | Description |
|--------|-------|-------|-------------|
| Dashboard | `/` | All | Role-specific KPIs and overview |
| My Services | `/my-services` | All | User's service info (Markdown) |
| My Submitted Tickets | `/my-tickets` | All | User's own submitted requests |
| Submit New Request | `/command-center` | All | Create new ticket/request |
| Report an Issue | `/report-issue` | All | Report bugs/issues |
| Opportunity Ribbon | `/ribbon-board` | Non-Media Clients | Pool 1 & Pool 2 ticket pools |
| All Orders | `/orders` | Admin | Full ticket management |
| Deleted Tickets | `/deleted-tickets` | Admin | Soft-deleted tickets view |
| Reports | `/reports` | All | Canned reports module |
| Identity & Access | `/iam` | Admin | Users, Teams, Roles, Specialties, Account Types, Plans |
| Logs | `/logs` | Admin, Operator | Activity/system logs |
| Announcements | `/announcements` | Admin | System announcements |
| Settings | `/settings` | Admin | Settings hub |

### Settings Hub (Admin-Only Subpages)
| Subpage | Route | Description |
|---------|-------|-------------|
| Categories | `/categories` | L1/L2 category management |
| Workflows | `/workflows` | Workflow builder |
| SLA & Escalation | `/sla-policies` | SLA policies + escalation rules |
| Email Settings | `/email-settings` | SMTP configuration |
| Integrations | `/integrations` | API keys, webhooks |
| Pool Picker Rules | `/settings/pool-picker-rules` | Pool eligibility configuration |
| Documentation | `/settings/documentation` | System logic snapshot |
| Translation Editor | `/settings/translations` | i18n translation editor |
| UI Customizations | `/settings/ui` | Field labels, branding |

### IAM Page Tabs (Admin-Only)
| Tab | Description |
|-----|-------------|
| Users | Create/edit/deactivate users |
| Teams | Team management with specialty association |
| Specialties | Service specialties (routing key) |
| Roles | Role definitions with permissions |
| Account Types | Partner, Internal Staff, Vendor, Media Client |
| Plans | Subscription plans |

---

## B) CORE TICKET LIFECYCLE

### Statuses & Transitions
```
Draft → Open → In Progress → Pending → Delivered → Closed
                    ↓
                Cancelled
```

| From | Allowed To | Who Can Transition |
|------|------------|-------------------|
| Draft | Open (Submit) | Requester only |
| Open | In Progress (Pick/Assign) | Assignee, Admin |
| Open | Cancelled | Admin |
| In Progress | Pending (Submit for Review) | Assignee |
| In Progress | Cancelled | Admin |
| Pending | In Progress (Revision) | Requester, Admin |
| Pending | Delivered (Accept) | Requester, Admin |
| Delivered | Closed | Auto (7 days) or Admin |
| Delivered | Reopened → In Progress | Requester (within window) |
| Any | Soft-Deleted | Admin only |

### Required Fields by Action
| Action | Required Fields |
|--------|----------------|
| Cancel | `cancel_reason` (text) |
| Close | None (auto after delivery acceptance) |
| Reopen | `reopen_reason` (text) |
| Soft-Delete | None (admin action) |

### Who Can Do What
| Action | Roles |
|--------|-------|
| Create Ticket | All authenticated users |
| Cancel Ticket | Admin only |
| Close Ticket | Admin, Auto-close system |
| Reopen Ticket | Requester (within 7 days), Admin |
| Soft-Delete | Admin only |
| Restore Deleted | Admin only |
| Permanent Delete | Not implemented |

---

## C) POOLS / OPPORTUNITY RIBBON

### Pool Routing Rules (Source of Truth: `/api/pool-picker-rules`)

| Account Type | Can Pick | Allowed Pools | Default |
|--------------|----------|---------------|---------|
| Partner | ✅ Yes | POOL_1 | Yes |
| Internal Staff | ✅ Yes | POOL_1 | Yes |
| Vendor/Freelancer | ✅ Yes | POOL_2 | Yes |
| Media Client | ❌ No | [] | No |

**Admin Override:** Each user has a `can_pick` field (boolean) that can override account-type settings.

**Effective Rule:** `user_can_pick = account_type.can_pick AND user.can_pick`

### Pool Routing Logic
1. Ticket becomes `Open` (draft submitted or direct creation)
2. System determines `routing_specialty_id` from category L2 → L1 fallback
3. Query eligible Pool 1 users (Partners + Internal Staff with matching specialty)
4. If eligible users > 0 → Assign to `POOL_1`, set `pool1_expires_at` = now + 24h
5. If eligible users = 0 → Skip Pool 1, assign to `POOL_2` immediately
6. Background monitor promotes `POOL_1` tickets to `POOL_2` after 24h expiry

### Pick/Assign Logic
1. User clicks "Pick" on Ribbon Board
2. System validates: account type allowed, pool access, specialty match
3. Ticket `assigned_to` = picker's user ID
4. Ticket `status` = "In Progress"
5. Ticket removed from pool
6. Notification sent to requester: "Your ticket has been picked up by [name]"

### Pool Visibility
| Pool | Who Sees It |
|------|-------------|
| Pool 1 (Opportunity Ribbon) | Partners, Internal Staff (first 24h) |
| Pool 2 (Opportunity Pool) | Vendors/Freelancers, OR anyone after 24h expiry |

### Notifications Triggered by Pool Events
| Event | Notification Type | Recipients |
|-------|-------------------|------------|
| Ticket enters Pool 1 | In-app + Email | Eligible Partners/Staff with matching specialty |
| Ticket enters Pool 2 | In-app + Email | Eligible Vendors with matching specialty |
| Ticket picked | In-app | Requester |
| Pool 1 → Pool 2 transition | In-app | Eligible Pool 2 users |

---

## D) WORKFLOW ENGINE

### Trigger Events Supported
| Trigger Type | Description |
|--------------|-------------|
| `order.created` | When ticket is created |
| `order.status_changed` | When ticket status changes |
| `order.assigned` | When ticket is assigned |
| `sla.at_risk` | When SLA approaches breach |
| `sla.breached` | When SLA is breached |
| `order.delivered` | When ticket is delivered |
| Manual | User-initiated workflow |

### Action Types Supported
| Action Type | Description |
|-------------|-------------|
| `assign_role` | Auto-assign to user by role |
| `assign_specialty` | Auto-assign to user by specialty |
| `forward_ticket` | Forward to team/user |
| `update_status` | Change ticket status |
| `notify` | Send in-app notification |
| `send_email` / `email_user` / `email_requester` | Send email |
| `webhook` | Trigger external webhook |
| `route_to_pool` | Route ticket to Pool 1/2 |
| `send_payment_link` | Send GHL payment link (MOCKED) |
| `apply_sla` | Apply SLA policy |
| `auto_escalate` | Trigger escalation |

### Node Types
| Type | Purpose |
|------|---------|
| `trigger` | Entry point (event that starts workflow) |
| `action` | Perform an automated action |
| `condition` | Branch based on criteria (field = value) |
| `form` | Collect additional data (not fully implemented) |
| `end` | Terminal node |

### Templated vs Hardcoded
- **Templated:** All workflow definitions stored in DB, fully customizable via UI
- **Hardcoded:** Core status transitions, email templates (partial), SLA calculations

### Known Limitations
1. No undo/redo in workflow editor
2. Form nodes are defined but UI for runtime form rendering is limited
3. Workflow versioning not implemented
4. No dry-run/preview mode
5. Condition nodes support single field comparison only

---

## E) NOTIFICATIONS & EMAIL

### In-App Notification Events
| Event | Notification Created |
|-------|---------------------|
| Ticket created | Admin notification |
| Ticket assigned to user | Assignee notification |
| Ticket status changed | Requester + assignee notification |
| Ticket enters pool | Eligible pool users notification |
| Ticket picked from pool | Requester notification |
| Message added to ticket | Other party notification |
| SLA at risk | Admin notification |
| SLA breached | Admin notification |
| Escalation triggered | Escalation targets notification |

### Email Events
| Event | Email Sent To |
|-------|--------------|
| User created | New user (welcome email with credentials) |
| Password reset requested | User (reset link) |
| Ticket assigned | Assignee |
| Ticket delivered | Requester (with survey link) |
| Ticket status changed | Requester |
| Pool notification | Eligible pool users |
| SLA escalation | Escalation contacts |
| Review reminder | Requester (7 days after delivery) |

### Satisfaction Survey Trigger
- **Trigger:** Ticket status changes to `Delivered`
- **Email:** Sent to requester with unique rating link
- **Auto-close:** 7 days after delivery if no response

### SMTP Status
| Status | Notes |
|--------|-------|
| **LIVE** | Gmail SMTP configured via environment variables |
| Configuration | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| Fallback | If not configured, emails are mocked (logged to console) |

---

## F) REPORTS

### Canned Reports (All Roles Can Access)
| Report ID | Name | Description | Charts |
|-----------|------|-------------|--------|
| `tickets_created` | Tickets Created | Volume over time (day/week/month) | ✅ |
| `tickets_closed` | Tickets Closed | Volume over time | ✅ |
| `open_ticket_aging` | Open Ticket Aging | Age buckets (0-24h, 1-3d, 3-7d, 7-14d, 14d+) | ✅ |
| `avg_first_response` | Avg Time to First Response | Performance metric | ✅ |
| `avg_resolution_time` | Avg Time to Resolution | Performance metric | ✅ |
| `tickets_by_category` | Tickets by Category | Volume by L1/L2 category | ✅ |
| `tickets_by_status` | Tickets by Status | Current status distribution | ✅ |
| `tickets_by_priority` | Tickets by Priority | Priority distribution | ✅ |
| `tickets_by_team` | Tickets by Team | Team workload distribution | ✅ |
| `editor_performance` | Editor Performance | Per-assignee metrics | ✅ |
| `sla_compliance` | SLA Compliance | On-track vs breached rates | ✅ |
| `pool_metrics` | Pool Metrics | Pool 1/2 pickup rates, times | ✅ |

### Export Formats
| Format | Status |
|--------|--------|
| CSV | ✅ Working |
| PDF | ✅ Working (client-side via jsPDF) |

### Role Access
- All reports accessible to all authenticated users
- Data is RBAC-filtered (users only see their own data unless Admin)

---

## G) IAM (Identity & Access Management)

### Roles & Permissions Model
| Role | Description | Key Permissions |
|------|-------------|-----------------|
| Administrator | Full system access | All CRUD, settings, user management |
| Operator | Team lead/supervisor | View all tickets, limited settings |
| Standard User | Regular requester | Create tickets, view own tickets |

**Permission Override:** Each role has a granular permission matrix that can be customized.

### Account Types
| Type | Purpose | Can Pick | Default Pools |
|------|---------|----------|---------------|
| Partner | External partners (subscription required) | ✅ | Pool 1 |
| Internal Staff | Internal team members | ✅ | Pool 1 |
| Vendor/Freelancer | External contractors | ✅ | Pool 2 |
| Media Client | End clients who submit requests | ❌ | None |

### Multi-Specialty Support
- Users can have **multiple specialties** (`specialty_ids` array)
- One specialty marked as **primary** (`primary_specialty_id`)
- Pool routing matches if **ANY** user specialty matches ticket specialty

### Teams
- Teams are organizational groups
- Teams have **related specialties** (filters specialty options for team members)
- Users belong to one team (optional)

### Searchable Dropdowns
- User selector: Search by name/email
- Team selector: Search by team name
- Specialty selector: Multi-select with search
- Category selector: Search by category name

---

## H) INTEGRATIONS

### Webhooks/APIs Status
| Integration | Status | Notes |
|-------------|--------|-------|
| GoHighLevel (GHL) Payment | **MOCKED** | `/api/webhooks/ghl-payment-mock` - simulates payment confirmation |
| SMTP (Gmail) | **LIVE** | Real email delivery configured |
| API Keys | Live | Issue keys for external integrations |
| Custom Webhooks | Live | Configurable outbound webhooks |

### API Keys Module
- Create/revoke API keys
- Track usage (logged but no analytics UI yet)
- Rate limiting not implemented

### Webhook Configuration
- Admin can configure outbound webhooks
- Events: ticket created, status changed, etc.
- Test webhook functionality available

---

## I) KNOWN ISSUES / TECH DEBT

### Partially Implemented
1. **Form Nodes in Workflows:** Node type exists but runtime form UI is limited
2. **Workflow Preview/Simulation:** Planned but not built
3. **API Key Analytics:** Usage logged but no charts/dashboard
4. **Bulk Operations:** Bulk restore/delete for tickets not implemented

### Technical Debt
1. **Large Files:** `orders.py`, `users.py`, `IAMPage.js` are very large and should be refactored
2. **Pool Routing:** Complex logic in `orders.py` could be extracted to service module
3. **Legacy Compatibility:** Some code handles both `specialty_id` (old) and `specialty_ids` (new)

### Not Final
1. **GHL Payment:** Still mocked - needs real integration
2. **Backup Codes for OTP:** Planned but not implemented
3. **Email Preferences:** User email preference page not built

### Known Bugs (None Critical)
- None identified at this time (clean UAT baseline)

---

## QUICK REFERENCE: Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@redribbonops.com | Admin123! |

**Note:** Create additional test users via IAM page for role-specific testing.

---

## DATA RESET STATUS

| Collection | Count | Status |
|------------|-------|--------|
| Tickets (orders) | 0 | ✅ Clean |
| Notifications | 0 | ✅ Clean |
| Announcements | 0 | ✅ Clean |
| Escalation History | 0 | ✅ Clean |
| SLA Alerts | 0 | ✅ Clean |
| Workflow Executions | 0 | ✅ Clean |
| Users | 1 | Admin only |
| Configuration | Preserved | Roles, Account Types, etc. need seeding |

**Backup Location:** `/app/backups/uat_reset_20260129_155357/`

---

*Document generated for UAT testing reference. Last updated: December 2025*
