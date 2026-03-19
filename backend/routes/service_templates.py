"""
Service Templates API - The canonical engine for client intake

GET  /service-templates          - Client-facing catalog (active + client_visible only)
GET  /service-templates/all      - Admin: all templates including inactive
GET  /service-templates/{id}     - Single template with full form schema
POST /service-templates          - Admin: create new template
PUT  /service-templates/{id}     - Admin: update template
DELETE /service-templates/{id}   - Admin: delete template
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import uuid

from database import db
from utils.auth import get_current_user, require_roles
from models.service_template import ServiceTemplateResponse
from pydantic import BaseModel

router = APIRouter(prefix="/service-templates", tags=["Service Templates"])


# ─── Read Endpoints ──────────────────────────────────────────────────────────

@router.get("", response_model=List[ServiceTemplateResponse])
async def list_service_templates(current_user: dict = Depends(get_current_user)):
    """Get all active, client-visible service templates for the catalog"""
    templates = await db.service_templates.find(
        {"active": True, "client_visible": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(100)
    return templates


@router.get("/all", response_model=List[ServiceTemplateResponse])
async def list_all_service_templates(current_user: dict = Depends(require_roles(["Admin"]))):
    """Admin: get all templates including inactive"""
    templates = await db.service_templates.find(
        {}, {"_id": 0}
    ).sort("sort_order", 1).to_list(200)
    return templates


@router.get("/{template_id}", response_model=ServiceTemplateResponse)
async def get_service_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Get single template with full form schema"""
    template = await db.service_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


# ─── Write Endpoints (Admin Only) ────────────────────────────────────────────

class ServiceTemplateCreate(BaseModel):
    name: str
    description: str
    icon: str = "star"
    default_title: str
    turnaround_text: str = "3-5 business days"
    client_visible: bool = True
    active: bool = True
    sort_order: int = 0
    deliverable_type: Optional[str] = None
    offer_track: Optional[str] = None
    flow_type: Optional[str] = None
    hidden_category_l1: Optional[str] = None
    hidden_category_l2: Optional[str] = None
    form_schema: list = []
    required_fields: list = []
    default_task_templates: list = []


class ServiceTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    default_title: Optional[str] = None
    turnaround_text: Optional[str] = None
    client_visible: Optional[bool] = None
    active: Optional[bool] = None
    sort_order: Optional[int] = None
    deliverable_type: Optional[str] = None
    offer_track: Optional[str] = None
    flow_type: Optional[str] = None
    hidden_category_l1: Optional[str] = None
    hidden_category_l2: Optional[str] = None
    form_schema: Optional[list] = None
    required_fields: Optional[list] = None
    default_task_templates: Optional[list] = None


@router.post("", response_model=ServiceTemplateResponse)
async def create_service_template(
    template_data: ServiceTemplateCreate,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Admin: create a new service template"""
    template_dict = template_data.model_dump()
    template_dict["id"] = str(uuid.uuid4())
    await db.service_templates.insert_one(template_dict)
    return {k: v for k, v in template_dict.items() if k != "_id"}


@router.put("/{template_id}", response_model=ServiceTemplateResponse)
async def update_service_template(
    template_id: str,
    template_data: ServiceTemplateUpdate,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Admin: update a service template"""
    existing = await db.service_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    update_dict = {k: v for k, v in template_data.model_dump().items() if v is not None}
    if update_dict:
        await db.service_templates.update_one({"id": template_id}, {"$set": update_dict})
    updated = await db.service_templates.find_one({"id": template_id}, {"_id": 0})
    return updated


@router.delete("/{template_id}")
async def delete_service_template(
    template_id: str,
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Admin: delete a service template"""
    result = await db.service_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted successfully"}
