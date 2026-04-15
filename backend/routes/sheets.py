"""
Basic spreadsheet — rows and columns stored on the sheets collection.

Kept intentionally simple:
  • columns: [{ id, name, type }]   type = text | number | date
  • rows:    [[cell, cell, ...], [...]]   parallel arrays keyed by column order
  • Folder-aware (uses the existing file_folders collection) so sheets
    sit alongside files and docs inside the Drive grid.

Org-scoped via the 3-level fallback per CLAUDE.md.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Literal, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/sheets", tags=["Sheets"])


# ============== MODELS ==============

ColumnType = Literal["text", "number", "date"]


class SheetColumn(BaseModel):
    id: str
    name: str
    type: ColumnType = "text"


class SheetCreate(BaseModel):
    name: str = "Untitled sheet"
    folder_id: Optional[str] = None


class SheetUpdate(BaseModel):
    name: Optional[str] = None
    folder_id: Optional[str] = None
    columns: Optional[List[SheetColumn]] = None
    rows: Optional[List[List[Any]]] = None  # 2D grid of cell values


class SheetListItem(BaseModel):
    id: str
    name: str
    folder_id: Optional[str] = None
    column_count: int = 0
    row_count: int = 0
    created_by_user_id: str
    created_at: datetime
    updated_at: datetime


class SheetDetail(BaseModel):
    id: str
    org_id: str
    name: str
    folder_id: Optional[str] = None
    columns: List[SheetColumn]
    rows: List[List[Any]] = Field(default_factory=list)
    created_by_user_id: str
    created_at: datetime
    updated_at: datetime


# ============== HELPERS ==============

def _org_id(user: dict) -> str:
    return user.get("org_id") or user.get("team_id") or user.get("id")


def _default_columns() -> List[dict]:
    """Start every new sheet with three text columns so the grid isn't empty."""
    return [
        {"id": str(uuid.uuid4()), "name": "Name",  "type": "text"},
        {"id": str(uuid.uuid4()), "name": "Notes", "type": "text"},
        {"id": str(uuid.uuid4()), "name": "Status","type": "text"},
    ]


# ============== ROUTES ==============

@router.get("", response_model=List[SheetListItem])
async def list_sheets(
    folder_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List sheets in the org, optionally filtered by folder."""
    org = _org_id(current_user)
    query: dict = {"org_id": org}
    if folder_id is None:
        query["folder_id"] = {"$in": [None, ""]}
    else:
        query["folder_id"] = folder_id

    sheets = await db.sheets.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)
    out = []
    for s in sheets:
        out.append(SheetListItem(
            id=s["id"],
            name=s.get("name") or "Untitled sheet",
            folder_id=s.get("folder_id"),
            column_count=len(s.get("columns") or []),
            row_count=len(s.get("rows") or []),
            created_by_user_id=s["created_by_user_id"],
            created_at=s["created_at"],
            updated_at=s["updated_at"],
        ))
    return out


@router.post("", response_model=SheetDetail)
async def create_sheet(body: SheetCreate, current_user: dict = Depends(get_current_user)):
    """Create a blank sheet with three starter columns and one empty row."""
    org = _org_id(current_user)
    now = datetime.now(timezone.utc)
    columns = _default_columns()
    sheet = {
        "id": str(uuid.uuid4()),
        "org_id": org,
        "name": (body.name or "Untitled sheet").strip() or "Untitled sheet",
        "folder_id": body.folder_id,
        "columns": columns,
        "rows": [["" for _ in columns]],
        "created_by_user_id": current_user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.sheets.insert_one(sheet)
    return SheetDetail(**{k: v for k, v in sheet.items() if k != "_id"})


@router.get("/{sheet_id}", response_model=SheetDetail)
async def get_sheet(sheet_id: str, current_user: dict = Depends(get_current_user)):
    s = await db.sheets.find_one({"id": sheet_id, "org_id": _org_id(current_user)}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Sheet not found")
    # Ensure columns/rows keys exist on older docs
    s.setdefault("columns", [])
    s.setdefault("rows", [])
    return SheetDetail(**s)


@router.patch("/{sheet_id}", response_model=SheetDetail)
async def update_sheet(sheet_id: str, body: SheetUpdate, current_user: dict = Depends(get_current_user)):
    """Update any combination of name / folder / columns / rows."""
    org = _org_id(current_user)
    existing = await db.sheets.find_one({"id": sheet_id, "org_id": org}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Sheet not found")

    update: dict = {"updated_at": datetime.now(timezone.utc)}
    if body.name is not None:
        update["name"] = body.name.strip() or "Untitled sheet"
    if body.folder_id is not None:
        update["folder_id"] = body.folder_id or None
    if body.columns is not None:
        # Serialize as plain dicts so Mongo is happy
        update["columns"] = [c.model_dump() for c in body.columns]
    if body.rows is not None:
        # Enforce row width = column count to keep the grid rectangular
        col_count = len(update.get("columns") or existing.get("columns") or [])
        rows = []
        for r in body.rows:
            row = list(r)[:col_count]
            while len(row) < col_count:
                row.append("")
            rows.append(row)
        update["rows"] = rows

    await db.sheets.update_one({"id": sheet_id, "org_id": org}, {"$set": update})
    updated = await db.sheets.find_one({"id": sheet_id, "org_id": org}, {"_id": 0})
    return SheetDetail(**updated)


@router.delete("/{sheet_id}")
async def delete_sheet(sheet_id: str, current_user: dict = Depends(get_current_user)):
    res = await db.sheets.delete_one({"id": sheet_id, "org_id": _org_id(current_user)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return {"ok": True}
