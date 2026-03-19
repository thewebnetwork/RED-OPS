"""
Service Templates API - The canonical engine for client intake

GET  /service-templates          - Client-facing catalog (active + client_visible only)
GET  /service-templates/all      - Admin: all templates including inactive
GET  /service-templates/{id}     - Single template with full form schema
POST /service-templates          - Admin: create new template
PUT  /service-templates/{id}     - Admin: update template
DELETE /service-templates/{id}   - Admin: delete template
POST /service-templates/seed     - Admin: seed default service catalog
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import uuid

from database import db
from utils.auth import get_current_user, require_roles
from models.service_template import ServiceTemplateResponse
from pydantic import BaseModel

router = APIRouter(prefix="/service-templates", tags=["Service Templates"])


# ─── Pydantic Models ─────────────────────────────────────────────────────────

class ServiceTemplateCreate(BaseModel):
    name: str
    description: str
    icon: str
    default_title: str
    turnaround_text: str
    category: Optional[str] = None
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
    cta_url: Optional[str] = None
    cta_label: Optional[str] = None


class ServiceTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    default_title: Optional[str] = None
    turnaround_text: Optional[str] = None
    category: Optional[str] = None
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


# ─── Read Endpoints ──────────────────────────────────────────────────────────

@router.get("", response_model=List[ServiceTemplateResponse])
async def list_service_templates():
    """Client-facing catalog — active and visible templates only."""
    templates = await db.service_templates.find(
        {"active": True, "client_visible": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(None)
    return templates


@router.get("/all", response_model=List[ServiceTemplateResponse])
async def list_all_service_templates(
    current_user: dict = Depends(require_roles(["Administrator", "Account Manager", "Internal Staff"]))
):
    """Admin: all templates including inactive."""
    templates = await db.service_templates.find({}, {"_id": 0}).sort("sort_order", 1).to_list(None)
    return templates


@router.get("/{template_id}", response_model=ServiceTemplateResponse)
async def get_service_template(template_id: str):
    """Single template with full form schema."""
    template = await db.service_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Service template not found")
    return template


# ─── Write Endpoints ─────────────────────────────────────────────────────────

@router.post("", response_model=ServiceTemplateResponse)
async def create_service_template(
    template_data: ServiceTemplateCreate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Admin: create new service template."""
    template_id = str(uuid.uuid4())
    template = {
        "id": template_id,
        "name": template_data.name,
        "description": template_data.description,
        "category": template_data.category or template_data.hidden_category_l1,
        "icon": template_data.icon,
        "default_title": template_data.default_title,
        "turnaround_text": template_data.turnaround_text,
        "client_visible": template_data.client_visible,
        "active": template_data.active,
        "sort_order": template_data.sort_order,
        "deliverable_type": template_data.deliverable_type,
        "offer_track": template_data.offer_track,
        "flow_type": template_data.flow_type,
        "hidden_category_l1": template_data.hidden_category_l1 or template_data.category,
        "hidden_category_l2": template_data.hidden_category_l2,
        "form_schema": template_data.form_schema,
        "required_fields": template_data.required_fields,
        "default_task_templates": template_data.default_task_templates,
        "cta_url": template_data.cta_url,
        "cta_label": template_data.cta_label,
    }
    await db.service_templates.insert_one(template)
    return {k: v for k, v in template.items() if k != "_id"}


@router.put("/{template_id}", response_model=ServiceTemplateResponse)
async def update_service_template(
    template_id: str,
    update_data: ServiceTemplateUpdate,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Admin: update a service template."""
    template = await db.service_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Service template not found")

    updates = {k: v for k, v in update_data.dict().items() if v is not None}
    if updates:
        await db.service_templates.update_one({"id": template_id}, {"$set": updates})

    updated = await db.service_templates.find_one({"id": template_id}, {"_id": 0})
    return updated


@router.delete("/{template_id}")
async def delete_service_template(
    template_id: str,
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """Admin: delete a service template."""
    result = await db.service_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service template not found")
    return {"message": "Service template deleted"}


# ─── Seed Endpoint ────────────────────────────────────────────────────────────

@router.post("/seed", response_model=dict)
async def seed_service_templates(
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    """
    Admin: seed the default Red Ops service catalog.
    Upserts by name — safe to run multiple times.
    """
    services = [
        # ── Content Creation ─────────────────────────────────────────────────
        {
            "name": "Social Media Content",
            "category": "Content Creation",
            "icon": "📱",
            "description": "Engaging posts, captions, and graphics for your social media channels.",
            "default_title": "Social Media Content Package",
            "turnaround_text": "3–5 business days",
            "sort_order": 10,
            "form_schema": [
                {"field": "platforms", "label": "Platforms", "type": "select",
                 "options": ["Instagram", "Facebook", "TikTok", "LinkedIn", "Twitter/X", "All"],
                 "required": True},
                {"field": "post_count", "label": "Number of Posts", "type": "select",
                 "options": ["4 posts", "8 posts", "12 posts", "16 posts", "Custom"],
                 "required": True},
                {"field": "content_direction", "label": "Content Direction / Brief", "type": "textarea",
                 "required": True, "placeholder": "What do you want to promote or communicate?"},
                {"field": "brand_assets", "label": "Brand Assets (logo, colours, fonts)", "type": "file"},
            ],
            "required_fields": ["platforms", "post_count", "content_direction"],
        },
        {
            "name": "Short-Form Video (Reels / TikTok)",
            "category": "Content Creation",
            "icon": "🎬",
            "description": "Scroll-stopping short-form video content edited for Reels, TikTok, and Shorts.",
            "default_title": "Short-Form Video Package",
            "turnaround_text": "5–7 business days",
            "sort_order": 20,
            "form_schema": [
                {"field": "raw_footage", "label": "Do you have raw footage?", "type": "select",
                 "options": ["Yes, I will upload footage", "No, I need filming too"], "required": True},
                {"field": "video_count", "label": "Number of Videos", "type": "select",
                 "options": ["2 videos", "4 videos", "8 videos", "Custom"], "required": True},
                {"field": "style_reference", "label": "Style / Reference Links", "type": "textarea",
                 "placeholder": "Link to videos with the vibe you want"},
                {"field": "captions", "label": "Add Captions?", "type": "toggle"},
            ],
            "required_fields": ["raw_footage", "video_count"],
        },
        {
            "name": "Blog & Copywriting",
            "category": "Content Creation",
            "icon": "✍️",
            "description": "SEO-optimised blog posts, website copy, and long-form content that converts.",
            "default_title": "Blog & Copy Package",
            "turnaround_text": "3–5 business days",
            "sort_order": 30,
            "form_schema": [
                {"field": "content_type", "label": "Content Type", "type": "select",
                 "options": ["Blog Post", "Website Copy", "Email Copy", "Ad Copy", "Landing Page"],
                 "required": True},
                {"field": "word_count", "label": "Approximate Word Count", "type": "select",
                 "options": ["500 words", "1,000 words", "1,500 words", "2,000+ words"]},
                {"field": "topic", "label": "Topic / Brief", "type": "textarea", "required": True},
                {"field": "tone", "label": "Tone of Voice", "type": "select",
                 "options": ["Professional", "Conversational", "Bold", "Friendly", "Technical"]},
            ],
            "required_fields": ["content_type", "topic"],
        },
        {
            "name": "Email Newsletter",
            "category": "Content Creation",
            "icon": "📧",
            "description": "Professionally written and designed email newsletters that engage your list.",
            "default_title": "Email Newsletter",
            "turnaround_text": "3–4 business days",
            "sort_order": 40,
            "form_schema": [
                {"field": "email_platform", "label": "Email Platform", "type": "select",
                 "options": ["Mailchimp", "Klaviyo", "ActiveCampaign", "HubSpot", "Other"]},
                {"field": "subject_focus", "label": "Newsletter Topic / Focus", "type": "textarea",
                 "required": True},
                {"field": "list_size", "label": "Approximate List Size", "type": "text"},
            ],
            "required_fields": ["subject_focus"],
        },
        {
            "name": "Podcast Production",
            "category": "Content Creation",
            "icon": "🎙️",
            "description": "Full-service podcast editing, show notes, and audiogram creation.",
            "default_title": "Podcast Production",
            "turnaround_text": "3–5 business days",
            "sort_order": 50,
            "form_schema": [
                {"field": "episode_count", "label": "Number of Episodes", "type": "select",
                 "options": ["1 episode", "2 episodes", "4 episodes", "Monthly batch"]},
                {"field": "raw_audio", "label": "Raw Audio / File Upload Notes", "type": "textarea",
                 "required": True, "placeholder": "Describe how you will share raw files"},
                {"field": "deliverables", "label": "Deliverables Needed", "type": "select",
                 "options": ["Edit only", "Edit + Show Notes", "Edit + Audiogram", "Full Package"]},
            ],
            "required_fields": ["raw_audio"],
        },
        # ── Photography ──────────────────────────────────────────────────────
        {
            "name": "Brand Photography",
            "category": "Photography",
            "icon": "📸",
            "description": "Professional brand and headshot photography to elevate your visual identity.",
            "default_title": "Brand Photography Session",
            "turnaround_text": "5–7 business days after shoot",
            "sort_order": 60,
            "form_schema": [
                {"field": "shoot_type", "label": "Shoot Type", "type": "select",
                 "options": ["Headshots", "Team Photos", "Lifestyle Branding", "Product", "Mixed"],
                 "required": True},
                {"field": "location", "label": "Preferred Location", "type": "text",
                 "placeholder": "Studio, office, outdoor, etc.", "required": True},
                {"field": "shoot_date", "label": "Preferred Shoot Date", "type": "date"},
                {"field": "num_people", "label": "Number of People", "type": "text"},
                {"field": "style_inspo", "label": "Style / Inspiration References", "type": "textarea"},
            ],
            "required_fields": ["shoot_type", "location"],
        },
        {
            "name": "Product Photography",
            "category": "Photography",
            "icon": "🛍️",
            "description": "Clean, conversion-focused product photography for e-commerce and ads.",
            "default_title": "Product Photography Session",
            "turnaround_text": "5–7 business days after shoot",
            "sort_order": 70,
            "form_schema": [
                {"field": "product_count", "label": "Number of Products / SKUs", "type": "text",
                 "required": True},
                {"field": "background_style", "label": "Background Style", "type": "select",
                 "options": ["White/Clean", "Lifestyle", "Flat Lay", "Mixed"], "required": True},
                {"field": "usage", "label": "Where will images be used?", "type": "select",
                 "options": ["Website", "Amazon/E-commerce", "Social Media", "Ads", "All"],
                 "required": True},
                {"field": "shipping_info", "label": "Product Shipping / Drop-off Details", "type": "textarea"},
            ],
            "required_fields": ["product_count", "background_style", "usage"],
        },
        {
            "name": "Event Photography",
            "category": "Photography",
            "icon": "🎉",
            "description": "Professional coverage of corporate events, launches, and activations.",
            "default_title": "Event Photography Coverage",
            "turnaround_text": "5–7 business days after event",
            "sort_order": 80,
            "form_schema": [
                {"field": "event_name", "label": "Event Name", "type": "text", "required": True},
                {"field": "event_date", "label": "Event Date", "type": "date", "required": True},
                {"field": "event_location", "label": "Event Location / Address", "type": "text",
                 "required": True},
                {"field": "expected_duration", "label": "Event Duration", "type": "text",
                 "placeholder": "e.g. 3 hours"},
                {"field": "deliverable_count", "label": "Edited Images Needed", "type": "select",
                 "options": ["25 images", "50 images", "100 images", "Unlimited"]},
            ],
            "required_fields": ["event_name", "event_date", "event_location"],
        },
        # ── Videography ──────────────────────────────────────────────────────
        {
            "name": "Videography",
            "category": "Videography",
            "icon": "🎥",
            "description": "Cinematic brand videos, testimonials, and promo reels shot by our crew.",
            "default_title": "Videography Production",
            "turnaround_text": "7–14 business days after shoot",
            "sort_order": 90,
            "form_schema": [
                {"field": "video_type", "label": "Video Type", "type": "select",
                 "options": ["Brand Video", "Testimonial", "Promo / Ad", "Event Coverage",
                             "Product Demo", "Interview / Talking Head"],
                 "required": True},
                {"field": "shoot_date", "label": "Preferred Shoot Date", "type": "date"},
                {"field": "shoot_location", "label": "Shoot Location", "type": "text",
                 "required": True},
                {"field": "video_length", "label": "Target Video Length", "type": "select",
                 "options": ["15–30 sec", "30–60 sec", "1–2 min", "2–5 min", "5+ min"]},
                {"field": "script_needed", "label": "Do you need a script?", "type": "toggle"},
                {"field": "reference_videos", "label": "Reference / Inspiration Videos", "type": "textarea"},
            ],
            "required_fields": ["video_type", "shoot_location"],
        },
        {
            "name": "Drone Footage",
            "category": "Videography",
            "icon": "🚁",
            "description": "Aerial drone footage for real estate, events, and cinematic brand content.",
            "default_title": "Drone Footage Package",
            "turnaround_text": "5–7 business days after shoot",
            "sort_order": 100,
            "form_schema": [
                {"field": "location", "label": "Shoot Location / Address", "type": "text",
                 "required": True},
                {"field": "shoot_date", "label": "Preferred Date", "type": "date"},
                {"field": "use_case", "label": "Use Case", "type": "select",
                 "options": ["Real Estate", "Event", "Brand / Commercial", "Construction / Progress",
                             "Tourism", "Other"],
                 "required": True},
                {"field": "edit_required", "label": "Editing Required?", "type": "toggle"},
            ],
            "required_fields": ["location", "use_case"],
        },
        # ── Digital Marketing ─────────────────────────────────────────────────
        {
            "name": "Meta Ads Management",
            "category": "Digital Marketing",
            "icon": "📊",
            "description": "Done-for-you Facebook and Instagram ad campaigns that generate leads and sales.",
            "default_title": "Meta Ads Management",
            "turnaround_text": "Campaign live within 5 business days",
            "sort_order": 110,
            "form_schema": [
                {"field": "business_goal", "label": "Primary Goal", "type": "select",
                 "options": ["Lead Generation", "Sales / E-commerce", "Brand Awareness",
                             "App Installs", "Event Registrations"],
                 "required": True},
                {"field": "monthly_budget", "label": "Monthly Ad Spend Budget", "type": "text",
                 "required": True, "placeholder": "e.g. $1,500/month"},
                {"field": "target_audience", "label": "Target Audience Description", "type": "textarea",
                 "required": True},
                {"field": "landing_page", "label": "Landing Page / Website URL", "type": "text"},
                {"field": "existing_account", "label": "Existing Ad Account?", "type": "toggle"},
            ],
            "required_fields": ["business_goal", "monthly_budget", "target_audience"],
        },
        {
            "name": "Google Ads Management",
            "category": "Digital Marketing",
            "icon": "🔍",
            "description": "Search, Display, and YouTube ad campaigns managed to maximise your ROI.",
            "default_title": "Google Ads Management",
            "turnaround_text": "Campaign live within 5 business days",
            "sort_order": 120,
            "form_schema": [
                {"field": "campaign_type", "label": "Campaign Type", "type": "select",
                 "options": ["Search", "Display", "YouTube", "Shopping", "Full Mix"],
                 "required": True},
                {"field": "monthly_budget", "label": "Monthly Ad Spend Budget", "type": "text",
                 "required": True},
                {"field": "keywords", "label": "Target Keywords / Services", "type": "textarea"},
                {"field": "google_account", "label": "Existing Google Ads Account?", "type": "toggle"},
            ],
            "required_fields": ["campaign_type", "monthly_budget"],
        },
        {
            "name": "Social Media Management",
            "category": "Digital Marketing",
            "icon": "📲",
            "description": "Full account management: strategy, content, scheduling, and community engagement.",
            "default_title": "Social Media Management",
            "turnaround_text": "Onboarding within 3 business days",
            "sort_order": 130,
            "form_schema": [
                {"field": "platforms", "label": "Platforms", "type": "select",
                 "options": ["Instagram", "Facebook", "TikTok", "LinkedIn", "Twitter/X",
                             "Instagram + Facebook", "All Platforms"],
                 "required": True},
                {"field": "post_frequency", "label": "Post Frequency", "type": "select",
                 "options": ["3x/week", "5x/week", "Daily", "Custom"]},
                {"field": "engagement", "label": "Include Community Engagement?", "type": "toggle"},
                {"field": "current_following", "label": "Current Follower Count", "type": "text"},
            ],
            "required_fields": ["platforms"],
        },
        {
            "name": "SEO & Content Strategy",
            "category": "Digital Marketing",
            "icon": "🔎",
            "description": "Keyword research, on-page SEO, and a content strategy that ranks and converts.",
            "default_title": "SEO & Content Strategy",
            "turnaround_text": "Strategy delivered in 7–10 days",
            "sort_order": 140,
            "form_schema": [
                {"field": "website_url", "label": "Website URL", "type": "text", "required": True},
                {"field": "target_keywords", "label": "Target Keywords / Topics", "type": "textarea"},
                {"field": "competitors", "label": "Top 3 Competitors", "type": "textarea"},
                {"field": "deliverable", "label": "Primary Deliverable", "type": "select",
                 "options": ["SEO Audit", "Keyword Research", "Content Calendar",
                             "Full Strategy Package"]},
            ],
            "required_fields": ["website_url"],
        },
        # ── Design & Branding ─────────────────────────────────────────────────
        {
            "name": "Brand Identity & Logo",
            "category": "Design & Branding",
            "icon": "🎨",
            "description": "Full brand identity design including logo, colour palette, typography, and brand guide.",
            "default_title": "Brand Identity Package",
            "turnaround_text": "7–14 business days",
            "sort_order": 150,
            "form_schema": [
                {"field": "business_name", "label": "Business / Brand Name", "type": "text",
                 "required": True},
                {"field": "industry", "label": "Industry / Niche", "type": "text", "required": True},
                {"field": "brand_feel", "label": "Brand Feel / Personality", "type": "select",
                 "options": ["Modern & Minimal", "Bold & Energetic", "Luxury & Premium",
                             "Friendly & Playful", "Corporate & Professional", "Earthy & Natural"]},
                {"field": "colour_prefs", "label": "Colour Preferences", "type": "textarea"},
                {"field": "inspiration", "label": "Brand Inspiration / References", "type": "textarea"},
                {"field": "competitors", "label": "Competitor Examples", "type": "textarea"},
            ],
            "required_fields": ["business_name", "industry"],
        },
        {
            "name": "Graphic Design",
            "category": "Design & Branding",
            "icon": "🖼️",
            "description": "Custom graphics for social media, ads, presentations, and marketing collateral.",
            "default_title": "Graphic Design Package",
            "turnaround_text": "3–5 business days",
            "sort_order": 160,
            "form_schema": [
                {"field": "design_type", "label": "Design Type", "type": "select",
                 "options": ["Social Media Graphics", "Ad Creatives", "Presentation / Deck",
                             "Flyer / Poster", "Banner / Signage", "Mixed Pack"],
                 "required": True},
                {"field": "quantity", "label": "Number of Designs", "type": "text", "required": True},
                {"field": "brief", "label": "Design Brief", "type": "textarea", "required": True},
                {"field": "brand_assets", "label": "Brand Assets / Guidelines", "type": "file"},
            ],
            "required_fields": ["design_type", "quantity", "brief"],
        },
        {
            "name": "Website Design",
            "category": "Design & Branding",
            "icon": "💻",
            "description": "High-converting website design and development for your business.",
            "default_title": "Website Design Project",
            "turnaround_text": "14–21 business days",
            "sort_order": 170,
            "form_schema": [
                {"field": "website_type", "label": "Website Type", "type": "select",
                 "options": ["Landing Page", "5-Page Business Site", "E-commerce",
                             "Portfolio", "Full Custom"],
                 "required": True},
                {"field": "platform", "label": "Preferred Platform", "type": "select",
                 "options": ["WordPress", "Webflow", "Shopify", "Custom Code", "No Preference"]},
                {"field": "current_website", "label": "Current Website URL (if any)", "type": "text"},
                {"field": "goals", "label": "Primary Website Goal", "type": "textarea", "required": True},
                {"field": "inspiration_urls", "label": "Design Inspiration URLs", "type": "textarea"},
            ],
            "required_fields": ["website_type", "goals"],
        },
    ]

    inserted = 0
    updated = 0
    for svc in services:
        service_id = str(uuid.uuid4())
        doc = {
            "id": service_id,
            "client_visible": True,
            "active": True,
            "hidden_category_l1": svc.get("category"),
            "hidden_category_l2": None,
            "form_schema": svc.get("form_schema", []),
            "required_fields": svc.get("required_fields", []),
            "default_task_templates": [],
            "deliverable_type": None,
            "offer_track": None,
            "flow_type": None,
            "cta_url": None,
            "cta_label": None,
            **{k: v for k, v in svc.items() if k not in ("form_schema", "required_fields")},
        }
        existing = await db.service_templates.find_one({"name": svc["name"]})
        if existing:
            await db.service_templates.update_one(
                {"name": svc["name"]},
                {"$set": {k: v for k, v in doc.items() if k != "id"}}
            )
            updated += 1
        else:
            await db.service_templates.insert_one(doc)
            inserted += 1

    return {
        "message": f"Seed complete: {inserted} inserted, {updated} updated",
        "total": len(services)
    }
