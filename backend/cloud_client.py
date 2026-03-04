"""
Cloud API client for the deployed cloud backend.

When CLOUD_API_URL is set, the local backend can persist and fetch data
from the cloud. Token is passed per-request (from frontend after login).
"""

import os
from typing import Optional

import httpx

CLOUD_API_URL = os.getenv("CLOUD_API_URL", "").rstrip("/")


def is_configured() -> bool:
    """True if cloud backend URL is configured."""
    return bool(CLOUD_API_URL)


def _url(path: str) -> str:
    base = CLOUD_API_URL.rstrip("/")
    path = path if path.startswith("/") else f"/{path}"
    return f"{base}{path}"


def _request(
    method: str,
    path: str,
    *,
    json: Optional[dict] = None,
    token: Optional[str] = None,
) -> tuple[int, Optional[dict]]:
    """Make HTTP request. Returns (status_code, json_body or None)."""
    if not CLOUD_API_URL:
        return 0, None
    url = _url(path)
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.request(method, url, headers=h, json=json)
            body = r.json() if r.content else None
            return r.status_code, body
    except Exception as e:
        print(f"[CloudClient] Request failed: {e}")
        return 0, None


# ─── Projects ───────────────────────────────────────────────────────────────
def create_project(name: str, description: Optional[str] = None, token: Optional[str] = None) -> Optional[dict]:
    code, data = _request("POST", "/api/v1/projects/", json={"name": name, "description": description}, token=token)
    return data if code in (200, 201) else None


def list_projects(token: Optional[str] = None) -> list:
    code, data = _request("GET", "/api/v1/projects/", token=token)
    return data if code == 200 else []


# ─── Features ───────────────────────────────────────────────────────────────
def create_feature(project_id: str, name: str, description: Optional[str] = None, token: Optional[str] = None) -> Optional[dict]:
    code, data = _request("POST", "/api/v1/features/", json={"project_id": project_id, "name": name, "description": description}, token=token)
    return data if code in (200, 201) else None


def update_feature(feature_id: str, token: Optional[str] = None, **fields) -> Optional[dict]:
    code, data = _request("PATCH", f"/api/v1/features/{feature_id}", json=fields, token=token)
    return data if code == 200 else None


# ─── Context items ──────────────────────────────────────────────────────────
def create_context_item(feature_id: str, type: str, token: Optional[str] = None, **kwargs) -> Optional[dict]:
    payload = {"feature_id": feature_id, "type": type, **kwargs}
    code, data = _request("POST", "/api/v1/context-items/", json=payload, token=token)
    return data if code in (200, 201) else None


def list_context_items(feature_id: str, token: Optional[str] = None) -> list:
    code, data = _request("GET", f"/api/v1/context-items/by-feature/{feature_id}", token=token)
    return data if code == 200 else []


# ─── Test cases ────────────────────────────────────────────────────────────
def list_test_cases_by_feature(feature_id: str, token: Optional[str] = None) -> list:
    """Fetch test cases from cloud for a feature."""
    code, data = _request("GET", f"/api/v1/test-cases/by-feature/{feature_id}", token=token)
    return data if code == 200 else []


# ─── Test runs & results ───────────────────────────────────────────────────
def create_test_run(feature_id: str, user_id: str, provider: str, model: str, total_tests: int = 0, target_window: Optional[str] = None, token: Optional[str] = None) -> Optional[dict]:
    payload = {
        "feature_id": feature_id,
        "user_id": user_id,
        "provider": provider,
        "model": model,
        "total_tests": total_tests,
        "target_window": target_window,
    }
    code, data = _request("POST", "/api/v1/test-runs/", json=payload, token=token)
    return data if code in (200, 201) else None


def update_test_run(run_id: str, token: Optional[str] = None, **fields) -> Optional[dict]:
    code, data = _request("PATCH", f"/api/v1/test-runs/{run_id}", json=fields, token=token)
    return data if code == 200 else None


def create_test_result(
    run_id: str,
    test_case_id: str,
    status: str,
    conclusion: Optional[str] = None,
    steps: Optional[list] = None,
    steps_executed: int = 0,
    error: Optional[str] = None,
    duration_ms: Optional[int] = None,
    token: Optional[str] = None,
) -> Optional[dict]:
    payload = {
        "run_id": run_id,
        "test_case_id": test_case_id,
        "status": status,
        "conclusion": conclusion,
        "steps": steps or [],
        "steps_executed": steps_executed,
        "error": error,
        "duration_ms": duration_ms,
    }
    code, data = _request("POST", "/api/v1/test-results/", json=payload, token=token)
    return data if code in (200, 201) else None
