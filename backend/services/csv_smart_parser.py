"""Parse any CSV using a format spec from the AI detector.

The spec tells us which row is the header, which columns hold date/amount/description,
and how the sign of the amount is determined.
"""
import csv
import io
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

DATE_FORMATS = {
    "YYYYMMDD": "%Y%m%d",
    "YYYY-MM-DD": "%Y-%m-%d",
    "MM/DD/YYYY": "%m/%d/%Y",
    "DD/MM/YYYY": "%d/%m/%Y",
    "YYYY-MM-DD HH:MM:SS": "%Y-%m-%d %H:%M:%S",
}


def _parse_date(raw: str, fmt_hint: Optional[str] = None) -> Optional[str]:
    """Return YYYY-MM-DD or None."""
    if not raw:
        return None
    raw = raw.strip().strip("'\"")

    if fmt_hint and fmt_hint in DATE_FORMATS:
        try:
            return datetime.strptime(raw[:len(DATE_FORMATS[fmt_hint]) + 5], DATE_FORMATS[fmt_hint]).date().isoformat()
        except ValueError:
            pass

    for py_fmt in ["%Y%m%d", "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
        try:
            return datetime.strptime(raw.split(".")[0].rstrip("Z"), py_fmt).date().isoformat()
        except ValueError:
            continue

    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


def _parse_amount(raw) -> Optional[float]:
    if raw is None or str(raw).strip() == "":
        return None
    try:
        cleaned = str(raw).strip().strip("'\"").replace(",", "").replace("$", "").replace(" ", "")
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def _strip_val(v: str, strip_quotes: bool) -> str:
    v = v.strip()
    if strip_quotes:
        v = v.strip("'\"")
    return v


def parse_with_format_spec(csv_text: str, spec: dict) -> tuple[list[dict], list[dict]]:
    """Parse CSV using the AI-generated spec.
    Returns (rows, errors)."""
    skip_rows = spec.get("skip_rows", 0)
    date_col = spec.get("date_column")
    amount_col = spec.get("amount_column")
    debit_col = spec.get("debit_column")
    credit_col = spec.get("credit_column")
    direction_col = spec.get("direction_column")
    direction_pos = (spec.get("direction_positive_value") or "").upper()
    desc_col = spec.get("description_column")
    date_fmt = spec.get("date_format")
    strip_quotes = spec.get("strip_value_quotes", False)
    format_name = spec.get("format_name", "unknown")

    lines = csv_text.split("\n")

    if skip_rows > 0 and skip_rows < len(lines):
        lines = lines[skip_rows:]

    reader = csv.reader(io.StringIO("\n".join(lines)))
    all_rows = list(reader)

    if len(all_rows) < 2:
        return [], [{"row": 0, "reason": "Not enough rows after skipping metadata"}]

    raw_headers = all_rows[0]
    headers = [h.strip().strip("\ufeff").strip("'\"") for h in raw_headers]

    def col_idx(name):
        if not name:
            return None
        name_lower = name.strip().lower()
        for i, h in enumerate(headers):
            if h.lower() == name_lower:
                return i
        for i, h in enumerate(headers):
            if name_lower in h.lower():
                return i
        return None

    date_idx = col_idx(date_col)
    amount_idx = col_idx(amount_col)
    debit_idx = col_idx(debit_col)
    credit_idx = col_idx(credit_col)
    direction_idx = col_idx(direction_col)
    desc_idx = col_idx(desc_col)

    rows, errors = [], []

    for row_num, row in enumerate(all_rows[1:], start=skip_rows + 2):
        if not any(c.strip() for c in row):
            continue

        raw_dict = {}
        for i, val in enumerate(row):
            if i < len(headers):
                raw_dict[headers[i]] = _strip_val(val, strip_quotes) if strip_quotes else val.strip()

        date_raw = _strip_val(row[date_idx], strip_quotes) if date_idx is not None and date_idx < len(row) else ""
        date = _parse_date(date_raw, date_fmt)

        amount = None
        tx_type = "expense"

        if amount_idx is not None and amount_idx < len(row):
            val = _strip_val(row[amount_idx], strip_quotes)
            amount = _parse_amount(val)
            if amount is not None:
                if amount < 0:
                    tx_type = "expense"
                    amount = abs(amount)
                else:
                    tx_type = "income"
        elif debit_idx is not None or credit_idx is not None:
            debit = _parse_amount(_strip_val(row[debit_idx], strip_quotes)) if debit_idx is not None and debit_idx < len(row) else None
            credit = _parse_amount(_strip_val(row[credit_idx], strip_quotes)) if credit_idx is not None and credit_idx < len(row) else None
            if debit and debit > 0:
                amount = debit
                tx_type = "expense"
            elif credit and credit > 0:
                amount = credit
                tx_type = "income"
        elif direction_idx is not None and amount_idx is not None:
            val = _strip_val(row[amount_idx], strip_quotes) if amount_idx < len(row) else ""
            amount = _parse_amount(val)
            if amount is not None:
                direction = _strip_val(row[direction_idx], strip_quotes).upper() if direction_idx < len(row) else ""
                if direction == direction_pos:
                    tx_type = "income"
                else:
                    tx_type = "expense"
                amount = abs(amount)

        desc_raw = _strip_val(row[desc_idx], strip_quotes) if desc_idx is not None and desc_idx < len(row) else ""
        desc = desc_raw.strip() or "(no description)"

        if amount is None or not date:
            errors.append({"row": row_num, "reason": f"Missing date or amount (date={date_raw!r}, amount={row[amount_idx] if amount_idx and amount_idx < len(row) else '?'})"})
            continue

        rows.append({
            "type": tx_type,
            "amount": round(amount, 2),
            "original_amount": round(amount, 2),
            "original_currency": "CAD",
            "exchange_rate": 1.0,
            "cad_amount": round(amount, 2),
            "description": desc,
            "date": date,
            "account": format_name.lower().replace(" ", "_"),
            "external_id": None,
            "source": f"{format_name.lower().replace(' ', '_')}_import",
            "raw": raw_dict,
        })

    logger.info("Smart parser: %d rows parsed, %d errors from %s format", len(rows), len(errors), format_name)
    return rows, errors
