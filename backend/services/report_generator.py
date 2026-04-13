"""
PDF report generator for Ad Performance snapshots.
Uses ReportLab to produce branded Red Ribbon Media reports.
"""
import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

# Brand palette
RRG_RED = colors.HexColor("#c92a3e")
RRG_DARK = colors.HexColor("#1a1a1a")
LIGHT_GRAY = colors.HexColor("#f5f5f5")
BORDER_GRAY = colors.HexColor("#dddddd")
TEXT_SECONDARY = colors.HexColor("#666666")


def _fmt_currency(val, currency="USD"):
    if val is None:
        return "—"
    symbols = {"USD": "$", "CAD": "CA$", "EUR": "€", "GBP": "£", "AUD": "AU$"}
    prefix = symbols.get((currency or "USD").upper(), f"{currency} ")
    return f"{prefix}{val:,.2f}"


def _fmt_number(val):
    if val is None:
        return "—"
    return f"{int(val):,}"


def _fmt_pct(val):
    if val is None:
        return "—"
    return f"{val:.2f}%"


def _pct_change(current, previous):
    """Return formatted % change string or '—'."""
    if not current or not previous or previous == 0:
        return "—"
    delta = ((current - previous) / previous) * 100
    sign = "+" if delta >= 0 else ""
    return f"{sign}{delta:.1f}%"


def generate_ad_performance_pdf(
    client_name: str,
    period: str,
    snapshot_data: dict,
    previous_data: dict | None = None,
) -> bytes:
    """
    Generate a branded PDF report for a single client's ad performance period.

    Args:
        client_name: Display name of the client
        period: YYYY-MM period string
        snapshot_data: Aggregated metrics dict with keys: metrics, campaigns, notes
        previous_data: Optional previous month metrics dict for MoM comparison

    Returns:
        PDF file content as bytes
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        topMargin=0.6 * inch,
        bottomMargin=0.8 * inch,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        "RRGTitle",
        parent=styles["Heading1"],
        fontSize=20,
        textColor=RRG_RED,
        spaceAfter=4,
        fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "RRGSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=TEXT_SECONDARY,
        spaceAfter=12,
    ))
    styles.add(ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=RRG_DARK,
        spaceBefore=18,
        spaceAfter=8,
        fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "BodyText",
        parent=styles["Normal"],
        fontSize=10,
        textColor=RRG_DARK,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "FooterStyle",
        parent=styles["Normal"],
        fontSize=8,
        textColor=TEXT_SECONDARY,
        alignment=1,  # center
    ))

    elements = []
    metrics = snapshot_data.get("metrics", {})
    campaigns = snapshot_data.get("campaigns") or []
    notes = snapshot_data.get("notes")
    prev_metrics = previous_data.get("metrics", {}) if previous_data else {}

    # ── Header ──
    elements.append(Paragraph("Red Ribbon Media", styles["RRGTitle"]))
    elements.append(Paragraph("Ad Performance Report", styles["SectionHeader"]))

    period_display = period
    try:
        dt = datetime.strptime(period, "%Y-%m")
        period_display = dt.strftime("%B %Y")
    except (ValueError, TypeError):
        pass

    generated_at = datetime.now(timezone.utc).strftime("%B %d, %Y at %H:%M UTC")
    elements.append(Paragraph(
        f"<b>Client:</b> {client_name} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Period:</b> {period_display} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Generated:</b> {generated_at}",
        styles["RRGSubtitle"],
    ))

    elements.append(HRFlowable(
        width="100%", thickness=1, color=RRG_RED, spaceAfter=16, spaceBefore=4,
    ))

    # ── KPI Summary Table ──
    elements.append(Paragraph("Performance Summary", styles["SectionHeader"]))

    kpi_headers = ["Metric", "Current Period"]
    has_comparison = bool(prev_metrics and prev_metrics.get("ad_spend"))
    if has_comparison:
        kpi_headers += ["Previous Period", "Change"]

    kpi_rows = [kpi_headers]

    cur = metrics.get("currency", "USD")
    prev_cur = prev_metrics.get("currency", cur)
    kpi_items = [
        ("Ad Spend", _fmt_currency(metrics.get("ad_spend"), cur),
         _fmt_currency(prev_metrics.get("ad_spend"), prev_cur),
         _pct_change(metrics.get("ad_spend"), prev_metrics.get("ad_spend"))),
        ("Impressions", _fmt_number(metrics.get("impressions")),
         _fmt_number(prev_metrics.get("impressions")),
         _pct_change(metrics.get("impressions"), prev_metrics.get("impressions"))),
        ("Reach", _fmt_number(metrics.get("reach")),
         _fmt_number(prev_metrics.get("reach")),
         _pct_change(metrics.get("reach"), prev_metrics.get("reach"))),
        ("Clicks", _fmt_number(metrics.get("clicks")),
         _fmt_number(prev_metrics.get("clicks")),
         _pct_change(metrics.get("clicks"), prev_metrics.get("clicks"))),
        ("Leads", _fmt_number(metrics.get("leads")),
         _fmt_number(prev_metrics.get("leads")),
         _pct_change(metrics.get("leads"), prev_metrics.get("leads"))),
        ("Cost per Lead", _fmt_currency(metrics.get("cpl"), cur),
         _fmt_currency(prev_metrics.get("cpl"), prev_cur),
         _pct_change(metrics.get("cpl"), prev_metrics.get("cpl"))),
        ("CTR", _fmt_pct((metrics.get("ctr") or 0) * 100),
         _fmt_pct((prev_metrics.get("ctr") or 0) * 100),
         _pct_change(metrics.get("ctr"), prev_metrics.get("ctr"))),
    ]

    for label, current, previous, change in kpi_items:
        row = [label, current]
        if has_comparison:
            row += [previous, change]
        kpi_rows.append(row)

    col_count = len(kpi_headers)
    col_widths = [1.8 * inch, 1.5 * inch] if col_count == 2 else [1.6 * inch, 1.4 * inch, 1.4 * inch, 1.0 * inch]

    kpi_table = Table(kpi_rows, colWidths=col_widths[:col_count])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), RRG_RED),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 12))

    # ── Campaign Breakdown ──
    if campaigns:
        elements.append(Paragraph("Campaign Breakdown", styles["SectionHeader"]))

        camp_rows = [["Campaign Name", "Spend", "Leads", "CPL"]]
        for c in campaigns:
            c_data = c if isinstance(c, dict) else c
            camp_rows.append([
                c_data.get("name", "—"),
                _fmt_currency(c_data.get("spend"), cur),
                _fmt_number(c_data.get("leads")),
                _fmt_currency(c_data.get("cpl"), cur),
            ])

        camp_widths = [3.0 * inch, 1.3 * inch, 1.0 * inch, 1.3 * inch]
        camp_table = Table(camp_rows, colWidths=camp_widths)
        camp_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), RRG_RED),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        elements.append(camp_table)
        elements.append(Spacer(1, 12))

    # ── Notes ──
    if notes:
        elements.append(Paragraph("Notes", styles["SectionHeader"]))
        elements.append(Paragraph(notes, styles["BodyText"]))
        elements.append(Spacer(1, 12))

    # ── Footer ──
    elements.append(Spacer(1, 24))
    elements.append(HRFlowable(
        width="100%", thickness=0.5, color=BORDER_GRAY, spaceAfter=8,
    ))
    elements.append(Paragraph(
        "Confidential — Prepared by Red Ribbon Media",
        styles["FooterStyle"],
    ))

    doc.build(elements)
    return buf.getvalue()
