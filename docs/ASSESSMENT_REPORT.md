# Project Assessment Report

**Date:** Jan 23, 2026 (Updated Feb 17, 2026)
**Assessor:** AI Assistant
**Target Phase:** Maintenance & Feature Expansion

## 🏆 Current Grade: B

### Justification

The project demonstrates a high level of architectural maturity and a strong commitment to its "Local-First" philosophy. The choice of Next.js 16 and Tailwind v4 places it on the cutting edge of the ecosystem.

**Strengths:**

- **Privacy Architecture:** The use of `IndexedDB` and local processing is robust and secure.
- **Modern Stack:** Leveraging the latest stable versions of React (19) and Next.js.
- **Feature Completeness:** Complex features like "Recursive Cubit" and "Scout" are implemented.

**Areas for Improvement (Why not an A?):**

- ~~**Test Reliability:** The critical `gemini_rate_limit.test.ts` is failing/flaky.~~ ✅ **FIXED** — Rewritten to be deterministic.
- ~~**Documentation Drift:** The documentation ("Strict Light Mode") contradicted the codebase.~~ ✅ **FIXED** — Docs updated Feb 2026.
- ~~**Mobile Polish:** The "Mobile Smash" issue in the header.~~ ✅ **FIXED** — `Header.tsx` with hamburger menu.
- **Developer Experience:** Linting configuration could still use `husky` pre-commit hooks.

---

## 🚀 20 Recommendations for the Roadmap

We have categorized these into **Critical Fixes**, **Feature Enhancements**, **User Experience (UX)**, and **Developer Experience (DX)**.

### Critical Fixes (Robustness)

1.  ~~**Fix Flaky Rate Limit Test:**~~ ✅ **DONE** — Rewritten with fake timers.
2.  **Linting CI Pipeline:** Ensure the CI workflow explicitly installs `eslint` dependencies before running lint checks to prevent "Cannot find package" errors.
3.  **Strict Type Check on Build:** Add `tsc --noEmit` to the pre-commit or build pipeline to catch type errors before runtime.
4.  **Error Boundary Logging:** The current `ErrorBoundary` catches crashes, but we should log these to `localStorage` (or a downloadable log file) so users can send us debug info.
5.  ~~**Gemini Model Fallback:**~~ ✅ **DONE** — Dual-model circuit breaker (`gemini-2.5-flash` → `gemini-2.5-flash-lite`) in `gemini.ts`.

### Feature Enhancements (The "Bleeding Edge")

6.  **"Retry" Action for AI:** Currently, if a request fails, the user gets an alert. Add a "Retry" button directly on the Task Card.
7.  ~~**Markdown Export:**~~ ✅ **DONE** — Implemented in `exportUtils.ts`.
8.  **Voice Mode (Future):** Since we use Gemini, we could add a "Listen" feature where the AI reads the steps back to the user (Text-to-Speech).
9.  **Image-to-Task:** Allow users to drag a screenshot _directly_ into a task to attach it, rather than only capturing from video.
10. ~~**Scout History:**~~ ✅ **DONE** — Saved to IndexedDB via `scoutHistory` in store.

### User Experience (UX)

11. ~~**Mobile Header Fix:**~~ ✅ **DONE** — Hamburger menu in `Header.tsx`.
12. ~~**Dark Mode Polish:**~~ ✅ **DONE** — Clean Enterprise Dark Mode via `ThemeSelector.tsx`.
13. **Offline Indicator:** Make the "Offline" badge more prominent (perhaps a sticky banner) when the user tries to use AI features while disconnected.
14. **Toast Notifications:** Replace browser `alert()` calls with `sonner` toasts for a smoother experience (e.g., "AI is thinking...", "Rate limit hit").
15. **Drag-and-Drop Reordering:** The `Virtuoso` list is great for performance, but users often want to reorder tasks. Implement drag-and-drop for the task list.

### Developer Experience (DX) & Maintenance

16. **Pre-commit Hooks:** Install `husky` to run `npm run lint` and `npm test` automatically before every commit.
17. **Automated Dependency Updates:** Configure `dependabot` or `renovate` (if using GitHub) to keep Next.js and Tailwind on the bleeding edge.
18. **Component Storybook:** (Optional) Set up Storybook or a simple "Kitchen Sink" page to test components (like the Task Card) in isolation without needing a video.
19. **Performance Monitoring:** Add a script to measure the size of the `idb-keyval` store and warn the user if it exceeds 500MB (browser quota risk).
20. **Centralized API Constants:** Move all AI Prompt Templates from `gemini.ts` into a separate `src/prompts/` directory for easier editing by non-developers (or "Prompt Engineers").

---

**Next Steps:**

1.  Approve this plan.
2.  Select the top 3 priorities from the list above to execute in "Strike 13".
