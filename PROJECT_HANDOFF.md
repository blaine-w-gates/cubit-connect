# CUBIT CONNECT | PROJECT HANDOFF PROTOCOL (v2.0)

**Date:** Feb 17, 2026
**Version:** Production (v2.0)
**Current Phase:** Maintenance & Feature Expansion
**IDE:** Google Antigravity

## 1. THE MISSION: "Process, Don't just Perform"

Cubit Connect is a **Local-First AI Knowledge Distillation Engine**.

- **Core Function:** Turns raw video/text into actionable "Recipe for Life" checklists.
- **Philosophy:** "Capture. Distill. Execute." We do not generate generic advice; we extract specific instructions.
- **UX Pattern:** "Clean Enterprise." High density, high contrast, zero "gamification" clutter. Supports Light and Dark modes.

## 2. THE "LAWS OF CUBIT" (TECH STACK & CONSTRAINTS)

**Violation of these laws is considered a System Failure.**

### A. The Core Stack

- **Framework:** Next.js 16 (App Router, Turbopack).
- **Styling:** Tailwind CSS **v4**. (CSS-native `@import "tailwindcss";` — there is no `tailwind.config.js`).
- **State:** `src/store/useAppStore.ts` (Zustand) is the **Single Source of Truth** for UI state.
- **Schemas:** `src/schemas/storage.ts` (Zod) defines all persistent data types (`TaskItem`, `CubitStep`, `StoredProjectData`).
- **Persistence:**
  - **IndexedDB (`idb-keyval`):** Stores project data (tasks, screenshots, scout results, transcript).
  - **LocalStorage:** Stores API Keys (`cubit_api_key`, encrypted via `src/lib/crypto.ts`).
- **Validation:** `src/lib/validation.ts` — Zod-based parsers for all Gemini API responses.
- **Icons:** `lucide-react` **ONLY**. (Ban `react-icons`, `fontawesome`).

### B. The Visual DNA (Adaptive Theme)

- **Theme:** **Clean Enterprise**. Supports Light and Dark modes via `ThemeSelector.tsx`.
- **Palette (Light):** Background `#FAFAFA` (Zinc-50), Surface `white`, Text `text-zinc-900`.
- **Palette (Dark):** Background `#1C1917` (Stone-900), Surface `stone-800`, Text `text-stone-100`.
- **Accents:** `text-purple-700` (Brand).
- **Mobile Rule:** All touch targets min 44px. Layouts must verify for "Mobile Smash" (pre-check `col` vs `row`).

### C. The AI Engine (Gemini) — Dual Model Circuit Breaker

- **Primary Model:** `gemini-2.5-flash` (`PRIMARY_MODEL` in `gemini.ts`).
- **Fallback Model:** `gemini-2.5-flash-lite` (`FALLBACK_MODEL` in `gemini.ts`).
- **Strategy:** If Primary hits `429`/quota, circuit breaker kicks in — cooldown for 60s, immediately switch to Fallback. If both are exhausted → `PROJECT_QUOTA_EXCEEDED` error shown to user.
- **Rate Limit:** `MIN_DELAY_MS = 2000` enforced between all calls.
- **Context Safety:** If transcript >100k chars, only Primary can handle it. If Primary is cooling down → fail fast.

### D. The Logic Types

- **Video Mode:** Uses `timestamp_seconds`.
  - **Visual Match Rule:** `timestamp + 0.5s` buffer for screenshots (skips vague transition fades).
- **Text Mode:** Uses `timestamp_seconds: 0`.

## 3. CURRENT CONTEXT (STATE VECTOR)

- **Active Phase:** Maintenance & Feature Expansion.
- **Known Bugs (Ghosts):**
  - **The Quota Trap:** Free tier has hard limits. Circuit breaker mitigates but doesn't eliminate.
- **Frozen Zones (Do Not Touch without Plan):**
  - `src/components/VideoInput.tsx` (Drag & drop state machine).
  - _Note:_ `gemini.ts` is UNLOCKED for API maintenance.

## 4. OPERATIONAL PROTOCOLS

1. **No Regressions:** Never revert specific "Instructional Designer" prompts to generic "Summary" prompts.
2. **Self-Correction:** If a build fails, read the error log. Do not guess.
3. **Clean Console:** `console.log` is for dev only. Remove before completion.
4. **Health Checks:** Review `docs/MAINTENANCE.md` regularly for scheduled audits.

## 5. CRITICAL FILE MAP (CONTEXT GROUNDING)

_(The AI assistant must assume these files exist and are populated)_

### Core Services & State
- `src/services/gemini.ts` (The Brain — Dual Model, Rate Limiting, Circuit Breaker & Prompt Engineering)
- `src/services/storage.ts` (IndexedDB Persistence Layer — `idb-keyval` wrapper)
- `src/store/useAppStore.ts` (The Memory — Zustand global state, migration logic)
- `src/schemas/storage.ts` (Zod Schemas — `TaskItem`, `CubitStep`, `StoredProjectData`)
- `src/schemas/gemini.ts` (Zod Schemas — AI response validation: `TaskSchema`, `SubStepsResponseSchema`, `SearchQueriesResponseSchema`)

### Hooks
- `src/hooks/useVideoProcessor.ts` (The Eyes — Canvas/FFmpeg screenshot extraction)
- `src/hooks/useNetworkStatus.ts` (Online/Offline detection)
- `src/hooks/useGlobalError.ts` (Error listener hook)

### Lib / Utils
- `src/lib/validation.ts` (Safe JSON parsers for Gemini responses)
- `src/lib/crypto.ts` (API Key encryption/decryption)
- `src/utils/exportUtils.ts` (PDF & Markdown export generation)

### Components — Core UI
- `src/components/Header.tsx` (App header with responsive hamburger menu)
- `src/components/VideoInput.tsx` (Drag & Drop + Media Capture — FROZEN)
- `src/components/UploadZone.tsx` (Upload area with footer stack)
- `src/components/IgnitionForm.tsx` (Analysis configuration form)
- `src/components/TaskFeed.tsx` (Virtualized task list — `react-virtuoso`)
- `src/components/TaskEditor.tsx` (Individual task cards + recursive Cubit logic)
- `src/components/ResultsFeed.tsx` (Task list container)
- `src/components/ProcessingLog.tsx` (System log drawer — Event Driven)
- `src/components/PrintableReport.tsx` (PDF print view)
- `src/components/ExportControl.tsx` (Export buttons — PDF, Markdown, JSON)
- `src/components/SettingsDialog.tsx` (API Key modal)

### Components — Scout Feature
- `src/components/ScoutView.tsx` (Multi-platform search assistant)

### Components — Landing / Onboarding
- `src/components/Manifesto.tsx` (Landing splash screen)
- `src/components/ManifestoGrid.tsx` (Feature grid cards)
- `src/components/HeroCarousel.tsx` (Hero image carousel)
- `src/components/WaitlistSignature.tsx` (Waitlist gate + signature)

### Components — System
- `src/components/ErrorBoundary.tsx` (React error boundary)
- `src/components/GlobalErrorListener.tsx` (Global error event listener)
- `src/components/ThemeSelector.tsx` (Light/Dark theme toggle)
- `src/components/ui/EditableText.tsx` (Inline text editing)
- `src/components/ui/FadeIn.tsx` (Fade-in animation wrapper)

### App Routes
- `src/app/page.tsx` (Landing page)
- `src/app/engine/page.tsx` (Main engine page)
- `src/app/design/` (Design system page)
- `src/app/sandbox/` (AI Sandbox page)
- `src/app/globals.css` (Tailwind v4 setup)
- `src/app/layout.tsx` (Root layout + ErrorBoundary)

### Docs
- `docs/MAINTENANCE.md` (Scheduled checks)
