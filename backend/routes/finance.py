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
    reference: Optional[str] = None
    recurring: bool = False
    recurring_interval: Optional[str] = None  # monthly, quarterly, yearly
    notes: Optional[str] = None

class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    reference: Optional[str] = None
    recurring: Optional[bool] = None
    recurring_interval: Optional[str] = None
    notes: Optional[str] = None


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

@router.get("/categories")
async def get_finance_categories(
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Get distinct transaction categories used so far"""
    income_cats = await db.finance_transactions.distinct("category", {"type": "income"})
    expense_cats = await db.finance_transactions.distinct("category", {"type": "expense"})

    # Merge with defaults
    default_income = ["Retainer", "Project Fee", "Consultation", "Ad Spend Markup", "Other Income"]
    default_expense = ["Payroll", "Software", "Ads", "Office", "Contractors", "Marketing", "Other Expense"]

    return {
        "income": sorted(set(default_income + income_cats)),
        "expense": sorted(set(default_expense + expense_cats)),
    }
