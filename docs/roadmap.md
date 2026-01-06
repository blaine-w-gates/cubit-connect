# Roadmap to 1.0

## Phase 1: The Human in the Loop (Manual Editing)
**Context:** AI is imperfect. Users need to correct typos or hallucinated steps.
**Technical Requirement:** `EditableText` component (Inline Edit).
**Risk:** Deeply nested updates (Task -> CubitStep -> MicroStep) are hard to handle with just `updateTask`. We might need a specialized store action `updateSubStep` to avoid performance issues or data loss.

## Phase 2: Visual Refinement (Glassmorphism)
**Context:** The app looks too "Engineer Dark Mode". Needs a premium feel.
**Technical Requirement:**
- Background mesh gradients (fixed).
- `backdrop-blur` on cards.
- Layout persistence (don't break Virtualization with heavy CSS filters).

## Phase 3: Pre-Flight Safety (QA)
**Context:** Robustness check.
**Tests:**
1.  **Corrupted DB:** What if `indexedDB` fails to load?
2.  **Missing Video:** What if the browser revoked the file handle?
3.  **Quota Exceeded:** Handling `429` errors gracefully.
