from pydantic import BaseModel
from typing import Optional


class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    active: Optional[bool] = None


class TeamResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    active: bool
    member_count: int = 0
    created_at: str
