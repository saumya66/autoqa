from datetime import datetime, timezone
from typing import Optional, List

from bson import ObjectId
from pymongo.database import Database

from app.db.mongodb import doc_to_dict


class TestResultService:
    COL = "test_results"

    def get(self, db: Database, *, id: str) -> Optional[dict]:
        doc = db[self.COL].find_one({"_id": ObjectId(id)})
        return doc_to_dict(doc)

    def get_multi_by_run(self, db: Database, *, run_id: str) -> List[dict]:
        cursor = db[self.COL].find({"run_id": run_id}).sort("created_at", 1)
        return [doc_to_dict(d) for d in cursor]

    def create(self, db: Database, *, data: dict) -> dict:
        doc = {
            "run_id": data["run_id"],
            "test_case_id": data["test_case_id"],
            "status": data["status"],
            "conclusion": data.get("conclusion"),
            "steps": data.get("steps", []),
            "steps_executed": data.get("steps_executed", 0),
            "error": data.get("error"),
            "duration_ms": data.get("duration_ms"),
            "created_at": datetime.now(timezone.utc),
        }
        result = db[self.COL].insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc_to_dict(doc)

    def update(self, db: Database, *, id: str, **fields) -> Optional[dict]:
        db[self.COL].update_one({"_id": ObjectId(id)}, {"$set": fields})
        return self.get(db, id=id)


test_result_service = TestResultService()
