"""
Remove sample/seed orders and junk projects from the production database.

Only deletes orders whose titles match known seed data patterns,
plus test orders ("vjv") and pre-launch orders from a specific org.
Also cleans up empty/junk projects.

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
    "Graphic Design Request",
]

# Pre-launch test org whose early orders should be cleaned
TEST_ORG_ID = "43fd0615-910f-43c2-bf84-9b3a828bbbe8"
TEST_CUTOFF = "2026-03-20T00:00:00"


async def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "red_ribbon_ops")

    if not mongo_url:
        print("ERROR: MONGO_URL environment variable is not set.")
        sys.exit(1)

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # ── Orders cleanup ──────────────────────────────────────────
    # Match seed titles OR "vjv" test orders OR pre-launch orders from test org
    regex_patterns = [{"title": {"$regex": pattern, "$options": "i"}} for pattern in SEED_TITLE_PATTERNS]
    regex_patterns.append({"title": {"$regex": "^vjv$", "$options": "i"}})
    regex_patterns.append({
        "org_id": TEST_ORG_ID,
        "created_at": {"$lt": TEST_CUTOFF},
    })
    order_query = {"$or": regex_patterns}

    order_count = await db.orders.count_documents(order_query)

    if order_count == 0:
        print("No seed/test orders found.")
    else:
        print(f"\nFound {order_count} seed/test order(s) to delete:\n")
        cursor = db.orders.find(order_query, {"_id": 0, "order_code": 1, "title": 1, "status": 1, "created_at": 1})
        async for doc in cursor:
            print(f"  [{doc.get('order_code', '?')}] {doc.get('title', '?')} — {doc.get('status', '?')} ({doc.get('created_at', '?')[:10] if doc.get('created_at') else '?'})")

    # ── Projects cleanup ────────────────────────────────────────
    project_query = {"$or": [
        {"title": {"$regex": "^vjv$", "$options": "i"}},
        {"title": None},
        {"title": ""},
        {"name": {"$regex": "^vjv$", "$options": "i"}},
        {"name": None},
        {"name": ""},
    ]}
    project_count = await db.projects.count_documents(project_query)

    if project_count == 0:
        print("No junk projects found.")
    else:
        print(f"\nFound {project_count} junk project(s) to delete:\n")
        cursor = db.projects.find(project_query, {"_id": 0, "id": 1, "title": 1, "name": 1})
        async for doc in cursor:
            print(f"  [{doc.get('id', '?')[:8]}] {doc.get('title') or doc.get('name') or '(empty)'}")

    total = order_count + project_count
    if total == 0:
        print("\nNothing to delete.")
        return

    # Confirm
    print(f"\nTotal: {order_count} order(s) + {project_count} project(s) = {total} documents")
    answer = input("Delete all? Type 'yes' to confirm: ")
    if answer.strip().lower() != "yes":
        print("Aborted.")
        return

    if order_count > 0:
        result = await db.orders.delete_many(order_query)
        print(f"Deleted {result.deleted_count} order(s).")

    if project_count > 0:
        result = await db.projects.delete_many(project_query)
        print(f"Deleted {result.deleted_count} project(s).")

    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
