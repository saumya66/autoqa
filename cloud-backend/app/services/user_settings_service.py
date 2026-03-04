from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from pymongo.database import Database

from app.db.mongodb import doc_to_dict


class UserSettingsService:
    COL = "user_settings"

    def get_by_user(self, db: Database, *, user_id: str) -> Optional[dict]:
        doc = db[self.COL].find_one({"user_id": user_id})
        return doc_to_dict(doc)

    def create(self, db: Database, *, user_id: str, **fields) -> dict:
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": user_id,
            "default_provider": fields.get("default_provider", "claude"),
            "default_model": fields.get("default_model", "claude-haiku-4-5"),
            "anthropic_api_key_encrypted": fields.get("anthropic_api_key_encrypted"),
            "gemini_api_key_encrypted": fields.get("gemini_api_key_encrypted"),
            "preferences": fields.get("preferences", {}),
            "updated_at": now,
        }
        result = db[self.COL].insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc_to_dict(doc)

    def update(self, db: Database, *, id: str, **fields) -> Optional[dict]:
        fields["updated_at"] = datetime.now(timezone.utc)
        db[self.COL].update_one({"_id": ObjectId(id)}, {"$set": fields})
        return self.get_by_id(db, id=id)

    def get_by_id(self, db: Database, *, id: str) -> Optional[dict]:
        doc = db[self.COL].find_one({"_id": ObjectId(id)})
        return doc_to_dict(doc)

    def upsert(self, db: Database, *, user_id: str, **fields) -> dict:
        existing = self.get_by_user(db, user_id=user_id)
        if existing:
            fields["updated_at"] = datetime.now(timezone.utc)
            db[self.COL].update_one(
                {"user_id": user_id},
                {"$set": fields},
            )
            return self.get_by_user(db, user_id=user_id)
        return self.create(db, user_id=user_id, **fields)


user_settings_service = UserSettingsService()
