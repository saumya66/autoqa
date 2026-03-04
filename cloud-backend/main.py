"""
AutoQA Cloud Backend

Deployed on Render/Railway. Handles:
- Auth (register, login, JWT)
- Database CRUD via MongoDB (projects, features, test cases, runs, results)
- User settings (provider, model, API key storage)

Does NOT handle:
- Screenshots, mouse/keyboard, window management (that's the local agent)
- AI calls (those happen on the local backend)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.db.mongodb import init_indexes

app = FastAPI(
    title="AutoQA Cloud API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
def on_startup():
    init_indexes()


@app.get("/")
def health():
    return {"status": "ok", "service": "autoqa-cloud"}


if __name__ == "__main__":
    import uvicorn
    from app.core.config import settings

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
