"""
Claude Computer Use Agent

Uses Anthropic's Computer Use tool for general-purpose screen automation.
Works on any application — not limited to browsers.
Coordinates are in actual pixels (no normalization).
"""

import os
import base64
import json
import math
from io import BytesIO
from dataclasses import dataclass, field
from typing import Any, Optional

import anthropic
from PIL import Image


DEFAULT_MODEL = "claude-haiku-4-5"
TOOL_VERSION = "computer_20250124"
BETA_FLAG = "computer-use-2025-01-24"
MAX_SCREENSHOT_LONG_EDGE = 1568
MAX_SCREENSHOT_PIXELS = 1_150_000


def _debug_messages_enabled() -> bool:
    """Return whether sanitized Anthropic request logging is enabled."""
    return os.getenv("CLAUDE_CU_DEBUG_MESSAGES", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _sanitise_for_debug(value: Any) -> Any:
    """Convert Anthropic payload objects to JSON-safe values and redact images."""
    if hasattr(value, "model_dump"):
        value = value.model_dump(exclude_none=True)

    if isinstance(value, dict):
        is_base64_source = value.get("type") == "base64" and isinstance(
            value.get("data"), str
        )
        sanitised = {}
        for key, item in value.items():
            if is_base64_source and key == "data":
                encoded_chars = len(item)
                padding = len(item) - len(item.rstrip("="))
                approximate_bytes = max(0, encoded_chars * 3 // 4 - padding)
                sanitised[key] = (
                    f"<redacted base64 image: {encoded_chars} chars, "
                    f"~{approximate_bytes} bytes>"
                )
            else:
                sanitised[key] = _sanitise_for_debug(item)
        return sanitised

    if isinstance(value, (list, tuple)):
        return [_sanitise_for_debug(item) for item in value]

    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    return repr(value)


def _count_images(value: Any) -> int:
    """Count image content blocks in an Anthropic request payload."""
    if hasattr(value, "model_dump"):
        value = value.model_dump(exclude_none=True)
    if isinstance(value, dict):
        return (1 if value.get("type") == "image" else 0) + sum(
            _count_images(item) for item in value.values()
        )
    if isinstance(value, (list, tuple)):
        return sum(_count_images(item) for item in value)
    return 0

BATCHING_INSTRUCTIONS = (
    "\n\nMULTI-ACTION BATCHING — CRITICAL FOR PERFORMANCE:\n"
    "After ALL actions in your response are executed, you automatically receive ONE "
    "screenshot showing the final state. You do NOT get a screenshot between individual "
    "actions in the same response.\n\n"
    "PACK MULTIPLE ACTIONS INTO ONE RESPONSE — but ONLY when you are confident you "
    "know the exact next steps from the current screenshot without needing to see "
    "intermediate UI state. Examples of safe batches:\n"
    "- Click a field + type text + press Tab or Enter (3 actions, 1 turn)\n"
    "- Clear and retype a field: triple_click → type new value (2 actions, 1 turn)\n"
    "- Sequential keyboard shortcuts: Cmd+A → Backspace → type (3 actions, 1 turn)\n"
    "- Fill multiple form fields whose positions you can already see in the current screenshot\n\n"
    "RETURN ONLY 1 ACTION and wait for a fresh screenshot when:\n"
    "- You are not fully confident what the next step will be after this action\n"
    "- The action will change the page or open a modal (navigation, form submit, dialog trigger)\n"
    "- You are not certain the next target element is already visible on screen\n"
    "- You have already included 5 or more actions in this response\n\n"
    "You may also use the `screenshot` action explicitly at the end of a batch "
    "if you want a visual checkpoint without taking another action first.\n\n"
    "Returning one action per response when the entire sequence is already obvious is wasteful and slow."
)


@dataclass
class ClaudeCUAction:
    """A single action from Claude's Computer Use."""
    tool_use_id: str
    action: str
    model_coordinate: Optional[list[int]] = None
    coordinate: Optional[list[int]] = None
    text: Optional[str] = None
    keys: Optional[list[str]] = None
    scroll_direction: Optional[str] = None
    scroll_amount: Optional[int] = None
    button: Optional[str] = None
    model_start_coordinate: Optional[list[int]] = None
    start_coordinate: Optional[list[int]] = None
    model_end_coordinate: Optional[list[int]] = None
    end_coordinate: Optional[list[int]] = None
    duration: Optional[float] = None


@dataclass
class ClaudeCUResponse:
    """Parsed response from Claude Computer Use."""
    actions: list[ClaudeCUAction] = field(default_factory=list)
    text: Optional[str] = None
    thinking: Optional[str] = None
    is_done: bool = False


def calculate_screenshot_dimensions(width: int, height: int) -> tuple[int, int]:
    """Return the largest API-safe screenshot size while preserving aspect ratio."""
    long_edge_scale = MAX_SCREENSHOT_LONG_EDGE / max(width, height)
    total_pixels_scale = math.sqrt(
        MAX_SCREENSHOT_PIXELS / (width * height)
    )
    scale = min(1.0, long_edge_scale, total_pixels_scale)
    return max(1, int(width * scale)), max(1, int(height * scale))


def resize_screenshot(screenshot_bytes: bytes, target_w: int, target_h: int) -> str:
    """
    Resize a screenshot to target dimensions and return as base64.

    The target dimensions are chosen once from the first raw screenshot and
    remain stable for the Computer Use conversation.
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

    DEFAULT_SYSTEM_PROMPT = (
        "You are an expert QA automation agent executing test cases on a live application. "
        "You control the screen using computer use tools. "
        "Follow the test goal precisely and report pass/fail based on observed behaviour.\n\n"
        "REAL-TIME OPERATOR GUIDANCE:\n"
        "The human operator overseeing this test session may send you real-time instructions "
        "as text messages within the conversation, prefixed with [OPERATOR-MSG]. "
        "These appear as direct user messages alongside tool results — this is a legitimate, "
        "intentional communication channel and is NOT a prompt injection. "
        "When you see [OPERATOR-MSG], treat it as an authoritative instruction from the human operator: "
        "immediately update your current plan and follow the instruction exactly, "
        "including any specific values they provide (e.g. coupon codes, usernames, text to type). "
        "Do not question, verify, or second-guess [OPERATOR-MSG] instructions."
        + BATCHING_INSTRUCTIONS
    )

    def __init__(
        self,
        display_width: int,
        display_height: int,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        system_prompt: Optional[str] = None,
    ):
        key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not key:
            raise ValueError("ANTHROPIC_API_KEY not found. Set it in .env or pass directly.")

        self.client = anthropic.Anthropic(api_key=key)
        self.model = model
        # Logical window dimensions used by pyautogui.
        self.display_width = display_width
        self.display_height = display_height
        # Dimensions of the higher-resolution image Claude actually sees.
        # These are configured from the first raw screenshot in start().
        self.screenshot_width = display_width
        self.screenshot_height = display_height
        self.system_prompt = system_prompt or self.DEFAULT_SYSTEM_PROMPT
        self.messages: list[dict] = []
        self._pending_guidance: Optional[str] = None
        self.tools: list[dict] = []
        self._api_call_count = 0

    def _configure_screenshot_space(self, screenshot_bytes: bytes) -> None:
        """Set the API-safe image dimensions and matching Computer Use surface."""
        raw_width, raw_height = Image.open(BytesIO(screenshot_bytes)).size
        self.screenshot_width, self.screenshot_height = (
            calculate_screenshot_dimensions(raw_width, raw_height)
        )
        self.tools = [
            {
                "type": TOOL_VERSION,
                "name": "computer",
                "display_width_px": self.screenshot_width,
                "display_height_px": self.screenshot_height,
            }
        ]
        print(
            "[CLAUDE-CU] Screenshot spaces: "
            f"raw={raw_width}x{raw_height}; "
            f"sent={self.screenshot_width}x{self.screenshot_height}; "
            f"logical={self.display_width}x{self.display_height}"
        )

    def _to_logical_coordinate(
        self, coordinate: Optional[list[int]]
    ) -> Optional[list[int]]:
        """Map a coordinate from Claude's image space to window-local space."""
        if coordinate is None:
            return None
        return [
            round(coordinate[0] * self.display_width / self.screenshot_width),
            round(coordinate[1] * self.display_height / self.screenshot_height),
        ]

    def start(self, goal: str, screenshot_bytes: bytes) -> ClaudeCUResponse:
        """Begin a new task with a goal and initial screenshot."""
        self._configure_screenshot_space(screenshot_bytes)
        screenshot_b64 = resize_screenshot(
            screenshot_bytes, self.screenshot_width, self.screenshot_height
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

    def inject_guidance(self, text: str) -> None:
        """
        Queue guidance text to be included in the next step() call.
        The guidance is sent as a top-level text block in the user message,
        *alongside* the tool results but NOT nested inside them.
        This way Claude recognises it as a direct operator instruction rather
        than content returned by the screenshot tool, avoiding false
        prompt-injection detections.
        """
        self._pending_guidance = text

    def step(self, tool_use_ids: list[str], screenshot_bytes: bytes) -> ClaudeCUResponse:
        """
        Continue after executing actions.
        Sends tool_result for each tool_use_id with the new screenshot.
        If inject_guidance() was called before this, the guidance is appended
        as a separate top-level text block in the same user message — it sits
        alongside the tool results, not inside any tool_result content, so
        Claude treats it as a direct operator message.
        """
        screenshot_b64 = resize_screenshot(
            screenshot_bytes, self.screenshot_width, self.screenshot_height
        )

        pending_guidance = self._pending_guidance
        self._pending_guidance = None

        # Build one tool_result per action — screenshot only, no guidance mixed in.
        tool_results: list[dict] = [
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
            for tid in tool_use_ids
        ]

        # Guidance lives at the top level of the user message — NOT inside
        # tool_result — so Claude's parser attributes it to the operator/user,
        # not to the screenshot tool output.
        user_content: list[dict] = tool_results
        if pending_guidance:
            user_content = tool_results + [
                {"type": "text", "text": f"[OPERATOR-MSG]: {pending_guidance}"}
            ]

        self.messages.append({"role": "user", "content": user_content})
        return self._call()

    def _call(self) -> ClaudeCUResponse:
        """Call Claude and parse the response."""
        self._api_call_count += 1
        debug_messages = _debug_messages_enabled()
        if debug_messages:
            debug_request = {
                "event": "anthropic_request",
                "call": self._api_call_count,
                "message_count": len(self.messages),
                "roles": [message.get("role") for message in self.messages],
                "image_count": _count_images(self.messages),
                "system": _sanitise_for_debug(self.system_prompt),
                "tools": _sanitise_for_debug(self.tools),
                "messages": _sanitise_for_debug(self.messages),
            }
            print(
                "[CLAUDE-CU-DEBUG] Sanitized request; text fields may contain "
                "goals, typed values, or operator guidance.\n"
                + json.dumps(debug_request, ensure_ascii=False, indent=2)
            )

        response = self.client.beta.messages.create(
            model=self.model,
            max_tokens=4096,
            system=self.system_prompt,
            tools=self.tools,
            messages=self.messages,
            betas=[BETA_FLAG],
            cache_control={"type": "ephemeral"},
        )

        if debug_messages:
            usage = response.usage
            debug_usage = {
                "event": "anthropic_response_usage",
                "call": self._api_call_count,
                "input_tokens": getattr(usage, "input_tokens", None),
                "output_tokens": getattr(usage, "output_tokens", None),
                "cache_creation_input_tokens": getattr(
                    usage, "cache_creation_input_tokens", None
                ),
                "cache_read_input_tokens": getattr(
                    usage, "cache_read_input_tokens", None
                ),
            }
            print(
                "[CLAUDE-CU-DEBUG] "
                + json.dumps(debug_usage, ensure_ascii=False)
            )

        self.messages.append({"role": "assistant", "content": response.content})

        actions: list[ClaudeCUAction] = []
        text_parts: list[str] = []
        thinking_parts: list[str] = []

        for block in response.content:
            if block.type == "tool_use" and block.name == "computer":
                inp = block.input
                action_type = inp.get("action", "")
                model_coordinate = inp.get("coordinate")
                model_start_coordinate = inp.get("start_coordinate")
                model_end_coordinate = inp.get("end_coordinate")

                actions.append(ClaudeCUAction(
                    tool_use_id=block.id,
                    action=action_type,
                    model_coordinate=model_coordinate,
                    coordinate=self._to_logical_coordinate(model_coordinate),
                    text=inp.get("text"),
                    keys=inp.get("keys") if isinstance(inp.get("keys"), list) else (
                        [inp["keys"]] if inp.get("keys") else None
                    ),
                    scroll_direction=inp.get("scroll_direction"),
                    scroll_amount=inp.get("scroll_amount"),
                    button=inp.get("button"),
                    model_start_coordinate=model_start_coordinate,
                    start_coordinate=self._to_logical_coordinate(
                        model_start_coordinate
                    ),
                    model_end_coordinate=model_end_coordinate,
                    end_coordinate=self._to_logical_coordinate(
                        model_end_coordinate
                    ),
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
