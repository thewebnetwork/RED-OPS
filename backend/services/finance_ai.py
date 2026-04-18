"""AI-powered transaction categorization using Claude.

Falls back to empty results (not crashes) if ANTHROPIC_API_KEY is missing
or the API call fails. The caller should fall back to regex categorization.
"""
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a financial categorization assistant for Red Ribbon Group, a digital agency serving Canadian real estate agents.

You will receive bank/credit card/payment transactions and must categorize each into one of these categories:
- Revenue (client payments coming in)
- Ad Spend (Meta, Google, LinkedIn, paid media)
- Software (SaaS subscriptions, domain registrars, hosting)
- Contractor (freelancers, editors, ISAs, independent contractors)
- Payroll (salaried internal team)
- Professional Services (lawyer, accountant, consultants)
- Marketing (non-ad marketing, sponsorships, events)
- Equipment (hardware, gear)
- Office (rent, utilities, office supplies)
- Travel (flights, hotels, Uber for client work)
- Meals (client meals, team meals)
- Transfer (bank-to-bank, credit card payments, internal movements)
- Refund (money returned)
- Other (unusual, doesn't fit elsewhere)
- Uncategorized (truly unclear, needs human review)

For each transaction return a JSON object with:
- index: the transaction number (0-based)
- category: one of the categories above
- subcategory: optional refinement (e.g. "Meta" under Ad Spend)
- vendor: normalized vendor name extracted from description
- confidence: 0.0 to 1.0

Return ONLY a JSON array, no markdown fences, no commentary."""


async def categorize_transactions(transactions: list[dict]) -> list[dict]:
    """Send transactions to Claude for categorization. Returns list with
    category/subcategory/vendor/confidence added to each transaction.

    Falls back gracefully: on any failure, returns transactions unchanged
    (caller should apply regex fallback).
    """
    from config import ANTHROPIC_API_KEY
    if not ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — skipping AI categorization")
        return transactions

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    except Exception as e:
        logger.error("Failed to create Anthropic client: %s", e)
        return transactions

    batch_size = 50
    for start in range(0, len(transactions), batch_size):
        batch = transactions[start:start + batch_size]
        lines = []
        for i, tx in enumerate(batch):
            desc = tx.get("description", "")
            amt = tx.get("amount", 0)
            date = tx.get("date", "")
            lines.append(f"{i}: {desc} | {amt} CAD | {date}")

        user_msg = "\n".join(lines)

        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                temperature=0,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
            )

            text = response.content[0].text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            results = json.loads(text)

            for item in results:
                idx = item.get("index", -1)
                if 0 <= idx < len(batch):
                    batch[idx]["ai_category"] = item.get("category", "Uncategorized")
                    batch[idx]["ai_subcategory"] = item.get("subcategory")
                    batch[idx]["ai_vendor"] = item.get("vendor")
                    batch[idx]["ai_confidence"] = item.get("confidence", 0.0)

        except json.JSONDecodeError as e:
            logger.error("AI categorization JSON parse error: %s", e)
        except Exception as e:
            logger.error("AI categorization API error: %s", e)

    return transactions
