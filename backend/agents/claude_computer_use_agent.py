"""
Claude Computer Use Agent

Uses Anthropic's Computer Use tool for general-purpose screen automation.
Works on any application — not limited to browsers.
Coordinates are in actual pixels (no normalization).
"""

import os
import base64
from io import BytesIO
from dataclasses import dataclass, field
from typing import Optional

import anthropic
from PIL import Image


DEFAULT_MODEL = "claude-haiku-4-5"
TOOL_VERSION = "computer_20250124"
BETA_FLAG = "computer-use-2025-01-24"


@dataclass
class ClaudeCUAction:
    """A single action from Claude's Computer Use."""
    tool_use_id: str
    action: str
    coordinate: Optional[list[int]] = None
    text: Optional[str] = None
    keys: Optional[list[str]] = None
    scroll_direction: Optional[str] = None
    scroll_amount: Optional[int] = None
    button: Optional[str] = None
    start_coordinate: Optional[list[int]] = None
    end_coordinate: Optional[list[int]] = None
    duration: Optional[float] = None


@dataclass
class ClaudeCUResponse:
    """Parsed response from Claude Computer Use."""
    actions: list[ClaudeCUAction] = field(default_factory=list)
    text: Optional[str] = None
    thinking: Optional[str] = None
    is_done: bool = False


def resize_screenshot(screenshot_bytes: bytes, target_w: int, target_h: int) -> str:
    """
    Resize a screenshot to target dimensions and return as base64.

    On Retina displays the raw screenshot is 2x the logical window size.
    Resizing to the logical size means Claude's pixel coordinates map 1:1
    to window-local coordinates — no scaling math needed.
    """
    img = Image.open(BytesIO(screenshot_bytes))
    if img.size != (target_w, target_h):
        img = img.resize((target_w, target_h), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


class ClaudeComputerUseAgent:
    """
    Agent using Claude's Computer Use for direct screen control.

    Unlike Gemini CU (browser-only, normalized 0-999 coords),
    Claude CU works on any screen and uses actual pixel coordinates.

    Usage:
        agent = ClaudeComputerUseAgent(display_w=1440, display_h=900)
        resp = agent.start("Open Safari", screenshot_bytes)

        while not resp.is_done:
            for action in resp.actions:
                execute(action)
            new_screenshot = capture()
            resp = agent.step(action.tool_use_id, new_screenshot)
    """

    def __init__(
        self,
        display_width: int,
        display_height: int,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
    ):
        key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not key:
            raise ValueError("ANTHROPIC_API_KEY not found. Set it in .env or pass directly.")

        self.client = anthropic.Anthropic(api_key=key)
        self.model = model
        self.display_width = display_width
        self.display_height = display_height
        self.messages: list[dict] = []
        self.tools = [
            {
                "type": TOOL_VERSION,
                "name": "computer",
                "display_width_px": display_width,
                "display_height_px": display_height,
            }
        ]

    def start(self, goal: str, screenshot_bytes: bytes) -> ClaudeCUResponse:
        """Begin a new task with a goal and initial screenshot."""
        screenshot_b64 = resize_screenshot(
            screenshot_bytes, self.display_width, self.display_height
        )

        self.messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": goal},
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": screenshot_b64,
                        },
                    },
                ],
            }
        ]
        return self._call()

    def step(self, tool_use_ids: list[str], screenshot_bytes: bytes) -> ClaudeCUResponse:
        """
        Continue after executing actions.
        Send tool_result for each tool_use_id with the new screenshot.
        """
        screenshot_b64 = resize_screenshot(
            screenshot_bytes, self.display_width, self.display_height
        )

        tool_results = []
        for tid in tool_use_ids:
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tid,
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": screenshot_b64,
                            },
                        }
                    ],
                }
            )

        self.messages.append({"role": "user", "content": tool_results})
        return self._call()

    def _call(self) -> ClaudeCUResponse:
        """Call Claude and parse the response."""
        response = self.client.beta.messages.create(
            model=self.model,
            max_tokens=4096,
            tools=self.tools,
            messages=self.messages,
            betas=[BETA_FLAG],
        )

        self.messages.append({"role": "assistant", "content": response.content})

        actions: list[ClaudeCUAction] = []
        text_parts: list[str] = []
        thinking_parts: list[str] = []

        for block in response.content:
            if block.type == "tool_use" and block.name == "computer":
                inp = block.input
                action_type = inp.get("action", "")

                actions.append(ClaudeCUAction(
                    tool_use_id=block.id,
                    action=action_type,
                    coordinate=inp.get("coordinate"),
                    text=inp.get("text"),
                    keys=inp.get("keys") if isinstance(inp.get("keys"), list) else (
                        [inp["keys"]] if inp.get("keys") else None
                    ),
                    scroll_direction=inp.get("scroll_direction"),
                    scroll_amount=inp.get("scroll_amount"),
                    button=inp.get("button"),
                    start_coordinate=inp.get("start_coordinate"),
                    end_coordinate=inp.get("end_coordinate"),
                    duration=inp.get("duration"),
                ))
            elif block.type == "thinking":
                thinking_parts.append(getattr(block, "thinking", "") or "")
            elif block.type == "text":
                text_parts.append(block.text)

        is_done = response.stop_reason != "tool_use"

        return ClaudeCUResponse(
            actions=actions,
            text=" ".join(text_parts) if text_parts else None,
            thinking=" ".join(thinking_parts) if thinking_parts else None,
            is_done=is_done,
        )
