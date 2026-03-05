"""
Service Templates API - The canonical engine for client intake

GET /service-templates          - Client-facing catalog (active + client_visible only)
GET /service-templates/all      - Admin: all templates including inactive
GET /service-templates/{id}     - Single template with full form schema
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List

from database import db
from utils.auth import get_current_user, require_roles
from models.service_template import ServiceTemplateResponse

router = APIRouter(prefix="/service-templates", tags=["Service Templates"])


@router.get("", response_model=List[ServiceTemplateResponse])
async def list_service_templates(current_user: dict = Depends(get_current_user)):
    """Get all active, client-visible service templates for the catalog"""
    templates = await db.service_templates.find(
        {"active": True, "client_visible": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(100)
    return templates


@router.get("/all", response_model=List[ServiceTemplateResponse])
async def list_all_service_templates(
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Admin: Get all service templates including inactive"""
    templates = await db.service_templates.find(
        {}, {"_id": 0}
    ).sort("sort_order", 1).to_list(100)
    return templates


@router.get("/{template_id}", response_model=ServiceTemplateResponse)
async def get_service_template(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single service template with full form schema"""
    template = await db.service_templates.find_one(
        {"id": template_id}, {"_id": 0}
    )
    if not template:
        raise HTTPException(status_code=404, detail="Service template not found")
    return template
