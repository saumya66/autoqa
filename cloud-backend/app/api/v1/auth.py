from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from app.api.deps import get_db, get_current_user
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.user import UserCreateRequest, UserLogin, TokenResponse, User as UserSchema
from app.services.user_service import user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(body: UserCreateRequest, db: Database = Depends(get_db)):
    existing = user_service.get_by_email(db, email=body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = user_service.create(
        db,
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
    )
    token = create_access_token(user["id"])
    return TokenResponse(access_token=token, user=UserSchema(**user))


@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin, db: Database = Depends(get_db)):
    user = user_service.get_by_email(db, email=body.email)
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user["id"])
    return TokenResponse(access_token=token, user=UserSchema(**user))


@router.get("/me", response_model=UserSchema)
def get_me(current_user: dict = Depends(get_current_user)):
    return UserSchema(**current_user)
