"""AI-powered CSV format detection using Claude.

Reads the first ~25 lines of a CSV and returns a structured parsing spec.
Falls back to {"format_name": "Unknown", "confidence": 0.0} on any failure.
"""
import json
import logging

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You analyze financial CSV exports and extract their structure. Return STRICT JSON, no markdown, no explanation.

Some files have:
- A BOM character at the start
- Metadata rows before the real CSV header (e.g., "Following data is valid as of...")
- Blank rows between metadata and real header
- Real header on row 4, 5, or later
- Leading/trailing whitespace in column names
- Quoted values with escape characters
- Card numbers wrapped in single quotes (e.g., '5273350016197848')

You will receive the first ~25 lines of a CSV file and must identify:
- Where the real header row starts (how many rows to skip)
- Which columns hold the date, amount, and description
- How the sign of the amount is determined

Return exactly this JSON structure:

{
  "format_name": "<BMO Credit Card|BMO Chequing|RBC|TD|Scotiabank|CIBC|Wise|Stripe|Meta Ads|Generic Bank|Unknown>",
  "skip_rows": <integer: rows BEFORE the header row (0 if header is row 1)>,
  "header_columns": ["col1", "col2", ...],
  "date_column": "<column name or null>",
  "date_format": "<YYYYMMDD|YYYY-MM-DD|MM/DD/YYYY|DD/MM/YYYY|YYYY-MM-DD HH:MM:SS|null>",
  "amount_column": "<column name or null — if single signed amount column>",
  "debit_column": "<column name or null — if separate debit>",
  "credit_column": "<column name or null — if separate credit>",
  "direction_column": "<column name or null — if sign comes from direction>",
  "direction_positive_value": "<value that means credit/income e.g. IN/CREDIT/null>",
  "description_column": "<column name or null>",
  "strip_value_quotes": <bool — true if values are wrapped in single/double quotes to strip>,
  "confidence": <0.0-1.0>
}

If confidence is below 0.5, set format_name to "Unknown" and all other fields to null."""

UNKNOWN_SPEC = {
    "format_name": "Unknown",
    "skip_rows": 0,
    "header_columns": [],
    "date_column": None,
    "date_format": None,
    "amount_column": None,
    "debit_column": None,
    "credit_column": None,
    "direction_column": None,
    "direction_positive_value": None,
    "description_column": None,
    "strip_value_quotes": False,
    "confidence": 0.0,
}


async def detect_csv_format(csv_text: str, filename: str = "") -> dict:
    """Send first ~25 lines of CSV to Claude for format detection.
    Returns a spec dict. Falls back to UNKNOWN_SPEC on any failure."""
    from config import ANTHROPIC_API_KEY
    if not ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — skipping AI format detection")
        return dict(UNKNOWN_SPEC)

    lines = csv_text.split("\n")[:25]
    sample = "\n".join(lines)

    user_msg = f"Filename: {filename}\n\n```\n{sample}\n```"

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            temperature=0,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )

        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        spec = json.loads(text)

        if spec.get("confidence", 0) < 0.5:
            logger.info("AI format detection low confidence (%.2f) for %s", spec.get("confidence", 0), filename)
            return dict(UNKNOWN_SPEC)

        for key in UNKNOWN_SPEC:
            if key not in spec:
                spec[key] = UNKNOWN_SPEC[key]

        logger.info("AI detected format: %s (confidence %.2f) for %s",
                     spec.get("format_name"), spec.get("confidence"), filename)
        return spec

    except json.JSONDecodeError as e:
        logger.error("AI format detection JSON parse error: %s", e)
        return dict(UNKNOWN_SPEC)
    except Exception as e:
        logger.error("AI format detection error: %s", e)
        return dict(UNKNOWN_SPEC)
