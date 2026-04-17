"""
Audit org_id drift across all collections.

Reports per-collection how many records have an org_id that doesn't match
their created_by user's id. Dry-run only — no writes, no flags.

Usage:
    MONGO_URL=... DB_NAME=... python backend/scripts/migrations/audit_org_id_drift.py
"""
import asyncio
import logging
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

COLLECTIONS_TO_AUDIT = [
    "documents", "finance_transactions", "finance_categories",
    "projects", "tasks", "crm_pipelines", "crm_contacts", "crm_deals",
    "knowledge_base_articles", "ambassador_referrals", "ambassador_listings",
    "ad_snapshots", "files", "file_folders", "messages", "message_threads",
    "sheets", "events", "calendar_connections", "drive_connections",
    "dashboards", "dashboard_configs", "integrations", "api_keys", "workflows",
]


async def run():
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

    users_by_id = {}
    async for u in db.users.find({}, {"_id": 0, "id": 1}):
        users_by_id[u["id"]] = u

    logger.info("Loaded %d users", len(users_by_id))
    logger.info("")

    total_drifted = 0

    for col_name in COLLECTIONS_TO_AUDIT:
        total = await db[col_name].count_documents({})
        if total == 0:
            continue

        has_org_id = await db[col_name].count_documents({"org_id": {"$exists": True}})
        missing_org_id = await db[col_name].count_documents(
            {"$or": [{"org_id": {"$exists": False}}, {"org_id": None}]}
        )

        drifted = 0
        if has_org_id > 0:
            docs = await db[col_name].find(
                {"org_id": {"$exists": True, "$ne": None}, "created_by": {"$exists": True}},
                {"_id": 0, "id": 1, "org_id": 1, "created_by": 1}
            ).to_list(None)

            for doc in docs:
                created_by = doc.get("created_by")
                if created_by and doc.get("org_id") != created_by:
                    drifted += 1

        if missing_org_id > 0 or drifted > 0:
            logger.warning(
                "%-30s total=%-5d has_org_id=%-5d missing=%-5d drifted=%-5d",
                col_name, total, has_org_id, missing_org_id, drifted,
            )
            total_drifted += drifted + missing_org_id
        else:
            logger.info(
                "%-30s total=%-5d has_org_id=%-5d — OK",
                col_name, total, has_org_id,
            )

    logger.info("")
    logger.info("Total records needing attention: %d", total_drifted)

    client.close()


if __name__ == "__main__":
    asyncio.run(run())
