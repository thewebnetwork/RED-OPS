"""
Seed Taryn Pessanha's client portal data.

Dry-run by default. Pass --apply to write.

Usage:
    MONGO_URL=... DB_NAME=... python backend/scripts/seed/seed_taryn_portal.py
    MONGO_URL=... DB_NAME=... python backend/scripts/seed/seed_taryn_portal.py --apply
"""
import argparse
import asyncio
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

TARYN_EMAIL = "homes@tarynpessanha.com"


async def run(apply: bool):
    try:
        mongo_url = os.environ["MONGO_URL"]
        db_name = os.environ["DB_NAME"]
    except KeyError as e:
        logger.error("Missing required env var: %s", e)
        sys.exit(1)

    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10_000)
    db = client[db_name]

    try:
        await client.admin.command("ping")
    except Exception as e:
        logger.error("Cannot connect to MongoDB: %s", e)
        sys.exit(1)

    user = await db.users.find_one({"email": TARYN_EMAIL}, {"_id": 0})
    if not user:
        logger.error("User with email %s not found. Aborting.", TARYN_EMAIL)
        sys.exit(1)

    logger.info("Found user: %s (id=%s, role=%s, account_type=%s)",
                user.get("name"), user["id"], user.get("role"), user.get("account_type"))

    if user.get("role") != "Media Client" and user.get("account_type") != "Media Client":
        logger.warning("User is not a Media Client (role=%s, account_type=%s). Skipping — set role manually first.",
                       user.get("role"), user.get("account_type"))
        client.close()
        return

    existing = await db.client_portal_data.find_one({"user_id": user["id"]})
    if existing:
        logger.info("Portal data already exists for %s. Skipping.", user.get("name"))
        client.close()
        return

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "org_id": user["id"],
        "status_phase": "onboarding",
        "status_message": "Onboarding week 1 — account setup in progress.",
        "launched_at": None,
        "performance": {
            "appointments_this_week": 0,
            "appointments_this_month": 0,
            "appointments_total": 0,
            "last_updated_at": now,
        },
        "upcoming_appointments": [],
        "created_at": now,
        "updated_at": now,
        "created_by": "seed_script",
    }

    if apply:
        await db.client_portal_data.insert_one(doc)
        logger.info("[APPLIED] Created portal data for %s (user_id=%s)", user.get("name"), user["id"])
    else:
        logger.info("[DRY] Would create portal data for %s (user_id=%s)", user.get("name"), user["id"])

    client.close()


def main():
    parser = argparse.ArgumentParser(description="Seed Taryn's client portal data")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if args.apply:
        logger.warning("Running in APPLY mode.")
    else:
        logger.info("Running in DRY-RUN mode.")

    asyncio.run(run(apply=args.apply))


if __name__ == "__main__":
    main()
