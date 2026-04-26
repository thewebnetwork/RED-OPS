"""
Add scope field to existing finance_categories documents.
Idempotent — safe to run multiple times. Skips docs that already have scope.

Usage:
    MONGO_URL=... DB_NAME=... python backend/scripts/migrations/add_scope_to_finance_categories.py
    MONGO_URL=... DB_NAME=... python backend/scripts/migrations/add_scope_to_finance_categories.py --apply
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

SCOPE_MAP = {
    "Ad Spend": "agency",
    "Software & Tools": "agency",
    "Salary": "agency",
    "Freelancer": "agency",
    "Revenue": "agency",
    "Retainer": "agency",
    "Contractor Payment": "agency",
    "Software Subscription": "agency",
    "Payroll": "agency",
    "RRM Revenue": "agency",
    "Real Estate Commission": "personal",
    "Airbnb Income": "personal",
    "Cleaning Services": "personal",
    "Loan Payment": "personal",
    "Condo Fees": "personal",
    "Real Estate Board Fees": "personal",
    "Food and Dining": "personal",
    "Food & Dining": "personal",
    "Shopping and Household": "personal",
    "Shopping": "personal",
    "Transportation": "personal",
    "Rent & Housing": "personal",
    "Donation": "personal",
    "Refund": "both",
    "Other": "both",
    "Uncategorized": "both",
    "Travel": "both",
    "Bank Fee": "both",
    "Transfer": "both",
    "Wise International Transfer": "both",
}


async def run(apply: bool):
    try:
        mongo_url = os.environ["MONGO_URL"]
        db_name = os.environ["DB_NAME"]
    except KeyError as e:
        logger.error("Missing env var: %s", e)
        sys.exit(1)

    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10_000)
    db = client[db_name]

    try:
        await client.admin.command("ping")
    except Exception as e:
        logger.error("Cannot connect: %s", e)
        sys.exit(1)

    cats = await db.finance_categories.find({}, {"_id": 1, "id": 1, "name": 1, "scope": 1}).to_list(None)
    already = 0
    updated = 0
    defaulted = 0

    for c in cats:
        if c.get("scope"):
            already += 1
            continue
        name = c.get("name", "")
        scope = SCOPE_MAP.get(name, "both")
        if name not in SCOPE_MAP:
            defaulted += 1

        if apply:
            await db.finance_categories.update_one({"_id": c["_id"]}, {"$set": {"scope": scope}})
            logger.info("[APPLIED] %s → scope=%s", name, scope)
        else:
            logger.info("[DRY] %s → scope=%s", name, scope)
        updated += 1

    logger.info("--- Summary ---")
    logger.info("Total categories: %d", len(cats))
    logger.info("Already had scope: %d", already)
    logger.info("Updated: %d", updated)
    logger.info("Defaulted to 'both': %d", defaulted)
    if not apply:
        logger.info("DRY RUN — re-run with --apply to write.")

    client.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.apply:
        logger.warning("APPLY mode.")
    else:
        logger.info("DRY-RUN mode.")
    asyncio.run(run(apply=args.apply))


if __name__ == "__main__":
    main()
