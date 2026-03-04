from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.projects import router as projects_router
from app.api.v1.features import router as features_router
from app.api.v1.context_items import router as context_items_router
from app.api.v1.test_cases import router as test_cases_router
from app.api.v1.test_runs import router as test_runs_router
from app.api.v1.test_results import router as test_results_router
from app.api.v1.settings import router as settings_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(features_router)
api_router.include_router(context_items_router)
api_router.include_router(test_cases_router)
api_router.include_router(test_runs_router)
api_router.include_router(test_results_router)
api_router.include_router(settings_router)
