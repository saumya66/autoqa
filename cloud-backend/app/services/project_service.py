from datetime import datetime, timezone
from typing import Optional, List

from bson import ObjectId
from pymongo.database import Database

from app.db.mongodb import doc_to_dict


class ProjectService:
    COL = "projects"

    def get(self, db: Database, *, id: str) -> Optional[dict]:
        doc = db[self.COL].find_one({"_id": ObjectId(id)})
        return doc_to_dict(doc)

    def get_multi_by_user(self, db: Database, *, user_id: str, skip: int = 0, limit: int = 100) -> List[dict]:
        cursor = (
            db[self.COL]
            .find({"user_id": user_id})
            .sort("updated_at", -1)
            .skip(skip)
            .limit(limit)
        )
        return [doc_to_dict(d) for d in cursor]

    def create(self, db: Database, *, user_id: str, name: str, description: Optional[str] = None, context_summary: Optional[str] = None) -> dict:
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": user_id,
            "name": name,
            "description": description,
            "context_summary": context_summary,
            "created_at": now,
            "updated_at": now,
        }
        result = db[self.COL].insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc_to_dict(doc)

    def update(self, db: Database, *, id: str, **fields) -> Optional[dict]:
        fields["updated_at"] = datetime.now(timezone.utc)
        db[self.COL].update_one({"_id": ObjectId(id)}, {"$set": fields})
        return self.get(db, id=id)

    def delete(self, db: Database, *, id: str) -> bool:
        result = db[self.COL].delete_one({"_id": ObjectId(id)})
        return result.deleted_count > 0


project_service = ProjectService()
