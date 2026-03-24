"""
Ad Performance Tracking System - "Hyros Lite"

Tracks ad performance metrics for Media Clients across platforms (Meta, Google, TikTok, LinkedIn).
Supports snapshot-based performance recording with aggregated summaries and agency-wide overviews.

Data Model: ad_snapshots collection
Each snapshot is a point-in-time record of ad performance for one client per platform per period.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/ad-performance", tags=["ad-performance"])


# ============== MODELS ==============

class MetricsDict(BaseModel):
    """Ad performance metrics"""
    ad_spend: float = Field(..., description="Total spend in dollars")
    impressions: int = Field(default=0, description="Number of impressions")
    clicks: int = Field(default=0, description="Number of clicks")
    leads: int = Field(default=0, description="Form fills, calls, etc.")
    cpl: Optional[float] = Field(None, description="Cost per lead (calculated or manual)")
    ctr: Optional[float] = Field(None, description="Click-through rate %")
    conversions: int = Field(default=0, description="Actual conversions (calls booked, deals)")
    roas: Optional[float] = Field(None, description="Return on ad spend")
    cpc: Optional[float] = Field(None, description="Cost per click")


class CampaignBreakdown(BaseModel):
    """Campaign-level breakdown within a snapshot"""
    name: str
    status: str = Field(..., description="active, paused, or completed")
    spend: float
    leads: int
    cpl: float


class AdSnapshotCreate(BaseModel):
    """Request body for creating a new ad snapshot"""
    client_id: str = Field(..., description="User ID of the Media Client")
    platform: str = Field(..., description="meta, google, tiktok, or linkedin")
    period: str = Field(..., description="YYYY-MM format")
    metrics: MetricsDict
    campaigns: Optional[List[CampaignBreakdown]] = None
    notes: Optional[str] = None


class AdSnapshotUpdate(BaseModel):
    """Request body for updating a snapshot"""
    metrics: Optional[MetricsDict] = None
    campaigns: Optional[List[CampaignBreakdown]] = None
    notes: Optional[str] = None


class AdSnapshot(BaseModel):
    """Full ad snapshot record"""
    id: str
    client_id: str
    client_name: str
    platform: str
    period: str
    metrics: MetricsDict
    campaigns: Optional[List[CampaignBreakdown]] = None
    notes: Optional[str] = None
    created_by: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ClientSummaryPeriod(BaseModel):
    """Period data for monthly trend"""
    period: str
    month: Optional[str] = None  # Alias for frontend compatibility
    total_spend: float
    total_leads: int
    total_cpl: float


class PlatformSummary(BaseModel):
    """Per-platform metrics breakdown"""
    platform: str
    ad_spend: float
    leads: int
    ctr: float
    cpl: float


class ClientSummary(BaseModel):
    """Aggregated summary for a single client"""
    client_id: str
    client_name: str
    current_month: Optional[Dict[str, Any]] = None
    previous_month: Optional[Dict[str, Any]] = None
    all_time_totals: Dict[str, Any]
    monthly_trends: List[ClientSummaryPeriod]
    active_platforms: List[str]
    platforms: List[PlatformSummary] = []  # Detailed per-platform breakdown


class PerClientAgencySummary(BaseModel):
    """Per-client summary for agency overview"""
    client_id: str
    client_name: str
    current_spend: float
    current_leads: int
    current_cpl: float
    platforms: List[str]
    health: str  # "strong", "ok", "needs_attention"


class AgencyOverview(BaseModel):
    """Agency-wide aggregate summary"""
    total_clients_with_data: int
    current_month_total_spend: float
    current_month_total_leads: int
    avg_cpl: float
    avg_roas: float
    per_client_summary: List[PerClientAgencySummary]
    monthly_totals: List[Dict[str, Any]]


# ============== HELPER FUNCTIONS ==============

async def get_client_name(client_id: str) -> str:
    """Fetch client name from users collection"""
    user = await db.users.find_one({"id": client_id}, {"name": 1})
    return user.get("name") if user else "Unknown Client"


def calculate_metrics(metrics_dict: dict) -> dict:
    """
    Auto-calculate derived metrics if not provided.
    CPL, CTR, CPC, ROAS will be computed from raw data.
    """
    m = metrics_dict.copy()

    # Calculate CPL if not provided
    if m.get("cpl") is None and m.get("leads", 0) > 0:
        m["cpl"] = round(m.get("ad_spend", 0) / m["leads"], 2)

    # Calculate CTR if not provided
    if m.get("ctr") is None and m.get("impressions", 0) > 0:
        m["ctr"] = round((m.get("clicks", 0) / m["impressions"]) * 100, 2)

    # Calculate CPC if not provided
    if m.get("cpc") is None and m.get("clicks", 0) > 0:
        m["cpc"] = round(m.get("ad_spend", 0) / m["clicks"], 2)

    return m


def get_org_id(user: dict) -> str:
    """Resolve org ID from user object"""
    return user.get("org_id") or user.get("team_id") or user.get("id")


def is_media_client(user: dict) -> bool:
    """Check if user is a Media Client"""
    return user.get("account_type") == "Media Client" or user.get("role") == "Media Client"


# ============== ENDPOINTS ==============

@router.post("/snapshots", response_model=AdSnapshot)
async def create_snapshot(
    body: AdSnapshotCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new ad performance snapshot for a client (Admin only).
    Auto-calculates derived metrics (CPL, CTR, CPC) if not provided.
    """
    # Only admins can create snapshots
    if current_user.get("role") not in ["Administrator", "Admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Fetch client name for denormalization
    client_name = await get_client_name(body.client_id)

    # Calculate derived metrics
    metrics = calculate_metrics(body.metrics.dict())

    # Create snapshot document
    snapshot = {
        "id": str(uuid.uuid4()),
        "client_id": body.client_id,
        "client_name": client_name,
        "platform": body.platform,
        "period": body.period,
        "metrics": metrics,
        "campaigns": body.campaigns.model_dump() if body.campaigns else None,
        "notes": body.notes,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    result = await db.ad_snapshots.insert_one(snapshot)
    snapshot["_id"] = result.inserted_id

    return AdSnapshot(**snapshot)


@router.get("/snapshots", response_model=List[AdSnapshot])
async def list_snapshots(
    client_id: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    period_from: Optional[str] = Query(None, description="YYYY-MM format"),
    period_to: Optional[str] = Query(None, description="YYYY-MM format"),
    current_user: dict = Depends(get_current_user)
):
    """
    List ad performance snapshots.
    - If user is Media Client: auto-filter to their own client_id
    - If user is Admin: can filter by any client_id or see all
    - Sorted by period DESC, then platform
    """
    query = {}

    # If Media Client, restrict to own data
    if is_media_client(current_user):
        query["client_id"] = current_user.get("id")
    else:
        # Admin can filter by client_id if provided
        if client_id:
            query["client_id"] = client_id

    # Platform filter
    if platform:
        query["platform"] = platform

    # Period range filter
    if period_from or period_to:
        period_query = {}
        if period_from:
            period_query["$gte"] = period_from
        if period_to:
            period_query["$lte"] = period_to
        if period_query:
            query["period"] = period_query

    # Fetch and sort
    cursor = db.ad_snapshots.find(query).sort([("period", -1), ("platform", 1)])
    snapshots = await cursor.to_list(None)

    return [AdSnapshot(**s) for s in snapshots]


@router.get("/snapshots/{snapshot_id}", response_model=AdSnapshot)
async def get_snapshot(
    snapshot_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single snapshot. Clients can only see their own."""
    snapshot = await db.ad_snapshots.find_one({"id": snapshot_id})

    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    # Media Clients can only view their own snapshots
    if is_media_client(current_user) and snapshot["client_id"] != current_user.get("id"):
        raise HTTPException(status_code=403, detail="You can only view your own snapshots")

    return AdSnapshot(**snapshot)


@router.patch("/snapshots/{snapshot_id}", response_model=AdSnapshot)
async def update_snapshot(
    snapshot_id: str,
    body: AdSnapshotUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a snapshot (Admin only)"""
    if current_user.get("role") not in ["Administrator", "Admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    snapshot = await db.ad_snapshots.find_one({"id": snapshot_id})
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    update_data = {}

    if body.metrics:
        # Calculate derived metrics for updates
        update_data["metrics"] = calculate_metrics(body.metrics.dict())

    if body.campaigns is not None:
        update_data["campaigns"] = [c.model_dump() for c in body.campaigns]

    if body.notes is not None:
        update_data["notes"] = body.notes

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.ad_snapshots.update_one({"id": snapshot_id}, {"$set": update_data})

    # Fetch updated document
    updated = await db.ad_snapshots.find_one({"id": snapshot_id})
    return AdSnapshot(**updated)


@router.delete("/snapshots/{snapshot_id}")
async def delete_snapshot(
    snapshot_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a snapshot (Admin only)"""
    if current_user.get("role") not in ["Administrator", "Admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.ad_snapshots.delete_one({"id": snapshot_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    return {"status": "deleted", "snapshot_id": snapshot_id}


@router.get("/summary/{client_id}", response_model=ClientSummary)
async def get_client_summary(
    client_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get aggregated summary for a client.
    Includes current/previous month metrics, all-time totals, and monthly trends.
    Clients can only access their own summary.
    """
    # Restrict access: clients can only view their own summary
    if is_media_client(current_user) and current_user.get("id") != client_id:
        raise HTTPException(status_code=403, detail="You can only view your own summary")

    # Fetch all snapshots for this client
    snapshots = await db.ad_snapshots.find({"client_id": client_id}).to_list(None)

    if not snapshots:
        raise HTTPException(status_code=404, detail="No data found for this client")

    # Get client name
    client_name = snapshots[0].get("client_name") or await get_client_name(client_id)

    # Get current and previous month (by period string)
    all_periods = sorted(set(s["period"] for s in snapshots), reverse=True)
    current_period = all_periods[0] if all_periods else None
    previous_period = all_periods[1] if len(all_periods) > 1 else None

    # Build current month summary (aggregate by platform if multiple snapshots)
    current_month = None
    if current_period:
        current_snapshots = [s for s in snapshots if s["period"] == current_period]
        current_month = aggregate_snapshots(current_snapshots)

    # Build previous month summary
    previous_month = None
    if previous_period:
        previous_snapshots = [s for s in snapshots if s["period"] == previous_period]
        previous_month = aggregate_snapshots(previous_snapshots)

    # Build all-time totals
    all_time_totals = {
        "total_spend": sum(s["metrics"].get("ad_spend", 0) for s in snapshots),
        "total_leads": sum(s["metrics"].get("leads", 0) for s in snapshots),
        "total_conversions": sum(s["metrics"].get("conversions", 0) for s in snapshots),
        "avg_cpl": calculate_avg_cpl([s["metrics"] for s in snapshots]),
        "avg_roas": calculate_avg_roas([s["metrics"] for s in snapshots]),
    }

    # Build monthly trends
    monthly_trends = []
    for period in sorted(set(s["period"] for s in snapshots)):
        period_snapshots = [s for s in snapshots if s["period"] == period]
        total_spend = sum(s["metrics"].get("ad_spend", 0) for s in period_snapshots)
        total_leads = sum(s["metrics"].get("leads", 0) for s in period_snapshots)
        total_cpl = calculate_avg_cpl([s["metrics"] for s in period_snapshots])

        monthly_trends.append(ClientSummaryPeriod(
            period=period,
            month=period,  # Alias for frontend compatibility
            total_spend=total_spend,
            total_leads=total_leads,
            total_cpl=total_cpl
        ))

    # Get active platforms
    active_platforms = sorted(set(s["platform"] for s in snapshots))

    # Build per-platform breakdown with metrics (latest period)
    platform_summaries = []
    for plat in active_platforms:
        plat_snapshots = [s for s in snapshots if s["platform"] == plat and s["period"] == current_period] if current_period else []
        if plat_snapshots:
            plat_spend = sum(s["metrics"].get("ad_spend", 0) for s in plat_snapshots)
            plat_leads = sum(s["metrics"].get("leads", 0) for s in plat_snapshots)
            plat_impressions = sum(s["metrics"].get("impressions", 0) for s in plat_snapshots)
            plat_clicks = sum(s["metrics"].get("clicks", 0) for s in plat_snapshots)
            plat_ctr = round((plat_clicks / plat_impressions) * 100, 2) if plat_impressions > 0 else 0
            plat_cpl = round(plat_spend / plat_leads, 2) if plat_leads > 0 else 0
            platform_summaries.append(PlatformSummary(
                platform=plat, ad_spend=plat_spend, leads=plat_leads, ctr=plat_ctr, cpl=plat_cpl
            ))

    return ClientSummary(
        client_id=client_id,
        client_name=client_name,
        current_month=current_month,
        previous_month=previous_month,
        all_time_totals=all_time_totals,
        monthly_trends=monthly_trends,
        active_platforms=active_platforms,
        platforms=platform_summaries
    )


@router.get("/agency-overview", response_model=AgencyOverview)
async def get_agency_overview(
    current_user: dict = Depends(get_current_user)
):
    """
    Get agency-wide aggregate summary across ALL clients (Admin only).
    Includes per-client breakdown and health scoring.
    """
    if current_user.get("role") not in ["Administrator", "Admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Fetch all snapshots
    all_snapshots = await db.ad_snapshots.find({}).to_list(None)

    if not all_snapshots:
        return AgencyOverview(
            total_clients_with_data=0,
            current_month_total_spend=0,
            current_month_total_leads=0,
            avg_cpl=0,
            avg_roas=0,
            per_client_summary=[],
            monthly_totals=[]
        )

    # Get unique clients
    client_ids = set(s["client_id"] for s in all_snapshots)

    # Get current month
    all_periods = sorted(set(s["period"] for s in all_snapshots), reverse=True)
    current_period = all_periods[0] if all_periods else None

    # Build per-client summary
    per_client_summary = []
    for client_id in client_ids:
        client_snapshots = [s for s in all_snapshots if s["client_id"] == client_id]
        client_name = client_snapshots[0].get("client_name") or "Unknown"

        # Current month metrics
        current_snapshots = [s for s in client_snapshots if s["period"] == current_period]
        current_spend = sum(s["metrics"].get("ad_spend", 0) for s in current_snapshots)
        current_leads = sum(s["metrics"].get("leads", 0) for s in current_snapshots)
        current_cpl = calculate_avg_cpl([s["metrics"] for s in current_snapshots])

        # Determine health status
        health = "ok"
        if current_cpl > 0 and current_cpl < 50:  # CPL below $50 is "strong"
            health = "strong"
        elif current_cpl == 0 or len(current_snapshots) == 0:
            health = "needs_attention"

        platforms = sorted(set(s["platform"] for s in client_snapshots))

        per_client_summary.append(PerClientAgencySummary(
            client_id=client_id,
            client_name=client_name,
            current_spend=current_spend,
            current_leads=current_leads,
            current_cpl=current_cpl,
            platforms=platforms,
            health=health
        ))

    # Current month totals
    current_month_snapshots = [s for s in all_snapshots if s["period"] == current_period]
    current_month_total_spend = sum(s["metrics"].get("ad_spend", 0) for s in current_month_snapshots)
    current_month_total_leads = sum(s["metrics"].get("leads", 0) for s in current_month_snapshots)

    # Average metrics
    all_metrics = [s["metrics"] for s in all_snapshots]
    avg_cpl = calculate_avg_cpl(all_metrics)
    avg_roas = calculate_avg_roas(all_metrics)

    # Build monthly totals for chart
    monthly_totals = []
    for period in sorted(set(s["period"] for s in all_snapshots)):
        period_snapshots = [s for s in all_snapshots if s["period"] == period]
        monthly_totals.append({
            "period": period,
            "month": period,  # Alias for frontend compatibility
            "total_spend": sum(s["metrics"].get("ad_spend", 0) for s in period_snapshots),
            "total_leads": sum(s["metrics"].get("leads", 0) for s in period_snapshots),
        })

    return AgencyOverview(
        total_clients_with_data=len(client_ids),
        current_month_total_spend=current_month_total_spend,
        current_month_total_leads=current_month_total_leads,
        avg_cpl=avg_cpl,
        avg_roas=avg_roas,
        per_client_summary=per_client_summary,
        monthly_totals=monthly_totals
    )


# ============== AGGREGATION HELPERS ==============

def aggregate_snapshots(snapshots: List[dict]) -> Dict[str, Any]:
    """
    Aggregate multiple snapshots (same period, different platforms)
    into a single summary object.
    """
    if not snapshots:
        return None

    total_spend = sum(s["metrics"].get("ad_spend", 0) for s in snapshots)
    total_impressions = sum(s["metrics"].get("impressions", 0) for s in snapshots)
    total_clicks = sum(s["metrics"].get("clicks", 0) for s in snapshots)
    total_leads = sum(s["metrics"].get("leads", 0) for s in snapshots)
    total_conversions = sum(s["metrics"].get("conversions", 0) for s in snapshots)

    # Calculate derived metrics
    cpl = round(total_spend / total_leads, 2) if total_leads > 0 else 0
    ctr = round((total_clicks / total_impressions) * 100, 2) if total_impressions > 0 else 0
    cpc = round(total_spend / total_clicks, 2) if total_clicks > 0 else 0
    roas = calculate_avg_roas([s["metrics"] for s in snapshots])

    return {
        "ad_spend": total_spend,
        "impressions": total_impressions,
        "clicks": total_clicks,
        "leads": total_leads,
        "conversions": total_conversions,
        "cpl": cpl,
        "ctr": ctr,
        "cpc": cpc,
        "roas": roas,
        "platforms": sorted(set(s["platform"] for s in snapshots))
    }


def calculate_avg_cpl(metrics_list: List[dict]) -> float:
    """Calculate average CPL across metrics"""
    if not metrics_list:
        return 0

    valid_cpls = [m.get("cpl") for m in metrics_list if m.get("cpl") and m.get("cpl") > 0]

    if not valid_cpls:
        # Try to calculate from raw data
        total_spend = sum(m.get("ad_spend", 0) for m in metrics_list)
        total_leads = sum(m.get("leads", 0) for m in metrics_list)
        return round(total_spend / total_leads, 2) if total_leads > 0 else 0

    return round(sum(valid_cpls) / len(valid_cpls), 2)


def calculate_avg_roas(metrics_list: List[dict]) -> float:
    """Calculate average ROAS across metrics"""
    if not metrics_list:
        return 0

    valid_roass = [m.get("roas") for m in metrics_list if m.get("roas") and m.get("roas") > 0]

    if not valid_roass:
        return 0

    return round(sum(valid_roass) / len(valid_roass), 2)
