"""Finance management routes - manual transaction tracking & dashboard"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
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
    description: str
    amount: float = Field(..., gt=0)
    date: str  # YYYY-MM-DD
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    team_member_id: Optional[str] = None
    reference: Optional[str] = None
    recurring: bool = False
    recurring_interval: Optional[str] = None  # monthly, quarterly, yearly
    notes: Optional[str] = None
    source: Optional[str] = None  # "manual", "bank_import"

class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    team_member_id: Optional[str] = None
    reference: Optional[str] = None
    recurring: Optional[bool] = None
    recurring_interval: Optional[str] = None
    notes: Optional[str] = None
    source: Optional[str] = None


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
    """List financial transactions with optional filters"""
    query = {}
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
    """Get a single transaction"""
    tx = await db.finance_transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.patch("/transactions/{transaction_id}")
async def update_transaction(
    transaction_id: str,
    data: TransactionUpdate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Update a transaction"""
    tx = await db.finance_transactions.find_one({"id": transaction_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = get_utc_now()
        await db.finance_transactions.update_one({"id": transaction_id}, {"$set": update_dict})

    updated = await db.finance_transactions.find_one({"id": transaction_id}, {"_id": 0})
    return updated


@router.delete("/transactions/{transaction_id}")
async def delete_transaction(
    transaction_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Delete a transaction"""
    tx = await db.finance_transactions.find_one({"id": transaction_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.finance_transactions.delete_one({"id": transaction_id})
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
