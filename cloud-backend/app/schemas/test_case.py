from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class TestCaseCreate(BaseModel):
    feature_id: str
    test_key: str
    title: str
    description: Optional[str] = None
    steps_text: Optional[str] = None
    goal: str
    expected_result: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    generated_by_model: Optional[str] = None


class TestCaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    steps_text: Optional[str] = None
    goal: Optional[str] = None
    expected_result: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None


class TestCase(BaseModel):
    id: str
    feature_id: str
    test_key: str
    title: str
    description: Optional[str] = None
    steps_text: Optional[str] = None
    goal: str
    expected_result: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    generated_by_model: Optional[str] = None
    created_at: datetime
