# Claude visual-targeting guardrail design

## Purpose

Reduce incorrect computer-use clicks caused by Claude selecting the wrong visible
element, while preserving the existing single-call-per-turn execution model.

The observed failure was a click intended for a persistent blue Cart CTA. The
debug screenshot proved that the backend executed the coordinate Claude chose;
the coordinate was in the product grid rather than inside the CTA. This is a
visual-grounding failure, not coordinate scaling or macOS click dispatch.

## Scope

This change applies to all coordinate-based computer-use actions:

- `left_click`, `right_click`, `middle_click`
- `double_click`, `triple_click`
- `mouse_move`
- `left_click_drag`

It does not add a second model call, image-processing model, or DOM/accessibility
integration.

## Design

### Visual-targeting protocol

Add a shared `VISUAL_TARGETING_INSTRUCTIONS` prompt constant in
`backend/agents/claude_computer_use_agent.py`. Append it to both:

1. `ClaudeComputerUseAgent.DEFAULT_SYSTEM_PROMPT`, for callers using the fallback
   system prompt.
2. The execution-specific `cu_system_prompt` built in `backend/main.py`.

The protocol requires Claude to:

1. Identify the exact target using visible text, iconography, color, and nearby
   layout context.
2. Keep fixed UI layers (sticky headers, bottom bars, floating buttons, dialogs,
   and overlays) distinct from scrollable content.
3. Choose a coordinate well inside the target, normally its visual center, and
   avoid borders, whitespace, and neighboring elements.
4. Return a single pointer action when the following action depends on visual
   confirmation.
5. Confirm expected UI state from the next screenshot before reporting the
   interaction as successful.

### Action evidence

The existing executor will continue to record the Claude coordinate, macOS
global coordinate, and red-crosshair debug screenshot. It will additionally
log a compact action-evidence record for every coordinate-based action:

- action type
- local coordinate supplied by Claude
- global coordinate dispatched to macOS
- model turn reasoning/text, labeled as the claimed target rationale
- debug screenshot file path

The existing `StepRecord` fields remain compatible. `description` and
`reasoning` continue to contain the model's turn-level explanation; no database
schema change is required.

## Data flow

```text
Screenshot → Claude receives visual-targeting instructions
           → Claude returns coordinate action + turn reasoning/text
           → executor logs claimed rationale + local coordinate
           → executor maps to global coordinate and clicks
           → executor saves crosshair screenshot
           → next screenshot lets Claude verify the outcome
```

## Failure handling

Logging and debug-image creation are diagnostic only. If image annotation fails,
the executor must still attempt the action and preserve the regular step error
behavior. A missing model explanation must be logged as unavailable rather than
being fabricated.

## Verification

Automated tests should cover:

- the visual-targeting instructions are included in both prompt construction
  paths;
- a coordinate action logs local coordinates, global coordinates, rationale, and
  debug-image path;
- actions without coordinates do not claim coordinate evidence.

Manual verification should reproduce the Cart CTA scenario and inspect the
crosshair image and action-evidence log. A successful run must select a point
inside the blue Cart CTA and only claim navigation after the cart page is
visible in the following screenshot.
