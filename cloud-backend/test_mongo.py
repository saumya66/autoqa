"""Quick script to verify MongoDB connectivity."""

import certifi
from app.core.config import settings
from pymongo import MongoClient

print(f"Connecting to: {settings.MONGODB_URI[:30]}...")
print(f"Database: {settings.MONGODB_DB}")

try:
    client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())
    client.admin.command("ping")
    print("Connected successfully!")

    db = client[settings.MONGODB_DB]
    collections = db.list_collection_names()
    print(f"Existing collections: {collections or '(none yet)'}")

    client.close()
except Exception as e:
    print(f"Connection failed: {e}")
