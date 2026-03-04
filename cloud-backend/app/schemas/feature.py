from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class FeatureCreateRequest(BaseModel):
    project_id: str
    name: str
    description: Optional[str] = None


class FeatureUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    context_summary: Optional[str] = None
    status: Optional[str] = None
    provider: Optional[str] = None
    raw_plan: Optional[dict] = None


class Feature(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    context_summary: Optional[str] = None
    status: str = "draft"
    provider: str = "claude"
    raw_plan: Optional[Any] = None
    created_at: datetime
    updated_at: datetime
