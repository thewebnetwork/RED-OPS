"""
Cleanup broken finance imports where amount ≈ $0.01.

BMO credit card and Wise CSVs broke the existing parser cascade,
causing every row to land with amount ≈ 0.01. This script finds
and deletes those broken records.

Dry-run by default. Pass --apply to delete. Requires typing DELETE to confirm.

Usage:
    MONGO_URL=... DB_NAME=... python backend/scripts/migrations/cleanup_broken_finance_imports.py
    MONGO_URL=... DB_NAME=... python backend/scripts/migrations/cleanup_broken_finance_imports.py --apply
"""
import argparse
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

    query = {
        "$or": [
            {"source": {"$regex": "import", "$options": "i"}},
            {"upload_id": {"$ne": None}},
        ],
        "$expr": {"$lte": [{"$abs": "$amount"}, 0.05]},
    }

    # Motor doesn't support $expr in all contexts; use a simpler approach
    all_imported = await db.finance_transactions.find(
        {"$or": [
            {"source": {"$regex": "import", "$options": "i"}},
            {"upload_id": {"$ne": None}},
        ]},
        {"_id": 1, "id": 1, "date": 1, "amount": 1, "description": 1, "upload_id": 1, "source": 1}
    ).to_list(None)

    broken = [t for t in all_imported if abs(t.get("amount", 0)) <= 0.05]

    logger.info("Total imported transactions: %d", len(all_imported))
    logger.info("Broken (abs(amount) <= $0.05): %d", len(broken))

    if not broken:
        logger.info("Nothing to clean up.")
        client.close()
        return

    total_sum = 0.0
    for t in broken:
        desc = (t.get("description") or "")[:60]
        logger.info("  %s | %s | $%.2f | %s | upload_id=%s",
                     t.get("id", "?"), t.get("date", "?"), t.get("amount", 0), desc, t.get("upload_id"))
        total_sum += abs(t.get("amount", 0))

    logger.info("Total broken: %d rows, sum $%.2f", len(broken), total_sum)

    if not apply:
        logger.info("DRY RUN — no deletes. Re-run with --apply to delete.")
        client.close()
        return

    confirm = input("\nType DELETE to confirm deletion of %d transactions: " % len(broken))
    if confirm.strip() != "DELETE":
        logger.info("Aborted.")
        client.close()
        return

    broken_ids = [t["id"] for t in broken if t.get("id")]
    if broken_ids:
        result = await db.finance_transactions.delete_many({"id": {"$in": broken_ids}})
        logger.info("Deleted %d transactions.", result.deleted_count)

    # Clean orphaned csv_uploads
    remaining_upload_ids = set()
    async for t in db.finance_transactions.find({}, {"upload_id": 1}):
        if t.get("upload_id"):
            remaining_upload_ids.add(t["upload_id"])

    all_uploads = await db.csv_uploads.find({}, {"id": 1}).to_list(None)
    orphaned = [u for u in all_uploads if u.get("id") not in remaining_upload_ids]
    if orphaned:
        orphan_ids = [u["id"] for u in orphaned]
        del_result = await db.csv_uploads.delete_many({"id": {"$in": orphan_ids}})
        logger.info("Deleted %d orphaned csv_uploads.", del_result.deleted_count)
    else:
        logger.info("No orphaned csv_uploads.")

    client.close()


def main():
    parser = argparse.ArgumentParser(description="Cleanup broken finance imports")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if args.apply:
        logger.warning("APPLY mode — will delete broken transactions after confirmation.")
    else:
        logger.info("DRY-RUN mode.")

    asyncio.run(run(apply=args.apply))


if __name__ == "__main__":
    main()
