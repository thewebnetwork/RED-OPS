"""Finance management routes - manual transaction tracking & dashboard"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from typing import Optional
from pydantic import BaseModel, Field

from database import db
from utils.auth import require_roles, get_current_user
from utils.helpers import get_utc_now

router = APIRouter(prefix="/finance", tags=["Finance"])


# ── Pydantic Models ──────────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    type: str = Field(..., pattern="^(income|expense)$")
    category: str
    subcategory: Optional[str] = None
    description: str
    amount: float = Field(..., gt=0)              # CAD-equivalent (or original if same currency)
    date: str                                       # YYYY-MM-DD
    # Currency tracking — original amount preserved alongside the CAD figure.
    original_amount: Optional[float] = None
    original_currency: Optional[str] = None         # ISO code: CAD/USD/BRL/...
    exchange_rate: Optional[float] = None           # original → CAD
    cad_amount: Optional[float] = None              # explicit CAD value (else amount)
    account: Optional[str] = None                   # "bank", "wise", "stripe", "manual"
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    team_member_id: Optional[str] = None
    reference: Optional[str] = None
    recurring: bool = False
    recurring_interval: Optional[str] = None        # monthly, quarterly, yearly
    notes: Optional[str] = None
    source: Optional[str] = None                    # "manual", "bank_import", "wise_import", "wise_api", "stripe"
    external_id: Optional[str] = None               # Provider transaction ID for dedup (e.g. Wise ID)
    import_id: Optional[str] = None                 # Which import batch this row came from

class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    original_amount: Optional[float] = None
    original_currency: Optional[str] = None
    exchange_rate: Optional[float] = None
    cad_amount: Optional[float] = None
    account: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    team_member_id: Optional[str] = None
    reference: Optional[str] = None
    recurring: Optional[bool] = None
    recurring_interval: Optional[str] = None
    notes: Optional[str] = None
    source: Optional[str] = None
    external_id: Optional[str] = None
    import_id: Optional[str] = None


# ── Categories + Auto-Categorization Engine ──────────────────────────────────

FINANCE_CATEGORIES = [
    "Real Estate Commission", "RRM Revenue", "Airbnb Income", "Refund",
    "Wise International Transfer", "Payroll", "Cleaning Services",
    "Contractor Payment", "Software Subscription", "Loan Payment",
    "Real Estate Board Fees", "Condo Fees", "Travel", "Food and Dining",
    "Shopping and Household", "Transportation", "Donation", "Bank Fee",
    "Uncategorized",
]

# (regex_pattern, category, type, recurring) — first match wins
DEFAULT_RULES = [
    (r"\breal broker\b|\brealtor commission\b|\bcommission\b", "Real Estate Commission", "income", False),
    (r"\brrm\b|red ribbon media|\bscp\b", "RRM Revenue", "income", True),
    (r"\bairbnb\b", "Airbnb Income", "income", False),
    (r"\brefund\b|\breturn\b", "Refund", "income", False),
    (r"\bwise\b|\btransferwise\b", "Wise International Transfer", "expense", False),
    (r"\bpayroll\b|\bsalary\b|\bwage\b", "Payroll", "expense", True),
    (r"\bcleaning\b|housekeep|maid", "Cleaning Services", "expense", True),
    (r"\bcontractor\b|freelance|upwork|fiverr", "Contractor Payment", "expense", False),
    (r"adobe|notion|github|figma|slack|zoom|google workspace|microsoft 365|netflix|spotify|chatgpt|openai|anthropic|claude|cursor|linear|stripe(?: subscription)?", "Software Subscription", "expense", True),
    (r"\bmortgage\b|\bloan payment\b|\bauto loan\b", "Loan Payment", "expense", True),
    (r"trreb|crea|orea|board fees|real estate board", "Real Estate Board Fees", "expense", True),
    (r"condo fee|maintenance fee|hoa", "Condo Fees", "expense", True),
    (r"airline|flight|hotel|airbnb host|uber|lyft|train|amtrak|via rail|booking\.com|expedia", "Travel", "expense", False),
    (r"restaurant|coffee|starbucks|tim hortons|mcdonald|subway|uber ?eats|doordash|skipthedishes", "Food and Dining", "expense", False),
    (r"amazon|walmart|costco|ikea|home depot|canadian tire|target|best buy", "Shopping and Household", "expense", False),
    (r"uber|lyft|gas|petrol|esso|shell|petro-canada|presto|ttc|metrolinx", "Transportation", "expense", False),
    (r"donation|charity|red cross|gofundme", "Donation", "expense", False),
    (r"\bnsf\b|overdraft|service charge|monthly fee|atm fee|bank fee|interac e-tr fee", "Bank Fee", "expense", False),
]


def _compile_default_rules():
    import re as _re
    return [(_re.compile(p, _re.IGNORECASE), cat, typ, rec) for (p, cat, typ, rec) in DEFAULT_RULES]


_COMPILED_RULES = _compile_default_rules()


async def _learned_rules(org_id: str):
    """Fetch user-saved categorization rules for this org (newest first so
    later corrections override defaults)."""
    rules = await db.categorization_rules.find(
        {"org_id": org_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    import re as _re
    out = []
    for r in rules:
        try:
            out.append((
                _re.compile(r["pattern"], _re.IGNORECASE),
                r["category"],
                r.get("type"),
                r.get("recurring", False),
                r.get("subcategory"),
            ))
        except Exception:
            continue
    return out


async def auto_categorize(description: str, amount_signed: float, org_id: str) -> dict:
    """Return {category, subcategory, type, recurring, matched_rule}."""
    desc = (description or "").strip()
    learned = await _learned_rules(org_id)
    for pat, cat, typ, rec, sub in learned:
        if pat.search(desc):
            return {
                "category": cat,
                "subcategory": sub,
                "type": typ or ("income" if amount_signed > 0 else "expense"),
                "recurring": rec,
                "matched_rule": "learned",
            }
    for pat, cat, typ, rec in _COMPILED_RULES:
        if pat.search(desc):
            return {
                "category": cat,
                "subcategory": None,
                "type": typ,
                "recurring": rec,
                "matched_rule": "default",
            }
    return {
        "category": "Uncategorized",
        "subcategory": None,
        "type": "income" if amount_signed > 0 else "expense",
        "recurring": False,
        "matched_rule": None,
    }


# ── CRUD Endpoints ───────────────────────────────────────────────────────────

@router.post("/transactions")
async def create_transaction(
    data: TransactionCreate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Create a new financial transaction"""
    transaction = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "created_by": current_user["id"],
        "created_at": get_utc_now(),
    }
    await db.finance_transactions.insert_one(transaction)
    transaction.pop("_id", None)
    return transaction


@router.get("/transactions")
async def list_transactions(
    type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(200, le=1000),
    skip: int = Query(0),
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """List financial transactions with optional filters. Admin-only AND
    org-scoped — defense in depth so multi-org never leaks across tenants."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    query = {"$or": [{"org_id": org_id}, {"org_id": {"$exists": False}}]}
    if type:
        query["type"] = type
    if category:
        query["category"] = category
    if client_id:
        query["client_id"] = client_id
    if date_from or date_to:
        date_q = {}
        if date_from:
            date_q["$gte"] = date_from
        if date_to:
            date_q["$lte"] = date_to
        query["date"] = date_q

    total = await db.finance_transactions.count_documents(query)
    items = await db.finance_transactions.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    return {"items": items, "total": total}


@router.get("/transactions/{transaction_id}")
async def get_transaction(
    transaction_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Get a single transaction. Admin + org-scoped — a transaction from
    another tenant returns 404 even if the ID is known."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    tx = await db.finance_transactions.find_one(
        {"id": transaction_id, "$or": [{"org_id": org_id}, {"org_id": {"$exists": False}}]},
        {"_id": 0},
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.patch("/transactions/{transaction_id}")
async def update_transaction(
    transaction_id: str,
    data: TransactionUpdate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Update a transaction. Admin + org-scoped."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    scope = {"id": transaction_id, "$or": [{"org_id": org_id}, {"org_id": {"$exists": False}}]}
    tx = await db.finance_transactions.find_one(scope)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = get_utc_now()
        await db.finance_transactions.update_one(scope, {"$set": update_dict})

    updated = await db.finance_transactions.find_one(scope, {"_id": 0})
    return updated


@router.delete("/transactions/{transaction_id}")
async def delete_transaction(
    transaction_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Delete a transaction. Admin + org-scoped."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    scope = {"id": transaction_id, "$or": [{"org_id": org_id}, {"org_id": {"$exists": False}}]}
    tx = await db.finance_transactions.find_one(scope)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.finance_transactions.delete_one(scope)
    return {"message": "Transaction deleted"}


# ── Summary / Dashboard Endpoint ─────────────────────────────────────────────

@router.get("/summary")
async def get_financial_summary(
    period: Optional[str] = Query(None, description="YYYY-MM filter"),
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Get financial summary — totals, by-category breakdown, monthly trend"""
    now = datetime.now(timezone.utc)
    current_month = period or now.strftime("%Y-%m")
    year = current_month[:4]

    # Current month totals
    month_query = {"date": {"$regex": f"^{current_month}"}}
    month_txns = await db.finance_transactions.find(month_query, {"_id": 0}).to_list(5000)

    income_total = sum(t["amount"] for t in month_txns if t["type"] == "income")
    expense_total = sum(t["amount"] for t in month_txns if t["type"] == "expense")

    # Category breakdown for current month
    cat_map = {}
    for t in month_txns:
        key = (t["type"], t["category"])
        cat_map[key] = cat_map.get(key, 0) + t["amount"]
    categories = [{"type": k[0], "category": k[1], "total": v} for k, v in sorted(cat_map.items(), key=lambda x: -x[1])]

    # Year-to-date totals
    ytd_query = {"date": {"$gte": f"{year}-01-01", "$lte": f"{year}-12-31"}}
    ytd_txns = await db.finance_transactions.find(ytd_query, {"_id": 0, "type": 1, "amount": 1, "date": 1}).to_list(10000)

    ytd_income = sum(t["amount"] for t in ytd_txns if t["type"] == "income")
    ytd_expense = sum(t["amount"] for t in ytd_txns if t["type"] == "expense")

    # Monthly trend (last 12 months or current year)
    monthly = {}
    for t in ytd_txns:
        m = t["date"][:7]
        if m not in monthly:
            monthly[m] = {"month": m, "income": 0, "expense": 0}
        monthly[m][t["type"]] += t["amount"]
    trend = sorted(monthly.values(), key=lambda x: x["month"])

    # Top clients by revenue this month
    client_map = {}
    for t in month_txns:
        if t["type"] == "income" and t.get("client_name"):
            client_map[t["client_name"]] = client_map.get(t["client_name"], 0) + t["amount"]
    top_clients = [{"name": k, "revenue": v} for k, v in sorted(client_map.items(), key=lambda x: -x[1])[:10]]

    return {
        "period": current_month,
        "income": round(income_total, 2),
        "expenses": round(expense_total, 2),
        "net": round(income_total - expense_total, 2),
        "ytd_income": round(ytd_income, 2),
        "ytd_expenses": round(ytd_expense, 2),
        "ytd_net": round(ytd_income - ytd_expense, 2),
        "categories": categories,
        "monthly_trend": trend,
        "top_clients": top_clients,
        "transaction_count": len(month_txns),
    }


# ── Categories Endpoint ──────────────────────────────────────────────────────

DEFAULT_FINANCE_CATEGORIES = [
    {"name": "Ad Spend", "type": "expense", "color": "#ef4444"},
    {"name": "Software & Tools", "type": "expense", "color": "#f97316"},
    {"name": "Salary", "type": "expense", "color": "#eab308"},
    {"name": "Freelancer", "type": "expense", "color": "#a855f7"},
    {"name": "Revenue", "type": "income", "color": "#22c55e"},
    {"name": "Retainer", "type": "income", "color": "#10b981"},
    {"name": "Refund", "type": "income", "color": "#06b6d4"},
    {"name": "Other", "type": "both", "color": "#6b7280"},
]


class FinanceCategoryCreate(BaseModel):
    name: str
    type: str = "expense"  # income | expense | both
    color: Optional[str] = "#6366f1"


class FinanceCategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None


@router.get("/stripe/payments")
async def stripe_live_payments(
    limit: int = Query(25, ge=1, le=100),
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Pull recent successful charges from the org's connected Stripe account.
    Returns {connected, payments, total_cents_30d}. Admin-only.

    If no Stripe integration is connected, returns connected=False with an
    empty list so the Finance page can render a "Connect Stripe" nudge
    instead of erroring."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    integ = await db.integrations.find_one(
        {"org_id": org_id, "provider": "stripe", "status": "connected"}
    )
    if not integ:
        return {"connected": False, "payments": [], "total_cents_30d": 0}

    api_key = (integ.get("config") or {}).get("api_key")
    if not api_key:
        return {"connected": False, "payments": [], "total_cents_30d": 0}

    try:
        import stripe as stripe_sdk
        stripe_sdk.api_key = api_key
        # Use the Charges API — works for any live account without requiring
        # Connect setup. List recent succeeded charges.
        charges = stripe_sdk.Charge.list(limit=limit)
        payments = []
        for c in charges.data:
            if c.get("status") != "succeeded":
                continue
            payments.append({
                "id": c["id"],
                "amount": c["amount"],               # in cents
                "currency": (c.get("currency") or "usd").upper(),
                "description": c.get("description") or "",
                "customer_email": (c.get("billing_details") or {}).get("email"),
                "customer_name": (c.get("billing_details") or {}).get("name"),
                "created": c["created"],             # epoch seconds
                "receipt_url": c.get("receipt_url"),
            })

        # 30-day total — paginate once with a created filter
        from datetime import datetime as _dt, timezone as _tz, timedelta as _td
        cutoff = int((_dt.now(_tz.utc) - _td(days=30)).timestamp())
        total = 0
        cursor = None
        pages = 0
        while pages < 5:  # safety cap
            page = stripe_sdk.Charge.list(limit=100, created={"gte": cutoff}, starting_after=cursor)
            for c in page.data:
                if c.get("status") == "succeeded":
                    total += c.get("amount", 0)
            if not page.get("has_more"):
                break
            cursor = page.data[-1]["id"] if page.data else None
            pages += 1

        return {"connected": True, "payments": payments, "total_cents_30d": total}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)[:200]}")


@router.get("/categories")
async def get_finance_categories(
    current_user: dict = Depends(get_current_user)
):
    """Get finance categories. Auto-seeds defaults if none exist."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    count = await db.finance_categories.count_documents({"org_id": org_id})

    if count == 0:
        docs = []
        for d in DEFAULT_FINANCE_CATEGORIES:
            docs.append({
                "id": str(uuid.uuid4()),
                "org_id": org_id,
                "name": d["name"],
                "type": d["type"],
                "color": d["color"],
            })
        await db.finance_categories.insert_many(docs)

    cats = await db.finance_categories.find({"org_id": org_id}, {"_id": 0}).sort("name", 1).to_list(100)

    # Also return legacy format for backward compat with transaction modal
    income = [c["name"] for c in cats if c["type"] in ["income", "both"]]
    expense = [c["name"] for c in cats if c["type"] in ["expense", "both"]]

    return {
        "items": cats,
        "income": sorted(income),
        "expense": sorted(expense),
    }


@router.post("/categories")
async def create_finance_category(
    data: FinanceCategoryCreate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Create a new finance category."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "name": data.name,
        "type": data.type,
        "color": data.color or "#6366f1",
    }
    await db.finance_categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/categories/{category_id}")
async def update_finance_category(
    category_id: str,
    data: FinanceCategoryUpdate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Update a finance category."""
    update = {k: v for k, v in data.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.finance_categories.update_one({"id": category_id}, {"$set": update})
    return {"success": True}


@router.delete("/categories/{category_id}")
async def delete_finance_category(
    category_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Delete a finance category. Existing transactions keep their label."""
    await db.finance_categories.delete_one({"id": category_id})
    return {"success": True}


# ════════════════════════════════════════════════════════════════════════════
# CSV IMPORT — bank statements + Wise exports
# ════════════════════════════════════════════════════════════════════════════

import csv as _csv
import io as _io
import hashlib
from datetime import datetime as _dt


WISE_REQUIRED_COLS = {"id", "direction", "source amount"}
BANK_HINT_COLS = {"card number", "transaction type"}


def _normalize_header(s: str) -> str:
    return (s or "").strip().lower().lstrip("\ufeff")


def _detect_format(headers: list[str]) -> str:
    h = {_normalize_header(c) for c in headers}
    if WISE_REQUIRED_COLS.issubset(h):
        return "wise"
    if BANK_HINT_COLS & h:
        return "bank"
    # Generic fallback: needs at least date + amount + description
    if {"date", "amount"}.issubset(h) and ("description" in h or "memo" in h):
        return "bank"
    return "unknown"


def _parse_amount(s) -> Optional[float]:
    if s is None or s == "":
        return None
    try:
        return float(str(s).replace(",", "").replace("$", "").strip())
    except (ValueError, TypeError):
        return None


def _parse_date(s: str) -> Optional[str]:
    """Return YYYY-MM-DD or None."""
    if not s:
        return None
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return _dt.strptime(s.split(".")[0].rstrip("Z"), fmt.rstrip("Z")).date().isoformat()
        except ValueError:
            continue
    # ISO with timezone
    try:
        return _dt.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


def _dedup_key(date: str, amount: float, description: str) -> str:
    raw = f"{date}|{round(amount, 2)}|{(description or '').strip().lower()}"
    return hashlib.sha1(raw.encode()).hexdigest()


def _row_to_tx_wise(row: dict) -> Optional[dict]:
    """Map a Wise CSV row to a transaction dict."""
    direction = (row.get("direction") or row.get("Direction") or "").strip().upper()
    src_amt = _parse_amount(row.get("source amount") or row.get("Source amount"))
    src_cur = (row.get("source currency") or row.get("Source currency") or "").strip().upper()
    tgt_amt = _parse_amount(row.get("target amount") or row.get("Target amount"))
    tgt_cur = (row.get("target currency") or row.get("Target currency") or "").strip().upper()
    fx_rate = _parse_amount(row.get("exchange rate") or row.get("Exchange rate"))
    finished = row.get("finished on") or row.get("Finished on") or row.get("created on") or row.get("Created on")
    date = _parse_date(finished or "")
    desc = " ".join(filter(None, [
        (row.get("target name") or row.get("Target name") or "").strip(),
        (row.get("reference") or row.get("Reference") or "").strip(),
        (row.get("note") or row.get("Note") or "").strip(),
    ])).strip() or "Wise transfer"

    if not date or src_amt is None:
        return None

    # Treat Wise rows as expenses if outgoing, income if incoming.
    is_outgoing = direction in ("OUT", "OUTGOING", "DEBIT")
    abs_amount = abs(src_amt)

    # CAD conversion: if source is CAD, that's the value. If target is CAD,
    # use target_amount. Otherwise leave cad_amount unset for the user to fix.
    cad_amount = None
    if src_cur == "CAD":
        cad_amount = abs_amount
    elif tgt_cur == "CAD" and tgt_amt is not None:
        cad_amount = abs(tgt_amt)
    elif fx_rate and tgt_cur == "CAD":
        cad_amount = abs_amount * fx_rate

    return {
        "type": "expense" if is_outgoing else "income",
        "amount": cad_amount or abs_amount,         # what the dashboard sums
        "original_amount": abs_amount,
        "original_currency": src_cur or "CAD",
        "exchange_rate": fx_rate,
        "cad_amount": cad_amount,
        "description": desc,
        "date": date,
        "account": "wise",
        "external_id": (row.get("id") or row.get("ID") or "").strip() or None,
        "source": "wise_import",
    }


def _row_to_tx_bank(row: dict) -> Optional[dict]:
    """Map a generic bank CSV row to a transaction dict.
    Recognises columns: date, amount, description (or memo), transaction type."""
    # Find columns case-insensitively
    norm = {_normalize_header(k): v for k, v in row.items()}
    raw_amt = norm.get("amount") or norm.get("debit") or norm.get("credit")
    amt = _parse_amount(raw_amt)
    if amt is None:
        # Some banks split debit/credit columns
        debit = _parse_amount(norm.get("debit"))
        credit = _parse_amount(norm.get("credit"))
        if debit:
            amt = -debit
        elif credit:
            amt = credit
    date = _parse_date(norm.get("date") or norm.get("posted date") or norm.get("transaction date") or "")
    desc = (norm.get("description") or norm.get("memo") or norm.get("payee") or "").strip()
    ttype = (norm.get("transaction type") or norm.get("type") or "").strip().lower()

    if amt is None or not date:
        return None

    is_expense = amt < 0 or ttype in ("debit", "withdrawal", "purchase", "fee")
    abs_amount = abs(amt)

    return {
        "type": "expense" if is_expense else "income",
        "amount": abs_amount,
        "original_amount": abs_amount,
        "original_currency": "CAD",  # default — user can override if their bank is in another currency
        "exchange_rate": 1.0,
        "cad_amount": abs_amount,
        "description": desc or "(no description)",
        "date": date,
        "account": "bank",
        "external_id": None,         # Most bank exports lack a stable ID
        "source": "bank_import",
    }


@router.post("/transactions/preview-import")
async def preview_csv_import(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles(["Administrator"])),
):
    """Parse a CSV (bank or Wise) and return a preview WITHOUT saving.
    Auto-detects format, runs auto-categorization, flags duplicates against
    existing finance_transactions in the org. The frontend renders a table
    of parsed rows + warnings; user clicks Confirm to call /commit-import."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1", errors="replace")

    reader = _csv.reader(_io.StringIO(text))
    rows = list(reader)
    if len(rows) < 2:
        raise HTTPException(status_code=400, detail="CSV must have a header row and at least one data row")

    headers = rows[0]
    fmt = _detect_format(headers)
    if fmt == "unknown":
        raise HTTPException(status_code=400, detail="Could not detect format. Expected a Wise transfers export or a bank statement with date/amount/description columns.")

    parser = _row_to_tx_wise if fmt == "wise" else _row_to_tx_bank
    raw_dicts = [dict(zip(headers, r)) for r in rows[1:] if any(c.strip() for c in r)]

    parsed, errors = [], []
    for i, row in enumerate(raw_dicts, start=2):
        tx = parser(row)
        if not tx:
            errors.append({"row": i, "reason": "Could not parse — missing date or amount"})
            continue
        # Auto-categorize
        signed = tx["amount"] if tx["type"] == "income" else -tx["amount"]
        cat = await auto_categorize(tx["description"], signed, org_id)
        tx["category"] = cat["category"]
        tx["subcategory"] = cat.get("subcategory")
        tx["recurring"] = cat["recurring"]
        # Default type from rule if rule supplied one
        if cat.get("type"):
            tx["type"] = cat["type"]
        parsed.append(tx)

    # Dedup check — by external_id first, then date+amount+description hash
    duplicate_count = 0
    for tx in parsed:
        is_dup = False
        if tx.get("external_id"):
            existing = await db.finance_transactions.find_one(
                {"org_id": org_id, "external_id": tx["external_id"]},
                {"_id": 0, "id": 1},
            )
            if existing:
                is_dup = True
        if not is_dup:
            key = _dedup_key(tx["date"], tx["amount"], tx["description"])
            existing = await db.finance_transactions.find_one(
                {"org_id": org_id, "dedup_key": key},
                {"_id": 0, "id": 1},
            )
            if existing:
                is_dup = True
        tx["_duplicate"] = is_dup
        if is_dup:
            duplicate_count += 1

    return {
        "format": fmt,
        "total_rows": len(raw_dicts),
        "parsed": parsed,
        "errors": errors,
        "duplicate_count": duplicate_count,
    }


@router.post("/transactions/commit-import")
async def commit_csv_import(
    body: dict,
    current_user: dict = Depends(require_roles(["Administrator"])),
):
    """Persist the user-confirmed transactions from a previous /preview-import.
    Body: {transactions: [...]}. Skips any row marked _duplicate=true.
    Returns {imported, skipped, import_id}."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    txs = (body or {}).get("transactions") or []
    if not isinstance(txs, list):
        raise HTTPException(status_code=400, detail="transactions must be an array")

    import_id = str(uuid.uuid4())
    now = get_utc_now()
    imported = 0
    skipped = 0
    docs = []
    for tx in txs:
        if tx.get("_duplicate"):
            skipped += 1
            continue
        # Sanitize — only persist whitelisted fields
        doc = {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "type": tx.get("type", "expense"),
            "category": tx.get("category", "Uncategorized"),
            "subcategory": tx.get("subcategory"),
            "description": tx.get("description", ""),
            "amount": float(tx.get("amount") or 0),
            "original_amount": tx.get("original_amount"),
            "original_currency": tx.get("original_currency"),
            "exchange_rate": tx.get("exchange_rate"),
            "cad_amount": tx.get("cad_amount"),
            "account": tx.get("account"),
            "date": tx.get("date"),
            "recurring": bool(tx.get("recurring")),
            "external_id": tx.get("external_id"),
            "import_id": import_id,
            "dedup_key": _dedup_key(tx.get("date") or "", float(tx.get("amount") or 0), tx.get("description") or ""),
            "source": tx.get("source", "csv_import"),
            "created_by": current_user["id"],
            "created_at": now,
        }
        docs.append(doc)
    if docs:
        await db.finance_transactions.insert_many(docs)
        imported = len(docs)

    return {"imported": imported, "skipped": skipped, "import_id": import_id}


# ════════════════════════════════════════════════════════════════════════════
# CATEGORIZATION RULES — saved patterns for "apply to all matching"
# ════════════════════════════════════════════════════════════════════════════

@router.get("/rules")
async def list_categorization_rules(
    current_user: dict = Depends(require_roles(["Administrator"])),
):
    """List the org's learned categorization rules."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    rules = await db.categorization_rules.find(
        {"org_id": org_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return rules


@router.post("/rules")
async def create_categorization_rule(
    body: dict,
    current_user: dict = Depends(require_roles(["Administrator"])),
):
    """Save a "categorize anything matching X as Y" rule. Future imports
    apply it automatically before falling back to defaults.
    Body: {pattern, category, subcategory?, type?, recurring?, apply_to_existing?}."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    pattern = (body.get("pattern") or "").strip()
    category = (body.get("category") or "").strip()
    if not pattern or not category:
        raise HTTPException(status_code=400, detail="pattern and category are required")

    rule = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "pattern": pattern,
        "category": category,
        "subcategory": body.get("subcategory"),
        "type": body.get("type"),
        "recurring": bool(body.get("recurring")),
        "created_by": current_user["id"],
        "created_at": get_utc_now(),
    }
    await db.categorization_rules.insert_one(rule)

    # Optionally re-categorize existing matching transactions
    updated = 0
    if body.get("apply_to_existing"):
        import re as _re
        try:
            regex = _re.compile(pattern, _re.IGNORECASE)
        except Exception:
            regex = None
        if regex:
            cursor = db.finance_transactions.find({"org_id": org_id}, {"_id": 0, "id": 1, "description": 1})
            ids_to_update = []
            async for t in cursor:
                if regex.search(t.get("description") or ""):
                    ids_to_update.append(t["id"])
            if ids_to_update:
                update_doc = {"category": category}
                if body.get("subcategory"):
                    update_doc["subcategory"] = body["subcategory"]
                if body.get("type"):
                    update_doc["type"] = body["type"]
                if body.get("recurring") is not None:
                    update_doc["recurring"] = bool(body["recurring"])
                res = await db.finance_transactions.update_many(
                    {"id": {"$in": ids_to_update}, "org_id": org_id},
                    {"$set": update_doc},
                )
                updated = res.modified_count

    rule.pop("_id", None)
    return {"rule": rule, "applied_to_existing": updated}


@router.delete("/rules/{rule_id}")
async def delete_categorization_rule(
    rule_id: str,
    current_user: dict = Depends(require_roles(["Administrator"])),
):
    """Forget a learned rule. Existing transactions keep their current category."""
    org_id = current_user.get("org_id") or current_user.get("team_id") or current_user.get("id")
    await db.categorization_rules.delete_one({"id": rule_id, "org_id": org_id})
    return {"success": True}
