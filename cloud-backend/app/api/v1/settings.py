from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.api.deps import get_db, get_current_user
from app.schemas.user_settings import UserSettings as UserSettingsSchema, UserSettingsUpdate
from app.services.user_settings_service import user_settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


def _to_response(doc: dict) -> UserSettingsSchema:
    return UserSettingsSchema(
        id=doc["id"],
        user_id=doc["user_id"],
        default_provider=doc.get("default_provider", "claude"),
        default_model=doc.get("default_model", "claude-haiku-4-5"),
        preferences=doc.get("preferences"),
        updated_at=doc["updated_at"],
        has_anthropic_key=bool(doc.get("anthropic_api_key_encrypted")),
        has_gemini_key=bool(doc.get("gemini_api_key_encrypted")),
    )


@router.get("/", response_model=UserSettingsSchema)
def get_settings(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    settings = user_settings_service.get_by_user(db, user_id=current_user["id"])
    if not settings:
        settings = user_settings_service.create(db, user_id=current_user["id"])
    return _to_response(settings)


@router.patch("/", response_model=UserSettingsSchema)
def update_settings(
    body: UserSettingsUpdate,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    updates = body.model_dump(exclude_unset=True)
    if "anthropic_api_key" in updates:
        updates["anthropic_api_key_encrypted"] = updates.pop("anthropic_api_key")
    if "gemini_api_key" in updates:
        updates["gemini_api_key_encrypted"] = updates.pop("gemini_api_key")

    settings = user_settings_service.upsert(db, user_id=current_user["id"], **updates)
    return _to_response(settings)
