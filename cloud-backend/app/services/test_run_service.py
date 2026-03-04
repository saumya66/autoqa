from datetime import datetime, timezone
from typing import Optional, List

from bson import ObjectId
from pymongo.database import Database

from app.db.mongodb import doc_to_dict


class TestRunService:
    COL = "test_runs"

    def get(self, db: Database, *, id: str) -> Optional[dict]:
        doc = db[self.COL].find_one({"_id": ObjectId(id)})
        return doc_to_dict(doc)

    def get_multi_by_feature(self, db: Database, *, feature_id: str, skip: int = 0, limit: int = 50) -> List[dict]:
        cursor = (
            db[self.COL]
            .find({"feature_id": feature_id})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        return [doc_to_dict(d) for d in cursor]

    def get_multi_by_user(self, db: Database, *, user_id: str, skip: int = 0, limit: int = 50) -> List[dict]:
        cursor = (
            db[self.COL]
            .find({"user_id": user_id})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        return [doc_to_dict(d) for d in cursor]

    def create(self, db: Database, *, data: dict) -> dict:
        now = datetime.now(timezone.utc)
        doc = {
            "feature_id": data["feature_id"],
            "user_id": data["user_id"],
            "provider": data["provider"],
            "model": data["model"],
            "target_window": data.get("target_window"),
            "status": "running",
            "total_tests": data.get("total_tests", 0),
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "started_at": now,
            "completed_at": None,
            "created_at": now,
        }
        result = db[self.COL].insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc_to_dict(doc)

    def update(self, db: Database, *, id: str, **fields) -> Optional[dict]:
        db[self.COL].update_one({"_id": ObjectId(id)}, {"$set": fields})
        return self.get(db, id=id)


test_run_service = TestRunService()
