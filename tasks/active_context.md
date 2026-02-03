# Active Context

## Purpose

This file tracks the active plan and phase of the Cubit Connect project.

## Current Plan

**Phase 1: Setup & Safety Harness (Config, IDB wrapper, and Async Queue Utility)**

- [x] Initialize Next.js project with Tailwind.
- [x] Setup `docs/` structure (Completed).
- [x] Implement `idb-keyval` service layer.
- [x] Build `SettingsContext` or Zustand store for API Key management.
- [x] Create `GeminiService` with rate-limiting and validation.
- [x] Build `VideoProcessor` hook (event-driven queue).

## Phase 2: Core UI Construction

- [x] Create `SettingsDialog` (API Key Modal).
- [x] Create `UploadZone` (Video/VTT Inputs).
- [x] Create `TaskFeed` (Virtualized List with `react-virtuoso`).
- [x] Implement `page.tsx` Controller logic.

## Phase 2.5: Wiring Cubit Logic

- [x] Add `generateSubSteps` to `GeminiService`.
- [x] Update `TaskFeed` with `onCubit` prop.
- [x] Implement `handleCubit` in `page.tsx`.

## Phase 3: Polish (Logic Improvements)

- [x] Fix "Talking Head" Screenshot Offset (+1.5s).
- [x] Implement "Smart Reset" (Keep API Key).
- [x] Add HEVC Codec Warning.
- [x] Data Export/Import (JSON).
- [ ] Verify Build (`npm run build`).

## Phase 4: Deployment Prep

- [x] Fix `page.tsx` syntax error.
- [x] Run full build check.
- [x] Fix `date-fns` build error.
- [x] Fix Gemini Model Name (404 Error) - Upgrading to `gemini-1.5-flash-002` (v2.0 was 429).
- [x] Verify with provided API Key - Listing models to confirm access.
- [x] UI Fix: Expose "Disconnect Key" button.
- [x] Fix Build Error (missing `fullLogout` import).
