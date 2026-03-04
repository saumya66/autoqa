import certifi
from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import settings

_client: MongoClient | None = None
_db: Database | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(settings.MONGODB_URI, tlsCAFile=certifi.where())
    return _client


def get_database() -> Database:
    global _db
    if _db is None:
        _db = get_client()[settings.MONGODB_DB]
    return _db


def get_db() -> Database:
    """FastAPI dependency — returns the MongoDB database instance."""
    return get_database()


def doc_to_dict(doc: dict | None) -> dict | None:
    """Convert a MongoDB document: _id (ObjectId) -> id (str)."""
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


def init_indexes():
    """Create indexes on startup. Idempotent — safe to call repeatedly."""
    db = get_database()

    db.users.create_index("email", unique=True)
    db.projects.create_index("user_id")
    db.features.create_index("project_id")
    db.context_items.create_index("feature_id")
    db.test_cases.create_index("feature_id")
    db.test_runs.create_index([("feature_id", 1), ("created_at", -1)])
    db.test_runs.create_index("user_id")
    db.test_results.create_index("run_id")
    db.user_settings.create_index("user_id", unique=True)
