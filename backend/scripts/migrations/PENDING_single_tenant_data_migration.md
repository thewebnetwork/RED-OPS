# Pending: Single-Tenant Data Migration

**Status:** NOT EXECUTED — plan only. Awaiting code-level migration to be stable on main.

## Context

RED OPS migrated to single-tenant-per-user architecture on 2026-04-17
(branch `fix/single-tenant-migration`). Under this model, `org_id = user.id`
for every user, unconditionally.

## What needs to happen

### 1. Audit org_id drift

Run `audit_org_id_drift.py` (dry-run, no writes) to report per-collection how
many records have an `org_id` that doesn't match their `created_by` user's `id`.

### 2. Backfill drifted org_ids

For any collection where `org_id != created_by.id`, stamp the correct value.
Use the same pattern as `backfill_documents_org_id.py` (already executed).

Collections to check:
- `documents` (already backfilled 2026-04-17)
- `finance_transactions`, `finance_categories`
- `projects`, `tasks`
- `crm_pipelines`, `crm_contacts`, `crm_deals`
- `knowledge_base_articles`
- `ambassador_referrals`, `ambassador_listings`
- `ad_snapshots`
- `files`, `file_folders`
- `messages`, `message_threads`
- `sheets`
- `events`, `calendar_connections`, `drive_connections`
- `dashboards`, `dashboard_configs`
- `integrations`, `api_keys`
- `workflows`

### 3. Archive `org_members` collection

After confirming no code reads from `org_members`:
```
db.org_members.renameCollection("_archived_org_members_20260417")
```

### 4. Archive `organizations` collection

After confirming no code reads from `organizations`:
```
db.organizations.renameCollection("_archived_organizations_20260417")
```

### 5. Clean user documents

Remove `primary_org_id` and `org_ids` fields from all user documents:
```
db.users.updateMany({}, { $unset: { primary_org_id: "", org_ids: "" } })
```

## Backup required

Before any writes, take a full `mongodump` of the production database.
