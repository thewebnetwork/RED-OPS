"""
One-time admin seed script for Red Ops.
Creates or updates the platform admin account.

Usage:  MONGO_URL=... DB_NAME=... python scripts/seed_admin.py
"""
import asyncio
import os
import uuid
import sys
from pathlib import Path
from datetime import datetime, timezone

# Add parent dir so we can import project modules
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_EMAIL = "redops@redribbongroup.ca"
ADMIN_PASSWORD = "Fmtvvl171**"
ADMIN_NAME = "Red Ops Admin"


async def seed():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")

    if not mongo_url or not db_name:
        print("ERROR: MONGO_URL and DB_NAME environment variables are required.")
        print("Set them in backend/.env or export them before running.")
        sys.exit(1)

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    existing = await db.users.find_one({"email": ADMIN_EMAIL})

    if existing:
        # Update password and ensure admin role
        hashed = pwd_context.hash(ADMIN_PASSWORD)
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {
                "password": hashed,
                "role": "Administrator",
                "active": True,
                "force_password_change": False,
                "force_otp_setup": False,
                "otp_verified": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        print(f"Updated existing user: {ADMIN_EMAIL}")
        print(f"  - Password reset to provided value")
        print(f"  - Role set to Administrator")
        print(f"  - Account activated, OTP bypassed")
    else:
        # Create new admin user
        hashed = pwd_context.hash(ADMIN_PASSWORD)
        user = {
            "id": str(uuid.uuid4()),
            "name": ADMIN_NAME,
            "email": ADMIN_EMAIL,
            "password": hashed,
            "role": "Administrator",
            "account_type": "Internal Staff",
            "specialty_ids": [],
            "primary_specialty_id": None,
            "specialty_id": None,
            "team_id": None,
            "subscription_plan_id": None,
            "dashboard_type_id": None,
            "permissions": {},
            "permission_overrides": None,
            "active": True,
            "can_pick": True,
            "pool_access": "both",
            "force_password_change": False,
            "force_otp_setup": False,
            "otp_verified": True,
            "otp_secret": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
        print(f"Created new admin user: {ADMIN_EMAIL}")
        print(f"  - Role: Administrator")
        print(f"  - Account Type: Internal Staff")
        print(f"  - No forced password change or OTP")

    # Also ensure this user is in the platform org if one exists
    platform_org = await db.organizations.find_one({"type": "platform"})
    if platform_org:
        user_doc = await db.users.find_one({"email": ADMIN_EMAIL})
        user_id = user_doc.get("id", str(user_doc["_id"]))
        org_id = str(platform_org["_id"])

        existing_mem = await db.org_memberships.find_one({"user_id": user_id, "org_id": org_id})
        if not existing_mem:
            # Also check org_members collection (used by organizations.py)
            existing_mem = await db.org_members.find_one({"user_id": user_id, "org_id": org_id})

        if not existing_mem:
            await db.org_members.insert_one({
                "org_id": org_id,
                "user_id": user_id,
                "role": "owner",
                "joined_at": datetime.now(timezone.utc).isoformat(),
            })
            print(f"  - Added as owner to platform org: {platform_org.get('name', org_id)}")
        else:
            print(f"  - Already a member of platform org")
    else:
        print(f"  - No platform org found (will be assigned when org is created)")

    print("\nDone. You can now log in with:")
    print(f"  Email:    {ADMIN_EMAIL}")
    print(f"  Password: {'*' * len(ADMIN_PASSWORD)}")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
