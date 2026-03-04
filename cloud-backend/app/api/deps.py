from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pymongo.database import Database

from app.db.mongodb import get_db as _get_db
from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_db() -> Database:
    return _get_db()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Database = Depends(get_db),
) -> dict:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    from bson import ObjectId
    from app.db.mongodb import doc_to_dict
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return doc_to_dict(user)


def get_optional_user(
    token: str = Depends(oauth2_scheme),
    db: Database = Depends(get_db),
) -> dict | None:
    if not token:
        return None
    user_id = decode_access_token(token)
    if not user_id:
        return None

    from bson import ObjectId
    from app.db.mongodb import doc_to_dict
    user = db.users.find_one({"_id": ObjectId(user_id)})
    return doc_to_dict(user) if user else None
