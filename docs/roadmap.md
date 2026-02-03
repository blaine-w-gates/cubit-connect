# Roadmap to 1.0

## Phase 1: The Human in the Loop (Manual Editing)
**Context:** AI is imperfect. Users need to correct typos or hallucinated steps.
**Technical Requirement:** `EditableText` component (Inline Edit).
**Risk:** Deeply nested updates (Task -> CubitStep -> MicroStep) are hard to handle with just `updateTask`. We might need a specialized store action `updateSubStep` to avoid performance issues or data loss.

## Phase 2: Visual Refinement (Clean Enterprise)
**Context:** The visual style has been calibrated to "Clean Enterprise".
**Status:** ✅ COMPLETED / LOCKED.
**Standards:**
- Background: `#FAFAFA` (Zinc-50).
- No Dark Mode.
- No Glassmorphism blur abuse.
- Touch targets min 44px.

## Phase 3: Pre-Flight Safety (QA)
**Context:** Robustness check.
**Tests:**
1.  **Corrupted DB:** What if `indexedDB` fails to load?
2.  **Missing Video:** What if the browser revoked the file handle?
3.  **Quota Exceeded:** Handling `429` errors gracefully.
