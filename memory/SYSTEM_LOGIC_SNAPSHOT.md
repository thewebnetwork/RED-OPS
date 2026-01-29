# Red Ops Platform - System Logic Snapshot
**Version**: 3.4 | **Date**: January 29, 2026 | **For UAT Testing**

---

## 1. CORE TICKET LIFECYCLE + STATUS RULES

### 1.1 Status Definitions

| Status | Description |
|--------|-------------|
| **Draft** | Saved but not submitted. Only visible to owner. No SLA. |
| **Open** | Submitted and available for pickup in pool. SLA clock starts. |
| **In Progress** | Picked up or assigned to a resolver. Being worked on. |
| **Pending** | Submitted for review by resolver. Awaiting requester response. |
| **Delivered** | Work completed with final delivery file. Survey sent. |
| **Closed** | Requester accepted or admin closed. Terminal state. |
| **Canceled** | Requester canceled. Terminal state. NO survey. |

### 1.2 Allowed Status Transitions

```
Draft ────────────────► Open (submit)
Open ─────────────────► In Progress (pick/assign)
In Progress ──────────► Pending (submit-for-review)
In Progress ──────────► Delivered (deliver)
In Progress ──────────► Canceled (requester cancel)
Pending ──────────────► In Progress (requester respond)
Pending ──────────────► Closed (requester close)
Pending ──────────────► Canceled (requester cancel)
Delivered ────────────► Closed (requester close)
Closed ───────────────► Open (admin reopen only)
Canceled ─────────────► Open (admin reopen only)
```

### 1.3 Who Can Perform Each Transition

| Action | Administrator | Operator | Standard User (Requester) | Standard User (Resolver/Partner/Vendor) |
|--------|---------------|----------|---------------------------|----------------------------------------|
| Create Order | ✅ | ✅ (on behalf) | ✅ (own) | ❌ |
| Submit Draft | ✅ | ❌ | ✅ (own) | ❌ |
| Pick from Pool | ✅ | ✅ | ❌ | ✅ (based on Pool eligibility) |
| Assign to User | ✅ | ✅ | ❌ | ❌ |
| Submit for Review | ✅ | ❌ | ❌ | ✅ (if assigned) |
| Respond to Pending | ✅ | ❌ | ✅ (if requester) | ❌ |
| Deliver | ✅ | ❌ | ❌ | ✅ (if assigned, requires final file) |
| Close | ✅ | ❌ | ✅ (if requester) | ❌ |
| Cancel | ✅ | ❌ | ✅ (if requester) | ❌ |
| Reopen | ✅ | ❌ | ❌ | ❌ |
| Soft Delete | ✅ | ❌ | ❌ | ❌ |
| Restore Deleted | ✅ | ❌ | ❌ | ❌ |
| Reassign | ✅ | ✅ | ❌ | ✅ (if currently assigned) |
| Force to Pool 2 | ✅ | ❌ | ❌ | ❌ |

### 1.4 Required Fields at Each Transition

| Transition | Required Fields |
|------------|-----------------|
| Create Order | `title`, `description` |
| Submit Draft | None (must be Draft status) |
| Pick from Pool | None (must be Open, unassigned) |
| Submit for Review | None (must be In Progress, assigned) |
| Deliver | `resolution_notes` (string), Must have `is_final_delivery: true` file |
| Close | `reason` (string, 1-500 chars) |
| Cancel | `reason` (from predefined list), `notes` (optional) |
| Reopen | `reason` (string, 1-500 chars) |
| Soft Delete | `reason` (string, 1-500 chars) |
| Reassign | `reassign_type` (user/team/specialty), `target_id`, `reason` (optional) |

### 1.5 Predefined Cancellation Reasons
```
- "Duplicate Request"
- "Submitted by Mistake"
- "No Longer Needed"
- "Budget/Resource Constraints"
- "Timeline No Longer Works"
- "Going with Alternative"
- "Other"
```

---

## 2. ROUTING LOGIC (POOLS / SPECIALTY / TEAM)

### 2.1 Pool System Overview

**Two-tier pool system based on time:**
- **Pool 1 (Partner Pool)**: First 24 hours after submission
- **Pool 2 (Vendor/Freelancer Pool)**: After 24 hours

### 2.2 Pool 1 Visibility and Pickup Rules

| Condition | Access |
|-----------|--------|
| User has `account_type = "Partner"` | ✅ Can view and pick |
| User has `role = "Administrator"` | ✅ Can view and pick |
| User has `role = "Operator"` | ✅ Can view and pick |
| Ticket age | Must be < 24 hours since `pool_entered_at` or `created_at` |

**Pickup Requirements:**
- Ticket status must be `Open`
- Ticket must have no `editor_id` assigned
- Ticket must be in Pool 1 time window (< 24 hours)
- If user is Partner, they can ONLY pick from Pool 1

### 2.3 Pool 2 Handoff Timing + Notifications

**Automatic handoff at 24 hours:**
- Tickets automatically become visible to Pool 2 users
- No manual action required
- `pool_entered_at` timestamp determines eligibility

**Force to Pool 2 (Admin only):**
- Endpoint: `POST /api/orders/{id}/force-pool-2`
- Sets `pool_entered_at` to 25 hours ago (artificial aging)
- Sets `forced_to_pool_2: true`, `forced_to_pool_2_at`, `forced_to_pool_2_by`, `forced_to_pool_2_reason`
- Triggers webhook: `order.forced_to_pool_2`

**Pool 2 Pickup Rules:**
- User has `account_type = "Vendor/Freelancer"` OR is Admin/Operator
- Ticket must be >= 24 hours old OR `forced_to_pool_2: true`
- Vendors can ONLY pick from Pool 2

### 2.4 Specialty-Based Filtering

When tickets have `required_specialty_id` set (via workflow):
- Only users with matching `specialty_id` see ticket in pool
- Support/Issue tickets excluded from Partners/Vendors unless user has support specialty

**Filtering Logic (non-admin users):**
```
if ticket.request_type IN ['issue', 'bug'] OR 
   ticket.category_l1_name CONTAINS ['support', 'issue', 'bug']:
   ONLY show if user.specialty_name CONTAINS 'support'
```

### 2.5 What Happens If No Workflow Exists

If a ticket is created with a category/subcategory that has no matching workflow:
- Ticket goes directly to Pool 1 with status `Open`
- No automatic assignment, SLA, or routing occurs
- Standard 24-hour pool timing applies
- Default SLA of 72 hours is calculated

### 2.6 Reassignment Logic

**Three reassignment types:**

| Type | Effect |
|------|--------|
| `user` | Assigns to specific user. Sets `editor_id`, `editor_name`. Changes status to `In Progress` if was `Open`. |
| `team` | Unassigns current resolver. Sets `preferred_team_id`. Returns to `Open` status if was `In Progress`. |
| `specialty` | Unassigns current resolver. Sets `preferred_specialty_id`. Returns to `Open` status if was `In Progress`. |

**Who can reassign:**
- Administrator: Any ticket (not Closed/Canceled/Delivered)
- Operator: Any ticket (not Closed/Canceled/Delivered)
- Current Resolver: Only their assigned ticket

---

## 3. WORKFLOW ENGINE LOGIC

### 3.1 Available Triggers

| Trigger Event | When Fired |
|--------------|------------|
| `order.created` | When order is created with status Open (not Draft) |
| `order.pending_review` | When resolver submits for review (status → Pending) |

### 3.2 Available Actions

| Action Type | Status | Description |
|-------------|--------|-------------|
| `assign_role` | ✅ ACTIVE | Assigns order to first available user with specified role |
| `update_status` | ✅ ACTIVE | Updates order status to specified value |
| `notify` | ✅ ACTIVE | Sends in-app notification to requester/resolver/admin |
| `email_user` / `email_requester` | ✅ ACTIVE | Sends email via SMTP |
| `webhook` | ✅ ACTIVE | Triggers external webhook URL |
| `forward_ticket` | ✅ ACTIVE | Forwards to another team/category |
| `assign_specialty` | ✅ ACTIVE | Routes to users with specific specialty. Config: `specialty_id`, `pool_preference` (pool_1/pool_2/any), `fallback` (admin_queue/any_specialty) |
| `apply_sla_policy` | ✅ ACTIVE | Applies specific SLA policy or auto-selects best match |
| `auto_escalate` | ✅ ACTIVE (legacy) | Redirects to apply_sla_policy logic |

### 3.3 Workflow Trigger Matching

```python
# Matching query
{
    "is_active": True,
    "trigger_event": trigger_event,
    "$or": [
        {"trigger_category_id": category_id},
        {"trigger_category_id": None},
        {"trigger_category_id": {"$exists": False}}
    ]
}
```

If `trigger_category_id` is set on workflow, it only fires for that category. If null/missing, fires for all.

### 3.4 Workflow Execution Flow

1. Find trigger node
2. Execute nodes in sequence following edges
3. Each step logged to `workflow_executions` collection
4. If node has `stop_on_failure: true` and fails, workflow stops
5. Execution status: `running` → `completed` or `failed`

---

## 4. IAM LOGIC

### 4.1 Three System Roles

| Role | Purpose |
|------|---------|
| **Administrator** | Full system access. Governance control. |
| **Operator** | Internal ops. Manage tickets/queues. No governance. |
| **Standard User** | Basic user. Submit requests. View own data. |

### 4.2 Account Types

| Account Type | Pool Access | Purpose |
|--------------|-------------|---------|
| **Partner** | Pool 1 only | First-tier resolver |
| **Media Client** | Neither | Requester only |
| **Internal Staff** | Based on role | Internal employees |
| **Vendor/Freelancer** | Pool 2 only | Second-tier resolver |

### 4.3 Permission Structure

```typescript
permissions = {
    [module]: {
        [action]: boolean
    }
}
```

**Modules**: dashboard, my_services, submit_request, orders, users, teams, specialties, subscription_plans, categories, workflows, sla_policies, integrations, announcements, logs, settings, reports

**Actions per module**: view, create, edit, delete, export, pick, assign, execute, acknowledge

### 4.4 Permission Merge Logic (Precedence)

```
Final Permission = Per-User Override > Role Default > False
```

1. Check if user has specific override in `user.permission_overrides`
2. If not, use role's default from `roles.permissions`
3. If role permission undefined, default to `false`

### 4.5 Role Default Permissions

**Administrator**: All permissions = `true`

**Operator**: 
- Can: dashboard, my_services, submit_request, orders (all except delete), teams/specialties/categories (view only), workflows (view + execute), sla_policies (view + acknowledge), logs (view), reports (all)
- Cannot: users CRUD, integrations, announcements CRUD, settings

**Standard User**:
- Can: dashboard, my_services, submit_request, orders (view, create, edit, pick), specialties/subscription_plans/categories (view), announcements (view), reports (view)
- Cannot: users, teams, workflows, sla_policies, integrations, logs, settings, reports export

### 4.6 Account Type Impact on Features

| Feature | Partner | Media Client | Internal Staff | Vendor/Freelancer |
|---------|---------|--------------|----------------|-------------------|
| Submit Requests | ✅ | ✅ | ✅ | ❌ |
| Pool 1 Access | ✅ | ❌ | Based on role | ❌ |
| Pool 2 Access | ❌ | ❌ | Based on role | ✅ |
| Opportunity Ribbon | ✅ (Pool 1) | ❌ | ✅ (Admin/Op) | ✅ (Pool 2) |
| Subscription Plans | ✅ (assigned) | ❌ | ❌ | ❌ |

---

## 5. NOTIFICATIONS + EMAIL + SURVEYS

### 5.1 In-App Notification Events

| Event | Recipients | Title |
|-------|------------|-------|
| `order.created` | All Editors | "New request available" |
| `status_change` | Requester (if not changer), Editor (if assigned) | "Order {old} → {new}" |
| `order_closed` | Editor (if assigned) | "Order closed by requester" |
| `order_reopened` | Requester, Editor | "Your ticket has been reopened" |
| `order_canceled` | Editor (if assigned) | "Requester canceled request" |
| `order_reassigned` | Old resolver, New resolver, Requester | "Ticket reassigned" |
| `order_deleted` | Requester | "Your ticket has been removed" |
| `order_restored` | Requester | "Your ticket has been restored" |
| `workflow_notification` | Configured target | "Workflow Notification" |

### 5.2 Email Events (LIVE SMTP - Gmail)

| Event | Recipients | Subject Pattern |
|-------|------------|-----------------|
| Ticket Created | Requester | "[Red Ops] New Ticket Created: {order_code}" |
| Ticket Picked Up | Requester | "[Red Ops] Your Ticket Has Been Picked Up: {order_code}" |
| Ticket Assigned | Resolver | "[Red Ops] Ticket Assigned: {order_code}" |
| Status → In Progress | Requester | "[Red Ops] Ticket Status Update: {order_code} - In Progress" |
| Status → Pending | Requester | "[Red Ops] Action Required: Review Ticket {order_code}" |
| Status → Delivered | Requester | "[Red Ops] Ticket Status Update: {order_code} - Delivered" |
| Ticket Resolved | Requester | "[Red Ops] Your Ticket Has Been Resolved: {order_code}" |
| Ticket Closed | Requester (if admin closed) | "[Red Ops] Ticket Closed: {order_code}" |
| Ticket Reopened | Requester, Editor | "[Red Ops] Ticket Reopened: {order_code}" |
| Ticket Reassigned | Old resolver, New resolver, Requester | "[Red Ops] Ticket Reassigned: {order_code}" |
| Ticket Cancelled | Editor (assigned), Admins | "[Red Ops] Ticket Cancelled: {order_code}" |
| Pool Assignment | Partners | "[Red Ops] New Ticket in Your Pool: {order_code}" |
| Satisfaction Survey | Requester | "[Red Ops] How was your experience? {order_code}" |
| User Welcome | New user | "Red Ops - Welcome! Your Account Has Been Created" |
| Account Disabled | User | "Red Ops - Your Account Has Been Disabled" |
| Account Reactivated | User | "Red Ops - Your Account Has Been Reactivated" |

**SMTP Status**: ✅ LIVE (Gmail: admin@redribbongroup.ca)

### 5.3 Satisfaction Survey Rules

**Survey IS sent when:**
- Status changes to `Delivered`
- Via `POST /api/orders/{id}/deliver` endpoint
- Token-based survey link emailed to requester

**Survey is NOT sent when:**
- Requester cancels ticket (`Canceled` status)
- Admin closes ticket without delivery
- Ticket is soft-deleted
- Any transition that doesn't go through `deliver` endpoint

**Survey collection**: `rating_surveys`
```
{
    id, token, order_id, requester_id, resolver_id,
    completed, rating, feedback, completed_at, created_at
}
```

---

## 6. REPORTS MODULE

### 6.1 Data Sources

| Report | Collection(s) |
|--------|---------------|
| Order Statistics | `orders` |
| Status Distribution | `orders` (grouped by status) |
| Priority Distribution | `orders` (grouped by priority) |
| Category Distribution | `orders` (grouped by category_l1_name) |
| SLA Performance | `orders` (breached vs on-time) |
| Resolver Performance | `orders` (grouped by editor_id) |
| Satisfaction Ratings | `rating_surveys` |
| Workflow Executions | `workflow_executions` |
| User Activity | `logs`, `orders` |

### 6.2 Role Access

| Role | Access Level |
|------|--------------|
| Administrator | All reports, all data, export enabled |
| Operator | All reports, all data, export enabled |
| Standard User | Limited reports (own data only), export disabled |

**Access controlled by**: `permissions.reports.view` and `permissions.reports.export`

### 6.3 Export Formats

| Format | Status |
|--------|--------|
| CSV | ✅ Implemented |
| PDF | ❌ Not implemented |
| Excel | ❌ Not implemented |

---

## 7. TEST HARNESS / DATA RESET

### 7.1 Available Admin Reset Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| None exposed | - | No bulk delete endpoints exposed in API |

### 7.2 MongoDB Direct Reset (Development Only)

```bash
# Connect to MongoDB and clear collections
cd /app/backend && python3 -c "
import asyncio
from database import db

async def clear_data():
    # Clear tickets
    result = await db.orders.delete_many({})
    print(f'Deleted {result.deleted_count} orders')
    
    # Clear order messages
    result = await db.order_messages.delete_many({})
    print(f'Deleted {result.deleted_count} messages')
    
    # Clear order files
    result = await db.order_files.delete_many({})
    print(f'Deleted {result.deleted_count} files')
    
    # Clear notifications
    result = await db.notifications.delete_many({})
    print(f'Deleted {result.deleted_count} notifications')
    
    # Clear announcements
    result = await db.announcements.delete_many({})
    print(f'Deleted {result.deleted_count} announcements')
    
    # Clear workflow executions
    result = await db.workflow_executions.delete_many({})
    print(f'Deleted {result.deleted_count} workflow executions')
    
    # Clear logs
    result = await db.logs.delete_many({})
    print(f'Deleted {result.deleted_count} logs')
    
    # Clear surveys
    result = await db.rating_surveys.delete_many({})
    print(f'Deleted {result.deleted_count} surveys')

asyncio.run(clear_data())
"
```

### 7.3 Reset Counter (Order Codes)

```bash
cd /app/backend && python3 -c "
import asyncio
from database import db

async def reset_counter():
    await db.counters.update_one(
        {'_id': 'order_code'},
        {'\$set': {'sequence_value': 0}},
        upsert=True
    )
    print('Order code counter reset to 0')

asyncio.run(reset_counter())
"
```

### 7.4 Backup Before Reset (Recommended)

```bash
# Export to JSON before clearing
mongodump --uri="$MONGO_URL" --db="$DB_NAME" --out=/tmp/redops_backup_$(date +%Y%m%d)
```

---

## 8. MOCKED / INCOMPLETE FEATURES

| Feature | Status | Notes |
|---------|--------|-------|
| GoHighLevel Payment Webhook | 🟡 MOCKED | Endpoint: `/api/webhooks/ghl-payment-mock` |
| PDF Export | ❌ Not implemented | Only CSV available |
| Slack/Teams Integration | ❌ Not implemented | Planned P1 |
| Workflow Preview/Simulation | ❌ Not implemented | Planned P2 |
| API Key Analytics Charts | ❌ Not implemented | Planned P1 |

---

## 9. TEST ACCOUNTS

| Email | Password | Role | Account Type |
|-------|----------|------|--------------|
| admin@redribbonops.com | Fmtvvl171** | Administrator | Internal Staff |
| testforce@example.com | TempPass123! | Standard User | (test) |

---

## 10. KEY API ENDPOINTS SUMMARY

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders` - List orders
- `GET /api/orders/{id}` - Get order
- `POST /api/orders/{id}/pick` - Pick from pool
- `POST /api/orders/{id}/submit-for-review` - Submit for review
- `POST /api/orders/{id}/respond` - Requester respond
- `POST /api/orders/{id}/deliver` - Mark delivered
- `POST /api/orders/{id}/close` - Close order
- `POST /api/orders/{id}/cancel` - Cancel order
- `POST /api/orders/{id}/reopen` - Reopen (admin)
- `DELETE /api/orders/{id}` - Soft delete (admin)
- `POST /api/orders/{id}/restore` - Restore (admin)
- `POST /api/orders/{id}/reassign` - Reassign ticket
- `POST /api/orders/{id}/force-pool-2` - Force to Pool 2 (admin)
- `GET /api/orders/pool/1` - Get Pool 1 tickets
- `GET /api/orders/pool/2` - Get Pool 2 tickets
- `GET /api/orders/deleted/list` - List deleted tickets (admin)

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/force-change-password` - Force password change
- `GET /api/auth/otp/setup` - Get OTP setup
- `POST /api/auth/otp/verify` - Verify OTP setup
- `POST /api/auth/otp/verify-login` - Verify OTP on login

---

*End of System Logic Snapshot*
