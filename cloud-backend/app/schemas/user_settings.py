from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class UserSettingsCreateRequest(BaseModel):
    default_provider: str = "claude"
    default_model: str = "claude-haiku-4-5"
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    preferences: Optional[dict] = None


class UserSettingsUpdate(BaseModel):
    default_provider: Optional[str] = None
    default_model: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    preferences: Optional[dict] = None


class UserSettings(BaseModel):
    id: str
    user_id: str
    default_provider: str = "claude"
    default_model: str = "claude-haiku-4-5"
    preferences: Optional[Any] = None
    updated_at: datetime
    has_anthropic_key: bool = False
    has_gemini_key: bool = False
