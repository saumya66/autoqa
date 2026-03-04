from datetime import datetime, timezone
from typing import Optional, List

from bson import ObjectId
from pymongo.database import Database

from app.db.mongodb import doc_to_dict


class ContextItemService:
    COL = "context_items"

    def get(self, db: Database, *, id: str) -> Optional[dict]:
        doc = db[self.COL].find_one({"_id": ObjectId(id)})
        return doc_to_dict(doc)

    def get_multi_by_feature(self, db: Database, *, feature_id: str) -> List[dict]:
        cursor = db[self.COL].find({"feature_id": feature_id}).sort("created_at", 1)
        return [doc_to_dict(d) for d in cursor]

    def create(self, db: Database, *, data: dict) -> dict:
        doc = {
            "feature_id": data["feature_id"],
            "type": data["type"],
            "filename": data.get("filename"),
            "content": data.get("content"),
            "storage_path": data.get("storage_path"),
            "file_size": data.get("file_size"),
            "ai_summary": None,
            "processing_status": "pending",
            "metadata_": None,
            "created_at": datetime.now(timezone.utc),
        }
        result = db[self.COL].insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc_to_dict(doc)

    def update(self, db: Database, *, id: str, **fields) -> Optional[dict]:
        db[self.COL].update_one({"_id": ObjectId(id)}, {"$set": fields})
        return self.get(db, id=id)

    def delete(self, db: Database, *, id: str) -> bool:
        result = db[self.COL].delete_one({"_id": ObjectId(id)})
        return result.deleted_count > 0


context_item_service = ContextItemService()
