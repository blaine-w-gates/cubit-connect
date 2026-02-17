# Cubit Connect - Upgrade Progress Tracker

This document tracks the progress of the 20 recommendations from the Assessment Report.

## Critical Fixes (Robustness)

- [x] **1. Fix Flaky Rate Limit Test:** Rewritten `gemini_rate_limit.test.ts` to be deterministic.
- [ ] **2. Linting CI Pipeline:** Ensure CI explicitly installs eslint dependencies.
- [ ] **3. Strict Type Check on Build:** Add `tsc --noEmit` to pre-commit/build pipeline.
- [ ] **4. Error Boundary Logging:** Log crashes to localStorage/file.
- [x] **5. Gemini Model Fallback:** Implemented dual-model circuit breaker (`PRIMARY_MODEL` + `FALLBACK_MODEL` in `gemini.ts`).

## Feature Enhancements (The "Bleeding Edge")

- [ ] **6. "Retry" Action for AI:** Add "Retry" button on Task Card.
- [x] **7. Markdown Export:** Implemented in `exportUtils.ts`.
- [ ] **8. Voice Mode (Future):** Text-to-Speech implementation.
- [ ] **9. Image-to-Task:** Drag screenshot directly into task.
- [x] **10. Scout History:** Scout history saved to IndexedDB (`scoutHistory` in store).

## User Experience (UX)

- [x] **11. Mobile Header Fix:** Hamburger menu implemented in `Header.tsx`.
- [x] **12. Dark Mode Polish:** Dark Mode implemented via `ThemeSelector.tsx` with Clean Enterprise palette.
- [ ] **13. Offline Indicator:** Prominent banner when offline.
- [ ] **14. Toast Notifications:** Replace `alert()` with `sonner` toasts.
- [ ] **15. Drag-and-Drop Reordering:** Implement drag-and-drop for task list.

## Developer Experience (DX) & Maintenance

- [ ] **16. Pre-commit Hooks:** Install `husky` for lint/test checks.
- [ ] **17. Automated Dependency Updates:** Configure dependabot/renovate.
- [ ] **18. Component Storybook:** (Optional) Setup Storybook/Kitchen Sink.
- [ ] **19. Performance Monitoring:** Warn if idb-keyval store > 500MB.
- [ ] **20. Centralized API Constants:** Move prompts to `src/prompts/`.
