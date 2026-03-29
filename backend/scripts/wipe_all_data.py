"""
Wipe all user-created data from the production database.
Keeps the admin account intact. Clears everything else.

Usage:  MONGO_URL=... DB_NAME=... python backend/scripts/wipe_all_data.py

⚠️  THIS IS DESTRUCTIVE — it permanently deletes all data.
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

ADMIN_EMAIL = "redops@redribbongroup.ca"

COLLECTIONS_TO_WIPE = [
    "orders",
    "tasks",
    "task_comments",
    "time_entries",
    "projects",
    "documents",
    "threads",
    "messages",
    "onboarding_checklists",
    "ad_snapshots",
    "notifications",
    "escalation_history",
    "recurring_task_rules",
    "files",
    "feedback",
]

COLLECTIONS_TO_WIPE_FULLY = [
    "task_comments",
    "time_entries",
    "documents",
    "threads",
    "messages",
    "onboarding_checklists",
    "ad_snapshots",
    "notifications",
    "escalation_history",
    "recurring_task_rules",
    "feedback",
]


async def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "red_ribbon_ops")

    if not mongo_url:
        print("ERROR: MONGO_URL environment variable is not set.")
        sys.exit(1)

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    print(f"\n⚠️  DATABASE WIPE: {db_name}")
    print(f"{'=' * 50}")

    # Count what will be deleted
    total = 0
    for col_name in COLLECTIONS_TO_WIPE:
        col = db[col_name]
        count = await col.count_documents({})
        if count > 0:
            print(f"  {col_name}: {count} documents")
            total += count

    # Count non-admin users
    non_admin_users = await db.users.count_documents({"email": {"$ne": ADMIN_EMAIL}})
    if non_admin_users > 0:
        print(f"  users (non-admin): {non_admin_users} documents")
        total += non_admin_users

    admin = await db.users.find_one({"email": ADMIN_EMAIL})
    if admin:
        print(f"\n  ✅ Admin account ({ADMIN_EMAIL}) will be KEPT")

    if total == 0:
        print("\nDatabase is already empty. Nothing to delete.")
        return

    print(f"\n  TOTAL: {total} documents will be deleted")
    print()
    answer = input("Type 'WIPE' to confirm deletion: ")
    if answer.strip() != "WIPE":
        print("Aborted.")
        return

    # Delete all non-admin users
    result = await db.users.delete_many({"email": {"$ne": ADMIN_EMAIL}})
    print(f"  Deleted {result.deleted_count} non-admin users")

    # Wipe all other collections
    for col_name in COLLECTIONS_TO_WIPE:
        col = db[col_name]
        result = await col.delete_many({})
        if result.deleted_count > 0:
            print(f"  Deleted {result.deleted_count} from {col_name}")

    print(f"\n✅ Database wiped. Only admin account remains.")
    print(f"   Email: {ADMIN_EMAIL}")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
