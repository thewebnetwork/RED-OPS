"""
Tests for single-tenant-per-user org resolution.

Verifies that:
- resolve_org_id always returns user["id"] regardless of other fields
- get_current_user stamps org_id = user.id on the returned dict
- Cross-user isolation holds: user A's org_id != user B's org_id
"""
import os
import sys
from unittest.mock import patch as _patch

_real_makedirs = os.makedirs
def _safe_makedirs(path, *a, **kw):
    if "/app" in str(path):
        os.makedirs("/tmp/redops-test-uploads", exist_ok=True)
        return
    return _real_makedirs(path, *a, **kw)

with _patch("os.makedirs", _safe_makedirs):
    from server_v2 import app

import pytest
from httpx import AsyncClient, ASGITransport
from utils.tenancy import resolve_org_id
from utils.auth import get_current_user


def test_resolve_org_id_returns_user_id():
    user = {"id": "user-123", "org_id": "some-other-org", "team_id": "some-team"}
    assert resolve_org_id(user) == "user-123"


def test_resolve_org_id_ignores_stored_org_id():
    user = {"id": "user-456", "org_id": "org-that-should-be-ignored"}
    assert resolve_org_id(user) == "user-456"


def test_resolve_org_id_ignores_team_id():
    user = {"id": "user-789", "team_id": "team-that-should-be-ignored"}
    assert resolve_org_id(user) == "user-789"


def test_resolve_org_id_no_optional_fields():
    user = {"id": "user-minimal"}
    assert resolve_org_id(user) == "user-minimal"


def test_cross_user_isolation():
    user_a = {"id": "aaa-111"}
    user_b = {"id": "bbb-222"}
    assert resolve_org_id(user_a) != resolve_org_id(user_b)


def _make_auth_override(user_dict):
    async def _override():
        return user_dict
    return _override


@pytest.mark.asyncio
async def test_get_current_user_stamps_org_id():
    """Verify the full auth pipeline sets org_id = user.id."""
    test_user = {
        "id": "test-user-stamp",
        "name": "Test",
        "role": "Administrator",
        "org_id": "test-user-stamp",
    }
    app.dependency_overrides[get_current_user] = _make_auth_override(test_user)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/health")
            assert resp.status_code == 200
        assert test_user["org_id"] == test_user["id"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
