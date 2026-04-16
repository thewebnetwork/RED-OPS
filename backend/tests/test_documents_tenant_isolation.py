"""
Regression tests for cross-tenant isolation in documents.py.

Verifies that org_id scoping prevents users in one org from
accessing, modifying, or deleting documents belonging to another org.

Uses httpx.AsyncClient against the FastAPI app with mocked auth
(no live DB or server required).
"""
import os
import sys
from unittest.mock import patch as _patch

# orders.py:60 calls os.makedirs("/app/uploads") at import time which
# fails outside Railway. Patch it before the import chain fires.
_real_makedirs = os.makedirs
def _safe_makedirs(path, *a, **kw):
    if "/app" in str(path):
        os.makedirs("/tmp/redops-test-uploads", exist_ok=True)
        return
    return _real_makedirs(path, *a, **kw)

with _patch("os.makedirs", _safe_makedirs):
    from server_v2 import app

import pytest
import uuid
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport

from routes.documents import _resolve_org_id


USER_A = {
    "id": "user-aaa-111",
    "name": "Alice",
    "email": "alice@orgx.com",
    "role": "Administrator",
    "org_id": "org-x",
    "team_id": None,
    "org_role": "owner",
    "org_permissions": {},
}

USER_B = {
    "id": "user-bbb-222",
    "name": "Bob",
    "email": "bob@orgy.com",
    "role": "Administrator",
    "org_id": "org-y",
    "team_id": None,
    "org_role": "owner",
    "org_permissions": {},
}


DOC_ORG_X_ID = str(uuid.uuid4())
DOC_ORG_X = {
    "id": DOC_ORG_X_ID,
    "title": "Org X Secret Doc",
    "content": {"type": "doc", "content": []},
    "parent_id": None,
    "icon": "📄",
    "tags": [],
    "org_id": "org-x",
    "created_by": "user-aaa-111",
    "created_by_name": "Alice",
    "created_at": "2026-04-16T00:00:00+00:00",
    "updated_at": "2026-04-16T00:00:00+00:00",
    "archived": False,
}


def _make_auth_override(user_dict):
    async def _override():
        return user_dict
    return _override


def _mock_collection():
    """Build a mock MongoDB collection backed by a simple in-memory list."""
    store = []

    col = AsyncMock()

    async def _find_one(query, *args, **kwargs):
        for doc in store:
            if all(_match(doc, k, v) for k, v in query.items()):
                result = {k: v for k, v in doc.items() if k != "_id"}
                return result
        return None

    async def _insert_one(doc):
        store.append(dict(doc))
        return MagicMock(inserted_id="fake")

    async def _update_one(query, update):
        for doc in store:
            if all(_match(doc, k, v) for k, v in query.items()):
                if "$set" in update:
                    doc.update(update["$set"])
                return MagicMock(modified_count=1)
        return MagicMock(modified_count=0)

    async def _update_many(query, update):
        count = 0
        for doc in store:
            if all(_match(doc, k, v) for k, v in query.items()):
                if "$set" in update:
                    doc.update(update["$set"])
                count += 1
        return MagicMock(modified_count=count)

    async def _count_documents(query):
        return sum(
            1 for doc in store
            if all(_match(doc, k, v) for k, v in query.items())
        )

    def _find(query, *args, **kwargs):
        results = [
            {k: v for k, v in doc.items() if k != "_id"}
            for doc in store
            if all(_match(doc, k, v) for k, v in query.items())
        ]
        cursor = MagicMock()
        cursor.sort = MagicMock(return_value=cursor)
        cursor.to_list = AsyncMock(return_value=results)
        return cursor

    col.find_one = AsyncMock(side_effect=_find_one)
    col.insert_one = AsyncMock(side_effect=_insert_one)
    col.update_one = AsyncMock(side_effect=_update_one)
    col.update_many = AsyncMock(side_effect=_update_many)
    col.count_documents = AsyncMock(side_effect=_count_documents)
    col.find = MagicMock(side_effect=_find)
    col._store = store

    return col


def _match(doc, key, value):
    """Simple query-matcher for basic MongoDB filter operators."""
    if key == "$ne":
        return True
    doc_val = doc.get(key)
    if isinstance(value, dict):
        if "$ne" in value:
            return doc_val != value["$ne"]
        if "$in" in value:
            return doc_val in value["$in"]
        if "$regex" in value:
            import re
            flags = re.IGNORECASE if value.get("$options") == "i" else 0
            return bool(re.search(value["$regex"], doc_val or "", flags))
        return doc_val == value
    return doc_val == value


@pytest.fixture
def mock_documents_col():
    col = _mock_collection()
    col._store.append(dict(DOC_ORG_X))
    return col


@pytest.fixture
def client_user_a(mock_documents_col):
    from utils.auth import get_current_user
    app.dependency_overrides[get_current_user] = _make_auth_override(USER_A)
    yield mock_documents_col
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def client_user_b(mock_documents_col):
    from utils.auth import get_current_user
    app.dependency_overrides[get_current_user] = _make_auth_override(USER_B)
    yield mock_documents_col
    app.dependency_overrides.pop(get_current_user, None)


def _patch_db(col):
    return patch("routes.documents.db", MagicMock(documents=col))


# ── resolve_org_id sanity ──

def test_resolve_org_id_primary():
    assert _resolve_org_id({"org_id": "org-x", "team_id": "t1", "id": "u1"}) == "org-x"

def test_resolve_org_id_fallback_team():
    assert _resolve_org_id({"org_id": None, "team_id": "t1", "id": "u1"}) == "t1"

def test_resolve_org_id_fallback_user():
    assert _resolve_org_id({"org_id": None, "team_id": None, "id": "u1"}) == "u1"


# ── Cross-tenant isolation tests ──

@pytest.mark.asyncio
async def test_user_b_cannot_list_user_a_docs(client_user_b):
    col = client_user_b
    with _patch_db(col):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/documents")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 0, f"User B should see 0 docs from org-x, got {len(data)}"


@pytest.mark.asyncio
async def test_user_a_can_list_own_docs(client_user_a):
    col = client_user_a
    with _patch_db(col):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/documents")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 1
            assert data[0]["id"] == DOC_ORG_X_ID


@pytest.mark.asyncio
async def test_user_b_cannot_get_user_a_doc(client_user_b):
    col = client_user_b
    with _patch_db(col):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get(f"/api/documents/{DOC_ORG_X_ID}")
            assert resp.status_code == 404


@pytest.mark.asyncio
async def test_user_a_can_get_own_doc(client_user_a):
    col = client_user_a
    with _patch_db(col):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get(f"/api/documents/{DOC_ORG_X_ID}")
            assert resp.status_code == 200
            assert resp.json()["id"] == DOC_ORG_X_ID


@pytest.mark.asyncio
async def test_user_b_cannot_update_user_a_doc(client_user_b):
    col = client_user_b
    with _patch_db(col):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.patch(
                f"/api/documents/{DOC_ORG_X_ID}",
                json={"title": "Hacked Title"},
            )
            assert resp.status_code == 404


@pytest.mark.asyncio
async def test_user_a_can_update_own_doc(client_user_a):
    col = client_user_a
    with _patch_db(col):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.patch(
                f"/api/documents/{DOC_ORG_X_ID}",
                json={"title": "Updated by Alice"},
            )
            assert resp.status_code == 200
            assert resp.json()["title"] == "Updated by Alice"


@pytest.mark.asyncio
async def test_user_b_cannot_delete_user_a_doc(client_user_b):
    col = client_user_b
    with _patch_db(col):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.delete(f"/api/documents/{DOC_ORG_X_ID}")
            assert resp.status_code == 404


@pytest.mark.asyncio
async def test_user_a_can_delete_own_doc(client_user_a):
    col = client_user_a
    with _patch_db(col):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.delete(f"/api/documents/{DOC_ORG_X_ID}")
            assert resp.status_code == 200
            assert resp.json()["success"] is True


@pytest.mark.asyncio
async def test_user_b_cannot_list_children_of_user_a_doc(client_user_b):
    col = client_user_b
    with _patch_db(col):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get(f"/api/documents/{DOC_ORG_X_ID}/children")
            assert resp.status_code == 404


@pytest.mark.asyncio
async def test_user_a_can_list_children_of_own_doc(client_user_a):
    col = client_user_a
    with _patch_db(col):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get(f"/api/documents/{DOC_ORG_X_ID}/children")
            assert resp.status_code == 200
            assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_create_stamps_org_id(client_user_a):
    col = client_user_a
    with _patch_db(col):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.post("/api/documents", json={"title": "New Doc"})
            assert resp.status_code == 200
            inserted = [d for d in col._store if d["title"] == "New Doc"]
            assert len(inserted) == 1
            assert inserted[0]["org_id"] == "org-x"
