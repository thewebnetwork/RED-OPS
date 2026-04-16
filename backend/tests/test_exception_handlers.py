"""
Tests for global exception handlers in server_v2.py.

Verifies that:
- HTTPException returns structured JSON with type "http_error"
- Unhandled exceptions return structured JSON with type "internal_error" + error_id
- Stack traces are NOT leaked to the client
- Existing routes still respond normally
"""
import os
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
from fastapi import APIRouter, HTTPException


_test_router = APIRouter(prefix="/_exc_test")

@_test_router.get("/http-error")
async def _raise_http():
    raise HTTPException(status_code=418, detail="teapot test")

@_test_router.get("/unhandled")
async def _raise_unhandled():
    raise ValueError("intentional test explosion")

@_test_router.get("/ok")
async def _return_ok():
    return {"status": "fine"}

app.include_router(_test_router)


@pytest.mark.asyncio
async def test_http_exception_structured_json():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/_exc_test/http-error")
        assert resp.status_code == 418
        body = resp.json()
        assert body["error"]["type"] == "http_error"
        assert body["error"]["code"] == 418
        assert body["error"]["message"] == "teapot test"


@pytest.mark.asyncio
async def test_unhandled_exception_structured_json():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/_exc_test/unhandled")
        assert resp.status_code == 500
        body = resp.json()
        assert body["error"]["type"] == "internal_error"
        assert body["error"]["code"] == 500
        assert body["error"]["message"] == "Internal server error"
        assert len(body["error"]["error_id"]) == 8


@pytest.mark.asyncio
async def test_unhandled_exception_no_stack_leak():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/_exc_test/unhandled")
        assert "ValueError" not in resp.text
        assert "intentional" not in resp.text
        assert "Traceback" not in resp.text


@pytest.mark.asyncio
async def test_normal_route_unaffected():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/_exc_test/ok")
        assert resp.status_code == 200
        assert resp.json()["status"] == "fine"


@pytest.mark.asyncio
async def test_health_endpoint_unaffected():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_root_endpoint_unaffected():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "running"
