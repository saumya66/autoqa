from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from typing import List

from app.api.deps import get_db, get_current_user
from app.schemas.context_item import ContextItemCreate, ContextItemUpdate, ContextItem
from app.services.context_item_service import context_item_service
from app.services.feature_service import feature_service
from app.services.project_service import project_service

router = APIRouter(prefix="/context-items", tags=["context-items"])


def _verify_feature_owner(db: Database, feature_id: str, user_id: str):
    feature = feature_service.get(db, id=feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    project = project_service.get(db, id=feature["project_id"])
    if not project or project["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Feature not found")
    return feature


@router.get("/by-feature/{feature_id}", response_model=List[ContextItem])
def list_context_items(
    feature_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _verify_feature_owner(db, feature_id, current_user["id"])
    docs = context_item_service.get_multi_by_feature(db, feature_id=feature_id)
    return [ContextItem(**d) for d in docs]


@router.post("/", response_model=ContextItem)
def create_context_item(
    body: ContextItemCreate,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _verify_feature_owner(db, body.feature_id, current_user["id"])
    doc = context_item_service.create(db, data=body.model_dump())
    return ContextItem(**doc)


@router.get("/{item_id}", response_model=ContextItem)
def get_context_item(
    item_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    item = context_item_service.get(db, id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Context item not found")
    _verify_feature_owner(db, item["feature_id"], current_user["id"])
    return ContextItem(**item)


@router.patch("/{item_id}", response_model=ContextItem)
def update_context_item(
    item_id: str,
    body: ContextItemUpdate,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    item = context_item_service.get(db, id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Context item not found")
    _verify_feature_owner(db, item["feature_id"], current_user["id"])

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return ContextItem(**item)

    updated = context_item_service.update(db, id=item_id, **updates)
    return ContextItem(**updated)


@router.delete("/{item_id}")
def delete_context_item(
    item_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    item = context_item_service.get(db, id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Context item not found")
    _verify_feature_owner(db, item["feature_id"], current_user["id"])
    context_item_service.delete(db, id=item_id)
    return {"ok": True}
