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
    category_l1_id: Optional[str] = None  # Allow moving to different parent
    specialty_id: Optional[str] = None  # Link to specialty for pool routing


# ============== L1 CATEGORY ROUTES ==============

@router.post("/l1")
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


@router.get("/l1")
async def list_categories_l1(current_user: dict = Depends(get_current_user)):
    """List all active L1 categories"""
    categories = await db.categories_l1.find({"active": True}, {"_id": 0}).to_list(100)
    return categories


@router.get("/l1/all")
async def list_all_categories_l1(current_user: dict = Depends(require_roles(["Admin"]))):
    """List all L1 categories including inactive (Admin only)"""
    categories = await db.categories_l1.find({}, {"_id": 0}).to_list(100)
    return categories


@router.get("/l1/{category_id}")
async def get_category_l1(category_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific L1 category"""
    category = await db.categories_l1.find_one({"id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.patch("/l1/{category_id}")
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


@router.delete("/l1/{category_id}")
async def delete_category_l1(category_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Soft delete an L1 category (Admin only)"""
    result = await db.categories_l1.update_one({"id": category_id}, {"$set": {"active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Also deactivate all L2 categories under this L1
    await db.categories_l2.update_many({"category_l1_id": category_id}, {"$set": {"active": False}})
    
    return {"message": "Category deleted"}


# ============== L2 CATEGORY (SUBCATEGORY) ROUTES ==============

@router.post("/l2")
async def create_category_l2_direct(cat_data: CategoryL2Create, current_user: dict = Depends(require_roles(["Admin"]))):
    """Create a new L2 category (Admin only)"""
    # Verify L1 category exists
    l1_category = await db.categories_l1.find_one({"id": cat_data.category_l1_id, "active": True})
    if not l1_category:
        raise HTTPException(status_code=404, detail="Parent category not found")
    
    # Check for duplicate name under same L1
    existing = await db.categories_l2.find_one({
        "name": cat_data.name,
        "category_l1_id": cat_data.category_l1_id,
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
        "category_l1_id": cat_data.category_l1_id,
        "category_l1_name": l1_category["name"],
        "description": cat_data.description,
        "active": True,
        "created_at": get_utc_now()
    }
    
    await db.categories_l2.insert_one(subcategory)
    return {k: v for k, v in subcategory.items() if k != "_id"}


@router.get("/l2")
async def list_categories_l2(category_l1_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """List all L2 categories, optionally filtered by L1"""
    query = {"active": True}
    if category_l1_id:
        query["category_l1_id"] = category_l1_id
    
    subcategories = await db.categories_l2.find(query, {"_id": 0}).to_list(100)
    return subcategories


@router.patch("/l2/{category_id}")
async def update_category_l2_direct(category_id: str, cat_data: CategoryL2Update, current_user: dict = Depends(require_roles(["Admin"]))):
    """Update a L2 category (Admin only) - includes moving to different parent"""
    subcategory = await db.categories_l2.find_one({"id": category_id}, {"_id": 0})
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    
    update_dict = {k: v for k, v in cat_data.model_dump().items() if v is not None}
    
    # If changing parent category, validate new parent and update category_l1_name
    if "category_l1_id" in update_dict:
        new_parent = await db.categories_l1.find_one({"id": update_dict["category_l1_id"], "active": True}, {"_id": 0})
        if not new_parent:
            raise HTTPException(status_code=404, detail="New parent category not found")
        update_dict["category_l1_name"] = new_parent["name"]
    
    if update_dict:
        await db.categories_l2.update_one({"id": category_id}, {"$set": update_dict})
    
    updated = await db.categories_l2.find_one({"id": category_id}, {"_id": 0})
    return updated


@router.delete("/l2/{category_id}")
async def delete_category_l2_direct(category_id: str, current_user: dict = Depends(require_roles(["Admin"]))):
    """Soft delete a L2 category (Admin only)"""
    result = await db.categories_l2.update_one({"id": category_id}, {"$set": {"active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    return {"message": "Subcategory deleted"}


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



# ============== SERVICE CATALOG ENDPOINT ==============

class ServiceCatalogItem(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    turnaround: str
    included: bool
    popular: bool


@router.get("/catalog", response_model=List[ServiceCatalogItem])
async def get_service_catalog(current_user: dict = Depends(get_current_user)):
    """
    Get the browseable service catalog for clients.
    Returns 8 RRM launch services.
    """
    # RRM Launch Services - Hardcoded for MVP
    catalog = [
        {
            "id": "video-editing-60s",
            "name": "Video Editing (60s Reels)",
            "description": "Professional 60-second video editing for Instagram Reels, TikTok, and YouTube Shorts",
            "icon": "video",
            "turnaround": "3-5 days",
            "included": True,
            "popular": True
        },
        {
            "id": "short-form-stories",
            "name": "Short-Form Editing (Stories)",
            "description": "Instagram Stories and Snapchat content - quick edits optimized for vertical format",
            "icon": "video",
            "turnaround": "1-2 days",
            "included": True,
            "popular": True
        },
        {
            "id": "long-form-youtube",
            "name": "Long-Form Video (YouTube)",
            "description": "Complete YouTube video editing with intro, outro, b-roll, and transitions",
            "icon": "video",
            "turnaround": "5-7 days",
            "included": True,
            "popular": True
        },
        {
            "id": "thumbnail-design",
            "name": "Thumbnail Design",
            "description": "Eye-catching YouTube thumbnails and social media preview images",
            "icon": "image",
            "turnaround": "1-2 days",
            "included": True,
            "popular": False
        },
        {
            "id": "content-writing",
            "name": "Content Writing",
            "description": "Blog posts, captions, scripts, and web copy tailored to your brand voice",
            "icon": "content",
            "turnaround": "2-3 days",
            "included": True,
            "popular": False
        },
        {
            "id": "social-media-graphics",
            "name": "Social Media Graphics",
            "description": "Custom graphics for Instagram, Facebook, LinkedIn, and Twitter posts",
            "icon": "design",
            "turnaround": "2-4 days",
            "included": True,
            "popular": False
        },
        {
            "id": "email-campaigns",
            "name": "Email Campaigns",
            "description": "Email newsletter design and copywriting for audience engagement",
            "icon": "marketing",
            "turnaround": "2-3 days",
            "included": False,
            "popular": False
        },
        {
            "id": "website-updates",
            "name": "Website Updates",
            "description": "Minor website updates, content changes, and page edits",
            "icon": "web",
            "turnaround": "1-3 days",
            "included": False,
            "popular": False
        }
    ]
    
    return catalog

