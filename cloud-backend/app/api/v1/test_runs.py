from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from typing import List

from app.api.deps import get_db, get_current_user
from app.schemas.test_run import TestRunCreate, TestRunUpdate, TestRun, TestRunDetail
from app.schemas.test_result import TestResult
from app.services.test_run_service import test_run_service
from app.services.test_result_service import test_result_service
from app.services.feature_service import feature_service
from app.services.project_service import project_service

router = APIRouter(prefix="/test-runs", tags=["test-runs"])


def _verify_feature_owner(db: Database, feature_id: str, user_id: str):
    feature = feature_service.get(db, id=feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    project = project_service.get(db, id=feature["project_id"])
    if not project or project["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Feature not found")
    return feature


@router.get("/by-feature/{feature_id}", response_model=List[TestRun])
def list_test_runs(
    feature_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _verify_feature_owner(db, feature_id, current_user["id"])
    docs = test_run_service.get_multi_by_feature(db, feature_id=feature_id, skip=skip, limit=limit)
    return [TestRun(**d) for d in docs]


@router.get("/by-user", response_model=List[TestRun])
def list_test_runs_by_user(
    skip: int = 0,
    limit: int = 50,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    docs = test_run_service.get_multi_by_user(db, user_id=current_user["id"], skip=skip, limit=limit)
    return [TestRun(**d) for d in docs]


@router.post("/", response_model=TestRun)
def create_test_run(
    body: TestRunCreate,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _verify_feature_owner(db, body.feature_id, current_user["id"])
    if body.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot create run for another user")
    doc = test_run_service.create(db, data=body.model_dump())
    return TestRun(**doc)


@router.get("/{run_id}", response_model=TestRun)
def get_test_run(
    run_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    run = test_run_service.get(db, id=run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    _verify_feature_owner(db, run["feature_id"], current_user["id"])
    return TestRun(**run)


@router.get("/{run_id}/detail", response_model=TestRunDetail)
def get_test_run_detail(
    run_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    run = test_run_service.get(db, id=run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    _verify_feature_owner(db, run["feature_id"], current_user["id"])

    results = test_result_service.get_multi_by_run(db, run_id=run_id)
    run["results"] = [TestResult(**r) for r in results]
    return TestRunDetail(**run)


@router.patch("/{run_id}", response_model=TestRun)
def update_test_run(
    run_id: str,
    body: TestRunUpdate,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    run = test_run_service.get(db, id=run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    _verify_feature_owner(db, run["feature_id"], current_user["id"])

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return TestRun(**run)

    updated = test_run_service.update(db, id=run_id, **updates)
    return TestRun(**updated)
