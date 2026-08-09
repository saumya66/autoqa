# Clariti Outcome-First Hero Design

**Date:** 2026-08-09
**Scope:** Replace the landing-page hero messaging and hierarchy.

## Goal

Explain Clariti immediately to engineering leaders, then make its three commercial benefits easy to scan: better defect detection, no test-code maintenance, and more QA coverage without proportional hiring.

## Layout

- Retain the existing dark visual system and Aurora background.
- Replace the animated four-verb headline with a direct product introduction.
- Use the reference-inspired desktop composition: left-aligned copy and CTAs, with a product infographic on the right.
- Build the infographic from native React and CSS rather than requiring an external animation asset.
- Show one active target at a time, beginning with `ANDROID · PIXEL EMULATOR`. Do not imply that one test runs on several platforms simultaneously.
- Animate one continuous product story: a user describes a checkout test in plain English, Clariti generates the test cases, runs them on the active Android emulator, and returns a mixed pass/fail report with a highlighted visual issue.
- Place three equal value cards in a full-width row beneath the primary hero content.
- Stack cards vertically on small screens and use three columns on larger screens.
- Remove the decorative `See / Act / Listen / Learn` floating labels and the four-verb animation.
- Continue using the existing booking and demo CTA components.

## Approved Copy

### Eyebrow

`AUTONOMOUS QA`

### Headline

`Meet Clariti — Your Team’s Autonomous QA`

### Supporting copy

`Clariti tests your product the way a real QA does—it sees your app, works through critical flows, notices what looks wrong, and tells you what broke.`

### Value card 1

**Heading:** `SEES WHAT USERS SEE`

`Traditional E2E tests verify expected behavior. Screenshot tests flag pixel changes. Clariti notices when something looks or behaves wrong.`

### Value card 2

**Heading:** `TEST IN ENGLISH, NOT CODE`

`Describe what should work in plain English. Clariti generates and runs tests across web, desktop, Android, and iOS—no test code to write or maintain.`

### Value card 3

**Heading:** `MORE COVERAGE. SAME TEAM.`

`Clariti handles repetitive testing, helping your existing team cover more flows and releases without more hires.`

## Interaction and Accessibility

- Animate the eyebrow, headline, supporting copy, CTAs, and cards once on page load with short staggered fades.
- Give the infographic restrained stage transitions and a persistent `DESCRIBE → GENERATE → RUN → REPORT` progress indicator.
- The report is the final payoff: `RUN COMPLETE · 3 PASSED · 1 ISSUE`, followed by a concise issue summary and replay affordance.
- Keep all hero text in server-rendered markup.
- Preserve semantic heading order and readable contrast.
- Respect reduced-motion preferences through the existing motion setup.

## Validation

- Confirm the hero remains legible and balanced at mobile, tablet, and desktop widths.
- Confirm all CTA behavior remains unchanged.
- Run the landing-site build and lint/type checks available in the package.
