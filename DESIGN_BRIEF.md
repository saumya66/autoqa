# AutoQA — Design Brief

Create mockups for AutoQA, a desktop app for AI-powered visual QA testing.

---

## Product Overview

**AutoQA** lets QA engineers and developers:
1. Create test suites from designs, PRDs, and recordings (Figma, PDFs, videos)
2. Generate test cases using AI
3. Execute tests on real apps (web, mobile simulators, desktop) with an AI agent that sees the screen and performs clicks, typing, scrolling

**Target users:** QA engineers, developers, product teams doing visual regression and functional testing.

---

## App Shell

- Desktop app window (Mac/Windows)
- Global navigation: **Create Test** | **Projects** (when logged in)
- Connection status indicator (backend connected or disconnected)

---

## Flow 1: Create Test Suite

A multi-step wizard. User progresses through steps in order.

### Step 1 — Feature Details
- Feature name (required)
- Description (optional)
- Primary action: Continue

### Step 2 — Select Assets
- Show feature name and description
- Four ways to add context:
  1. Images (screenshots, mockups, wireframes)
  2. Documents (PDF, DOCX, TXT)
  3. Videos (screen recordings)
  4. Text notes (free-form)
- List of selected assets with ability to remove
- Primary action: Generate Context (shows asset count)

### Step 3 — Review Context
- Summary of what AI extracted: screens detected, UI elements, requirements, user flows, notes
- List of processed items with extraction summary
- Optional feedback input for corrections
- Action: Regenerate Context (when feedback provided)
- Primary action: Generate & Review Test Cases

### Step 4 — Review Tests
- Feature summary from AI
- Count of generated vs selected tests
- Select All / Deselect All
- List of test cases, each with:
  - Include/exclude toggle
  - ID, title
  - Priority, category
  - Steps (expandable)
  - Expected result
- Primary action: Approve & Generate (shows selected count)

### Step 5 — Execute
- Window selector (dropdown or list of open app windows)
- Refresh to reload window list
- Confirmation of selected window
- Primary action: Run Tests
- During execution:
  - Progress indicator (current test X of Y)
  - Current test title and goal
  - Step-by-step log: action, target element, outcome, AI reasoning
  - When agent is stuck: prompt for user guidance, input field, submit to continue
- Secondary action: Skip and finish later

### Step 6 — Done
- Success message
- Results: Passed, Failed, Skipped, Total
- List of each test with status, ID, title, conclusion
- Actions: Create Another Suite
- If tests ran: Run Tests or Re-run Tests (when there were failures)
- If user skipped execution: Run Tests

---

## Flows Summary

| From | To |
|------|-----|
| App shell | Create Test (step 1) or Projects (when logged in) |
| App shell | Login/Signup when not authenticated |
| Onboarding | App shell after API keys and permissions set |
| Projects list | Create project, or open project → Features list |
| Features list | Create feature, or open feature → Create Test flow (step 2+) or past runs |
| Create step 1 | Step 2 |
| Create step 2 | Step 3 |
| Create step 3 | Step 4 |
| Create step 4 | Step 5 |
| Create step 5 | Step 6 (Done) or back to step 5 if providing guidance |
| Create step 6 | Step 1 (new suite), Step 5 (re-run), or back to Features |

---

## Elements Needed Across Screens

- Step progress indicator (Create flow)
- File/asset upload zones
- Expandable test cards
- Window selector
- Step log (action + target + outcome + reasoning)
- Status indicators (connected, success, fail, warning)
- Error and feedback panels

---

## Flow 3: Auth & Onboarding

### Login / Signup
- Login: email, password, submit
- Signup: email, name, password, submit
- Link to switch between login and signup

### Onboarding (First-time setup)
- API keys: fields for Anthropic (Claude) and/or Google (Gemini) API keys
- Permissions: prompts for Screen Recording and Accessibility (Mac) with instructions to enable in System Settings

---

## Flow 4: Projects & Features (Logged-in)

### Projects List
- List of user's projects
- Each project: name, description, feature count
- Create new project
- Open project to see its features

### Features List (within a project)
- List of features in the project
- Each feature: name, status, test count
- Create new feature
- Open feature to run Create Test flow (steps 2–6) or view past runs
