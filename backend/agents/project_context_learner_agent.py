"""Learns durable project knowledge from completed suite execution logs."""

import json
from typing import Any, Optional

from .base_agent import BaseAgent


class ProjectContextLearnerAgent(BaseAgent):
    """Maintains the canonical project context without retaining run-local state."""

    @property
    def system_prompt(self) -> str:
        return (
            "You maintain the canonical project-level context for an application. "
            "Return only JSON with `updated_project_context` and `change_summary`. "
            "Preserve accurate existing project knowledge. Add only durable app-level "
            "facts explicitly supported by the feature context, final executor reports, "
            "or execution logs. Incorporate useful operational learnings and corrected "
            "mistakes. Do not infer that an attempted action succeeded merely because it "
            "was issued. Exclude current prices, cart contents, login state, modal state, "
            "temporary offers, timestamps, test outcomes, and narration about a run. "
            "Correct or remove existing information only when new evidence clearly "
            "contradicts it. Keep the result concise and useful across all project features."
        )

    def parse_response(self, response_text: str) -> Optional[dict]:
        return self.extract_json(response_text)

    def update_project_context(
        self,
        current_project_context: str,
        feature_context: str,
        suite_learning_logs: list[dict[str, Any]],
    ) -> Optional[dict]:
        """Return the revised canonical project context and a concise change summary."""
        prompt = (
            f"EXISTING PROJECT CONTEXT:\n{current_project_context or '(empty)'}\n\n"
            f"CURRENT FEATURE CONTEXT:\n{feature_context or '(empty)'}\n\n"
            "EXECUTION LOGS FROM THIS SUITE:\n"
            f"{json.dumps(suite_learning_logs, ensure_ascii=False)}\n\n"
            "Return the complete revised project context."
        )
        return self.parse_response(self.call_llm(prompt, max_tokens=1024))
