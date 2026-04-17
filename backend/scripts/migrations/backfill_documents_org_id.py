"""
Backfill org_id on legacy documents.

Documents created before the tenant-scoping fix (commit a52706e) have no
org_id field. The new query filters exclude them, making them invisible to
their owners. This script stamps org_id by looking up each document's
created_by user and applying the same 3-level fallback used in the route
code: user.org_id → user.team_id → user.id.

Dry-run by default. Pass --apply to perform writes.

Adds a _backfilled_at ISO timestamp on each updated document so future
readers can distinguish migrated documents from natively-scoped ones.

Usage:
    MONGO_URL=... DB_NAME=... python backend/scripts/migrations/backfill_documents_org_id.py
    MONGO_URL=... DB_NAME=... python backend/scripts/migrations/backfill_documents_org_id.py --apply
"""
import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)


def resolve_org_id(user: dict) -> str:
    """Same 3-level fallback as backend/routes/documents.py:_resolve_org_id"""
    return user.get("org_id") or user.get("team_id") or user.get("id")


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

    query = {"$or": [{"org_id": {"$exists": False}}, {"org_id": None}]}
    docs = await db.documents.find(query, {"_id": 1, "id": 1, "title": 1, "created_by": 1}).to_list(None)

    total_scanned = await db.documents.count_documents({})
    total_missing = len(docs)
    resolved = 0
    skipped = 0

    logger.info("Total documents in collection: %d", total_scanned)
    logger.info("Documents without org_id: %d", total_missing)

    if total_missing == 0:
        logger.info("Nothing to backfill.")
        return

    user_cache: dict[str, dict | None] = {}
    now = datetime.now(timezone.utc).isoformat()

    for doc in docs:
        doc_id = doc.get("id") or str(doc["_id"])
        created_by = doc.get("created_by")
        title = doc.get("title", "<untitled>")

        if not created_by:
            logger.warning("[SKIP] doc=%s title=%r — no created_by field", doc_id, title)
            skipped += 1
            continue

        if created_by not in user_cache:
            user_cache[created_by] = await db.users.find_one(
                {"id": created_by},
                {"_id": 0, "id": 1, "org_id": 1, "team_id": 1, "primary_org_id": 1}
            )

        user = user_cache[created_by]
        if user is None:
            logger.warning("[SKIP] doc=%s title=%r — created_by user %s not found", doc_id, title, created_by)
            skipped += 1
            continue

        org_id = resolve_org_id(user)

        if apply:
            await db.documents.update_one(
                {"_id": doc["_id"]},
                {"$set": {"org_id": org_id, "_backfilled_at": now}},
            )
            logger.info("[APPLIED] doc=%s title=%r → org_id=%s", doc_id, title, org_id)
        else:
            logger.info("[DRY] would set org_id=%s on doc=%s title=%r", org_id, doc_id, title)

        resolved += 1

    logger.info("--- Summary ---")
    logger.info("Total documents:     %d", total_scanned)
    logger.info("Without org_id:      %d", total_missing)
    logger.info("Resolved:            %d", resolved)
    logger.info("Skipped (orphaned):  %d", skipped)
    if apply:
        logger.info("Written:             %d", resolved)
    else:
        logger.info("Mode: DRY RUN — no writes performed. Re-run with --apply to write.")

    client.close()


def main():
    parser = argparse.ArgumentParser(description="Backfill org_id on legacy documents")
    parser.add_argument("--apply", action="store_true", help="Actually write changes (default is dry-run)")
    args = parser.parse_args()

    if args.apply:
        logger.warning("Running in APPLY mode — changes will be written to the database.")
    else:
        logger.info("Running in DRY-RUN mode — no changes will be made.")

    asyncio.run(run(apply=args.apply))


if __name__ == "__main__":
    main()
