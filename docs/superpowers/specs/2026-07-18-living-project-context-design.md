# Living Project Context Design

## Goal

Clariti maintains one canonical project context that improves as suites run. Users may paste app-wide knowledge during project onboarding; it is stored separately as immutable source memory. A text-only Learner Agent incorporates durable findings from completed suite logs into the canonical project context.

## Context hierarchy

- `Project.source_memory`: Exact user-entered app memory. Learner runs never modify it.
- `Project.context_summary`: Canonical app knowledge used by every feature.
- `Feature.context_summary`: Knowledge limited to a single feature/test suite.

Generation and execution continue combining project and feature contexts. Raw source memory is not injected through a second prompt path.

## Project onboarding

The existing `POST /cloud/project/create` SSE request receives optional `source_memory` with project images and text notes. The local backend labels it as user-provided app memory in the project synthesis input, then creates the cloud project with both `source_memory` and `context_summary`.

Project context edits use the existing `POST /cloud/project/{id}/update-context` SSE request. The request can replace source memory; when omitted, the backend retains stored source memory. Context rebuilds provide the existing project context as a baseline so accurate learned knowledge is retained.

## Suite learning flow

The normal Computer Use completion behavior remains unchanged: `cu_response.is_done` closes the test according to the current execution logic.

The executor's final response must include:

1. Execution summary
2. Test result
3. Directly observed app facts
4. Operational learnings
5. Run-local state

After a non-aborted suite completes and its TestResults are persisted, the backend creates compact text-only suite records from existing step logs and executor conclusions. It calls `ProjectContextLearnerAgent` once with:

- Existing project context
- Current feature context
- Compact suite logs

The learner returns a complete revised project context and a change summary. Its prompt preserves accurate existing context, admits only supported durable app-level knowledge, and excludes run-local values such as prices, cart contents, current login state, modal state, offers, timestamps, and test narration.

On success, the local backend calls the existing `PATCH /api/v1/projects/{id}` endpoint with the revised `context_summary`, then emits `context_learned`. If learning or persistence fails, it emits `context_learning_warning` and still completes the suite; test outcomes are unchanged.

## SSE events

- `context_learning`: The suite has completed and project learning has started.
- `context_learned`: Project context was updated; includes a change summary.
- `context_learning_warning`: Learning failed non-fatally; includes an error message.

## Non-goals

- No verifier agent
- No screenshot evidence persistence
- No execution-state store
- No separate learned-context field
- No change to the current pass/fail behavior
