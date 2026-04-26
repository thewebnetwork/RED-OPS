"""
Sprint 5.1 — Backfill finance_categories per user from SCOPE_MAP.

Existing users have a partial finance_categories set (typically the 8 oldest
seeded names) while their transactions reference the broader 28-name taxonomy
defined in SCOPE_MAP. The Sprint 5 scope filter (finance.py) joins txns to
categories by name, so transactions whose category names lack matching
finance_categories records get excluded from scope-filtered totals.

This script is additive and idempotent: for each user, insert any SCOPE_MAP
entries that don't already exist for that user. Existing records are never
modified — scope/type/color stay as-is.

Usage:
    MONGO_URL=... DB_NAME=... python backfill_user_categories_from_scope_map.py
    MONGO_URL=... DB_NAME=... python backfill_user_categories_from_scope_map.py --apply
"""
import argparse
import asyncio
import logging
import os
import sys
import uuid
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

# Pulled from DEFAULT_FINANCE_CATEGORIES in backend/routes/finance.py — used to
# preserve type/color when SCOPE_MAP and DEFAULT have the same name. Categories
# only in SCOPE_MAP fall back to safe defaults (type='both', color='#6b7280').
DEFAULT_META = {
    "Ad Spend": {"type": "expense", "color": "#ef4444"},
    "Software & Tools": {"type": "expense", "color": "#f97316"},
    "Salary": {"type": "expense", "color": "#eab308"},
    "Freelancer": {"type": "expense", "color": "#a855f7"},
    "Revenue": {"type": "income", "color": "#22c55e"},
    "Retainer": {"type": "income", "color": "#10b981"},
    "Refund": {"type": "income", "color": "#06b6d4"},
    "Other": {"type": "both", "color": "#6b7280"},
    "Food & Dining": {"type": "expense", "color": "#f97316"},
    "Rent & Housing": {"type": "expense", "color": "#64748b"},
    "Transportation": {"type": "expense", "color": "#8b5cf6"},
    "Shopping": {"type": "expense", "color": "#ec4899"},
    "Travel": {"type": "expense", "color": "#14b8a6"},
    "Bank Fee": {"type": "expense", "color": "#94a3b8"},
    "Transfer": {"type": "expense", "color": "#475569"},
}

FALLBACK_META = {"type": "both", "color": "#6b7280"}


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

    users = await db.users.find({}, {"id": 1, "email": 1}).to_list(None)
    logger.info("Found %d users", len(users))

    total_created = 0
    users_touched = 0

    for u in users:
        uid = u.get("id")
        email = u.get("email", "<no email>")
        if not uid:
            continue

        existing = await db.finance_categories.find(
            {"org_id": uid}, {"_id": 0, "name": 1}
        ).to_list(None)
        existing_names = {c["name"] for c in existing}

        to_insert = []
        for name, scope in SCOPE_MAP.items():
            if name in existing_names:
                continue
            meta = DEFAULT_META.get(name, FALLBACK_META)
            to_insert.append({
                "id": str(uuid.uuid4()),
                "org_id": uid,
                "name": name,
                "type": meta["type"],
                "color": meta["color"],
                "scope": scope,
            })

        prefix = "[APPLY]" if apply else "[DRY]  "
        if to_insert:
            users_touched += 1
            logger.info(
                "%s %s: had %d, creating %d (total after: %d)",
                prefix, email, len(existing_names), len(to_insert),
                len(existing_names) + len(to_insert),
            )
            if apply:
                await db.finance_categories.insert_many(to_insert)
            total_created += len(to_insert)
        else:
            logger.info("%s %s: had %d, nothing to create", prefix, email, len(existing_names))

    logger.info("--- Summary ---")
    logger.info("Users scanned: %d", len(users))
    logger.info("Users with new categories created: %d", users_touched)
    logger.info("Total categories created: %d", total_created)
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
