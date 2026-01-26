"""Feedback routes - Feature Requests and Bug Reports"""
import uuid
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Literal

from database import db
from utils.auth import get_current_user, require_roles
from utils.helpers import get_utc_now, get_next_code, create_notification

router = APIRouter(tags=["Feedback"])


# ============== MODELS ==============

class FeatureRequestCreate(BaseModel):
    title: str
    category_l1_id: Optional[str] = None
    category_l2_id: Optional[str] = None
    description: str
    why_important: Optional[str] = None
    who_is_for: Optional[str] = None
    reference_links: Optional[str] = None
    priority: Literal["Low", "Normal", "High"] = "Normal"
    is_draft: bool = False  # If true, save as Draft instead of Open


class FeatureRequestResponse(BaseModel):
    id: str
    request_code: str
    request_type: str
    requester_id: str
    requester_name: str
    title: str
    category_l1_id: Optional[str] = None
    category_l1_name: Optional[str] = None
    category_l2_id: Optional[str] = None
    category_l2_name: Optional[str] = None
    description: str
    why_important: Optional[str] = None
    who_is_for: Optional[str] = None
    reference_links: Optional[str] = None
    priority: str
    status: str
    created_at: str
    updated_at: str


class BugReportCreate(BaseModel):
    title: str
    category_l1_id: Optional[str] = None
    category_l2_id: Optional[str] = None
    bug_type: str
    steps_to_reproduce: str = ""
    expected_behavior: str = ""
    actual_behavior: str = ""
    browser: Optional[str] = None
    device: Optional[str] = None
    url_page: Optional[str] = None
    severity: Literal["Low", "Normal", "High", "Urgent"] = "Normal"
    is_draft: bool = False  # If true, save as Draft instead of Open
    description: Optional[str] = None  # Optional for drafts


class BugReportResponse(BaseModel):
    id: str
    report_code: str
    request_type: str
    requester_id: str
    requester_name: str
    title: str
    category_l1_id: Optional[str] = None
    category_l1_name: Optional[str] = None
    category_l2_id: Optional[str] = None
    category_l2_name: Optional[str] = None
    bug_type: str
    steps_to_reproduce: str
    expected_behavior: str
    actual_behavior: str
    browser: Optional[str] = None
    device: Optional[str] = None
    url_page: Optional[str] = None
    severity: str
    status: str
    created_at: str
    updated_at: str


class UnifiedRequestResponse(BaseModel):
    id: str
    code: str
    request_type: str
    title: str
    category_l1_name: Optional[str] = None
    category_l2_name: Optional[str] = None
    status: str
    priority_or_severity: str
    assigned_to_name: Optional[str] = None
    created_at: str
    updated_at: str


# ============== FEATURE REQUEST ROUTES ==============

@router.post("/feature-requests", response_model=FeatureRequestResponse)
async def create_feature_request(request_data: FeatureRequestCreate, current_user: dict = Depends(get_current_user)):
    """Create a new feature request (or save as draft)"""
    request_code = await get_next_code(db, "feature_request_code", "FR")
    now = get_utc_now()
    
    is_draft = getattr(request_data, 'is_draft', False)
    initial_status = "Draft" if is_draft else "Open"
    
    cat_l1_name = None
    cat_l2_name = None
    if request_data.category_l1_id:
        l1 = await db.categories_l1.find_one({"id": request_data.category_l1_id}, {"_id": 0})
        cat_l1_name = l1["name"] if l1 else None
    if request_data.category_l2_id:
        l2 = await db.categories_l2.find_one({"id": request_data.category_l2_id}, {"_id": 0})
        cat_l2_name = l2["name"] if l2 else None
    
    feature_request = {
        "id": str(uuid.uuid4()),
        "request_code": request_code,
        "request_type": "Feature",
        "requester_id": current_user["id"],
        "requester_name": current_user["name"],
        "title": request_data.title,
        "category_l1_id": request_data.category_l1_id,
        "category_l1_name": cat_l1_name,
        "category_l2_id": request_data.category_l2_id,
        "category_l2_name": cat_l2_name,
        "description": request_data.description,
        "why_important": request_data.why_important,
        "who_is_for": request_data.who_is_for,
        "reference_links": request_data.reference_links,
        "priority": request_data.priority,
        "status": initial_status,
        "created_at": now,
        "updated_at": now
    }
    await db.feature_requests.insert_one(feature_request)
    
    # Only notify admins for non-draft requests
    if not is_draft:
        admins = await db.users.find({"role": "Admin", "active": True}, {"_id": 0}).to_list(100)
        for admin in admins:
            await create_notification(
                db,
                admin['id'],
                "new_feature_request",
                "New feature request",
                f"New feature request {request_code}: {request_data.title}",
                feature_request['id']
            )
    
    return FeatureRequestResponse(**feature_request)


@router.put("/feature-requests/{request_id}/draft", response_model=FeatureRequestResponse)
async def update_feature_request_draft(request_id: str, request_data: FeatureRequestCreate, current_user: dict = Depends(get_current_user)):
    """Update a draft feature request"""
    request = await db.feature_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Feature request not found")
    
    if request["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only update your own drafts")
    
    if request["status"] != "Draft":
        raise HTTPException(status_code=400, detail="Only draft requests can be updated this way")
    
    cat_l1_name = None
    cat_l2_name = None
    if request_data.category_l1_id:
        l1 = await db.categories_l1.find_one({"id": request_data.category_l1_id}, {"_id": 0})
        cat_l1_name = l1["name"] if l1 else None
    if request_data.category_l2_id:
        l2 = await db.categories_l2.find_one({"id": request_data.category_l2_id}, {"_id": 0})
        cat_l2_name = l2["name"] if l2 else None
    
    now = get_utc_now()
    await db.feature_requests.update_one(
        {"id": request_id},
        {"$set": {
            "title": request_data.title,
            "description": request_data.description,
            "category_l1_id": request_data.category_l1_id,
            "category_l1_name": cat_l1_name,
            "category_l2_id": request_data.category_l2_id,
            "category_l2_name": cat_l2_name,
            "why_important": request_data.why_important,
            "who_is_for": request_data.who_is_for,
            "reference_links": request_data.reference_links,
            "priority": request_data.priority,
            "updated_at": now
        }}
    )
    
    updated = await db.feature_requests.find_one({"id": request_id}, {"_id": 0})
    return FeatureRequestResponse(**updated)


@router.post("/feature-requests/{request_id}/submit", response_model=FeatureRequestResponse)
async def submit_feature_request_draft(request_id: str, current_user: dict = Depends(get_current_user)):
    """Submit a draft feature request - converts Draft to Open status"""
    request = await db.feature_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Feature request not found")
    
    if request["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only submit your own drafts")
    
    if request["status"] != "Draft":
        raise HTTPException(status_code=400, detail="Only draft requests can be submitted")
    
    now = get_utc_now()
    await db.feature_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "Open", "updated_at": now}}
    )
    
    # Now notify admins
    admins = await db.users.find({"role": "Admin", "active": True}, {"_id": 0}).to_list(100)
    for admin in admins:
        await create_notification(
            db,
            admin['id'],
            "new_feature_request",
            "New feature request",
            f"New feature request {request['request_code']}: {request['title']}",
            request['id']
        )
    
    updated = await db.feature_requests.find_one({"id": request_id}, {"_id": 0})
    return FeatureRequestResponse(**updated)


@router.get("/feature-requests", response_model=List[FeatureRequestResponse])
async def list_feature_requests(current_user: dict = Depends(get_current_user)):
    """List feature requests"""
    query = {}
    if current_user["role"] == "Requester":
        query["requester_id"] = current_user["id"]
    
    requests = await db.feature_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [FeatureRequestResponse(**r) for r in requests]


@router.get("/feature-requests/{request_id}", response_model=FeatureRequestResponse)
async def get_feature_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific feature request"""
    request = await db.feature_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Feature request not found")
    
    if current_user["role"] == "Requester" and request["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return FeatureRequestResponse(**request)


@router.patch("/feature-requests/{request_id}/status")
async def update_feature_request_status(
    request_id: str,
    status: str = Query(...),
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Update feature request status (Admin only)"""
    result = await db.feature_requests.update_one(
        {"id": request_id},
        {"$set": {"status": status, "updated_at": get_utc_now()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Feature request not found")
    return {"message": "Status updated"}


# ============== BUG REPORT ROUTES ==============

@router.post("/bug-reports", response_model=BugReportResponse)
async def create_bug_report(report_data: BugReportCreate, current_user: dict = Depends(get_current_user)):
    """Create a new bug report (or save as draft)"""
    report_code = await get_next_code(db, "bug_report_code", "BUG")
    now = get_utc_now()
    
    is_draft = getattr(report_data, 'is_draft', False)
    initial_status = "Draft" if is_draft else "Open"
    
    cat_l1_name = None
    cat_l2_name = None
    if report_data.category_l1_id:
        l1 = await db.categories_l1.find_one({"id": report_data.category_l1_id}, {"_id": 0})
        cat_l1_name = l1["name"] if l1 else None
    if report_data.category_l2_id:
        l2 = await db.categories_l2.find_one({"id": report_data.category_l2_id}, {"_id": 0})
        cat_l2_name = l2["name"] if l2 else None
    
    bug_report = {
        "id": str(uuid.uuid4()),
        "report_code": report_code,
        "request_type": "Bug",
        "requester_id": current_user["id"],
        "requester_name": current_user["name"],
        "title": report_data.title,
        "category_l1_id": report_data.category_l1_id,
        "category_l1_name": cat_l1_name,
        "category_l2_id": report_data.category_l2_id,
        "category_l2_name": cat_l2_name,
        "bug_type": report_data.bug_type,
        "steps_to_reproduce": report_data.steps_to_reproduce or "",
        "expected_behavior": report_data.expected_behavior or "",
        "actual_behavior": report_data.actual_behavior or "",
        "browser": report_data.browser,
        "device": report_data.device,
        "url_page": report_data.url_page,
        "severity": report_data.severity,
        "status": initial_status,
        "created_at": now,
        "updated_at": now
    }
    await db.bug_reports.insert_one(bug_report)
    
    # Only notify admins for non-draft reports
    if not is_draft:
        admins = await db.users.find({"role": "Admin", "active": True}, {"_id": 0}).to_list(100)
        for admin in admins:
            await create_notification(
                db,
                admin['id'],
                "new_bug_report",
                "New bug report",
                f"New bug report {report_code}: {report_data.title} (Severity: {report_data.severity})",
                bug_report['id']
            )
    
    return BugReportResponse(**bug_report)


@router.put("/bug-reports/{report_id}/draft", response_model=BugReportResponse)
async def update_bug_report_draft(report_id: str, report_data: BugReportCreate, current_user: dict = Depends(get_current_user)):
    """Update a draft bug report"""
    report = await db.bug_reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Bug report not found")
    
    if report["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only update your own drafts")
    
    if report["status"] != "Draft":
        raise HTTPException(status_code=400, detail="Only draft reports can be updated this way")
    
    cat_l1_name = None
    cat_l2_name = None
    if report_data.category_l1_id:
        l1 = await db.categories_l1.find_one({"id": report_data.category_l1_id}, {"_id": 0})
        cat_l1_name = l1["name"] if l1 else None
    if report_data.category_l2_id:
        l2 = await db.categories_l2.find_one({"id": report_data.category_l2_id}, {"_id": 0})
        cat_l2_name = l2["name"] if l2 else None
    
    now = get_utc_now()
    await db.bug_reports.update_one(
        {"id": report_id},
        {"$set": {
            "title": report_data.title,
            "category_l1_id": report_data.category_l1_id,
            "category_l1_name": cat_l1_name,
            "category_l2_id": report_data.category_l2_id,
            "category_l2_name": cat_l2_name,
            "bug_type": report_data.bug_type,
            "steps_to_reproduce": report_data.steps_to_reproduce or "",
            "expected_behavior": report_data.expected_behavior or "",
            "actual_behavior": report_data.actual_behavior or "",
            "browser": report_data.browser,
            "device": report_data.device,
            "url_page": report_data.url_page,
            "severity": report_data.severity,
            "updated_at": now
        }}
    )
    
    updated = await db.bug_reports.find_one({"id": report_id}, {"_id": 0})
    return BugReportResponse(**updated)


@router.post("/bug-reports/{report_id}/submit", response_model=BugReportResponse)
async def submit_bug_report_draft(report_id: str, current_user: dict = Depends(get_current_user)):
    """Submit a draft bug report - converts Draft to Open status"""
    report = await db.bug_reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Bug report not found")
    
    if report["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only submit your own drafts")
    
    if report["status"] != "Draft":
        raise HTTPException(status_code=400, detail="Only draft reports can be submitted")
    
    now = get_utc_now()
    await db.bug_reports.update_one(
        {"id": report_id},
        {"$set": {"status": "Open", "updated_at": now}}
    )
    
    # Now notify admins
    admins = await db.users.find({"role": "Admin", "active": True}, {"_id": 0}).to_list(100)
    for admin in admins:
        await create_notification(
            db,
            admin['id'],
            "new_bug_report",
            "New bug report",
            f"New bug report {report['report_code']}: {report['title']} (Severity: {report['severity']})",
            report['id']
        )
    
    updated = await db.bug_reports.find_one({"id": report_id}, {"_id": 0})
    return BugReportResponse(**updated)


@router.get("/bug-reports", response_model=List[BugReportResponse])
async def list_bug_reports(current_user: dict = Depends(get_current_user)):
    """List bug reports"""
    query = {}
    if current_user["role"] == "Requester":
        query["requester_id"] = current_user["id"]
    
    reports = await db.bug_reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [BugReportResponse(**r) for r in reports]


@router.get("/bug-reports/{report_id}", response_model=BugReportResponse)
async def get_bug_report(report_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific bug report"""
    report = await db.bug_reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Bug report not found")
    
    # Drafts only visible to owner
    if report["status"] == "Draft" and report["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user["role"] == "Requester" and report["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return BugReportResponse(**report)


@router.patch("/bug-reports/{report_id}/status")
async def update_bug_report_status(
    report_id: str,
    status: str = Query(...),
    current_user: dict = Depends(require_roles(["Admin"]))
):
    """Update bug report status (Admin only)"""
    result = await db.bug_reports.update_one(
        {"id": report_id},
        {"$set": {"status": status, "updated_at": get_utc_now()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bug report not found")
    return {"message": "Status updated"}


# ============== UNIFIED MY REQUESTS ==============

@router.get("/my-requests", response_model=List[UnifiedRequestResponse])
async def get_my_requests(current_user: dict = Depends(get_current_user)):
    """Get all requests (editing orders, feature requests, bug reports) for current user"""
    results = []
    
    # Get editing orders
    orders = await db.orders.find({"requester_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    for o in orders:
        results.append(UnifiedRequestResponse(
            id=o["id"],
            code=o["order_code"],
            request_type="Editing",
            title=o["title"],
            category_l1_name=o.get("category_l1_name"),
            category_l2_name=o.get("category_l2_name"),
            status=o["status"],
            priority_or_severity=o.get("priority", "Normal"),
            assigned_to_name=o.get("editor_name"),
            created_at=o["created_at"],
            updated_at=o["updated_at"]
        ))
    
    # Get feature requests
    feature_requests = await db.feature_requests.find({"requester_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    for fr in feature_requests:
        results.append(UnifiedRequestResponse(
            id=fr["id"],
            code=fr["request_code"],
            request_type="Feature",
            title=fr["title"],
            category_l1_name=fr.get("category_l1_name"),
            category_l2_name=fr.get("category_l2_name"),
            status=fr["status"],
            priority_or_severity=fr.get("priority", "Normal"),
            assigned_to_name=None,
            created_at=fr["created_at"],
            updated_at=fr["updated_at"]
        ))
    
    # Get bug reports
    bug_reports = await db.bug_reports.find({"requester_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    for br in bug_reports:
        results.append(UnifiedRequestResponse(
            id=br["id"],
            code=br["report_code"],
            request_type="Bug",
            title=br["title"],
            category_l1_name=br.get("category_l1_name"),
            category_l2_name=br.get("category_l2_name"),
            status=br["status"],
            priority_or_severity=br.get("severity", "Normal"),
            assigned_to_name=None,
            created_at=br["created_at"],
            updated_at=br["updated_at"]
        ))
    
    # Sort by created_at descending
    results.sort(key=lambda x: x.created_at, reverse=True)
    
    return results
