from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from typing import List

from app.api.deps import get_db, get_current_user
from app.schemas.project import ProjectCreateRequest, ProjectUpdate, Project
from app.services.project_service import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=List[Project])
def list_projects(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    docs = project_service.get_multi_by_user(db, user_id=current_user["id"])
    return [Project(**d) for d in docs]


@router.post("/", response_model=Project)
def create_project(
    body: ProjectCreateRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    doc = project_service.create(
        db,
        user_id=current_user["id"],
        name=body.name,
        description=body.description,
        context_summary=body.context_summary,
    )
    return Project(**doc)


@router.get("/{project_id}", response_model=Project)
def get_project(
    project_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = project_service.get(db, id=project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
    return Project(**project)


@router.patch("/{project_id}", response_model=Project)
def update_project(
    project_id: str,
    body: ProjectUpdate,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = project_service.get(db, id=project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return Project(**project)

    updated = project_service.update(db, id=project_id, **updates)
    return Project(**updated)


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = project_service.get(db, id=project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
    project_service.delete(db, id=project_id)
    return {"ok": True}
