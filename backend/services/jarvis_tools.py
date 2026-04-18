"""Jarvis tool definitions + executor. All tools are read-only."""
import json
import logging
from datetime import datetime, timezone, timedelta

from database import db
from utils.tenancy import resolve_org_id

logger = logging.getLogger(__name__)

TOOLS = [
    {
        "name": "query_finance_transactions",
        "description": "Query finance transactions. Filter by date range, category, amount, or text search. Returns up to 500 rows with date, amount, type, description, category.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date_from": {"type": "string", "description": "ISO date like 2026-01-01"},
                "date_to": {"type": "string"},
                "category": {"type": "string"},
                "search_term": {"type": "string", "description": "Text search in description"},
                "amount_min": {"type": "number"},
                "amount_max": {"type": "number"},
                "limit": {"type": "integer", "default": 100}
            }
        }
    },
    {
        "name": "query_finance_summary",
        "description": "Get aggregate financial summary: income, expenses, net, category breakdown for a time period.",
        "input_schema": {
            "type": "object",
            "properties": {
                "period": {"type": "string", "enum": ["this_month", "last_month", "this_quarter", "ytd", "custom"]},
                "date_from": {"type": "string"},
                "date_to": {"type": "string"}
            },
            "required": ["period"]
        }
    },
    {
        "name": "query_clients",
        "description": "List or search clients (Media Client users). Returns name, email, role, account type, active status.",
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {"type": "string"},
                "limit": {"type": "integer", "default": 50}
            }
        }
    },
    {
        "name": "query_tasks",
        "description": "Query tasks. Filter by status, assignee, priority, or due date.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string"},
                "assignee_id": {"type": "string"},
                "priority": {"type": "string"},
                "due_before": {"type": "string"},
                "limit": {"type": "integer", "default": 50}
            }
        }
    },
    {
        "name": "query_projects",
        "description": "Query projects. Filter by status, client name, or project type.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string"},
                "client_name": {"type": "string"},
                "project_type": {"type": "string"},
                "limit": {"type": "integer", "default": 50}
            }
        }
    },
    {
        "name": "query_users",
        "description": "Query platform users. Filter by role, account_type, or search by name/email.",
        "input_schema": {
            "type": "object",
            "properties": {
                "role": {"type": "string"},
                "account_type": {"type": "string"},
                "search": {"type": "string"},
                "limit": {"type": "integer", "default": 50}
            }
        }
    },
    {
        "name": "get_system_time",
        "description": "Get current server time. Use when the user asks about 'today', 'this week', etc.",
        "input_schema": {"type": "object", "properties": {}}
    },
]

MATT_ALLOWED_TOOLS = {"query_finance_transactions", "query_finance_summary", "query_clients", "get_system_time"}


def get_tools_for_scope(scope: str) -> list:
    if scope == "scoped_matt":
        return [t for t in TOOLS if t["name"] in MATT_ALLOWED_TOOLS]
    return TOOLS


async def execute_tool(name: str, tool_input: dict, user: dict, scope: str) -> str:
    if scope == "scoped_matt" and name not in MATT_ALLOWED_TOOLS:
        return json.dumps({"error": "This tool is not available in your scope."})

    org_id = resolve_org_id(user)
    try:
        if name == "query_finance_transactions":
            return await _query_finance(org_id, tool_input)
        elif name == "query_finance_summary":
            return await _query_summary(org_id, tool_input)
        elif name == "query_clients":
            return await _query_clients(tool_input)
        elif name == "query_tasks":
            return await _query_tasks(org_id, tool_input)
        elif name == "query_projects":
            return await _query_projects(org_id, tool_input)
        elif name == "query_users":
            return await _query_users(tool_input)
        elif name == "get_system_time":
            return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S UTC")
        return json.dumps({"error": f"Unknown tool: {name}"})
    except Exception as e:
        logger.error("Jarvis tool %s error: %s", name, e)
        return json.dumps({"error": str(e)[:200]})


async def _query_finance(org_id: str, inp: dict) -> str:
    query = {"org_id": org_id}
    if inp.get("date_from") or inp.get("date_to"):
        dq = {}
        if inp.get("date_from"): dq["$gte"] = inp["date_from"]
        if inp.get("date_to"): dq["$lte"] = inp["date_to"]
        query["date"] = dq
    if inp.get("category"): query["category"] = inp["category"]
    if inp.get("search_term"): query["description"] = {"$regex": inp["search_term"], "$options": "i"}
    if inp.get("amount_min") is not None or inp.get("amount_max") is not None:
        aq = {}
        if inp.get("amount_min") is not None: aq["$gte"] = inp["amount_min"]
        if inp.get("amount_max") is not None: aq["$lte"] = inp["amount_max"]
        query["amount"] = aq
    limit = min(inp.get("limit", 100), 500)
    txs = await db.finance_transactions.find(
        query, {"_id": 0, "id": 1, "date": 1, "amount": 1, "type": 1, "description": 1, "category": 1}
    ).sort("date", -1).to_list(limit)
    return json.dumps({"count": len(txs), "transactions": txs})


async def _query_summary(org_id: str, inp: dict) -> str:
    now = datetime.now(timezone.utc)
    period = inp.get("period", "this_month")
    if period == "this_month":
        start, end = now.replace(day=1).strftime("%Y-%m-%d"), now.strftime("%Y-%m-%d")
    elif period == "last_month":
        first = now.replace(day=1)
        lme = first - timedelta(days=1)
        start, end = lme.replace(day=1).strftime("%Y-%m-%d"), lme.strftime("%Y-%m-%d")
    elif period == "this_quarter":
        q = (now.month - 1) // 3
        start, end = f"{now.year}-{q*3+1:02d}-01", now.strftime("%Y-%m-%d")
    elif period == "ytd":
        start, end = f"{now.year}-01-01", now.strftime("%Y-%m-%d")
    else:
        start = inp.get("date_from", f"{now.year}-01-01")
        end = inp.get("date_to", now.strftime("%Y-%m-%d"))
    txs = await db.finance_transactions.find(
        {"org_id": org_id, "date": {"$gte": start, "$lte": end}}, {"_id": 0, "type": 1, "amount": 1, "category": 1}
    ).to_list(10000)
    inc = sum(t["amount"] for t in txs if t.get("type") == "income")
    exp = sum(t["amount"] for t in txs if t.get("type") == "expense")
    cats = {}
    for t in txs:
        c = t.get("category", "Uncategorized")
        cats[c] = cats.get(c, 0) + t.get("amount", 0)
    return json.dumps({"period": {"start": start, "end": end}, "income": round(inc, 2), "expenses": round(exp, 2), "net": round(inc - exp, 2), "count": len(txs), "by_category": [{"category": k, "total": round(v, 2)} for k, v in sorted(cats.items(), key=lambda x: -x[1])]})


async def _query_clients(inp: dict) -> str:
    query = {"$or": [{"role": "Media Client"}, {"account_type": "Media Client"}]}
    if inp.get("search"):
        query = {"$and": [{"$or": [{"role": "Media Client"}, {"account_type": "Media Client"}]}, {"$or": [{"name": {"$regex": inp["search"], "$options": "i"}}, {"email": {"$regex": inp["search"], "$options": "i"}}]}]}
    limit = min(inp.get("limit", 50), 200)
    clients = await db.users.find(query, {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "account_type": 1, "active": 1, "created_at": 1}).sort("name", 1).to_list(limit)
    return json.dumps({"count": len(clients), "clients": clients})


async def _query_tasks(org_id: str, inp: dict) -> str:
    query = {"org_id": org_id}
    if inp.get("status"): query["status"] = inp["status"]
    if inp.get("assignee_id"): query["assignee_user_id"] = inp["assignee_id"]
    if inp.get("priority"): query["priority"] = inp["priority"]
    if inp.get("due_before"): query["due_date"] = {"$lte": inp["due_before"]}
    limit = min(inp.get("limit", 50), 200)
    tasks = await db.tasks.find(query, {"_id": 0, "id": 1, "title": 1, "status": 1, "priority": 1, "assignee_user_id": 1, "due_date": 1}).sort("created_at", -1).to_list(limit)
    return json.dumps({"count": len(tasks), "tasks": tasks})


async def _query_projects(org_id: str, inp: dict) -> str:
    query = {"org_id": org_id}
    if inp.get("status"): query["status"] = inp["status"]
    if inp.get("client_name"): query["client_name"] = {"$regex": inp["client_name"], "$options": "i"}
    if inp.get("project_type"): query["project_type"] = inp["project_type"]
    limit = min(inp.get("limit", 50), 200)
    projects = await db.projects.find(query, {"_id": 0, "id": 1, "name": 1, "status": 1, "client_name": 1, "project_type": 1, "progress": 1, "created_at": 1}).sort("created_at", -1).to_list(limit)
    return json.dumps({"count": len(projects), "projects": projects})


async def _query_users(inp: dict) -> str:
    query = {}
    if inp.get("role"): query["role"] = inp["role"]
    if inp.get("account_type"): query["account_type"] = inp["account_type"]
    if inp.get("search"): query["$or"] = [{"name": {"$regex": inp["search"], "$options": "i"}}, {"email": {"$regex": inp["search"], "$options": "i"}}]
    limit = min(inp.get("limit", 50), 200)
    users = await db.users.find(query, {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "account_type": 1, "active": 1}).sort("name", 1).to_list(limit)
    return json.dumps({"count": len(users), "users": users})
