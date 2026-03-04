from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class Project(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
