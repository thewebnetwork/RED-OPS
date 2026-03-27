"""
Scheduled Report Service

Generates and emails branded PDF reports on a schedule.
Supports: Ad Performance monthly reports per client.
"""
import logging
from datetime import datetime, timezone
from database import db
from services.report_generator import generate_ad_performance_pdf

logger = logging.getLogger(__name__)


async def get_previous_period(period: str) -> str:
    """Get the previous month period string."""
    dt = datetime.strptime(period, "%Y-%m")
    if dt.month == 1:
        return f"{dt.year - 1}-12"
    return f"{dt.year}-{dt.month - 1:02d}"


async def generate_client_report(client_id: str, period: str) -> dict | None:
    """
    Generate a PDF report for a client/period.
    Returns { pdf_bytes, filename, client_name, client_email } or None if no data.
    """
    from routes.ad_performance import aggregate_snapshots, get_client_name

    snapshots = await db.ad_snapshots.find({
        "client_id": client_id,
        "period": period,
    }).to_list(100)

    if not snapshots:
        return None

    # Aggregate current period
    snapshot_data = {
        "metrics": aggregate_snapshots(snapshots) or {},
        "campaigns": [],
        "notes": None,
    }
    for s in snapshots:
        if s.get("campaigns"):
            snapshot_data["campaigns"].extend(s["campaigns"])
        if s.get("notes") and not snapshot_data["notes"]:
            snapshot_data["notes"] = s["notes"]

    # Get previous period for comparison
    previous_data = None
    prev_period = await get_previous_period(period)
    prev_snapshots = await db.ad_snapshots.find({
        "client_id": client_id,
        "period": prev_period,
    }).to_list(100)
    if prev_snapshots:
        previous_data = {"metrics": aggregate_snapshots(prev_snapshots) or {}}

    client_name = snapshots[0].get("client_name") or await get_client_name(client_id)

    # Get client email
    client_user = await db.users.find_one({"id": client_id}, {"_id": 0, "email": 1})
    client_email = client_user.get("email") if client_user else None

    pdf_bytes = generate_ad_performance_pdf(
        client_name=client_name,
        period=period,
        snapshot_data=snapshot_data,
        previous_data=previous_data,
    )

    safe_name = client_name.replace(" ", "_").replace("/", "-")
    filename = f"RRM_AdReport_{safe_name}_{period}.pdf"

    return {
        "pdf_bytes": pdf_bytes,
        "filename": filename,
        "client_name": client_name,
        "client_email": client_email,
    }


async def send_report_email(client_email: str, client_name: str, period: str, pdf_bytes: bytes, filename: str):
    """Send a report email with PDF attachment."""
    try:
        from services.email import send_email_with_attachment
        await send_email_with_attachment(
            to_email=client_email,
            subject=f"Red Ribbon Media — Ad Performance Report ({period})",
            body=f"Hi {client_name.split(' ')[0]},\n\nPlease find attached your ad performance report for {period}.\n\nBest regards,\nRed Ribbon Media",
            attachment_bytes=pdf_bytes,
            attachment_filename=filename,
            attachment_content_type="application/pdf",
        )
        return True
    except Exception as e:
        logger.warning(f"Failed to send report email to {client_email}: {e}")
        return False


async def run_monthly_reports(period: str | None = None):
    """
    Generate and optionally email monthly ad performance reports for all clients.
    Returns summary of what was generated.
    """
    if not period:
        now = datetime.now(timezone.utc)
        # Default to previous month
        if now.month == 1:
            period = f"{now.year - 1}-12"
        else:
            period = f"{now.year}-{now.month - 1:02d}"

    # Get all clients with ad snapshots for this period
    client_ids = await db.ad_snapshots.distinct("client_id", {"period": period})

    results = []
    for client_id in client_ids:
        report = await generate_client_report(client_id, period)
        if report:
            results.append({
                "client_id": client_id,
                "client_name": report["client_name"],
                "client_email": report["client_email"],
                "filename": report["filename"],
                "size_kb": round(len(report["pdf_bytes"]) / 1024, 1),
            })

    return {
        "period": period,
        "reports_generated": len(results),
        "clients": results,
    }
