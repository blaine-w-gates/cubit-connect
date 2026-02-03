---
description: Automated QA - Generate and Run E2E Tests for Recent Features
---

# Test Suite Generation Workflow

This workflow guides the agent to autonomously generate and run Playwright E2E tests for the most recently developed features.

## Steps

1.  **Context Gathering**
    - Read `task.md` to identify the most recently completed feature (marked with `[x]`).
    - Read `walkthrough.md` to understand the intended user flow and UI behavior.
    - Identify the key React components associated with that feature (e.g., `ScoutView.tsx`, `ExportControl.tsx`).

2.  **Test Generation**
    - Create a new test file in `e2e/` (or `tests/`) named after the feature (e.g., `scout.spec.ts`).
    - Write a Playwright test that covers:
      - **Happy Path:** The ideal user flow (e.g., Enter input -> Click Search -> Verify Result).
      - **Edge Cases:** Empty inputs, API errors (mocked if possible), or UI boundary conditions.
      - **Accessibility:** Include an `axe-core` check if applicable.
    - _Self-Correction:_ Ensure the test selectors use resilient attributes (like `data-testid`, `role`, or persistent text) rather than brittle CSS paths.

3.  **Execution & Verification**
    - Run the test: `npx playwright test e2e/scout.spec.ts` (or specific file).
    - If the test fails, analyze the output/screenshot, fix the test code (or the app code if a bug is found), and retry.

4.  **Reporting**
    - Update `walkthrough.md` with the test results.
    - Notify the user of the pass/fail status.
