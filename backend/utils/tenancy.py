"""Single-tenant-per-user tenancy resolution.

Decision: every user is their own org. org_id = user.id, unconditionally.
See docs/audits/AUDIT_2026-04-16.md §4.2.1 decision log.

This replaces the former 3-level fallback pattern:
    org_id = user.get("org_id") or user.get("team_id") or user.get("id")
"""


def resolve_org_id(user: dict) -> str:
    """Single-tenant: every user is their own org. org_id = user.id."""
    return user["id"]
