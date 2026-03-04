from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from typing import List

from app.api.deps import get_db, get_current_user
from app.schemas.test_result import TestResultCreate, TestResultUpdate, TestResult
from app.services.test_result_service import test_result_service
from app.services.test_run_service import test_run_service
from app.services.feature_service import feature_service
from app.services.project_service import project_service

router = APIRouter(prefix="/test-results", tags=["test-results"])


def _verify_run_owner(db: Database, run_id: str, user_id: str):
    run = test_run_service.get(db, id=run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    _verify_feature_owner(db, run["feature_id"], user_id)


def _verify_feature_owner(db: Database, feature_id: str, user_id: str):
    feature = feature_service.get(db, id=feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    project = project_service.get(db, id=feature["project_id"])
    if not project or project["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Feature not found")
    return feature


@router.get("/by-run/{run_id}", response_model=List[TestResult])
def list_test_results(
    run_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _verify_run_owner(db, run_id, current_user["id"])
    docs = test_result_service.get_multi_by_run(db, run_id=run_id)
    return [TestResult(**d) for d in docs]


@router.post("/", response_model=TestResult)
def create_test_result(
    body: TestResultCreate,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _verify_run_owner(db, body.run_id, current_user["id"])
    doc = test_result_service.create(db, data=body.model_dump())
    return TestResult(**doc)


@router.get("/{result_id}", response_model=TestResult)
def get_test_result(
    result_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = test_result_service.get(db, id=result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    _verify_run_owner(db, result["run_id"], current_user["id"])
    return TestResult(**result)


@router.patch("/{result_id}", response_model=TestResult)
def update_test_result(
    result_id: str,
    body: TestResultUpdate,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = test_result_service.get(db, id=result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    _verify_run_owner(db, result["run_id"], current_user["id"])

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return TestResult(**result)

    updated = test_result_service.update(db, id=result_id, **updates)
    return TestResult(**updated)
