# Outcome-First Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the behavior-first Clariti hero with a reference-inspired product introduction, animated platform infographic, and three concise value cards.

**Architecture:** Keep `Hero.tsx` responsible for content, responsive layout, and entrance sequencing. Use a focused `HeroVisual.tsx` component for a four-stage product story so the hero copy remains readable and independently editable.

**Tech Stack:** React 19, Motion, Tailwind CSS v4, Astro.

## Global Constraints

- Preserve the existing Aurora background and CTA behavior.
- Use the approved Clariti copy exactly.
- Use only native React, CSS, and existing icon components; add no dependency or external asset.
- Preserve accessible semantics and mark the infographic decorative.
- Respect the existing reduced-motion stylesheet.

---

### Task 1: Platform infographic

**Files:**
- Create: `landingsite/src/components/HeroVisual.tsx`

**Interfaces:**
- Consumes: `GlobeIcon`, `MonitorIcon`, and `PhoneIcon` from `Icons.tsx`.
- Produces: default React component `HeroVisual(): JSX.Element`.

- [ ] **Step 1: Create the decorative diagram**

Build a responsive glass-panel sequence that starts with `ANDROID · PIXEL EMULATOR` and cycles through `DESCRIBE`, `GENERATE`, `RUN`, and `REPORT`. Show one platform target, one natural-language checkout instruction, generated test cases, autonomous execution, and a final mixed pass/fail report with a highlighted visual issue. Set `aria-hidden="true"` and avoid interactive controls.

- [ ] **Step 2: Check the new file**

Run: `npm run build`

Expected: Astro completes with exit code 0 and no TypeScript errors from `HeroVisual.tsx`.

### Task 2: Hero copy, hierarchy, and value cards

**Files:**
- Modify: `landingsite/src/components/Hero.tsx`

**Interfaces:**
- Consumes: `HeroVisual`, `BookDemoButton`, `WatchDemoButton`, and `Aurora`.
- Produces: the existing default `Hero` component used by `src/pages/index.astro`.

- [ ] **Step 1: Replace the four-verb composition**

Remove `VERBS`, `FLOAT_NODES`, their icon imports, floating labels, and animated behavior-first headline. Add a two-column primary area with:

- Eyebrow: `AUTONOMOUS QA`
- H1: `Meet Clariti — Your Team’s Autonomous QA`
- Supporting copy: `Clariti tests your product the way a real QA does—it sees your app, works through critical flows, notices what looks wrong, and tells you what broke.`
- Existing CTA components
- `HeroVisual` in the right column

- [ ] **Step 2: Add the three value cards**

Render a responsive three-column row below the primary content with the exact headings and bodies from the approved design spec. Use subtle borders, small mono headings, and staggered one-time entrance motion.

- [ ] **Step 3: Preserve responsive behavior**

Use a single column on mobile, hide the infographic’s nonessential details where space is constrained, and switch to the two-column hero plus three-column cards at large breakpoints.

- [ ] **Step 4: Verify production output**

Run: `npm run build`

Expected: Astro reports a successful build and generates `/index.html`.

- [ ] **Step 5: Check edited-file diagnostics**

Read IDE diagnostics for `Hero.tsx` and `HeroVisual.tsx`.

Expected: no new diagnostics.
