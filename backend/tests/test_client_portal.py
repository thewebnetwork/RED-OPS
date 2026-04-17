"""
Tests for client portal data endpoints.

Covers:
1. Admin can create portal data for a Media Client user
2. Admin cannot create portal data for a non-Media-Client user (400)
3. Media Client can read own /me data
4. Media Client cannot read another user's /data/{id} (404)
5. Admin can read any user's data
6. Admin PATCH updates updated_at and recalculates days_since_launch
7. /clients list returns only Media Client users
"""
import os
import sys
from unittest.mock import patch as _patch, AsyncMock, MagicMock

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
from unittest.mock import patch
from utils.auth import get_current_user


ADMIN = {"id": "admin-001", "name": "Admin", "role": "Administrator", "org_id": "admin-001", "email": "admin@test.com"}
CLIENT_A = {"id": "client-aaa", "name": "Client A", "role": "Media Client", "account_type": "Media Client", "org_id": "client-aaa", "email": "a@test.com"}
CLIENT_B = {"id": "client-bbb", "name": "Client B", "role": "Media Client", "account_type": "Media Client", "org_id": "client-bbb", "email": "b@test.com"}
NON_CLIENT = {"id": "staff-001", "name": "Staff", "role": "Standard User", "org_id": "staff-001", "email": "staff@test.com"}


def _auth(user):
    async def _override():
        return user
    return _override


def _mock_db():
    """In-memory mock of relevant MongoDB collections."""
    portal_store = []
    users_store = [
        {**CLIENT_A, "active": True},
        {**CLIENT_B, "active": True},
        {**NON_CLIENT, "active": True},
        {**ADMIN, "active": True, "account_type": "Internal Staff"},
    ]

    async def _find_one(query, *args, **kwargs):
        store = portal_store if "user_id" in query or "id" in query and any(d.get("user_id") for d in portal_store) else users_store
        # Determine which store based on caller context
        return None  # overridden per-collection below

    def make_col(store, key_field="id"):
        col = MagicMock()

        async def find_one(query, *args, **kwargs):
            for doc in store:
                if all(_match(doc, k, v) for k, v in query.items() if k != "_id"):
                    return {k: v for k, v in doc.items() if k != "_id"}
            return None

        async def insert_one(doc):
            store.append(dict(doc))
            return MagicMock(inserted_id="fake")

        async def update_one(query, update):
            for doc in store:
                if all(_match(doc, k, v) for k, v in query.items() if k != "_id"):
                    if "$set" in update:
                        doc.update(update["$set"])
                    return MagicMock(modified_count=1)
            return MagicMock(modified_count=0)

        def find(query, *args, **kwargs):
            results = [
                {k: v for k, v in doc.items() if k != "_id"}
                for doc in store
                if all(_match(doc, k, v) for k, v in query.items() if k != "_id")
            ]
            cursor = MagicMock()
            cursor.sort = MagicMock(return_value=cursor)
            cursor.to_list = AsyncMock(return_value=results)
            return cursor

        col.find_one = AsyncMock(side_effect=find_one)
        col.insert_one = AsyncMock(side_effect=insert_one)
        col.update_one = AsyncMock(side_effect=update_one)
        col.find = MagicMock(side_effect=find)
        col._store = store
        return col

    users_col = make_col(users_store)
    portal_col = make_col(portal_store)
    return MagicMock(users=users_col, client_portal_data=portal_col)


def _match(doc, key, value):
    if key == "$or":
        return any(all(_match(doc, k, v) for k, v in cond.items()) for cond in value)
    doc_val = doc.get(key)
    if isinstance(value, dict):
        if "$ne" in value:
            return doc_val != value["$ne"]
        return doc_val == value
    return doc_val == value


@pytest.fixture
def mock_db():
    return _mock_db()


def _patch_db(mock):
    return patch("routes.client_portal.db", mock)


@pytest.mark.asyncio
async def test_admin_create_portal_for_media_client(mock_db):
    app.dependency_overrides[get_current_user] = _auth(ADMIN)
    with _patch_db(mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.post("/api/client-portal/data", json={"user_id": "client-aaa", "status_phase": "onboarding", "status_message": "Hello"})
            assert resp.status_code == 201
            assert resp.json()["user_id"] == "client-aaa"
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_admin_cannot_create_portal_for_non_client(mock_db):
    app.dependency_overrides[get_current_user] = _auth(ADMIN)
    with _patch_db(mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.post("/api/client-portal/data", json={"user_id": "staff-001", "status_phase": "onboarding"})
            assert resp.status_code == 400
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_client_can_read_own_me(mock_db):
    # First create data as admin
    app.dependency_overrides[get_current_user] = _auth(ADMIN)
    with _patch_db(mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            await ac.post("/api/client-portal/data", json={"user_id": "client-aaa", "status_phase": "active", "status_message": "Live"})

    # Now read as client
    app.dependency_overrides[get_current_user] = _auth(CLIENT_A)
    with _patch_db(mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/client-portal/data/me")
            assert resp.status_code == 200
            assert resp.json()["status_phase"] == "active"
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_client_cannot_read_other_user_data(mock_db):
    # Create data for client A
    app.dependency_overrides[get_current_user] = _auth(ADMIN)
    with _patch_db(mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            await ac.post("/api/client-portal/data", json={"user_id": "client-aaa", "status_phase": "active"})

    # Client B tries to read client A's data
    app.dependency_overrides[get_current_user] = _auth(CLIENT_B)
    with _patch_db(mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/client-portal/data/client-aaa")
            assert resp.status_code == 404
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_admin_can_read_any_user_data(mock_db):
    app.dependency_overrides[get_current_user] = _auth(ADMIN)
    with _patch_db(mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            await ac.post("/api/client-portal/data", json={"user_id": "client-aaa", "status_phase": "active"})
            resp = await ac.get("/api/client-portal/data/client-aaa")
            assert resp.status_code == 200
            assert resp.json()["user_id"] == "client-aaa"
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_admin_patch_updates_fields(mock_db):
    app.dependency_overrides[get_current_user] = _auth(ADMIN)
    with _patch_db(mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            await ac.post("/api/client-portal/data", json={"user_id": "client-aaa", "status_phase": "onboarding"})
            resp = await ac.patch("/api/client-portal/data/client-aaa", json={
                "status_phase": "active",
                "status_message": "Campaign live!",
                "launched_at": "2026-04-01T00:00:00+00:00",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["status_phase"] == "active"
            assert data["status_message"] == "Campaign live!"
            assert data["days_since_launch"] is not None
            assert data["days_since_launch"] >= 0
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_clients_list_returns_only_media_clients(mock_db):
    app.dependency_overrides[get_current_user] = _auth(ADMIN)
    with _patch_db(mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/client-portal/clients")
            assert resp.status_code == 200
            data = resp.json()
            ids = [c["id"] for c in data]
            assert "client-aaa" in ids
            assert "client-bbb" in ids
            assert "staff-001" not in ids
            assert "admin-001" not in ids
    app.dependency_overrides.pop(get_current_user, None)
