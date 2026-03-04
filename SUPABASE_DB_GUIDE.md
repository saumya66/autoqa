# Supabase as PostgreSQL Backend — Python/FastAPI/SQLAlchemy Guide

This document describes how we use **Supabase as a managed PostgreSQL database** with a **Python FastAPI** backend. We do **not** use the Supabase JS client, Supabase Auth, Supabase Storage, or Supabase Realtime. Supabase is purely the database host — all access is via standard PostgreSQL through SQLAlchemy ORM and Alembic migrations.

---

## Architecture Overview

| Layer | Tool |
|---|---|
| Database host | Supabase (managed PostgreSQL) |
| Connection | Supabase connection pooler (`pooler.supabase.com`) |
| ORM | SQLAlchemy 2.0 (declarative) |
| Migrations | Alembic (autogenerate from models) |
| Validation / Schemas | Pydantic v2 (`pydantic-settings`) |
| Auth | Custom JWT (not Supabase Auth) |
| File storage | PostgreSQL `LargeBinary` column (not Supabase Storage) |
| RLS | Not used — authorization is application-level via FastAPI dependencies |

---

## Folder Structure

```
project-root/
├── alembic/                        # Alembic migration config
│   ├── versions/                   # Auto-generated migration scripts
│   └── env.py                      # Alembic env — loads models & builds DB URL
├── alembic.ini                     # Alembic settings (script location, logging)
├── app/
│   ├── core/
│   │   ├── config.py               # pydantic-settings: loads .env, exposes Settings
│   │   └── security.py             # JWT creation/verification, password hashing
│   ├── db/
│   │   ├── base_class.py           # SQLAlchemy `Base = declarative_base()`
│   │   └── session.py              # Engine, SessionLocal, get_db() dependency
│   ├── models/                     # SQLAlchemy ORM models (one file per table)
│   │   ├── base.py                 # Imports all models so Alembic can see them
│   │   ├── user.py
│   │   ├── conversation.py
│   │   └── ...
│   ├── schemas/                    # Pydantic request/response schemas
│   │   ├── user.py
│   │   ├── conversation.py
│   │   └── ...
│   ├── services/                   # Business logic — one service class per model
│   │   ├── user_service.py
│   │   ├── conversation_service.py
│   │   └── ...
│   └── api/
│       ├── deps.py                 # FastAPI dependencies (get_db, get_current_user)
│       └── v1/                     # Versioned API routes
├── seed_plans.py                   # Seed script for initial data
├── reset_db.py                     # Drop all tables for a fresh start
├── test_supabase.py                # Quick connection smoke test
└── .env                            # Environment variables
```

---

## Connecting to Supabase PostgreSQL

### Environment Variables

```bash
# .env
POSTGRES_SERVER=aws-0-<region>.pooler.supabase.com   # Supabase pooler endpoint
POSTGRES_USER=postgres.<project-ref>
POSTGRES_PASSWORD=<your-password>
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# Alternative: a single URL (useful for Render/Heroku)
# DATABASE_URL=postgresql://user:pass@host:port/db
```

The settings class supports both a single `DATABASE_URL` and discrete `POSTGRES_*` vars. Discrete vars are preferred for local dev; `DATABASE_URL` is common when hosting platforms inject it.

### Config (`app/core/config.py`)

```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: Optional[str] = None
    POSTGRES_SERVER: Optional[str] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    POSTGRES_PORT: Optional[int] = None

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings()
```

### Session & Engine (`app/db/session.py`)

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

if settings.DATABASE_URL:
    database_url = settings.DATABASE_URL
else:
    database_url = (
        f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    )

engine = create_engine(
    database_url,
    pool_size=2,           # Small — Supabase pooler handles connection pooling
    max_overflow=0,        # No overflow — keep it predictable
    pool_pre_ping=True,    # Verify connection liveness before use (critical for pooler)
    pool_recycle=300,      # Recycle after 5 min (before Supabase's idle timeout)
    connect_args={
        "connect_timeout": 10,
    },
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Why these pool settings?**
- Supabase's connection pooler (PgBouncer) already manages pooling on their side. A large local pool would waste Supabase connections.
- `pool_pre_ping=True` catches stale connections the pooler may have dropped.
- `pool_recycle=300` prevents connections from outliving Supabase's idle timeout.

### Base Class (`app/db/base_class.py`)

```python
from sqlalchemy.ext.declarative import declarative_base
Base = declarative_base()
```

All models inherit from this `Base`. Alembic reads `Base.metadata` for autogeneration.

---

## Models

Each table has its own file in `app/models/`. A central `app/models/base.py` imports every model so Alembic's autogenerate can discover them all.

### Model Registry (`app/models/base.py`)

```python
from app.db.base_class import Base
from .user import User
from .conversation import Conversation
from .message import Message
# ... import every model here
```

**Important:** If you add a new model file, you must import it here or Alembic won't detect it.

### Model Conventions

```python
import uuid
from sqlalchemy import Column, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql.sqltypes import DateTime
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(Text, unique=True, nullable=False)
    name = Column(Text, nullable=True)
    hashed_password = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
```

**Patterns used:**
- **UUIDs** as primary keys (`UUID(as_uuid=True)`, `default=uuid.uuid4`).
- **Timezone-aware timestamps** with `server_default=func.now()`.
- **`onupdate=func.now()`** for `updated_at` auto-refresh.
- **Cascade deletes** via `cascade="all, delete-orphan"` on parent relationships.
- **`Text`** over `String(n)` — Postgres `text` type has no practical length limit.
- **JSONB** columns for flexible structured data (messages, features, metadata).
- **`LargeBinary`** for file storage in the database.
- **Check constraints** for enum-like columns (e.g., `mode IN ('quick', 'workflow')`).

---

## Pydantic Schemas

Schemas live in `app/schemas/` — one file per domain. They follow a layered pattern:

```python
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

class ConversationBase(BaseModel):
    title: Optional[str] = None

class ConversationCreate(ConversationBase):
    user_id: uuid.UUID

class ConversationUpdate(ConversationBase):
    pass

class ConversationInDBBase(ConversationBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True     # Allows creating from SQLAlchemy model instances

class Conversation(ConversationInDBBase):
    """Response schema for API"""
    pass
```

**Schema layers:**
| Schema | Purpose |
|---|---|
| `*Base` | Shared fields |
| `*Create` | Fields needed to create a record (may include foreign keys set server-side) |
| `*CreateRequest` | Fields the API client actually sends (subset of Create) |
| `*Update` | Fields allowed to be updated (all optional) |
| `*InDBBase` | Full DB representation (adds id, timestamps) |
| `*` (response) | What the API returns |
| `*Detail` | Expanded response with nested relationships |

---

## Service Layer

Business logic and database queries are in `app/services/` — one service class per model, instantiated as a module-level singleton.

```python
from sqlalchemy.orm import Session
import uuid
from typing import Optional, List
from app.models.conversation import Conversation
from app.schemas.conversation import ConversationCreate, ConversationUpdate

class ConversationService:
    def get(self, db: Session, *, id: uuid.UUID) -> Optional[Conversation]:
        return db.query(Conversation).filter(Conversation.id == id).first()

    def get_multi_by_user(
        self, db: Session, *, user_id: uuid.UUID, skip: int = 0, limit: int = 100
    ) -> List[Conversation]:
        return (
            db.query(Conversation)
            .filter(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_by_user(self, db: Session, *, user_id: uuid.UUID) -> int:
        return db.query(Conversation).filter(Conversation.user_id == user_id).count()

    def create(self, db: Session, *, obj_in: ConversationCreate) -> Conversation:
        db_obj = Conversation(**obj_in.dict())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, *, db_obj: Conversation, obj_in: ConversationUpdate) -> Conversation:
        update_data = obj_in.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, *, id: uuid.UUID) -> bool:
        obj = db.query(Conversation).filter(Conversation.id == id).first()
        if obj:
            db.delete(obj)
            db.commit()
            return True
        return False

conversation_service = ConversationService()
```

**Query patterns:**
| Operation | Pattern |
|---|---|
| Get one | `db.query(Model).filter(Model.id == id).first()` |
| Get many | `.filter(...).order_by(...).offset(skip).limit(limit).all()` |
| Count | `.filter(...).count()` |
| Aggregate | `db.query(func.sum(Model.col)).filter(...).scalar()` |
| Create | `db.add(obj)` → `db.commit()` → `db.refresh(obj)` |
| Update | `setattr` loop → `db.add(obj)` → `db.commit()` → `db.refresh(obj)` |
| Delete | `db.delete(obj)` → `db.commit()` |

---

## FastAPI Dependencies (`app/api/deps.py`)

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    # Verify JWT → extract user_id → query DB → return User or raise 401
    ...
```

Usage in routes:

```python
@router.get("/conversations")
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return conversation_service.get_multi_by_user(db, user_id=current_user.id)
```

---

## Migrations with Alembic

### Setup

- `alembic.ini` — points to `alembic/` directory.
- `alembic/env.py` — imports `Base.metadata` and builds the DB URL from the same `Settings` class the app uses. This ensures migrations always target the correct database.

### Commands

```bash
# Create a new migration (autogenerate from model changes)
poetry run alembic revision --autogenerate -m "Add users table"

# Apply all pending migrations
poetry run alembic upgrade head

# Rollback one migration
poetry run alembic downgrade -1

# See current migration state
poetry run alembic current

# See migration history
poetry run alembic history
```

### How Autogenerate Works

1. You modify a model in `app/models/`.
2. Run `alembic revision --autogenerate -m "description"`.
3. Alembic compares `Base.metadata` (your models) against the live database schema and generates an `upgrade()` / `downgrade()` migration in `alembic/versions/`.
4. **Always review the generated migration** before running `alembic upgrade head`.

### `alembic/env.py` Key Parts

```python
from app.core.config import settings
from app.db.base_class import Base
import app.models.base           # Ensures all models are imported

target_metadata = Base.metadata

# Build DB URL from settings (same logic as session.py)
if settings.DATABASE_URL:
    database_url = settings.DATABASE_URL
else:
    database_url = f"postgresql://..."

config.set_main_option("sqlalchemy.url", database_url)
```

---

## Utility Scripts

### Seed Script (`seed_plans.py`)

Populates initial/reference data (e.g., subscription plans). Idempotent — checks for existing records before inserting.

```bash
poetry run python seed_plans.py
```

### Database Reset (`reset_db.py`)

Drops all tables and the `alembic_version` table for a completely fresh start. Use when migrations get into a bad state.

```bash
poetry run python reset_db.py
# Then re-run migrations:
poetry run alembic revision --autogenerate -m "Create initial tables"
poetry run alembic upgrade head
```

### Connection Test (`test_supabase.py`)

Quick smoke test that connects to the Supabase PostgreSQL instance using `psycopg2` directly.

```bash
poetry run python test_supabase.py
```

---

## Important Supabase-Specific Notes

### Use the Connection Pooler
Always connect via `pooler.supabase.com` (port 5432), not the direct connection (`db.<ref>.supabase.co`, port 5432). The pooler uses PgBouncer and handles connection limits for you — critical when deploying to platforms like Render that don't support IPv6.

### Connection Pool Sizing
Keep SQLAlchemy's pool small (`pool_size=2`, `max_overflow=0`). Supabase free tier has a limited number of direct connections; the pooler multiplexes them. A large local pool wastes slots.

### Connection Recycling
Set `pool_recycle=300` (5 minutes). Supabase's pooler may drop idle connections; recycling prevents "server closed the connection unexpectedly" errors.

### Pre-Ping
Always enable `pool_pre_ping=True`. This sends a lightweight query before reusing a connection, catching dead connections before your actual query fails.

### No RLS — Application-Level Auth
We don't use Supabase Row Level Security. Authorization is handled entirely in Python via JWT validation and FastAPI dependencies that scope queries to the authenticated user.

### No Supabase Client SDK
We don't use `supabase-py` or `supabase-js`. All database access goes through SQLAlchemy → psycopg2 → PostgreSQL. This means we can switch to any PostgreSQL host without code changes.

---

## Checklist: Adding a New Table

1. **Create the model** — `app/models/new_thing.py` (inherit from `Base`).
2. **Register it** — add `from .new_thing import NewThing` to `app/models/base.py`.
3. **Create schema** — `app/schemas/new_thing.py` (Base, Create, Update, response).
4. **Create service** — `app/services/new_thing_service.py`.
5. **Create route** — `app/api/v1/new_thing.py`, wire into the router.
6. **Generate migration** — `poetry run alembic revision --autogenerate -m "Add new_thing table"`.
7. **Review & apply** — check the migration file, then `poetry run alembic upgrade head`.
8. **Seed data** (if needed) — add to `seed_plans.py` or create a new seed script.
