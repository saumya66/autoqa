from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from .test_result import TestResult


class TestRunCreate(BaseModel):
    feature_id: str
    user_id: str
    provider: str
    model: str
    target_window: Optional[str] = None
    total_tests: int = 0


class TestRunUpdate(BaseModel):
    status: Optional[str] = None
    passed: Optional[int] = None
    failed: Optional[int] = None
    skipped: Optional[int] = None
    completed_at: Optional[datetime] = None


class TestRun(BaseModel):
    id: str
    feature_id: str
    user_id: str
    provider: str
    model: str
    target_window: Optional[str] = None
    status: str = "running"
    total_tests: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    started_at: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime


class TestRunDetail(TestRun):
    results: List[TestResult] = []
