# Claude Visual-Targeting Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Claude's selection of all visible UI targets and record enough action evidence to distinguish model target-selection errors from click-dispatch errors.

**Architecture:** A shared prompt constant supplies identical visual-targeting rules to the fallback Claude agent prompt and the test-suite execution prompt. The executor will isolate crosshair-image generation from action dispatch, then emit a structured diagnostic log using the action, Claude-local coordinate, macOS-global coordinate, claimed turn rationale, and optional image path.

**Tech Stack:** Python 3, Anthropic Computer Use SDK, FastAPI, Pillow, standard-library `unittest`.

## Global Constraints

- Do not change coordinate conversion or add an additional Anthropic API call.
- Apply visual-targeting instructions to every coordinate-based computer-use action.
- Existing screenshot capture and one-second post-turn wait remain unchanged.
- A debug-image failure must not prevent the requested mouse action.
- Preserve the existing `StepRecord` schema and SSE event shape.

---

## File Structure

- `backend/agents/claude_computer_use_agent.py` — owns reusable visual-targeting prompt text and appends it to the fallback system prompt.
- `backend/main.py` — appends the shared prompt text to the runtime execution prompt; creates crosshair debug images safely; prints action evidence without changing persisted step fields.
- `backend/tests/test_claude_visual_targeting.py` — covers prompt composition and isolated debug-image/evidence behavior without calling Anthropic or moving the mouse.

### Task 1: Add and test shared visual-targeting prompt

**Files:**
- Create: `backend/tests/test_claude_visual_targeting.py`
- Modify: `backend/agents/claude_computer_use_agent.py:19-45`
- Modify: `backend/main.py:43-52,2775-2791`

**Interfaces:**
- Produces: `VISUAL_TARGETING_INSTRUCTIONS: str` in `agents.claude_computer_use_agent`.
- Consumes: `VISUAL_TARGETING_INSTRUCTIONS` in `ClaudeComputerUseAgent.DEFAULT_SYSTEM_PROMPT` and the runtime `cu_system_prompt`.
- Produces: `build_claude_system_prompt(context_block: str) -> str` in `main`.

- [ ] **Step 1: Write failing prompt-composition tests**

```python
# backend/tests/test_claude_visual_targeting.py
import unittest

from agents.claude_computer_use_agent import (
    ClaudeComputerUseAgent,
    VISUAL_TARGETING_INSTRUCTIONS,
)
from main import build_claude_system_prompt


class VisualTargetingPromptTests(unittest.TestCase):
    def test_visual_targeting_rules_cover_target_identity_and_safe_coordinates(self):
        self.assertIn("visible label", VISUAL_TARGETING_INSTRUCTIONS)
        self.assertIn("visual center", VISUAL_TARGETING_INSTRUCTIONS)
        self.assertIn("fixed UI layers", VISUAL_TARGETING_INSTRUCTIONS)

    def test_default_prompt_includes_visual_targeting_rules(self):
        self.assertIn(
            VISUAL_TARGETING_INSTRUCTIONS,
            ClaudeComputerUseAgent.DEFAULT_SYSTEM_PROMPT,
        )

    def test_runtime_prompt_includes_visual_targeting_rules(self):
        prompt = build_claude_system_prompt("Feature context: cart")
        self.assertIn(VISUAL_TARGETING_INSTRUCTIONS, prompt)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd backend && python -m unittest tests.test_claude_visual_targeting.VisualTargetingPromptTests -v
```

Expected: FAIL with `ImportError` because `VISUAL_TARGETING_INSTRUCTIONS` does not yet exist.

- [ ] **Step 3: Define and use the shared prompt constant**

```python
# backend/agents/claude_computer_use_agent.py
VISUAL_TARGETING_INSTRUCTIONS = (
    "\n\nVISUAL TARGETING — REQUIRED FOR EVERY POINTER ACTION:\n"
    "Before clicking, moving, or dragging, identify the exact visible target using "
    "its label, icon, color, and surrounding layout. Treat fixed UI layers—sticky "
    "headers, bottom bars, floating controls, dialogs, and overlays—as separate from "
    "scrollable content. Choose a coordinate safely inside the target, normally its "
    "visual center; never use its border, whitespace, or a neighboring element. "
    "When the next action depends on visual feedback, return only this pointer action "
    "and use the next screenshot to check the observed result before reporting success."
)

# Append it after BATCHING_INSTRUCTIONS in DEFAULT_SYSTEM_PROMPT.
```

Import the constant in `backend/main.py` and append it to the runtime
`cu_system_prompt` through a pure helper. Do not duplicate its literal text in
`main.py`.

```python
# backend/main.py
def build_claude_system_prompt(context_block: str) -> str:
    return (
        "You are an expert QA automation agent executing test cases on a live application. "
        "You control the screen using computer use tools. "
        "Follow the test goal precisely and report pass/fail based on observed behaviour."
        f"{context_block}\n\n"
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
        + VISUAL_TARGETING_INSTRUCTIONS
        + FINAL_REPORTING_INSTRUCTIONS
    )
```

Replace the inline `cu_system_prompt = (...)` construction with:

```python
cu_system_prompt = build_claude_system_prompt(context_block)
```

- [ ] **Step 4: Run the prompt tests to verify they pass**

Run:

```bash
cd backend && python -m unittest tests.test_claude_visual_targeting.VisualTargetingPromptTests -v
```

Expected: PASS with both tests succeeding.

- [ ] **Step 5: Commit the prompt change**

```bash
git add backend/agents/claude_computer_use_agent.py backend/main.py backend/tests/test_claude_visual_targeting.py
git commit -m "feat: add Claude visual targeting guardrails"
```

### Task 2: Make coordinate diagnostics non-blocking and testable

**Files:**
- Modify: `backend/main.py:1948-2038,2928-2955`
- Modify: `backend/tests/test_claude_visual_targeting.py`

**Interfaces:**
- Produces: `_save_coordinate_debug_image(screenshot_bytes, width, height, coordinate, step_number) -> str | None`.
- Produces: `_log_claude_coordinate_evidence(action, result, rationale, debug_path) -> None`.
- Consumes: a `ClaudeCUAction`, the executor result dict, the turn reasoning/text, and an optional debug image path.

- [ ] **Step 1: Write failing diagnostics tests**

```python
from unittest.mock import patch

from main import _save_coordinate_debug_image


class CoordinateDiagnosticsTests(unittest.TestCase):
    @patch("main.Image.open", side_effect=OSError("bad image"))
    def test_debug_annotation_failure_returns_none(self, _open):
        path = _save_coordinate_debug_image(
            b"not-a-png", 353, 813, [245, 755], 18
        )
        self.assertIsNone(path)

    def test_debug_image_path_uses_step_number(self):
        with patch("main.Image.open") as image_open, patch("main.ImageDraw.Draw"):
            image = image_open.return_value
            path = _save_coordinate_debug_image(
                b"png", 353, 813, [245, 755], 18
            )
        self.assertEqual(path, "/tmp/clariti-coordinate-debug-18.png")
        image.save.assert_called_once_with(path)

    @patch("builtins.print")
    def test_action_evidence_includes_coordinates_rationale_and_image(
        self, print_mock
    ):
        from main import _log_claude_coordinate_evidence

        _log_claude_coordinate_evidence(
            action_name="left_click",
            local_coordinate=[245, 755],
            global_coordinate=[1372, 817],
            rationale="blue CART button",
            debug_path="/tmp/clariti-coordinate-debug-18.png",
        )

        line = print_mock.call_args.args[0]
        self.assertIn("left_click", line)
        self.assertIn("[245, 755]", line)
        self.assertIn("[1372, 817]", line)
        self.assertIn("blue CART button", line)
        self.assertIn("clariti-coordinate-debug-18.png", line)
```

- [ ] **Step 2: Run the diagnostics tests to verify they fail**

Run:

```bash
cd backend && python -m unittest tests.test_claude_visual_targeting.CoordinateDiagnosticsTests -v
```

Expected: FAIL with `ImportError` because `_save_coordinate_debug_image` does not yet exist.

- [ ] **Step 3: Extract safe debug-image and evidence helpers**

```python
# backend/main.py
def _save_coordinate_debug_image(
    screenshot_bytes: bytes,
    width: int,
    height: int,
    coordinate: list[int],
    step_number: int,
) -> str | None:
    try:
        debug_image = Image.open(BytesIO(screenshot_bytes))
        debug_image = debug_image.resize((width, height))
        x, y = coordinate
        draw = ImageDraw.Draw(debug_image)
        draw.ellipse((x - 8, y - 8, x + 8, y + 8), outline="red", width=3)
        draw.line((x - 12, y, x + 12, y), fill="red", width=2)
        draw.line((x, y - 12, x, y + 12), fill="red", width=2)
        debug_path = f"/tmp/clariti-coordinate-debug-{step_number}.png"
        debug_image.save(debug_path)
        return debug_path
    except Exception as exc:
        print(f"[EXECUTE-CU] Coordinate debug image unavailable: {exc}")
        return None


def _log_claude_coordinate_evidence(
    action_name: str,
    local_coordinate: list[int],
    global_coordinate: list[int] | None,
    rationale: str,
    debug_path: str | None,
) -> None:
    print(
        "[EXECUTE-CU] Action evidence: "
        f"action={action_name}; local={local_coordinate}; "
        f"global={global_coordinate or 'unavailable'}; "
        f"claimed_target={rationale or 'unavailable'}; "
        f"debug_image={debug_path or 'unavailable'}"
    )
```

Replace the inline image-annotation block with this helper. Call it before
`execute_claude_action`, but do not allow a `None` return to skip that call.
After dispatch, log one line containing the action type, `action.coordinate`,
`result.get("coordinates")`, `step_reasoning or "unavailable"`, and the helper
return value or `"unavailable"`.

- [ ] **Step 4: Run the full targeted test module**

Run:

```bash
cd backend && python -m unittest tests.test_claude_visual_targeting -v
```

Expected: PASS with every prompt and diagnostic test succeeding.

- [ ] **Step 5: Perform a syntax check**

Run:

```bash
cd backend && python -m py_compile main.py agents/claude_computer_use_agent.py
```

Expected: exit code `0`.

- [ ] **Step 6: Commit the diagnostics change**

```bash
git add backend/main.py backend/tests/test_claude_visual_targeting.py
git commit -m "chore: log Claude click targeting evidence"
```

### Task 3: Manually verify the Cart CTA regression

**Files:**
- No code changes.

**Interfaces:**
- Consumes: the `/feature/{id}/execute` SSE flow and `/tmp/clariti-coordinate-debug-<step>.png`.
- Produces: a manually inspected CTA click and diagnostic evidence.

- [ ] **Step 1: Start the local backend**

Run:

```bash
cd backend && python main.py
```

Expected: Uvicorn starts and exposes the local API.

- [ ] **Step 2: Run the existing test that clicks the Android Emulator Cart CTA**

Use the existing test suite and select the Android Emulator window. Wait for the
step that opens the Cart page.

Expected: the action-evidence log identifies the blue Cart CTA; the local
coordinate lands inside the button in the corresponding crosshair image.

- [ ] **Step 3: Verify the observed state**

Inspect the screenshot sent after the Cart click.

Expected: it shows the cart page before Claude reports that navigation succeeded.

- [ ] **Step 4: Record the manual verification outcome**

Add the run ID, action-evidence log line, and outcome to the task/PR description.
Do not alter generated test results or the project context merely to record this
verification.
