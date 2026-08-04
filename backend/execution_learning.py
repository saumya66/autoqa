"""Pure helpers for preparing durable project-context learning inputs."""

from typing import Any, Callable, Optional


MAX_STEPS_PER_TEST = 60
MAX_TEXT_CHARS = 1200


def _compact_text(value: Any) -> str:
    text = str(value or "").strip()
    if len(text) <= MAX_TEXT_CHARS:
        return text
    return f"{text[:MAX_TEXT_CHARS]}…"


def _select_steps(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(steps) <= MAX_STEPS_PER_TEST:
        return steps
    half = MAX_STEPS_PER_TEST // 2
    return steps[:half] + steps[-half:]


def build_suite_learning_log(
    *,
    test_case: dict[str, Any],
    status: str,
    conclusion: str,
    steps: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build a bounded, text-only record for project-context learning."""
    compact_steps = [
        {
            "step_number": step.get("step_number"),
            "action": _compact_text(step.get("action")),
            "description": _compact_text(
                step.get("description") or step.get("reasoning")
            ),
            "success": bool(step.get("success")),
            "error": _compact_text(step.get("error")) or None,
        }
        for step in _select_steps(steps)
    ]
    return {
        "test_id": str(test_case.get("id") or test_case.get("test_key") or ""),
        "test_key": _compact_text(test_case.get("test_key")),
        "title": _compact_text(test_case.get("title")),
        "goal": _compact_text(test_case.get("goal")),
        "expected_result": _compact_text(test_case.get("expected_result")),
        "status": status,
        "conclusion": _compact_text(conclusion),
        "steps": compact_steps,
    }


def should_run_context_learning(
    *,
    logs: list[dict[str, Any]],
    aborted: bool,
    project_id: Optional[str],
    cloud_token: Optional[str],
) -> bool:
    """Return whether a completed suite has enough data to update its project."""
    if aborted or not project_id or not cloud_token:
        return False
    return any(log.get("conclusion") or log.get("steps") for log in logs)


def learn_and_update_project(
    *,
    learner: Any,
    update_project: Callable[..., Optional[dict]],
    project_id: str,
    cloud_token: str,
    project_context: str,
    feature_context: str,
    logs: list[dict[str, Any]],
) -> dict[str, str]:
    """Generate a revised context and persist it through the cloud client."""
    learner_result = learner.update_project_context(
        project_context,
        feature_context,
        logs,
    )
    updated_context = (
        (learner_result or {}).get("updated_project_context") or ""
    ).strip()
    change_summary = ((learner_result or {}).get("change_summary") or "").strip()
    if not updated_context:
        raise ValueError("Learner returned no updated project context")

    updated_project = update_project(
        project_id,
        token=cloud_token,
        context_summary=updated_context,
    )
    if not updated_project:
        raise RuntimeError("Cloud project context update failed")

    return {
        "updated_project_context": updated_context,
        "change_summary": change_summary,
    }
