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
