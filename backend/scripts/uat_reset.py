#!/usr/bin/env python3
"""
UAT Data Reset Script for Red Ops
1. Exports all operational data to JSON backup files
2. Clears operational data while preserving configuration
"""

import asyncio
import json
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# Custom JSON encoder for MongoDB ObjectId and datetime
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

# Collections to BACKUP AND CLEAR (operational data)
OPERATIONAL_COLLECTIONS = [
    'orders',           # Tickets/requests
    'order_messages',   # Ticket messages/comments
    'order_files',      # Attachments metadata
    'order_activity',   # Timeline/activity log
    'notifications',    # In-app notifications
    'activity_logs',    # System activity logs
    'escalation_history', # Escalation events
    'sla_alerts',       # SLA monitoring records
    'workflow_executions', # Workflow run history
    'announcements',    # Announcements
    'announcement_ticker', # Ticker announcements
    'bug_reports',      # Bug reports
    'feature_requests', # Feature requests
    'ratings',          # User ratings
    'rating_surveys',   # Survey responses
    'rating_tokens',    # Rating tokens
    'api_key_logs',     # API key usage logs
    'webhook_logs',     # Webhook execution logs
    'password_resets',  # Password reset tokens (can be cleared)
]

# Collections to BACKUP ONLY (preserve configuration)
CONFIG_COLLECTIONS = [
    'users',            # User accounts
    'roles',            # Roles & permissions
    'account_types',    # Account types
    'teams',            # Teams
    'specialties',      # Specialties
    'subscription_plans', # Plans
    'categories_l1',    # Level 1 categories
    'categories_l2',    # Level 2 categories (subcategories)
    'workflows',        # Workflow templates
    'sla_policies',     # SLA policies
    'escalation_policies', # Escalation policies
    'settings',         # General settings
    'pool_picker_rules', # Pool eligibility rules
    'smtp_config',      # SMTP configuration
    'ui_settings',      # UI customizations
    'api_keys',         # API keys (config, not logs)
    'webhooks',         # Webhook configurations
    'announcement_settings', # Announcement settings
    'access_tiers',     # Access tiers
]

async def export_collection(db, collection_name, backup_dir):
    """Export a collection to JSON file"""
    try:
        docs = await db[collection_name].find({}).to_list(None)
        if docs:
            filepath = os.path.join(backup_dir, f"{collection_name}.json")
            with open(filepath, 'w') as f:
                json.dump(docs, f, cls=MongoJSONEncoder, indent=2)
            print(f"  ✅ {collection_name}: {len(docs)} documents exported")
            return len(docs)
        else:
            print(f"  ⚪ {collection_name}: 0 documents (empty)")
            return 0
    except Exception as e:
        print(f"  ❌ {collection_name}: Error - {str(e)}")
        return 0

async def clear_collection(db, collection_name):
    """Clear all documents from a collection"""
    try:
        result = await db[collection_name].delete_many({})
        print(f"  🗑️  {collection_name}: {result.deleted_count} documents deleted")
        return result.deleted_count
    except Exception as e:
        print(f"  ❌ {collection_name}: Error clearing - {str(e)}")
        return 0

async def main():
    # Setup
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'redops')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = f"/app/backups/uat_reset_{timestamp}"
    os.makedirs(backup_dir, exist_ok=True)
    
    print("=" * 60)
    print(f"UAT DATA RESET - {timestamp}")
    print(f"Backup directory: {backup_dir}")
    print("=" * 60)
    
    # Phase 1: Export all data
    print("\n📦 PHASE 1: EXPORTING BACKUP DATA")
    print("-" * 40)
    
    print("\n🔸 Operational Data (will be cleared):")
    operational_counts = {}
    for coll in OPERATIONAL_COLLECTIONS:
        count = await export_collection(db, coll, backup_dir)
        operational_counts[coll] = count
    
    print("\n🔸 Configuration Data (will be preserved):")
    config_counts = {}
    for coll in CONFIG_COLLECTIONS:
        count = await export_collection(db, coll, backup_dir)
        config_counts[coll] = count
    
    # Create summary file
    summary = {
        "timestamp": timestamp,
        "backup_dir": backup_dir,
        "operational_data": operational_counts,
        "config_data": config_counts,
        "total_operational_docs": sum(operational_counts.values()),
        "total_config_docs": sum(config_counts.values())
    }
    
    with open(os.path.join(backup_dir, "_backup_summary.json"), 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\n📊 Backup Summary:")
    print(f"   - Operational documents backed up: {sum(operational_counts.values())}")
    print(f"   - Configuration documents backed up: {sum(config_counts.values())}")
    
    # Phase 2: Clear operational data
    print("\n" + "=" * 60)
    print("🗑️  PHASE 2: CLEARING OPERATIONAL DATA")
    print("-" * 40)
    
    total_deleted = 0
    for coll in OPERATIONAL_COLLECTIONS:
        deleted = await clear_collection(db, coll)
        total_deleted += deleted
    
    print(f"\n📊 Clear Summary:")
    print(f"   - Total documents deleted: {total_deleted}")
    
    # Phase 3: Verify reset
    print("\n" + "=" * 60)
    print("✅ PHASE 3: VERIFICATION")
    print("-" * 40)
    
    print("\n🔸 Operational Collections (should be 0):")
    for coll in OPERATIONAL_COLLECTIONS:
        count = await db[coll].count_documents({})
        status = "✅" if count == 0 else "❌"
        print(f"   {status} {coll}: {count}")
    
    print("\n🔸 Configuration Collections (should be preserved):")
    for coll in CONFIG_COLLECTIONS:
        count = await db[coll].count_documents({})
        status = "✅" if count > 0 or coll in ['pool_picker_rules', 'access_tiers'] else "⚪"
        print(f"   {status} {coll}: {count}")
    
    print("\n" + "=" * 60)
    print(f"✅ UAT RESET COMPLETE")
    print(f"📁 Backup saved to: {backup_dir}")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
