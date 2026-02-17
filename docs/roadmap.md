# Roadmap to 2.0

## Phase 1: The Human in the Loop (Manual Editing) ✅

**Status:** COMPLETED.
**Delivered:** `EditableText` component for inline editing. `updateDeepStep` store action for recursive nested updates (Task → CubitStep → CubitStep).

## Phase 2: Visual Refinement (Clean Enterprise) ✅

**Status:** COMPLETED.
**Delivered:**
- Light Mode: Background `#FAFAFA` (Zinc-50), Surface `white`.
- Dark Mode: Background `#1C1917` (Stone-900), Surface `stone-800`.
- Theme toggle via `ThemeSelector.tsx`.
- Touch targets min 44px.
- Responsive Header with hamburger menu (`Header.tsx`).

## Phase 3: Pre-Flight Safety (QA) ✅

**Status:** COMPLETED.
**Delivered:**
1. **Corrupted DB:** Zod validation + legacy salvage in `storage.ts`.
2. **Missing Video:** File handle re-hydration prompt.
3. **Quota Exceeded:** Circuit breaker with Primary → Fallback model auto-switch.
4. **E2E Tests:** Playwright suite (`production-ready.spec.ts`).
5. **Unit Tests:** Vitest suite (store, Gemini rate limit, etc.).

## Phase 4: Deployment ✅

**Status:** COMPLETED.
**Delivered:** GitHub Pages deployment via GitHub Actions CI/CD pipeline.

## Phase 5: Feature Expansion (Current)

**Status:** In Progress.

### Delivered
- Scout Feature (multi-platform search assistant)
- Manifesto / Onboarding flow
- Markdown Export
- Dark Mode
- Mobile Header (hamburger menu)
- Gemini Model Fallback (circuit breaker)
- API Key encryption
- Zod schema validation

### Remaining (from Assessment Report)
- Retry Action for AI (button on Task Card)
- Toast Notifications (replace `alert()` with `sonner`)
- Drag-and-Drop task reordering
- Offline Indicator (sticky banner)
- Pre-commit Hooks (`husky`)
- Performance Monitoring (IDB size warning)
- Centralized AI Prompt Templates (`src/prompts/`)
