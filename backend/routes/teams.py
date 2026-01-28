"""Team management routes"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

from database import db
from utils.auth import require_roles, get_current_user
from utils.helpers import get_utc_now

router = APIRouter(prefix="/teams", tags=["Teams"])


# ============== MODELS ==============

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    related_specialty_ids: Optional[List[str]] = []


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    related_specialty_ids: Optional[List[str]] = None
    active: Optional[bool] = None


class TeamResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    related_specialty_ids: List[str] = []
    related_specialty_names: List[str] = []
    active: bool
    member_count: int = 0
    created_at: str


# ============== ROUTES ==============

@router.post("", response_model=TeamResponse)
async def create_team(team_data: TeamCreate, current_user: dict = Depends(require_roles(["Administrator"]))):
    """Create a new team (Admin only)"""
    # Check for duplicate name
    existing = await db.teams.find_one({"name": team_data.name, "active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Team with this name already exists")
    
    team = {
        "id": str(uuid.uuid4()),
        "name": team_data.name,
        "description": team_data.description,
        "color": team_data.color,
        "related_specialty_ids": team_data.related_specialty_ids or [],
        "active": True,
        "created_at": get_utc_now()
    }
    
    await db.teams.insert_one(team)
    
    # Resolve specialty names
    related_specialty_names = []
    for spec_id in team.get("related_specialty_ids", []):
        spec = await db.specialties.find_one({"id": spec_id}, {"_id": 0, "name": 1})
        if spec:
            related_specialty_names.append(spec["name"])
    
    return TeamResponse(**team, related_specialty_names=related_specialty_names, member_count=0)


@router.get("", response_model=List[TeamResponse])
async def list_teams(current_user: dict = Depends(get_current_user)):
    """List all active teams"""
    teams = await db.teams.find({"active": True}, {"_id": 0}).to_list(100)
    
    # Get member counts and resolve specialty names
    result = []
    for team in teams:
        member_count = await db.users.count_documents({"team_id": team["id"], "active": True})
        
        # Resolve related specialty names
        related_specialty_names = []
        for spec_id in team.get("related_specialty_ids", []):
            spec = await db.specialties.find_one({"id": spec_id}, {"_id": 0, "name": 1})
            if spec:
                related_specialty_names.append(spec["name"])
        
        # Ensure related_specialty_ids is set
        team_data = {**team}
        if "related_specialty_ids" not in team_data:
            team_data["related_specialty_ids"] = []
        
        result.append(TeamResponse(
            **team_data,
            related_specialty_names=related_specialty_names,
            member_count=member_count
        ))
    
    return result


@router.get("/all", response_model=List[TeamResponse])
async def list_all_teams(current_user: dict = Depends(require_roles(["Administrator"]))):
    """List all teams including inactive (Admin only)"""
    teams = await db.teams.find({}, {"_id": 0}).to_list(100)
    
    result = []
    for team in teams:
        member_count = await db.users.count_documents({"team_id": team["id"], "active": True})
        
        # Resolve related specialty names
        related_specialty_names = []
        for spec_id in team.get("related_specialty_ids", []):
            spec = await db.specialties.find_one({"id": spec_id}, {"_id": 0, "name": 1})
            if spec:
                related_specialty_names.append(spec["name"])
        
        # Ensure related_specialty_ids is set
        team_data = {**team}
        if "related_specialty_ids" not in team_data:
            team_data["related_specialty_ids"] = []
        
        result.append(TeamResponse(
            **team_data,
            related_specialty_names=related_specialty_names,
            member_count=member_count
        ))
    
    return result


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(team_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific team"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    member_count = await db.users.count_documents({"team_id": team_id, "active": True})
    
    # Resolve related specialty names
    related_specialty_names = []
    for spec_id in team.get("related_specialty_ids", []):
        spec = await db.specialties.find_one({"id": spec_id}, {"_id": 0, "name": 1})
        if spec:
            related_specialty_names.append(spec["name"])
    
    # Ensure related_specialty_ids is set
    team_data = {**team}
    if "related_specialty_ids" not in team_data:
        team_data["related_specialty_ids"] = []
    
    return TeamResponse(**team_data, related_specialty_names=related_specialty_names, member_count=member_count)


@router.patch("/{team_id}", response_model=TeamResponse)
async def update_team(team_id: str, team_data: TeamUpdate, current_user: dict = Depends(require_roles(["Administrator"]))):
    """Update a team (Admin only)"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    update_dict = {k: v for k, v in team_data.model_dump().items() if v is not None}
    
    if "name" in update_dict:
        existing = await db.teams.find_one({"name": update_dict["name"], "id": {"$ne": team_id}, "active": True})
        if existing:
            raise HTTPException(status_code=400, detail="Team with this name already exists")
    
    if update_dict:
        await db.teams.update_one({"id": team_id}, {"$set": update_dict})
    
    updated = await db.teams.find_one({"id": team_id}, {"_id": 0})
    member_count = await db.users.count_documents({"team_id": team_id, "active": True})
    
    # Resolve related specialty names
    related_specialty_names = []
    for spec_id in updated.get("related_specialty_ids", []):
        spec = await db.specialties.find_one({"id": spec_id}, {"_id": 0, "name": 1})
        if spec:
            related_specialty_names.append(spec["name"])
    
    return TeamResponse(**updated, related_specialty_names=related_specialty_names, member_count=member_count)


@router.delete("/{team_id}")
async def delete_team(team_id: str, current_user: dict = Depends(require_roles(["Administrator"]))):
    """Soft delete a team (Admin only)"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Unassign all users from this team
    await db.users.update_many({"team_id": team_id}, {"$set": {"team_id": None}})
    
    await db.teams.update_one({"id": team_id}, {"$set": {"active": False}})
    return {"message": "Team deleted"}


@router.get("/{team_id}/members")
async def get_team_members(team_id: str, current_user: dict = Depends(get_current_user)):
    """Get members of a team"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    members = await db.users.find(
        {"team_id": team_id, "active": True},
        {"_id": 0, "password": 0}
    ).to_list(100)
    
    return {"team": team, "members": members}
