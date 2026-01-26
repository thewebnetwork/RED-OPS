"""Category management routes"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

from database import db
from utils.auth import require_roles, get_current_user
from utils.helpers import get_utc_now

router = APIRouter(prefix="/categories", tags=["Categories"])


# ============== MODELS ==============

class CategoryL1Create(BaseModel):
    name: str
    name_en: Optional[str] = None
    name_pt: Optional[str] = None
    name_es: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None


class CategoryL1Update(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    name_pt: Optional[str] = None
    name_es: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    active: Optional[bool] = None


class CategoryL2Create(BaseModel):
    name: str
    name_en: Optional[str] = None
    name_pt: Optional[str] = None
    name_es: Optional[str] = None
    category_l1_id: str
    description: Optional[str] = None


class CategoryL2Update(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    name_pt: Optional[str] = None
    name_es: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None


# ============== L1 CATEGORY ROUTES ==============

@router.post("")
async def create_category_l1(cat_data: CategoryL1Create, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new L1 category (Admin only)"""
    existing = await db.categories_l1.find_one({"name": cat_data.name, "active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists")
    
    category = {
        "id": str(uuid.uuid4()),
        "name": cat_data.name,
        "name_en": cat_data.name_en,
        "name_pt": cat_data.name_pt,
        "name_es": cat_data.name_es,
        "description": cat_data.description,
        "icon": cat_data.icon,
        "active": True,
        "created_at": get_utc_now()
    }
    
    await db.categories_l1.insert_one(category)
    return {k: v for k, v in category.items() if k != "_id"}


@router.get("")
async def list_categories_l1(current_user: dict = Depends(get_current_user)):
    """List all active L1 categories"""
    categories = await db.categories_l1.find({"active": True}, {"_id": 0}).to_list(100)
    return categories


@router.get("/all")
async def list_all_categories_l1(current_user: dict = Depends(require_roles(["Admin"]))):
    """List all L1 categories including inactive (Admin only)"""
    categories = await db.categories_l1.find({}, {"_id": 0}).to_list(100)
    return categories


@router.get("/{category_id}")
async def get_category_l1(category_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific L1 category"""
    category = await db.categories_l1.find_one({"id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.patch("/{category_id}")
async def update_category_l1(category_id: str, cat_data: CategoryL1Update, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update an L1 category (Admin only)"""
    category = await db.categories_l1.find_one({"id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_dict = {k: v for k, v in cat_data.model_dump().items() if v is not None}
    
    if "name" in update_dict:
        existing = await db.categories_l1.find_one({
            "name": update_dict["name"],
            "id": {"$ne": category_id},
            "active": True
        })
        if existing:
            raise HTTPException(status_code=400, detail="Category with this name already exists")
    
    if update_dict:
        await db.categories_l1.update_one({"id": category_id}, {"$set": update_dict})
    
    updated = await db.categories_l1.find_one({"id": category_id}, {"_id": 0})
    return updated


@router.delete("/{category_id}")
async def delete_category_l1(category_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Soft delete an L1 category (Admin only)"""
    result = await db.categories_l1.update_one({"id": category_id}, {"$set": {"active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Also deactivate all L2 categories under this L1
    await db.categories_l2.update_many({"category_l1_id": category_id}, {"$set": {"active": False}})
    
    return {"message": "Category deleted"}


# ============== L2 CATEGORY (SUBCATEGORY) ROUTES ==============

@router.post("/{category_l1_id}/subcategories")
async def create_category_l2(category_l1_id: str, cat_data: CategoryL2Create, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new L2 category under an L1 category (Admin only)"""
    # Verify L1 category exists
    l1_category = await db.categories_l1.find_one({"id": category_l1_id, "active": True})
    if not l1_category:
        raise HTTPException(status_code=404, detail="Parent category not found")
    
    # Check for duplicate name under same L1
    existing = await db.categories_l2.find_one({
        "name": cat_data.name,
        "category_l1_id": category_l1_id,
        "active": True
    })
    if existing:
        raise HTTPException(status_code=400, detail="Subcategory with this name already exists")
    
    subcategory = {
        "id": str(uuid.uuid4()),
        "name": cat_data.name,
        "name_en": cat_data.name_en,
        "name_pt": cat_data.name_pt,
        "name_es": cat_data.name_es,
        "category_l1_id": category_l1_id,
        "category_l1_name": l1_category["name"],
        "description": cat_data.description,
        "active": True,
        "created_at": get_utc_now()
    }
    
    await db.categories_l2.insert_one(subcategory)
    return {k: v for k, v in subcategory.items() if k != "_id"}


@router.get("/{category_l1_id}/subcategories")
async def list_subcategories(category_l1_id: str, current_user: dict = Depends(get_current_user)):
    """List all subcategories under an L1 category"""
    subcategories = await db.categories_l2.find(
        {"category_l1_id": category_l1_id, "active": True},
        {"_id": 0}
    ).to_list(100)
    return subcategories


@router.patch("/subcategories/{subcategory_id}")
async def update_category_l2(subcategory_id: str, cat_data: CategoryL2Update, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update a subcategory (Admin only)"""
    subcategory = await db.categories_l2.find_one({"id": subcategory_id}, {"_id": 0})
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    
    update_dict = {k: v for k, v in cat_data.model_dump().items() if v is not None}
    
    if update_dict:
        await db.categories_l2.update_one({"id": subcategory_id}, {"$set": update_dict})
    
    updated = await db.categories_l2.find_one({"id": subcategory_id}, {"_id": 0})
    return updated


@router.delete("/subcategories/{subcategory_id}")
async def delete_category_l2(subcategory_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Soft delete a subcategory (Admin only)"""
    result = await db.categories_l2.update_one({"id": subcategory_id}, {"$set": {"active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    return {"message": "Subcategory deleted"}


# ============== COMBINED ENDPOINTS ==============

@router.get("/tree/full")
async def get_category_tree(current_user: dict = Depends(get_current_user)):
    """Get full category tree (L1 with nested L2)"""
    l1_categories = await db.categories_l1.find({"active": True}, {"_id": 0}).to_list(100)
    
    result = []
    for l1 in l1_categories:
        l2_categories = await db.categories_l2.find(
            {"category_l1_id": l1["id"], "active": True},
            {"_id": 0}
        ).to_list(100)
        result.append({**l1, "subcategories": l2_categories})
    
    return result
