"""
Migration script: Convert old profession-based roles to new identity model

This script:
1. Creates the 3 system roles (Administrator, Privileged User, Standard User)
2. Migrates profession-based roles to Specialties
3. Updates users with new role + specialty assignments
4. Creates default Access Tiers
"""
import asyncio
import uuid
from datetime import datetime, timezone

# This will be run via a route endpoint

PROFESSION_ROLES = [
    "Video Editor", "Photographer", "Videographer", "Drone Operator",
    "Motion Graphics", "Color Grader", "Sound Engineer", "Animator",
    "Graphic Designer", "3D Artist", "VFX Artist", "Audio Editor",
    "Transcriber", "Subtitler", "Thumbnail Creator", "Social Media Manager",
    "Content Writer", "Podcast Editor", "Live Stream Operator", "Camera Operator",
    "Lighting Technician", "Makeup Artist", "Stylist", "Set Designer",
    "Production Assistant", "Project Manager", "Quality Assurance", "Editor",
    "Requester"
]

DEFAULT_ACCESS_TIERS = [
    {"name": "Free", "description": "Free tier - basic access", "sort_order": 1},
    {"name": "Starter", "description": "Starter tier - individual users", "sort_order": 2},
    {"name": "Growth", "description": "Growth tier - small teams", "sort_order": 3},
    {"name": "Scale", "description": "Scale tier - larger organizations", "sort_order": 4},
    {"name": "Partner", "description": "Partner tier - strategic partners", "sort_order": 5},
]


def get_utc_now():
    return datetime.now(timezone.utc).isoformat()


async def run_migration(db):
    """Run the full migration"""
    results = {
        "roles_created": 0,
        "specialties_created": 0,
        "access_tiers_created": 0,
        "users_migrated": 0,
        "errors": []
    }
    
    # 1. Create system roles if they don't exist
    from models.identity import DEFAULT_PERMISSIONS
    
    system_roles = [
        {
            "name": "Administrator",
            "display_name": "Administrator",
            "description": "Full platform control"
        },
        {
            "name": "Privileged User",
            "display_name": "Privileged User",
            "description": "Manager level access"
        },
        {
            "name": "Standard User",
            "display_name": "Standard User",
            "description": "Basic user access"
        }
    ]
    
    for role_data in system_roles:
        existing = await db.roles.find_one({"name": role_data["name"]})
        if not existing:
            role = {
                "id": str(uuid.uuid4()),
                "name": role_data["name"],
                "display_name": role_data["display_name"],
                "description": role_data["description"],
                "permissions": DEFAULT_PERMISSIONS.get(role_data["name"], {}),
                "is_system": True,
                "active": True,
                "created_at": get_utc_now()
            }
            await db.roles.insert_one(role)
            results["roles_created"] += 1
    
    # 2. Create specialties from profession roles
    for profession in PROFESSION_ROLES:
        existing = await db.specialties.find_one({"name": profession})
        if not existing:
            specialty = {
                "id": str(uuid.uuid4()),
                "name": profession,
                "description": f"{profession} specialty",
                "active": True,
                "created_at": get_utc_now()
            }
            await db.specialties.insert_one(specialty)
            results["specialties_created"] += 1
    
    # 3. Create default access tiers
    for tier_data in DEFAULT_ACCESS_TIERS:
        existing = await db.access_tiers.find_one({"name": tier_data["name"]})
        if not existing:
            tier = {
                "id": str(uuid.uuid4()),
                "name": tier_data["name"],
                "description": tier_data["description"],
                "sort_order": tier_data["sort_order"],
                "active": True,
                "created_at": get_utc_now()
            }
            await db.access_tiers.insert_one(tier)
            results["access_tiers_created"] += 1
    
    # 4. Migrate users
    users = await db.users.find({}, {"_id": 0}).to_list(10000)
    
    # Get the Starter tier for default assignment
    starter_tier = await db.access_tiers.find_one({"name": "Starter"}, {"_id": 0})
    starter_tier_id = starter_tier["id"] if starter_tier else None
    
    for user in users:
        try:
            old_role = user.get("role", "")
            update_data = {}
            
            # Map old role to new role
            if old_role == "Admin":
                update_data["role"] = "Administrator"
            elif old_role in PROFESSION_ROLES:
                # This was a profession, map to Standard User + Specialty
                update_data["role"] = "Standard User"
                
                # Find the specialty
                specialty = await db.specialties.find_one({"name": old_role}, {"_id": 0})
                if specialty:
                    update_data["specialty_id"] = specialty["id"]
                    update_data["specialty_name"] = specialty["name"]
            elif old_role in ["Administrator", "Privileged User", "Standard User"]:
                # Already using new role names
                pass
            else:
                # Unknown role, default to Standard User
                update_data["role"] = "Standard User"
            
            # Set default access tier if not set
            if not user.get("access_tier_id") and starter_tier_id:
                update_data["access_tier_id"] = starter_tier_id
                update_data["access_tier_name"] = "Starter"
            
            if update_data:
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": update_data}
                )
                results["users_migrated"] += 1
                
        except Exception as e:
            results["errors"].append(f"Error migrating user {user.get('id')}: {str(e)}")
    
    return results
