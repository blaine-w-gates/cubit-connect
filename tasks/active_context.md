# Active Context

## Purpose

This file tracks the active plan and phase of the Cubit Connect project.

## Current State

**Phase:** Maintenance & Feature Expansion (Phase 5)
**IDE:** Google Antigravity
**AI Model:** `gemini-2.5-flash` (Primary) + `gemini-2.5-flash-lite` (Fallback)

## Completed Phases

### Phase 1: Setup & Safety Harness ✅
- [x] Initialize Next.js project with Tailwind.
- [x] Setup `docs/` structure.
- [x] Implement `idb-keyval` service layer.
- [x] Build Zustand store for API Key management.
- [x] Create `GeminiService` with rate-limiting and validation.
- [x] Build `VideoProcessor` hook (event-driven queue).

### Phase 2: Core UI Construction ✅
- [x] Create `SettingsDialog` (API Key Modal).
- [x] Create `UploadZone` (Video/VTT Inputs).
- [x] Create `TaskFeed` (Virtualized List with `react-virtuoso`).
- [x] Implement `page.tsx` Controller logic.

### Phase 2.5: Wiring Cubit Logic ✅
- [x] Add `generateSubSteps` to `GeminiService`.
- [x] Update `TaskFeed` with `onCubit` prop.
- [x] Implement `handleCubit` in `page.tsx`.

### Phase 3: Polish (Logic Improvements) ✅
- [x] Fix "Talking Head" Screenshot Offset (+0.5s).
- [x] Implement "Smart Reset" (Keep API Key).
- [x] Add HEVC Codec Warning.
- [x] Data Export/Import (JSON, PDF, Markdown).
- [x] Verify Build (`npm run build`).

### Phase 4: Deployment ✅
- [x] Fix `page.tsx` syntax error.
- [x] Run full build check.
- [x] Fix `date-fns` build error.
- [x] Fix Gemini Model Name (404 Error).
- [x] Verify with provided API Key.
- [x] UI Fix: Expose "Disconnect Key" button.
- [x] Fix Build Error (missing `fullLogout` import).
- [x] Deploy to GitHub Pages.

### Phase 5: Feature Expansion (Current) 🔄
- [x] Scout Feature (multi-platform search assistant).
- [x] Manifesto / Onboarding UI.
- [x] Header refactor with hamburger menu.
- [x] Dark Mode (ThemeSelector).
- [x] API Key encryption (`src/lib/crypto.ts`).
- [x] Zod schema validation (`src/schemas/`).
- [x] Gemini dual-model circuit breaker.
- [x] E2E tests (Playwright) + Unit tests (Vitest).
- [x] Security hardening (`npm audit` fixes).
- [x] Markdown Export.
- [x] Toast Notifications (replace `alert()`).
- [x] Drag-and-Drop task reordering.
- [ ] Offline Indicator (sticky banner).
- [x] Pre-commit Hooks (`husky`).
- [ ] Centralized AI Prompts (`src/prompts/`).
