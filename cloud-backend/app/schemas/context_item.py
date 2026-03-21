from pydantic import BaseModel
from typing import Optional, Any, Literal
from datetime import datetime

ContextLevel = Literal["project", "feature"]


class ContextItemCreate(BaseModel):
    level: ContextLevel
    level_id: str
    type: str
    filename: Optional[str] = None
    content: Optional[str] = None
    file_size: Optional[int] = None


class ContextItemUpdate(BaseModel):
    ai_summary: Optional[str] = None
    processing_status: Optional[str] = None
    metadata_: Optional[dict] = None


class ContextItem(BaseModel):
    id: str
    level: ContextLevel
    level_id: str
    type: str
    filename: Optional[str] = None
    content: Optional[str] = None
    file_size: Optional[int] = None
    ai_summary: Optional[str] = None
    processing_status: str = "pending"
    metadata_: Optional[Any] = None
    created_at: datetime
