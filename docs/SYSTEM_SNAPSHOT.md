# System Snapshot - Red Ops Portal
**Version:** v23.1 | **Date:** January 26, 2026 | **Status:** Ready for Production Testing

---

## 1. Modules Currently Live

| Module | Status | Description |
|--------|--------|-------------|
| **Dashboard** | ✅ Live | Admin/Editor/Requester role-specific views, unified SLA stats |
| **Command Center** | ✅ Live | Quick access hub for all roles |
| **Orders** | ✅ Live | Full CRUD, messaging, status workflow, file attachments |
| **Workflows** | ✅ Live | Visual workflow builder with triggers, conditions, actions |
| **SLA & Escalation Policies** | ✅ Live | Unified policy configuration + monitoring + history |
| **Users** | ✅ Live | User management with IAM model (Role/Team/Specialty/Access Tier) |
| **Teams** | ✅ Live | Team management with member assignment |
| **Roles** | ✅ Live | Permission matrix configuration (3 core roles) |
| **Categories** | ✅ Live | L1/L2 category hierarchy management |
| **Logs** | ✅ Live | System logs viewer with SSE streaming |
| **Integrations** | ✅ Live | API keys, webhooks configuration |
| **Announcements** | ✅ Live | System-wide announcement ticker |
| **Email Settings** | ✅ Live | SMTP configuration |
| **UI Settings** | ✅ Live | Theme, language, appearance customization |

---

## 2. Data Model / Entities

### Core Entities
```
users
├── id, name, email, phone
├── role (Administrator | Privileged User | Standard User)
├── team_id, specialty_id, access_tier_id
├── permissions (per-user overrides)
└── active, created_at

orders
├── id, order_code (RRG-XXXX)
├── requester_id, editor_id
├── title, description, status, priority
├── category_l1_id, category_l2_id
├── sla_deadline, sla_policy_id, sla_policy_name
├── is_sla_breached, current_escalation_level
└── created_at, updated_at, delivered_at

workflows
├── id, name, description, color
├── assigned_roles, assigned_teams
├── assigned_specialties, assigned_access_tiers
├── trigger_event, trigger_category_id
├── nodes (ReactFlow nodes), edges
└── is_active, is_template

sla_policies
├── id, name, description
├── scope (role_ids, team_ids, specialty_ids, access_tier_ids)
├── sla_rules (duration_minutes, business_hours_only)
├── thresholds (at_risk_minutes)
├── escalation_levels (level, trigger, delay_minutes, actions)
└── is_active, created_at

escalation_history
├── id, order_id, order_code
├── policy_id, policy_name
├── level, level_name, trigger_type
├── actions_taken, acknowledged
└── created_at
```

### Supporting Entities
- `roles` - Permission templates
- `teams` - User groupings with members
- `specialties` - Professional classifications
- `access_tiers` - Software plan tiers (Free, Starter, Growth, Scale, Partner)
- `categories_l1/l2` - Request categorization
- `notifications` - In-app notifications
- `order_messages` - Thread messages per order
- `webhooks` - External integrations

---

## 3. Permissions Model

### Role Templates (3 Core Roles)
| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Administrator** | Full system access | All modules, all CRUD operations |
| **Privileged User** | Elevated access (ex: Editors) | Orders, Workflows, Categories, Teams |
| **Standard User** | Basic access (ex: Requesters) | Dashboard, Command Center, own Orders |

### Permission Matrix Categories
- **Orders**: create, view_all, view_own, edit, delete, assign, change_status
- **Users**: view, create, edit, delete, manage_permissions
- **Workflows**: view, create, edit, delete, execute
- **SLA Policies**: view, create, edit, delete
- **Reports**: view_basic, view_advanced, export
- **Settings**: view, edit

### Per-User Permission Overrides
- Checkbox matrix in User Edit dialog
- Overrides role-based defaults
- Stored in `users.permissions` object

---

## 4. Workflow Engine

### Available Triggers
| Trigger | Description |
|---------|-------------|
| `order.created` | When new order is submitted |
| `order.status_changed` | When order status changes |
| `order.assigned` | When editor picks up order |
| `order.delivered` | When order is delivered |
| `sla.at_risk` | When order enters at-risk state |
| `sla.breached` | When SLA is breached |

### Available Actions
| Action | Description | Config Fields |
|--------|-------------|---------------|
| `assign_role` | Auto-assign to role | role_id |
| `forward_ticket` | Route to category/team | category_id, team_id |
| `email_user` | Email assigned user | subject, body |
| `email_requester` | Email requester | subject, body |
| `update_status` | Change ticket status | status |
| `notify` | In-app notification | message, target |
| `webhook` | External API call | url, method |
| `delay` | Wait before next action | delay_value, delay_unit |
| `apply_sla_policy` | Apply SLA policy | policy_id (optional - auto-detect if empty) |

### Workflow Flow
```
Trigger → Condition Nodes → Action Nodes
     ↓
Execute actions sequentially via workflow_engine.py
     ↓
Log execution in workflow_executions collection
```

---

## 5. SLA Engine

### When Policy Engine Runs
1. **On Order Create**: Via workflow `apply_sla_policy` action (if configured)
2. **Scheduled Check**: Every 5 minutes via `sla_monitor_loop()` in server_v2.py
3. **Manual Trigger**: Admin can run check via "Run Check" button in SLA module

### Policy Selection Logic (Priority Order)
```python
# Scope matching score (highest wins)
Role match:       4 points
Team match:       3 points
Specialty match:  2 points
Access Tier match: 1 point
Empty scope (fallback): 0.5 points

# If multiple policies match, highest score wins
# If tie, first created policy applies
# If no match, no policy applied (uses default SLA from orders.py)
```

### SLA Attributes Based On
- **Resolver/Assignee attributes** (primary):
  - `editor_role_id` → matches `scope.role_ids`
  - `team_id` → matches `scope.team_ids`
  - Editor's `specialty_id` → matches `scope.specialty_ids`
  - Editor's `access_tier_id` → matches `scope.access_tier_ids`
- **NOT based on** requester attributes or category (V1)

### Status Calculation
```python
def get_sla_status(deadline, at_risk_minutes=240):
    now = datetime.now(UTC)
    if now > deadline:
        return "breached"
    elif now > deadline - timedelta(minutes=at_risk_minutes):
        return "at_risk"
    else:
        return "on_track"
```

### Escalation Trigger Types
| Trigger | When Fires |
|---------|-----------|
| `at_risk` | Order enters at-risk window |
| `breach` | SLA deadline passes |
| `breach_plus_minutes` | X minutes after breach |

### Escalation Actions (Policy-Driven)
- `notify_users` - Notify specific user IDs
- `notify_role` - Notify all users in a role
- `notify_team` - Notify all team members
- `escalate_to_role` - Escalate + notify role (includes email)
- `escalate_to_team` - Escalate + notify team
- `reassign` - Reassign to different user
- `change_priority` - Bump priority level
- `send_email` - Send custom email
- `webhook` - Trigger external webhook

### Escalation History Logging
All escalation actions are logged to `escalation_history` collection with:
- Order reference (id, code)
- Policy reference (id, name)
- Level triggered
- Actions taken (success/failure per action)
- Acknowledged status
- Timestamps

---

## 6. Integrations

### API Endpoints
| Category | Endpoints |
|----------|-----------|
| **Auth** | POST /api/auth/login, /api/auth/register, /api/auth/me |
| **Orders** | CRUD /api/orders, /api/orders/{id}/messages |
| **Users** | CRUD /api/users |
| **Workflows** | CRUD /api/workflows, /api/workflows/{id}/execute |
| **SLA Policies** | CRUD /api/sla-policies, /api/sla-policies/monitoring/* |
| **Webhooks** | GET/POST /api/webhooks |

### Webhook Events
- `order.created`
- `order.status_changed`
- `order.assigned`
- `order.delivered`
- `workflow.action` (custom)

### Integration Status
| Integration | Status | Notes |
|-------------|--------|-------|
| **SMTP Email** | ✅ Live | Gmail SMTP configured (admin@redribbongroup.ca) |
| **Webhooks** | ✅ Live | Full outbound webhook support |
| **API Keys** | ✅ Live | Scoped API key generation |
| **SSE Logs** | ✅ Live | Real-time log streaming |

---

## 7. Known Issues / Tech Debt

### Outstanding Items
| Priority | Issue | Notes |
|----------|-------|-------|
| P2 | SMTP not production-ready | Email delivery logs to console |
| P3 | Business hours SLA calculation | Flag exists but not fully implemented |
| P3 | Timezone handling | Uses UTC, user timezone not applied |

### Technical Debt
- Old `escalation_policies` collection exists alongside new `sla_policies`
- Some workflow templates reference old action types
- Dashboard still has legacy `sla_breaching_count` in stats API (unused by UI)

### Future Enhancements
- SLA policy templates (Quick-create presets)
- Advanced analytics with charts
- Slack/Teams integration presets
- Multi-language email templates

---

## 8. Testing Checklist Status

| Area | Status |
|------|--------|
| Data backup exported | ✅ Complete |
| Test data cleared | ✅ Complete |
| Order counter reset | ✅ Complete |
| Users preserved | ✅ (17 users) |
| Configuration preserved | ✅ (Workflows, Policies, Categories) |

**Backup Location:** `/app/backups/pre_testing_20260126/`

---

*Document generated: January 26, 2026*
*Ready for production testing*
