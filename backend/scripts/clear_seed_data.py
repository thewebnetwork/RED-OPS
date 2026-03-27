"""
Remove sample/seed orders from the production database.

Only deletes orders whose titles match known seed data patterns.
Does not touch any other collections or real client data.

Usage:  MONGO_URL=... DB_NAME=... python backend/scripts/clear_seed_data.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

SEED_TITLE_PATTERNS = [
    "Website SEO Audit",
    "Brand Identity Refresh",
    "Q1 Facebook",
    "Instagram Content",
    "Market Research Report",
    "Podcast Audio",
    "Logo Animation",
    "B2B Sales",
    "Landing Page Copywriting",
    "Email Campaign",
    "YouTube Scriptwriting",
    "Product Review Video",
]


async def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "red_ribbon_ops")

    if not mongo_url:
        print("ERROR: MONGO_URL environment variable is not set.")
        sys.exit(1)

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Build regex filter: match any title containing one of the seed patterns
    regex_patterns = [{"title": {"$regex": pattern, "$options": "i"}} for pattern in SEED_TITLE_PATTERNS]
    query = {"$or": regex_patterns}

    # Count matches first
    count = await db.orders.count_documents(query)

    if count == 0:
        print("No seed data found. Nothing to delete.")
        return

    # Show what will be deleted
    print(f"\nFound {count} seed order(s) to delete:\n")
    cursor = db.orders.find(query, {"_id": 0, "order_code": 1, "title": 1, "status": 1})
    async for doc in cursor:
        print(f"  [{doc.get('order_code', '?')}] {doc.get('title', '?')} — {doc.get('status', '?')}")

    # Confirm
    print()
    answer = input(f"Delete these {count} order(s)? Type 'yes' to confirm: ")
    if answer.strip().lower() != "yes":
        print("Aborted.")
        return

    result = await db.orders.delete_many(query)
    print(f"\nDeleted {result.deleted_count} seed order(s).")


if __name__ == "__main__":
    asyncio.run(main())
