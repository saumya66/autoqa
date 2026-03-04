from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class ContextItemCreate(BaseModel):
    feature_id: str
    type: str
    filename: Optional[str] = None
    content: Optional[str] = None
    storage_path: Optional[str] = None
    file_size: Optional[int] = None


class ContextItemUpdate(BaseModel):
    ai_summary: Optional[str] = None
    processing_status: Optional[str] = None
    metadata_: Optional[dict] = None


class ContextItem(BaseModel):
    id: str
    feature_id: str
    type: str
    filename: Optional[str] = None
    content: Optional[str] = None
    storage_path: Optional[str] = None
    file_size: Optional[int] = None
    ai_summary: Optional[str] = None
    processing_status: str = "pending"
    metadata_: Optional[Any] = None
    created_at: datetime
