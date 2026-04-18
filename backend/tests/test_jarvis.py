"""Tests for Jarvis command center."""
import os
import json
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
from utils.auth import get_current_user
from routes.jarvis import get_jarvis_scope

ADMIN_VITTO = {"id": "vitto-1", "name": "Vitto", "role": "Administrator", "org_id": "vitto-1", "email": "redops@redribbongroup.ca"}
ADMIN_MATT = {"id": "matt-1", "name": "Matt", "role": "Administrator", "org_id": "matt-1", "email": "matt@redribbongroup.ca"}
OPERATOR_LUCCA = {"id": "lucca-1", "name": "Lucca", "role": "Operator", "org_id": "lucca-1", "email": "lucca@redribbongroup.ca"}
OPERATOR_RANDOM = {"id": "op-1", "name": "Random Op", "role": "Operator", "org_id": "op-1", "email": "random@example.com"}
STANDARD_USER = {"id": "user-1", "name": "User", "role": "Standard User", "org_id": "user-1", "email": "u@t.com"}
MEDIA_CLIENT = {"id": "client-1", "name": "Client", "role": "Media Client", "org_id": "client-1", "email": "c@t.com"}

def _auth(user):
    async def _override():
        return user
    return _override


def test_scope_admin_full():
    with _patch("routes.jarvis.MATT_EMAIL", "matt@redribbongroup.ca"):
        assert get_jarvis_scope(ADMIN_VITTO) == "full"


def test_scope_matt_scoped():
    with _patch("routes.jarvis.MATT_EMAIL", "matt@redribbongroup.ca"):
        assert get_jarvis_scope(ADMIN_MATT) == "scoped_matt"


def test_scope_lucca_operator_whitelisted():
    with _patch("routes.jarvis.JARVIS_OPERATOR_EMAILS", ["lucca@redribbongroup.ca"]):
        assert get_jarvis_scope(OPERATOR_LUCCA) == "full"


def test_scope_operator_not_whitelisted():
    with _patch("routes.jarvis.JARVIS_OPERATOR_EMAILS", ["lucca@redribbongroup.ca"]):
        assert get_jarvis_scope(OPERATOR_RANDOM) is None


def test_scope_standard_user_denied():
    assert get_jarvis_scope(STANDARD_USER) is None


def test_scope_client_denied():
    assert get_jarvis_scope(MEDIA_CLIENT) is None


@pytest.mark.asyncio
async def test_non_admin_gets_403():
    app.dependency_overrides[get_current_user] = _auth(STANDARD_USER)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/jarvis/chat", json={"messages": [{"role": "user", "content": "hi"}]})
        assert resp.status_code == 403
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_admin_can_chat():
    app.dependency_overrides[get_current_user] = _auth(ADMIN_VITTO)
    import anthropic as _mod
    mock_response = MagicMock()
    mock_response.content = [MagicMock(type="text", text="Hello Vitto")]
    mock_response.usage = MagicMock(input_tokens=10, output_tokens=5)
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response
    mock_db = MagicMock()
    mock_db.jarvis_audit_log.insert_one = AsyncMock()

    with _patch("config.ANTHROPIC_API_KEY", "fake"), _patch("routes.jarvis.MATT_EMAIL", ""), _patch.object(_mod, "Anthropic", return_value=mock_client), _patch("routes.jarvis.db", mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.post("/api/jarvis/chat", json={"messages": [{"role": "user", "content": "hi"}]})
            assert resp.status_code == 200
            assert "Hello Vitto" in resp.text
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_scoped_matt_blocked_from_tasks():
    from services.jarvis_tools import execute_tool
    result = await execute_tool("query_tasks", {}, ADMIN_MATT, "scoped_matt")
    data = json.loads(result)
    assert "error" in data
    assert "scope" in data["error"].lower()


@pytest.mark.asyncio
async def test_finance_tool_scopes_by_org_id():
    from services.jarvis_tools import execute_tool
    mock_db_mod = MagicMock()
    txs = [{"id": "1", "date": "2026-01-01", "amount": 100, "type": "income", "description": "test", "category": "Revenue"}]
    mock_db_mod.finance_transactions.find.return_value.sort.return_value.to_list = AsyncMock(return_value=txs)
    with _patch("services.jarvis_tools.db", mock_db_mod):
        result = await execute_tool("query_finance_transactions", {}, ADMIN_VITTO, "full")
        data = json.loads(result)
        assert data["count"] == 1
        query = mock_db_mod.finance_transactions.find.call_args[0][0]
        assert query["org_id"] == "vitto-1"


@pytest.mark.asyncio
async def test_clients_returns_media_clients():
    from services.jarvis_tools import execute_tool
    mock_db_mod = MagicMock()
    clients = [{"id": "c1", "name": "Client", "email": "c@t.com", "role": "Media Client", "account_type": "Media Client"}]
    mock_db_mod.users.find.return_value.sort.return_value.to_list = AsyncMock(return_value=clients)
    with _patch("services.jarvis_tools.db", mock_db_mod):
        result = await execute_tool("query_clients", {}, ADMIN_VITTO, "full")
        data = json.loads(result)
        assert data["count"] == 1


def test_system_time():
    import asyncio
    from services.jarvis_tools import execute_tool
    result = asyncio.run(execute_tool("get_system_time", {}, ADMIN_VITTO, "full"))
    assert "UTC" in result
    assert "20" in result


@pytest.mark.asyncio
async def test_audit_log_inserted():
    app.dependency_overrides[get_current_user] = _auth(ADMIN_VITTO)
    import anthropic as _mod
    mock_response = MagicMock()
    mock_response.content = [MagicMock(type="text", text="Logged")]
    mock_response.usage = MagicMock(input_tokens=10, output_tokens=5)
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response
    mock_db = MagicMock()
    mock_db.jarvis_audit_log.insert_one = AsyncMock()

    with _patch("config.ANTHROPIC_API_KEY", "fake"), _patch("routes.jarvis.MATT_EMAIL", ""), _patch.object(_mod, "Anthropic", return_value=mock_client), _patch("routes.jarvis.db", mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            await ac.post("/api/jarvis/chat", json={"messages": [{"role": "user", "content": "test"}]})
            assert mock_db.jarvis_audit_log.insert_one.called
            log = mock_db.jarvis_audit_log.insert_one.call_args[0][0]
            assert log["user_scope"] == "full"
            assert log["channel"] == "web"
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_loop_caps_at_10():
    app.dependency_overrides[get_current_user] = _auth(ADMIN_VITTO)
    import anthropic as _mod
    tool_block = MagicMock(type="tool_use", name="get_system_time", input={}, id="t1")
    mock_response = MagicMock()
    mock_response.content = [tool_block]
    mock_response.usage = MagicMock(input_tokens=10, output_tokens=5)
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response
    mock_db = MagicMock()
    mock_db.jarvis_audit_log.insert_one = AsyncMock()

    with _patch("config.ANTHROPIC_API_KEY", "fake"), _patch("routes.jarvis.MATT_EMAIL", ""), _patch.object(_mod, "Anthropic", return_value=mock_client), _patch("routes.jarvis.db", mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.post("/api/jarvis/chat", json={"messages": [{"role": "user", "content": "loop"}]})
            assert resp.status_code == 200
            assert mock_client.messages.create.call_count <= 11
    app.dependency_overrides.pop(get_current_user, None)
