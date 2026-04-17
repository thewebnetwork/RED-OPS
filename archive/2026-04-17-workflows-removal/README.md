# Removed: Workflows Feature — 2026-04-17

These files were removed because the Workflows feature had a running backend
engine with no admin UI — silent automation that nobody could see, edit, or
audit. Client-facing workflow automation lives in GHL; RED OPS does not need
a parallel implementation.

| File | Purpose |
|---|---|
| `workflow_engine.py` | Core engine: executed workflow nodes on order events |
| `workflows.py` (route) | CRUD API for workflow definitions |
| `Workflows.js` | Frontend list page (already orphaned from router) |
| `WorkflowEditor.js` | Frontend visual editor (already orphaned from router) |
| `workflow-components/` | React components for editor nodes (TriggerNode, ActionNode, etc.) |
| `EscalationPolicies.js` | Frontend page for escalation policy management (orphaned) |
| `SLA.js` | Frontend SLA management page (orphaned) |
| `SLAPolicies.js` | Frontend SLA policies page (orphaned) |

**Kept (independent):** `sla_policy_engine.py`, `sla_monitor.py`, `escalation_engine.py`,
`recurring_tasks.py`, `review_reminder.py` — these serve SLA monitoring and task
scheduling, which are independent of the workflow engine.

**MongoDB collections preserved.** `workflows`, `workflow_executions` collections
still exist in the database. Cleanup in a separate pass with backup.

See `docs/audits/AUDIT_2026-04-16.md` §3.2, §4.2.2 decision log.
