"""
Computer Use Agent

Uses Gemini's built-in Computer Use tool for direct UI automation.
Single API call per step — the model both observes the screen AND decides
what action to take (click, type, scroll, etc.) with exact coordinates.

Replaces the OrchestratorAgent + VisionAgent two-call pattern.
"""

import os
from dataclasses import dataclass, field
from typing import Optional

from google import genai
from google.genai import types
from google.genai.types import Content, Part


DEFAULT_MODEL = "gemini-2.5-computer-use-preview-10-2025"


@dataclass
class CUAction:
    """A single action returned by the Computer Use model."""
    name: str
    args: dict
    safety_decision: Optional[dict] = None

    @property
    def x(self) -> Optional[int]:
        return self.args.get("x")

    @property
    def y(self) -> Optional[int]:
        return self.args.get("y")


@dataclass
class CUResponse:
    """Parsed response from the Computer Use model."""
    actions: list[CUAction] = field(default_factory=list)
    text: Optional[str] = None
    thinking: Optional[str] = None
    is_done: bool = False


class ComputerUseAgent:
    """
    Agent that uses Gemini Computer Use for direct screen control.

    Maintains a conversation history so the model remembers previous
    actions and can reason about multi-step flows.

    Usage:
        agent = ComputerUseAgent()
        resp = agent.start("Go to techcrunch.com", screenshot_bytes)

        while not resp.is_done:
            results = execute_actions(resp.actions)
            new_screenshot = capture()
            resp = agent.step(results, new_screenshot)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        excluded_actions: Optional[list[str]] = None,
    ):
        key = api_key or os.getenv("GEMINI_API_KEY")
        if not key:
            raise ValueError("GEMINI_API_KEY not found. Set it in .env or pass directly.")

        self.client = genai.Client(api_key=key)
        self.model = model
        self.contents: list[Content] = []

        cu_kwargs = {"environment": types.Environment.ENVIRONMENT_BROWSER}
        if excluded_actions:
            cu_kwargs["excluded_predefined_functions"] = excluded_actions

        self.config = types.GenerateContentConfig(
            tools=[
                types.Tool(computer_use=types.ComputerUse(**cu_kwargs))
            ],
            thinking_config=types.ThinkingConfig(include_thoughts=True),
        )

    def start(self, goal: str, screenshot_bytes: bytes) -> CUResponse:
        """Begin a new task with the user's goal and an initial screenshot."""
        self.contents = [
            Content(role="user", parts=[
                Part(text=goal),
                Part.from_bytes(data=screenshot_bytes, mime_type="image/png"),
            ])
        ]
        return self._generate()

    def step(
        self,
        action_results: list[tuple[str, dict]],
        screenshot_bytes: bytes,
        current_url: str = "",
    ) -> CUResponse:
        """
        Continue the conversation after executing actions.

        Args:
            action_results: List of (action_name, result_dict) tuples.
            screenshot_bytes: New screenshot after executing the actions.
            current_url: Current browser URL (required by Computer Use model).
        """
        parts: list[Part] = []

        for name, result in action_results:
            response_data = {"url": current_url}
            response_data.update(result)
            parts.append(Part(function_response=types.FunctionResponse(
                name=name,
                response=response_data,
            )))

        parts.append(Part.from_bytes(data=screenshot_bytes, mime_type="image/png"))

        self.contents.append(Content(role="user", parts=parts))
        return self._generate()

    def _generate(self) -> CUResponse:
        """Call the model and parse the response."""
        response = self.client.models.generate_content(
            model=self.model,
            contents=self.contents,
            config=self.config,
        )

        if not response.candidates:
            return CUResponse(is_done=True, text="No response from model")

        candidate = response.candidates[0]
        self.contents.append(candidate.content)

        actions: list[CUAction] = []
        text_parts: list[str] = []
        thinking_parts: list[str] = []

        for part in candidate.content.parts:
            if hasattr(part, "function_call") and part.function_call:
                fc = part.function_call
                args = dict(fc.args) if fc.args else {}
                safety = args.pop("safety_decision", None)
                actions.append(CUAction(name=fc.name, args=args, safety_decision=safety))

            if hasattr(part, "thought") and part.thought:
                thinking_parts.append(part.text or "")
            elif hasattr(part, "text") and part.text:
                text_parts.append(part.text)

        return CUResponse(
            actions=actions,
            text=" ".join(text_parts) if text_parts else None,
            thinking=" ".join(thinking_parts) if thinking_parts else None,
            is_done=len(actions) == 0,
        )
