"""Organization / Workspace Management

DEPRECATED under single-tenant-per-user architecture (2026-04-17).
Scheduled for removal in a separate pass.
See docs/audits/AUDIT_2026-04-16.md §4.2.1 decision log.

The foundational multi-tenant layer for Red Ops.
Every business that uses Red Ops gets an Organization.
All data is scoped to org_id.

Current model: Red Ops is FREE for all RRG clients. No public pricing tiers yet.
When a business signs with RRG (any pillar — RRM, RRP, etc.), they get a Red Ops
workspace included at no extra charge. Tier-based pricing may come later when
Red Ops goes public, but right now every client gets full access.

Organization Types:
  - platform: RRG internal (manages everything, super-admin across all orgs)
  - client:   A business served by RRG (gets their own workspace, full features)
  - partner:  An RRP partner (gets workspace + ability to sell services)

Org-Level Roles:
  - owner:   Created the org or was assigned ownership. Full control.
  - admin:   Can manage members, settings. Cannot delete org or transfer ownership.
  - manager: Can manage projects, tasks, orders within the org. Cannot manage members.
  - member:  Standard access. Can use features within their assigned scope.
  - viewer:  Read-only access to org data.
"""

import uuid
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict

from database import db
from utils.auth import get_current_user, require_admin
from utils.helpers import get_utc_now

router = APIRouter(prefix="/organizations", tags=["Organizations"])


# ============== CONSTANTS ==============

ORG_TYPES = ["platform", "client", "partner"]

ORG_ROLES = ["owner", "admin", "manager", "member", "viewer"]

# All clients get full access — Red Ops is included free with every RRG engagement.
# Org type determines context (platform = RRG internal, client = served business, partner = RRP).
# When public pricing tiers are introduced later, this is where gating logic lives.
ORG_TYPE_CONFIG = {
    "platform": {
        "label": "RRG Platform",
        "max_members": -1,  # unlimited
        "max_projects": -1,
        "max_storage_mb": -1,
        "can_order_services": True,
        "can_sell_services": True,
        "can_manage_all_orgs": True,  # super-admin across the platform
        "modules": ["*"],
    },
    "client": {
        "label": "Client Workspace",
        "max_members": 25,  # generous default, adjustable per org
        "max_projects": -1,  # unlimited
        "max_storage_mb": 10000,
        "can_order_services": True,
        "can_sell_services": False,
        "can_manage_all_orgs": False,
        "modules": ["dashboard", "orders", "projects", "tasks", "knowledge_base",
                     "invoicing", "analytics", "reports", "team", "settings"],
    },
    "partner": {
        "label": "Partner Workspace",
        "max_members": 50,
        "max_projects": -1,
        "max_storage_mb": 50000,
        "can_order_services": True,
        "can_sell_services": True,  # partners can sell services through platform
        "can_manage_all_orgs": False,
        "modules": ["dashboard", "orders", "projects", "tasks", "knowledge_base",
                     "invoicing", "analytics", "reports", "team", "settings",
                     "marketplace_sell"],
    },
}

# Default org-level permissions by org role
ORG_ROLE_PERMISSIONS = {
    "owner": {
        "manage_members": True,
        "manage_settings": True,
        "manage_billing": True,
        "manage_projects": True,
        "manage_tasks": True,
        "manage_orders": True,
        "manage_knowledge_base": True,
        "manage_invoices": True,
        "view_analytics": True,
        "manage_integrations": True,
        "transfer_ownership": True,
        "delete_org": True,
    },
    "admin": {
        "manage_members": True,
        "manage_settings": True,
        "manage_billing": True,
        "manage_projects": True,
        "manage_tasks": True,
        "manage_orders": True,
        "manage_knowledge_base": True,
        "manage_invoices": True,
        "view_analytics": True,
        "manage_integrations": True,
        "transfer_ownership": False,
        "delete_org": False,
    },
    "manager": {
        "manage_members": False,
        "manage_settings": False,
        "manage_billing": False,
        "manage_projects": True,
        "manage_tasks": True,
        "manage_orders": True,
        "manage_knowledge_base": True,
        "manage_invoices": True,
        "view_analytics": True,
        "manage_integrations": False,
        "transfer_ownership": False,
        "delete_org": False,
    },
    "member": {
        "manage_members": False,
        "manage_settings": False,
        "manage_billing": False,
        "manage_projects": False,
        "manage_tasks": True,
        "manage_orders": True,
        "manage_knowledge_base": False,
        "manage_invoices": False,
        "view_analytics": False,
        "manage_integrations": False,
        "transfer_ownership": False,
        "delete_org": False,
    },
    "viewer": {
        "manage_members": False,
        "manage_settings": False,
        "manage_billing": False,
        "manage_projects": False,
        "manage_tasks": False,
        "manage_orders": False,
        "manage_knowledge_base": False,
        "manage_invoices": False,
        "view_analytics": False,
        "manage_integrations": False,
        "transfer_ownership": False,
        "delete_org": False,
    },
}


# ============== REQUEST MODELS ==============

class OrgCreate(BaseModel):
    name: str
    slug: Optional[str] = None  # URL-friendly name, auto-generated if not provided
    org_type: str = "client"  # platform, client, or partner
    industry: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    org_type: Optional[str] = None  # Only platform admins can change this
    industry: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None
    settings: Optional[Dict] = None


class InviteMember(BaseModel):
    email: EmailStr
    org_role: str = "member"  # owner, admin, manager, member, viewer
    name: Optional[str] = None  # Pre-fill name for the invite


class UpdateMemberRole(BaseModel):
    org_role: str  # The new role


class TransferOwnership(BaseModel):
    new_owner_user_id: str


# ============== HELPER FUNCTIONS ==============

def generate_slug(name: str) -> str:
    """Generate URL-friendly slug from org name"""
    import re
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug[:50]  # Max 50 chars


async def get_org_membership(user_id: str, org_id: str) -> Optional[dict]:
    """Get user's membership in an org"""
    return await db.org_members.find_one(
        {"user_id": user_id, "org_id": org_id, "active": True},
        {"_id": 0}
    )


async def require_org_role(user_id: str, org_id: str, min_roles: List[str]):
    """Check if user has one of the required org roles"""
    membership = await get_org_membership(user_id, org_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    if membership["org_role"] not in min_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Requires one of: {', '.join(min_roles)}. You have: {membership['org_role']}"
        )
    return membership


def get_org_config(org_type: str) -> dict:
    """Get feature config for an org type"""
    return ORG_TYPE_CONFIG.get(org_type, ORG_TYPE_CONFIG["client"])


# ============== ORG CRUD ==============

@router.post("")
async def create_organization(data: OrgCreate, user: dict = Depends(get_current_user)):
    """Create a new organization. The creating user becomes the owner."""

    if data.org_type not in ORG_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid org_type. Must be one of: {', '.join(ORG_TYPES)}")

    # Only platform admins can create platform-type orgs
    if data.org_type == "platform" and user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Only platform administrators can create platform organizations")

    # Generate slug
    slug = data.slug or generate_slug(data.name)

    # Check slug uniqueness
    existing = await db.organizations.find_one({"slug": slug})
    if existing:
        slug = f"{slug}-{secrets.token_hex(3)}"

    org_id = str(uuid.uuid4())
    now = get_utc_now()

    org = {
        "id": org_id,
        "name": data.name,
        "slug": slug,
        "org_type": data.org_type,
        "industry": data.industry,
        "website": data.website,
        "logo_url": data.logo_url,
        "description": data.description,
        "owner_user_id": user["id"],
        "active": True,
        "settings": {
            "timezone": "America/Edmonton",
            "date_format": "YYYY-MM-DD",
            "currency": "CAD",
            "notifications_enabled": True,
            "branding": {
                "primary_color": "#c92a3e",
                "logo_url": data.logo_url,
            }
        },
        "member_count": 1,
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
    }

    await db.organizations.insert_one(org)

    # Add creator as owner member
    membership = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "user_id": user["id"],
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "org_role": "owner",
        "permissions": ORG_ROLE_PERMISSIONS["owner"],
        "active": True,
        "joined_at": now,
        "invited_by": None,
    }

    await db.org_members.insert_one(membership)

    # Update user record with org_id (primary org)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"primary_org_id": org_id}, "$addToSet": {"org_ids": org_id}}
    )

    # Remove _id for response
    org.pop("_id", None)
    org["config"] = get_org_config(data.org_type)

    return org


@router.get("")
async def list_organizations(user: dict = Depends(get_current_user)):
    """List all organizations the current user belongs to."""

    # Platform admins can see all orgs
    if user.get("role") == "Administrator":
        show_all = True
    else:
        show_all = False

    if show_all:
        cursor = db.organizations.find({"active": True}, {"_id": 0})
        orgs = await cursor.to_list(500)
    else:
        # Get user's org memberships
        memberships = await db.org_members.find(
            {"user_id": user["id"], "active": True},
            {"_id": 0}
        ).to_list(100)

        org_ids = [m["org_id"] for m in memberships]
        if not org_ids:
            return []

        cursor = db.organizations.find(
            {"id": {"$in": org_ids}, "active": True},
            {"_id": 0}
        )
        orgs = await cursor.to_list(100)

        # Attach user's role in each org
        role_map = {m["org_id"]: m["org_role"] for m in memberships}
        for org in orgs:
            org["my_role"] = role_map.get(org["id"], "member")
            org["config"] = get_org_config(org.get("org_type", "client"))

    return orgs


@router.get("/types")
async def list_org_types():
    """List all available org types and their config."""
    return {
        "types": ORG_TYPES,
        "config": ORG_TYPE_CONFIG,
    }


@router.get("/{org_id}")
async def get_organization(org_id: str, user: dict = Depends(get_current_user)):
    """Get a single organization with full details."""

    org = await db.organizations.find_one({"id": org_id, "active": True}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Check access (must be member or platform admin)
    if user.get("role") != "Administrator":
        membership = await get_org_membership(user["id"], org_id)
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        org["my_role"] = membership["org_role"]
        org["my_permissions"] = membership.get("permissions", ORG_ROLE_PERMISSIONS.get(membership["org_role"], {}))
    else:
        org["my_role"] = "owner"  # Platform admins have full access
        org["my_permissions"] = ORG_ROLE_PERMISSIONS["owner"]

    org["config"] = get_org_config(org.get("org_type", "client"))

    # Get member count
    member_count = await db.org_members.count_documents({"org_id": org_id, "active": True})
    org["member_count"] = member_count

    return org


@router.patch("/{org_id}")
async def update_organization(org_id: str, data: OrgUpdate, user: dict = Depends(get_current_user)):
    """Update organization details. Requires admin+ role in the org."""

    # Platform admins can update any org, including tier changes
    is_platform_admin = user.get("role") == "Administrator"

    if not is_platform_admin:
        await require_org_role(user["id"], org_id, ["owner", "admin"])

    updates = {}

    if data.name is not None:
        updates["name"] = data.name
    if data.slug is not None:
        # Check slug uniqueness
        existing = await db.organizations.find_one({"slug": data.slug, "id": {"$ne": org_id}})
        if existing:
            raise HTTPException(status_code=409, detail="Slug already in use")
        updates["slug"] = data.slug
    if data.org_type is not None:
        # Only platform admins can change org type
        if not is_platform_admin:
            raise HTTPException(status_code=403, detail="Only platform administrators can change organization type")
        if data.org_type not in ORG_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid org_type: {data.org_type}")
        updates["org_type"] = data.org_type
    if data.industry is not None:
        updates["industry"] = data.industry
    if data.website is not None:
        updates["website"] = data.website
    if data.logo_url is not None:
        updates["logo_url"] = data.logo_url
    if data.description is not None:
        updates["description"] = data.description
    if data.active is not None and is_platform_admin:
        updates["active"] = data.active
    if data.settings is not None:
        updates["settings"] = data.settings

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates["updated_at"] = get_utc_now()

    result = await db.organizations.update_one({"id": org_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Organization not found")

    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    org["config"] = get_org_config(org.get("org_type", "client"))
    return org


# ============== MEMBER MANAGEMENT ==============

@router.get("/{org_id}/members")
async def list_members(org_id: str, user: dict = Depends(get_current_user)):
    """List all members of an organization."""

    # Verify access
    if user.get("role") != "Administrator":
        await get_org_membership(user["id"], org_id)  # Throws 403 if not member

    members = await db.org_members.find(
        {"org_id": org_id, "active": True},
        {"_id": 0}
    ).to_list(500)

    # Enrich with user details
    user_ids = [m["user_id"] for m in members if m.get("user_id")]
    if user_ids:
        users = await db.users.find(
            {"id": {"$in": user_ids}},
            {"_id": 0, "password": 0, "otp_secret": 0, "trusted_devices": 0}
        ).to_list(500)
        user_map = {u["id"]: u for u in users}

        for m in members:
            u = user_map.get(m.get("user_id"))
            if u:
                m["user_name"] = u.get("name", "")
                m["user_email"] = u.get("email", "")
                m["user_avatar"] = u.get("avatar")
                m["user_active"] = u.get("active", True)

    # Also get pending invites
    invites = await db.org_invites.find(
        {"org_id": org_id, "status": "pending"},
        {"_id": 0}
    ).to_list(100)

    return {
        "members": members,
        "pending_invites": invites,
        "total": len(members),
        "pending_count": len(invites),
    }


@router.post("/{org_id}/invite")
async def invite_member(org_id: str, data: InviteMember, user: dict = Depends(get_current_user)):
    """Invite a user to the organization by email."""

    if data.org_role not in ORG_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(ORG_ROLES)}")

    if data.org_role == "owner":
        raise HTTPException(status_code=400, detail="Cannot invite as owner. Use transfer ownership instead.")

    # Check inviter has permission
    is_platform_admin = user.get("role") == "Administrator"
    if not is_platform_admin:
        await require_org_role(user["id"], org_id, ["owner", "admin"])

    # Check org exists and get tier
    org = await db.organizations.find_one({"id": org_id, "active": True})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Check member limit
    org_config = get_org_config(org.get("org_type", "client"))
    max_members = org_config["max_members"]
    if max_members != -1:
        current_count = await db.org_members.count_documents({"org_id": org_id, "active": True})
        pending_count = await db.org_invites.count_documents({"org_id": org_id, "status": "pending"})
        if (current_count + pending_count) >= max_members:
            raise HTTPException(
                status_code=403,
                detail=f"Member limit reached ({max_members}). Contact RRG to increase your limit."
            )

    # Check if already a member
    existing_user = await db.users.find_one({"email": data.email.lower()})
    if existing_user:
        existing_membership = await db.org_members.find_one({
            "org_id": org_id,
            "user_id": existing_user["id"],
            "active": True
        })
        if existing_membership:
            raise HTTPException(status_code=409, detail="User is already a member of this organization")

    # Check for pending invite
    existing_invite = await db.org_invites.find_one({
        "org_id": org_id,
        "email": data.email.lower(),
        "status": "pending"
    })
    if existing_invite:
        raise HTTPException(status_code=409, detail="An invite is already pending for this email")

    now = get_utc_now()
    invite_token = secrets.token_urlsafe(32)

    invite = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "org_name": org.get("name", ""),
        "email": data.email.lower(),
        "name": data.name,
        "org_role": data.org_role,
        "invited_by": user["id"],
        "invited_by_name": user.get("name", ""),
        "token": invite_token,
        "status": "pending",  # pending, accepted, expired, revoked
        "created_at": now,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    }

    await db.org_invites.insert_one(invite)

    # TODO: Send invite email with link containing token
    # For now, return the token so the frontend can show a share link

    invite.pop("_id", None)
    return invite


@router.post("/{org_id}/invite/{invite_id}/accept")
async def accept_invite(org_id: str, invite_id: str, user: dict = Depends(get_current_user)):
    """Accept an organization invite. The current user joins the org."""

    invite = await db.org_invites.find_one({
        "id": invite_id,
        "org_id": org_id,
        "status": "pending"
    })

    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or already used")

    # Verify the invite is for this user's email
    if invite["email"] != user.get("email", "").lower():
        raise HTTPException(status_code=403, detail="This invite is for a different email address")

    # Check if expired
    if invite.get("expires_at"):
        expires = datetime.fromisoformat(invite["expires_at"])
        if datetime.now(timezone.utc) > expires:
            await db.org_invites.update_one({"id": invite_id}, {"$set": {"status": "expired"}})
            raise HTTPException(status_code=410, detail="Invite has expired")

    now = get_utc_now()

    # Create membership
    membership = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "user_id": user["id"],
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "org_role": invite["org_role"],
        "permissions": ORG_ROLE_PERMISSIONS.get(invite["org_role"], ORG_ROLE_PERMISSIONS["member"]),
        "active": True,
        "joined_at": now,
        "invited_by": invite.get("invited_by"),
    }

    await db.org_members.insert_one(membership)

    # Mark invite as accepted
    await db.org_invites.update_one(
        {"id": invite_id},
        {"$set": {"status": "accepted", "accepted_at": now, "accepted_by": user["id"]}}
    )

    # Update user record
    await db.users.update_one(
        {"id": user["id"]},
        {"$addToSet": {"org_ids": org_id}}
    )

    # If user doesn't have a primary org, set this one
    if not user.get("primary_org_id"):
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"primary_org_id": org_id}}
        )

    # Update member count
    count = await db.org_members.count_documents({"org_id": org_id, "active": True})
    await db.organizations.update_one({"id": org_id}, {"$set": {"member_count": count}})

    membership.pop("_id", None)
    return membership


@router.post("/{org_id}/invite/{invite_id}/revoke")
async def revoke_invite(org_id: str, invite_id: str, user: dict = Depends(get_current_user)):
    """Revoke a pending invite."""

    is_platform_admin = user.get("role") == "Administrator"
    if not is_platform_admin:
        await require_org_role(user["id"], org_id, ["owner", "admin"])

    result = await db.org_invites.update_one(
        {"id": invite_id, "org_id": org_id, "status": "pending"},
        {"$set": {"status": "revoked", "revoked_at": get_utc_now(), "revoked_by": user["id"]}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invite not found or not pending")

    return {"message": "Invite revoked"}


@router.patch("/{org_id}/members/{member_user_id}")
async def update_member_role(
    org_id: str,
    member_user_id: str,
    data: UpdateMemberRole,
    user: dict = Depends(get_current_user)
):
    """Update a member's role within the organization."""

    if data.org_role not in ORG_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.org_role}")

    if data.org_role == "owner":
        raise HTTPException(status_code=400, detail="Use transfer ownership endpoint instead")

    is_platform_admin = user.get("role") == "Administrator"
    if not is_platform_admin:
        membership = await require_org_role(user["id"], org_id, ["owner", "admin"])

        # Admins can't change owner's role
        target_membership = await get_org_membership(member_user_id, org_id)
        if target_membership and target_membership["org_role"] == "owner":
            raise HTTPException(status_code=403, detail="Cannot change the owner's role")

        # Admins can't promote to admin (only owner can)
        if data.org_role == "admin" and membership["org_role"] != "owner":
            raise HTTPException(status_code=403, detail="Only the owner can promote to admin")

    new_permissions = ORG_ROLE_PERMISSIONS.get(data.org_role, ORG_ROLE_PERMISSIONS["member"])

    result = await db.org_members.update_one(
        {"org_id": org_id, "user_id": member_user_id, "active": True},
        {"$set": {
            "org_role": data.org_role,
            "permissions": new_permissions,
            "updated_at": get_utc_now(),
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Member not found in this organization")

    return {"message": f"Role updated to {data.org_role}", "org_role": data.org_role}


@router.delete("/{org_id}/members/{member_user_id}")
async def remove_member(org_id: str, member_user_id: str, user: dict = Depends(get_current_user)):
    """Remove a member from the organization."""

    is_platform_admin = user.get("role") == "Administrator"

    if not is_platform_admin:
        await require_org_role(user["id"], org_id, ["owner", "admin"])

    # Can't remove the owner
    target = await get_org_membership(member_user_id, org_id)
    if target and target["org_role"] == "owner":
        raise HTTPException(status_code=403, detail="Cannot remove the organization owner")

    result = await db.org_members.update_one(
        {"org_id": org_id, "user_id": member_user_id, "active": True},
        {"$set": {"active": False, "removed_at": get_utc_now(), "removed_by": user["id"]}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")

    # Remove org from user's org list
    await db.users.update_one(
        {"id": member_user_id},
        {"$pull": {"org_ids": org_id}}
    )

    # If this was their primary org, clear it
    member_user = await db.users.find_one({"id": member_user_id})
    if member_user and member_user.get("primary_org_id") == org_id:
        # Set next org as primary, or None
        remaining = member_user.get("org_ids", [])
        new_primary = remaining[0] if remaining else None
        await db.users.update_one(
            {"id": member_user_id},
            {"$set": {"primary_org_id": new_primary}}
        )

    # Update count
    count = await db.org_members.count_documents({"org_id": org_id, "active": True})
    await db.organizations.update_one({"id": org_id}, {"$set": {"member_count": count}})

    return {"message": "Member removed"}


@router.post("/{org_id}/transfer-ownership")
async def transfer_ownership(org_id: str, data: TransferOwnership, user: dict = Depends(get_current_user)):
    """Transfer organization ownership to another member."""

    is_platform_admin = user.get("role") == "Administrator"
    if not is_platform_admin:
        await require_org_role(user["id"], org_id, ["owner"])

    # Verify new owner is a member
    new_owner_membership = await get_org_membership(data.new_owner_user_id, org_id)
    if not new_owner_membership:
        raise HTTPException(status_code=404, detail="Target user is not a member of this organization")

    now = get_utc_now()

    # Demote current owner to admin
    await db.org_members.update_one(
        {"org_id": org_id, "user_id": user["id"], "active": True},
        {"$set": {
            "org_role": "admin",
            "permissions": ORG_ROLE_PERMISSIONS["admin"],
            "updated_at": now,
        }}
    )

    # Promote new owner
    await db.org_members.update_one(
        {"org_id": org_id, "user_id": data.new_owner_user_id, "active": True},
        {"$set": {
            "org_role": "owner",
            "permissions": ORG_ROLE_PERMISSIONS["owner"],
            "updated_at": now,
        }}
    )

    # Update org record
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"owner_user_id": data.new_owner_user_id, "updated_at": now}}
    )

    return {"message": "Ownership transferred", "new_owner_id": data.new_owner_user_id}


# ============== MY ORGANIZATIONS ==============

@router.get("/me/current")
async def get_current_org(user: dict = Depends(get_current_user)):
    """Get the user's current/primary organization with full context."""

    primary_org_id = user.get("primary_org_id")
    if not primary_org_id:
        return {"org": None, "membership": None, "message": "No organization set"}

    org = await db.organizations.find_one({"id": primary_org_id, "active": True}, {"_id": 0})
    if not org:
        return {"org": None, "membership": None, "message": "Organization not found"}

    membership = await get_org_membership(user["id"], primary_org_id)

    org["config"] = get_org_config(org.get("org_type", "client"))

    return {
        "org": org,
        "membership": membership,
        "config": org["config"],
    }


@router.post("/me/switch/{org_id}")
async def switch_org(org_id: str, user: dict = Depends(get_current_user)):
    """Switch the user's active organization."""

    # Verify membership
    membership = await get_org_membership(user["id"], org_id)
    if not membership and user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"primary_org_id": org_id}}
    )

    org = await db.organizations.find_one({"id": org_id, "active": True}, {"_id": 0})
    if org:
        org["config"] = get_org_config(org.get("org_type", "client"))

    return {"org": org, "membership": membership}


# ============== FEATURE GATING ==============

@router.get("/{org_id}/features")
async def get_org_features(org_id: str, user: dict = Depends(get_current_user)):
    """Get the feature config for an organization based on its type."""

    org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "org_type": 1, "id": 1})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org_type = org.get("org_type", "client")
    config = get_org_config(org_type)

    return {
        "org_id": org_id,
        "org_type": org_type,
        "config": config,
    }


# ============== INVITE BY TOKEN (for unauthenticated accept) ==============

@router.get("/invite/verify/{token}")
async def verify_invite_token(token: str):
    """Verify an invite token and return invite details (public endpoint)."""

    invite = await db.org_invites.find_one(
        {"token": token, "status": "pending"},
        {"_id": 0, "token": 0}  # Don't return token in response
    )

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired invite")

    # Check expiry
    if invite.get("expires_at"):
        expires = datetime.fromisoformat(invite["expires_at"])
        if datetime.now(timezone.utc) > expires:
            await db.org_invites.update_one({"id": invite["id"]}, {"$set": {"status": "expired"}})
            raise HTTPException(status_code=410, detail="Invite has expired")

    return invite
