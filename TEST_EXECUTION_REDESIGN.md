# Test Execution Redesign: Human-Guided Orchestrator

## Problem Statement

The current executable JSON test construct is too rigid and creates problems:
- Complex step-by-step JSON execution
- No flexibility when UI changes
- Doesn't match how human QA actually works
- The original prototype worked better with simple text prompts

## Solution: Human-Guided Orchestrator

### Core Philosophy
- **Human QA reads test cases and executes them** - not JSON steps
- **Agent can ask for help** when confused
- **Natural conversation flow** - like pair programming

## Architecture

### 1. Remove Executable JSON Generation
- **Keep**: Text-based test cases (human-readable)
- **Remove**: `executable_tests` with `setup_steps`, `test_steps`, `cleanup_steps`
- **Remove**: `TestGeneratorAgent` conversion to JSON

### 2. New Execution Flow

```
User approves test cases
    ↓
For each approved test case:
    ↓
Show test case to user: "TC-001: Verify user can add product to bag"
    ↓
Invoke Orchestrator with goal = test case description
    ↓
Orchestrator observes screen → decides action → executes → repeats
    ↓
If stuck/confused:
    ↓
Emit "need_help" event with context
    ↓
User provides guidance via text input
    ↓
Orchestrator resumes with guidance
    ↓
Continue until test passes/fails
```

### 3. Orchestrator Enhancements

#### A. Enhanced System Prompt
Add section about asking for help:

```
## Asking for Human Help

If you are stuck or unsure about what to do:
1. Set action to "stuck"
2. Clearly describe what you see and what's confusing
3. Ask a specific question about what to do next

Example:
{
  "action": "stuck",
  "current_state": "I see a search results page with many products",
  "reasoning": "I need to add a product to bag, but I see multiple 'Add' buttons. Which one should I click? Should I click the first visible one?",
  "need_help": "Which product should I add to the bag? Should I scroll to find a specific product?"
}
```

#### B. New Event: `need_help`
When orchestrator emits `action: "stuck"`, frontend shows:
- Current screen state
- Agent's question
- Text input for user guidance
- "Resume" button

#### C. Guidance Integration
When user provides guidance:
- Add it to orchestrator's context
- Continue execution with: `goal + "User guidance: {guidance}"`

### 4. API Changes

#### Remove:
- `POST /feature/{id}/approve-tests` - no longer generates executable JSON
- Complex step-by-step execution logic

#### Modify:
- `POST /feature/{id}/execute` - now takes test case IDs and executes them using orchestrator

#### New:
- `POST /feature/{id}/execute/{test_id}/guidance` - provide guidance when agent is stuck

### 5. Execution Endpoint Flow

```python
async def execute_test_suite():
    for test_case in approved_test_cases:
        goal = f"{test_case['title']}\n\nSteps: {test_case['steps']}\nExpected: {test_case['expected_result']}"
        
        yield test_start_event
        
        orchestrator = OrchestratorAgent()
        guidance_context = []  # Store user guidance
        
        for step in range(max_steps):
            # Capture screenshot
            screenshot = capture_window(window)
            
            # Build goal with guidance
            full_goal = goal
            if guidance_context:
                full_goal += "\n\nUser Guidance:\n" + "\n".join(guidance_context)
            
            # Get decision
            decision = orchestrator.analyze_and_decide(
                screenshot_bytes=screenshot,
                goal=full_goal,
                previous_actions=history
            )
            
            # If stuck, emit need_help event and wait
            if decision.action == ActionType.STUCK:
                yield need_help_event(decision.reasoning, decision.current_state)
                # Wait for user guidance (via separate endpoint)
                # When received, add to guidance_context and continue
            
            # Execute action
            execute_action(decision)
            
            # Check if goal complete
            if decision.goal_complete:
                yield test_passed_event
                break
        
        yield test_complete_event
```

### 6. Frontend Changes

#### Test Execution UI:
```
┌─────────────────────────────────────────┐
│ Test: TC-001 - Add product to bag      │
│ Status: Running...                      │
├─────────────────────────────────────────┤
│                                         │
│ [Live Screenshot]                       │
│                                         │
│ Step 3: Clicking on "Add" button...    │
│                                         │
├─────────────────────────────────────────┤
│ Agent needs help:                       │
│ "I see multiple Add buttons. Which one? │
│                                         │
│ [Text input for guidance]              │
│                                         │
│ [Resume] [Skip Test]                   │
└─────────────────────────────────────────┘
```

### 7. Implementation Steps

1. **Remove executable test generation**
   - Remove `TestGeneratorAgent.convert_all_test_cases()`
   - Keep only text test cases in `_tests.json`

2. **Modify orchestrator prompt**
   - Add "Asking for Help" section
   - Enhance reasoning for stuck scenarios

3. **Update execute endpoint**
   - Remove JSON step execution
   - Use orchestrator with test case description as goal
   - Handle `STUCK` action → emit `need_help` event
   - Add guidance endpoint

4. **Update frontend**
   - Remove executable test display
   - Show test case description
   - Show orchestrator progress (like original prototype)
   - Add guidance input UI when `need_help` event received

5. **Add guidance endpoint**
   - `POST /feature/{id}/execute/{test_id}/guidance`
   - Receives guidance text
   - Resumes orchestrator execution

## Benefits

1. **Simpler**: No complex JSON step execution
2. **More Natural**: Matches how humans test
3. **Flexible**: Agent adapts to UI changes
4. **Collaborative**: Human can guide when needed
5. **Maintainable**: Less code, easier to debug

## Example Flow

**Test Case**: "Verify user can add product to bag from search results"

**Execution**:
1. Orchestrator sees home page
2. Decides: "Click search icon" → executes
3. Sees search page
4. Decides: "Type product name" → executes
5. Sees search results with many "Add" buttons
6. **Gets stuck**: "Which product should I add?"
7. **User provides**: "Click Add on the first product card"
8. Orchestrator continues: "Click Add on first product" → executes
9. Sees success toast
10. **Goal complete**: Test passes

This is much more natural and flexible!
