#!/usr/bin/env python3
"""Backfill the `entity` field on existing finance_transactions per rules.

Rules applied in order, first match wins:
  1. description contains "STRIPE MSP"        → RRM
  2. description contains "REAL BROKER"       → RealEstate
  3. category in {"Real Estate Commission",
                  "Real Estate Board Fees"}   → RealEstate
  4. description starts with "[CW]WISE"       → Personal
  5. description contains any of TIM HORTONS,
     STARBUCKS, CALG CO-OP, WINNERSHOMESENS,
     JOEY Crowfoot, SAVE THE CHILDR,
     RODEO CLEANING                            → Personal
  6. description contains "Mia Isabel Carrasco" → Personal (Airbnb guest)
  7. category == "Airbnb Income"              → Personal
  8. description contains "Grace monthly payments" → DELETE (Grace deal
     killed 2026-05-06 per Vitto; not a real RRM transaction)
  9. else                                      → Unassigned

Defaults to dry-run. Pass --confirm-apply to write changes.

Halt condition: refuses to write if Unassigned > 30% of dataset (rules
need refining first).

Idempotent: rows already classified into a non-Unassigned entity are
left alone.
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Resolve backend/.env regardless of which directory invokes the script
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

if not MONGO_URL or not DB_NAME:
    print("ERROR: MONGO_URL and DB_NAME must be set in backend/.env", file=sys.stderr)
    sys.exit(1)

# Personal merchant tokens (rule 5) — substring match on uppercase description
PERSONAL_MERCHANT_TOKENS = [
    "TIM HORTONS",
    "STARBUCKS",
    "CALG CO-OP",
    "WINNERSHOMESENS",
    "JOEY CROWFOOT",
    "SAVE THE CHILDR",
    "RODEO CLEANING",
]

REAL_ESTATE_CATEGORIES = {"Real Estate Commission", "Real Estate Board Fees"}
PERSONAL_CATEGORIES = {"Airbnb Income"}

GRACE_DELETE_MARKER = "grace monthly payments"  # case-insensitive
UNASSIGNED_HALT_THRESHOLD = 0.30  # 30% per spec


def classify(tx: dict) -> str:
    """Return one of: RRG | RRM | RealEstate | Personal | Unassigned | DELETE."""
    description = (tx.get("description") or "").strip()
    desc_upper = description.upper()
    desc_lower = description.lower()
    category = tx.get("category") or ""

    # Rule 1
    if "STRIPE MSP" in desc_upper:
        return "RRM"

    # Rule 2
    if "REAL BROKER" in desc_upper:
        return "RealEstate"

    # Rule 3
    if category in REAL_ESTATE_CATEGORIES:
        return "RealEstate"

    # Rule 4 — bank export prefix is the literal "[CW]WISE"
    if desc_upper.startswith("[CW]WISE"):
        return "Personal"

    # Rule 5
    for token in PERSONAL_MERCHANT_TOKENS:
        if token in desc_upper:
            return "Personal"

    # Rule 6
    if "mia isabel carrasco" in desc_lower:
        return "Personal"

    # Rule 7
    if category in PERSONAL_CATEGORIES:
        return "Personal"

    # Rule 8
    if GRACE_DELETE_MARKER in desc_lower:
        return "DELETE"

    # Rule 9
    return "Unassigned"


async def run(confirm_apply: bool) -> int:
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    txs = await db.finance_transactions.find({}, {"_id": 0}).to_list(50000)
    total = len(txs)

    print("=" * 64)
    print(f"  TRANSACTION ENTITY BACKFILL — {'APPLY' if confirm_apply else 'DRY-RUN'}")
    print("=" * 64)

    if total == 0:
        print("No transactions found. Nothing to do.")
        client.close()
        return 0

    # Decide for each transaction. Already-classified rows pass through unchanged.
    counts = {
        "RRG": 0, "RRM": 0, "RealEstate": 0,
        "Personal": 0, "Unassigned": 0, "DELETE": 0,
    }
    decisions = []  # list[tuple[entity_or_DELETE, tx_dict, was_already_set: bool]]

    for tx in txs:
        existing = tx.get("entity")
        if existing in {"RRG", "RRM", "RealEstate", "Personal"}:
            counts[existing] += 1
            decisions.append((existing, tx, True))
            continue
        decision = classify(tx)
        counts[decision] += 1
        decisions.append((decision, tx, False))

    # Breakdown
    print(f"Total transactions scanned: {total}")
    print()
    print("Classification breakdown:")
    for entity in ("RRG", "RRM", "RealEstate", "Personal", "Unassigned", "DELETE"):
        count = counts[entity]
        pct = (count / total) * 100 if total else 0
        bar = "█" * int(pct / 2) if count else ""
        marker = "  ← will be DELETED" if entity == "DELETE" else ""
        print(f"  {entity:<12} {count:>5}  ({pct:5.1f}%)  {bar}{marker}")
    print()

    # Halt check
    unassigned_pct = counts["Unassigned"] / total
    if unassigned_pct > UNASSIGNED_HALT_THRESHOLD:
        print(
            f"⚠  HALT: Unassigned is {unassigned_pct * 100:.1f}% of dataset, "
            f"exceeds the {UNASSIGNED_HALT_THRESHOLD * 100:.0f}% threshold. "
            f"Refine rules in classify() before applying."
        )
        client.close()
        return 2

    # Sample previews so the operator can sanity-check before committing
    if not confirm_apply:
        print("Sample assignments (first 3 of each bucket made by these rules):")
        sample_count: dict[str, int] = {}
        for entity, tx, already in decisions:
            if already:
                continue  # skip already-classified rows from preview
            sample_count.setdefault(entity, 0)
            if sample_count[entity] < 3:
                desc = (tx.get("description") or "")[:62]
                date = tx.get("date") or "—"
                cat = (tx.get("category") or "—")[:26]
                amt = tx.get("amount") or 0
                print(f"  [{entity:<10}] {date}  ${amt:>10.2f}  {cat:<26}  {desc}")
                sample_count[entity] += 1
        print()
        print("Dry-run complete. Re-run with --confirm-apply to write changes.")
        client.close()
        return 0

    # APPLY
    print("Applying changes…")
    updated = 0
    deleted = 0
    skipped_already = 0
    skipped_no_id = 0

    for entity, tx, already in decisions:
        tx_id = tx.get("id")
        if not tx_id:
            skipped_no_id += 1
            continue
        if already:
            skipped_already += 1
            continue
        if entity == "DELETE":
            res = await db.finance_transactions.delete_one({"id": tx_id})
            if res.deleted_count:
                deleted += 1
        else:
            res = await db.finance_transactions.update_one(
                {"id": tx_id}, {"$set": {"entity": entity}}
            )
            if res.modified_count:
                updated += 1

    print()
    print(f"  Updated:                       {updated}")
    print(f"  Deleted (Grace transactions):  {deleted}")
    print(f"  Skipped (already classified):  {skipped_already}")
    if skipped_no_id:
        print(f"  Skipped (no `id` field):       {skipped_no_id}")
    print()
    print("Done.")

    client.close()
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Backfill `entity` on finance_transactions. Dry-run by default."
    )
    parser.add_argument(
        "--confirm-apply",
        action="store_true",
        help="Write the entity field + delete Grace transactions. Without this, runs as dry-run only.",
    )
    args = parser.parse_args()

    exit_code = asyncio.run(run(confirm_apply=args.confirm_apply))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
