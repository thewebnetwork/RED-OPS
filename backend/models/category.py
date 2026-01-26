from pydantic import BaseModel
from typing import Optional


class CategoryL1Create(BaseModel):
    name: str
    name_en: Optional[str] = None
    name_pt: Optional[str] = None
    name_es: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None


class CategoryL1Response(BaseModel):
    id: str
    name: str
    name_en: Optional[str] = None
    name_pt: Optional[str] = None
    name_es: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    active: bool
    created_at: str


class CategoryL2Create(BaseModel):
    name: str
    name_en: Optional[str] = None
    name_pt: Optional[str] = None
    name_es: Optional[str] = None
    category_l1_id: str
    description: Optional[str] = None
    triggers_editor_workflow: bool = False


class CategoryL2Response(BaseModel):
    id: str
    name: str
    name_en: Optional[str] = None
    name_pt: Optional[str] = None
    name_es: Optional[str] = None
    category_l1_id: str
    category_l1_name: Optional[str] = None
    description: Optional[str] = None
    triggers_editor_workflow: bool
    active: bool
    created_at: str
