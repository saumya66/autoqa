from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from typing import List

from app.api.deps import get_db, get_current_user
from app.schemas.feature import FeatureCreateRequest, FeatureUpdate, Feature
from app.services.feature_service import feature_service
from app.services.project_service import project_service

router = APIRouter(prefix="/features", tags=["features"])


def _verify_project_owner(db: Database, project_id: str, user_id: str):
    project = project_service.get(db, id=project_id)
    if not project or project["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/by-project/{project_id}", response_model=List[Feature])
def list_features(
    project_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _verify_project_owner(db, project_id, current_user["id"])
    docs = feature_service.get_multi_by_project(db, project_id=project_id)
    return [Feature(**d) for d in docs]


@router.post("/", response_model=Feature)
def create_feature(
    body: FeatureCreateRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _verify_project_owner(db, body.project_id, current_user["id"])
    doc = feature_service.create(
        db,
        project_id=body.project_id,
        name=body.name,
        description=body.description,
    )
    return Feature(**doc)


@router.get("/{feature_id}", response_model=Feature)
def get_feature(
    feature_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    feature = feature_service.get(db, id=feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    _verify_project_owner(db, feature["project_id"], current_user["id"])
    return Feature(**feature)


@router.patch("/{feature_id}", response_model=Feature)
def update_feature(
    feature_id: str,
    body: FeatureUpdate,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    feature = feature_service.get(db, id=feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    _verify_project_owner(db, feature["project_id"], current_user["id"])

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return Feature(**feature)

    updated = feature_service.update(db, id=feature_id, **updates)
    return Feature(**updated)


@router.delete("/{feature_id}")
def delete_feature(
    feature_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    feature = feature_service.get(db, id=feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    _verify_project_owner(db, feature["project_id"], current_user["id"])
    feature_service.delete(db, id=feature_id)
    return {"ok": True}
