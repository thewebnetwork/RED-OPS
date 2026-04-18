"""
Tests for Finance OS v1 enhancements: format detection, AI categorization,
and new parsers (Stripe, Meta Ads, credit card).
"""
import os
import sys
from pathlib import Path
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
from routes.finance import (
    _detect_format, _row_to_tx_stripe, _row_to_tx_meta_ads,
    _row_to_tx_credit_card, _row_to_tx_bank, _normalize_header,
)

FIXTURES = Path(__file__).parent / "fixtures" / "finance"


def _read_csv_headers(filename):
    import csv, io
    text = (FIXTURES / filename).read_text()
    reader = csv.reader(io.StringIO(text))
    return next(reader)


# ── Format detection ──

def test_detect_stripe_format():
    headers = _read_csv_headers("stripe.csv")
    assert _detect_format(headers) == "stripe"


def test_detect_meta_ads_format():
    headers = _read_csv_headers("meta_ads.csv")
    assert _detect_format(headers) == "meta_ads"


def test_detect_bank_format():
    headers = _read_csv_headers("bank.csv")
    assert _detect_format(headers) == "bank"


def test_detect_credit_card_format():
    headers = _read_csv_headers("credit_card.csv")
    assert _detect_format(headers) == "credit_card"


def test_detect_generic_format():
    headers = _read_csv_headers("generic.csv")
    assert _detect_format(headers) == "bank"


def test_detect_unknown_format():
    assert _detect_format(["foo", "bar", "baz"]) == "unknown"


# ── Row parsers ──

def test_stripe_parser():
    row = {"Created (UTC)": "2026-04-01 12:00:00", "Amount": "500.00", "Fee": "14.80", "Net": "485.20", "Currency": "cad", "Description": "Monthly sub", "id": "ch_123"}
    tx = _row_to_tx_stripe(row)
    assert tx is not None
    assert tx["type"] == "income"
    assert tx["amount"] == 500.0
    assert tx["source"] == "stripe_import"
    assert tx["external_id"] == "ch_123"


def test_meta_ads_parser():
    row = {"Campaign name": "Taryn Q2", "Amount spent": "45.23", "Day": "2026-04-01"}
    tx = _row_to_tx_meta_ads(row)
    assert tx is not None
    assert tx["type"] == "expense"
    assert tx["amount"] == 45.23
    assert "Taryn Q2" in tx["description"]
    assert tx["source"] == "meta_ads_import"


def test_credit_card_parser():
    row = {"Transaction Date": "2026-04-01", "Posting Date": "2026-04-02", "Description": "AMAZON.CA", "Amount": "89.99"}
    tx = _row_to_tx_credit_card(row)
    assert tx is not None
    assert tx["type"] == "expense"
    assert tx["amount"] == 89.99
    assert tx["source"] == "credit_card_import"


def test_bank_parser_with_negative():
    row = {"Date": "2026-04-02", "Description": "STARBUCKS", "Amount": "-6.50", "Transaction Type": "Debit"}
    tx = _row_to_tx_bank(row)
    assert tx is not None
    assert tx["type"] == "expense"
    assert tx["amount"] == 6.5


def test_parser_handles_missing_date():
    row = {"Amount": "100.00", "Description": "test"}
    assert _row_to_tx_bank(row) is None


# ── AI categorization ──

@pytest.mark.asyncio
async def test_ai_categorize_empty_input():
    from services.finance_ai import categorize_transactions
    result = await categorize_transactions([])
    assert result == []


@pytest.mark.asyncio
async def test_ai_categorize_fallback_on_no_key():
    from services.finance_ai import categorize_transactions
    with _patch("config.ANTHROPIC_API_KEY", None):
        txs = [{"id": "1", "description": "test", "amount": 10, "date": "2026-01-01"}]
        result = await categorize_transactions(txs)
        assert len(result) == 1
        assert "ai_category" not in result[0]


@pytest.mark.asyncio
async def test_ai_categorize_fallback_on_api_error():
    from services.finance_ai import categorize_transactions
    import anthropic as _anthropic_mod
    mock_client = MagicMock()
    mock_client.messages.create.side_effect = Exception("API down")
    with _patch("config.ANTHROPIC_API_KEY", "fake-key"):
        with _patch.object(_anthropic_mod, "Anthropic", return_value=mock_client):
            txs = [{"id": "1", "description": "test", "amount": 10, "date": "2026-01-01"}]
            result = await categorize_transactions(txs)
            assert len(result) == 1
            assert "ai_category" not in result[0]


# ── Advisor chat endpoint ──

from httpx import AsyncClient, ASGITransport
from utils.auth import get_current_user

ADMIN_USER = {"id": "admin-fin", "name": "Admin", "role": "Administrator", "org_id": "admin-fin", "email": "a@t.com"}
NON_ADMIN = {"id": "user-fin", "name": "User", "role": "Standard User", "org_id": "user-fin", "email": "u@t.com"}

def _auth(user):
    async def _override():
        return user
    return _override


@pytest.mark.asyncio
async def test_advisor_requires_auth():
    app.dependency_overrides[get_current_user] = _auth(NON_ADMIN)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/finance/advisor/chat", json={"question": "test"})
        assert resp.status_code == 403
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_advisor_returns_503_on_no_key():
    app.dependency_overrides[get_current_user] = _auth(ADMIN_USER)
    with _patch("config.ANTHROPIC_API_KEY", None):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            mock_db = MagicMock()
            mock_db.finance_transactions.find.return_value.sort.return_value.to_list = AsyncMock(return_value=[])
            with _patch("routes.finance.db", mock_db):
                resp = await ac.post("/api/finance/advisor/chat", json={"question": "test"})
                assert resp.status_code == 503
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_advisor_returns_structured_response():
    app.dependency_overrides[get_current_user] = _auth(ADMIN_USER)
    import anthropic as _anthropic_mod
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="Your biggest expense is Ad Spend at $2,400.")]
    mock_client.messages.create.return_value = mock_response

    mock_db = MagicMock()
    mock_db.finance_transactions.find.return_value.sort.return_value.to_list = AsyncMock(return_value=[
        {"date": "2026-04-01", "amount": 2400, "type": "expense", "description": "Meta Ads", "category": "Ad Spend"},
    ])

    with _patch("config.ANTHROPIC_API_KEY", "fake-key"):
        with _patch.object(_anthropic_mod, "Anthropic", return_value=mock_client):
            with _patch("routes.finance.db", mock_db):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as ac:
                    resp = await ac.post("/api/finance/advisor/chat", json={"question": "biggest expense?"})
                    assert resp.status_code == 200
                    data = resp.json()
                    assert "response" in data
                    assert data["transactions_referenced"] == 1
                    assert "date_range" in data
    app.dependency_overrides.pop(get_current_user, None)


# ── AI-first CSV format detection + smart parser ──

from services.csv_smart_parser import parse_with_format_spec

BMO_SPEC = {
    "format_name": "BMO Credit Card",
    "skip_rows": 3,
    "header_columns": ["First Bank Card", "Transaction Type", "Date Posted", "Transaction Amount", "Description"],
    "date_column": "Date Posted",
    "date_format": "YYYYMMDD",
    "amount_column": "Transaction Amount",
    "debit_column": None,
    "credit_column": None,
    "direction_column": None,
    "direction_positive_value": None,
    "description_column": "Description",
    "strip_value_quotes": True,
    "confidence": 0.95,
}

WISE_SPEC = {
    "format_name": "Wise",
    "skip_rows": 0,
    "header_columns": ["TransferWise ID", "Date", "Amount", "Currency", "Description"],
    "date_column": "Date",
    "date_format": "YYYY-MM-DD",
    "amount_column": "Amount",
    "debit_column": None,
    "credit_column": None,
    "direction_column": None,
    "direction_positive_value": None,
    "description_column": "Description",
    "strip_value_quotes": False,
    "confidence": 0.92,
}


def test_smart_parser_bmo():
    csv_text = (FIXTURES / "bmo_credit_card_sample.csv").read_text()
    rows, errors = parse_with_format_spec(csv_text, BMO_SPEC)
    assert len(rows) >= 3, f"Expected >=3 rows, got {len(rows)}"
    coffee = next((r for r in rows if "COFFEE" in r["description"]), None)
    assert coffee is not None
    assert coffee["type"] == "expense"
    assert coffee["amount"] == 50.0
    payment = next((r for r in rows if "PAYMENT" in r["description"]), None)
    assert payment is not None
    assert payment["type"] == "income"
    assert payment["amount"] == 500.0


def test_smart_parser_wise():
    csv_text = (FIXTURES / "wise_full_sample.csv").read_text()
    rows, errors = parse_with_format_spec(csv_text, WISE_SPEC)
    assert len(rows) >= 2, f"Expected >=2 rows, got {len(rows)}"
    income_row = next((r for r in rows if r["type"] == "income"), None)
    assert income_row is not None
    assert income_row["amount"] == 100.0
    expense_row = next((r for r in rows if "Meta" in r.get("description", "")), None)
    assert expense_row is not None
    assert expense_row["type"] == "expense"
    assert expense_row["amount"] == 250.0


@pytest.mark.asyncio
async def test_ai_detect_bmo_format():
    from services.csv_format_detector import detect_csv_format
    import anthropic as _anthropic_mod
    import json
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=json.dumps(BMO_SPEC))]
    mock_client.messages.create.return_value = mock_response
    with _patch("config.ANTHROPIC_API_KEY", "fake-key"):
        with _patch.object(_anthropic_mod, "Anthropic", return_value=mock_client):
            spec = await detect_csv_format("fake csv", "bmo.csv")
            assert spec["format_name"] == "BMO Credit Card"
            assert spec["confidence"] == 0.95
            assert spec["skip_rows"] == 3


@pytest.mark.asyncio
async def test_ai_detect_unknown_falls_back():
    from services.csv_format_detector import detect_csv_format
    import anthropic as _anthropic_mod
    import json
    mock_client = MagicMock()
    low_conf = {"format_name": "Unknown", "confidence": 0.3}
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=json.dumps(low_conf))]
    mock_client.messages.create.return_value = mock_response
    with _patch("config.ANTHROPIC_API_KEY", "fake-key"):
        with _patch.object(_anthropic_mod, "Anthropic", return_value=mock_client):
            spec = await detect_csv_format("bad csv", "unknown.csv")
            assert spec["format_name"] == "Unknown"
            assert spec["confidence"] == 0.0


@pytest.mark.asyncio
async def test_ai_detect_no_api_key():
    from services.csv_format_detector import detect_csv_format
    with _patch("config.ANTHROPIC_API_KEY", None):
        spec = await detect_csv_format("any csv", "test.csv")
        assert spec["format_name"] == "Unknown"
        assert spec["confidence"] == 0.0


@pytest.mark.asyncio
async def test_ai_detect_api_failure():
    from services.csv_format_detector import detect_csv_format
    import anthropic as _anthropic_mod
    mock_client = MagicMock()
    mock_client.messages.create.side_effect = Exception("API down")
    with _patch("config.ANTHROPIC_API_KEY", "fake-key"):
        with _patch.object(_anthropic_mod, "Anthropic", return_value=mock_client):
            spec = await detect_csv_format("csv text", "test.csv")
            assert spec["format_name"] == "Unknown"
            assert spec["confidence"] == 0.0
