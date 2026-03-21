from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from typing import List, Optional

from app.api.deps import get_db, get_current_user
from app.schemas.context_item import ContextItemCreate, ContextItemUpdate, ContextItem
from app.services.context_item_service import context_item_service
from app.services.feature_service import feature_service
from app.services.project_service import project_service

router = APIRouter(prefix="/context-items", tags=["context-items"])


def _verify_level_owner(db: Database, level: str, level_id: str, user_id: str):
    """Verify the authenticated user owns the project/feature this item belongs to."""
    if level == "feature":
        feature = feature_service.get(db, id=level_id)
        if not feature:
            raise HTTPException(status_code=404, detail="Feature not found")
        project = project_service.get(db, id=feature["project_id"])
        if not project or project["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Feature not found")
    elif level == "project":
        project = project_service.get(db, id=level_id)
        if not project or project["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Project not found")
    else:
        raise HTTPException(status_code=400, detail=f"Invalid level: {level}")


@router.get("/", response_model=List[ContextItem])
def list_context_items(
    level: str = Query(..., description="'project' or 'feature'"),
    level_id: str = Query(..., description="ID of the project or feature"),
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _verify_level_owner(db, level, level_id, current_user["id"])
    docs = context_item_service.get_multi_by_level(db, level=level, level_id=level_id)
    return [ContextItem(**d) for d in docs]


@router.post("/", response_model=ContextItem)
def create_context_item(
    body: ContextItemCreate,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _verify_level_owner(db, body.level, body.level_id, current_user["id"])
    doc = context_item_service.create(db, data=body.model_dump())
    return ContextItem(**doc)


@router.delete("/by-level")
def delete_context_items_by_level(
    level: str = Query(..., description="'project' or 'feature'"),
    level_id: str = Query(..., description="ID of the project or feature"),
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete all context items for a given level/level_id (used before re-uploading)."""
    _verify_level_owner(db, level, level_id, current_user["id"])
    deleted = context_item_service.delete_by_level(db, level=level, level_id=level_id)
    return {"ok": True, "deleted": deleted}


@router.get("/{item_id}", response_model=ContextItem)
def get_context_item(
    item_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    item = context_item_service.get(db, id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Context item not found")
    _verify_level_owner(db, item["level"], item["level_id"], current_user["id"])
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
    _verify_level_owner(db, item["level"], item["level_id"], current_user["id"])

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
    _verify_level_owner(db, item["level"], item["level_id"], current_user["id"])
    context_item_service.delete(db, id=item_id)
    return {"ok": True}
