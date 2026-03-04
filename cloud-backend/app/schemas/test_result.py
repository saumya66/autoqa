from pydantic import BaseModel
from typing import Optional, Any, List
from datetime import datetime


class TestResultCreate(BaseModel):
    run_id: str
    test_case_id: str
    status: str
    conclusion: Optional[str] = None
    steps: List[dict] = []
    steps_executed: int = 0
    error: Optional[str] = None
    duration_ms: Optional[int] = None


class TestResultUpdate(BaseModel):
    status: Optional[str] = None
    conclusion: Optional[str] = None
    steps: Optional[List[dict]] = None
    steps_executed: Optional[int] = None
    error: Optional[str] = None
    duration_ms: Optional[int] = None


class TestResult(BaseModel):
    id: str
    run_id: str
    test_case_id: str
    status: str
    conclusion: Optional[str] = None
    steps: Any = []
    steps_executed: int = 0
    error: Optional[str] = None
    duration_ms: Optional[int] = None
    created_at: datetime
