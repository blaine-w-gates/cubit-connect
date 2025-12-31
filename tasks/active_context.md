# Active Context: Cubit Connect

**Last Updated:** 2026-01-01  
**Current Phase:** Phase 1 - Setup & Safety Harness  
**Status:** 🟢 Phase 1 Complete — All steps finished

---

## Phase 1: Setup & Safety Harness (Config, Zustand, IDB wrapper)

### 1.1 Project Scaffolding ✅
- [x] Initialize Next.js 14 with App Router
- [x] Configure `next.config.js` for static export
- [x] Set up TypeScript with strict mode
- [x] Install and configure Tailwind CSS
- [x] Create `.github/workflows/deploy.yml` (GitHub Pages deployment)
- [x] Add CSP meta tag in layout.tsx

### 1.2 Core Dependencies ✅
- [x] Install `zustand` for state management
- [x] Install `idb-keyval` for IndexedDB wrapper
- [x] Install `isomorphic-dompurify` for sanitization
- [x] Install `@google/generative-ai` for Gemini API
- [x] Verify build passes (`npm run build` ✓)

### 1.3 Safety Utilities ✅
- [x] Create `src/lib/types.ts` — Core TypeScript interfaces
- [x] Create `src/lib/storage.ts` — IndexedDB wrapper + Private Mode detection
- [x] Create `src/lib/safety.ts` — DOMPurify sanitization + JSON parsing
- [x] Create `src/lib/video-queue.ts` — Async screenshot queue (Antigravity protocol)

### 1.4 Zustand Store ✅
- [x] Create base store with AppState interface (`src/store/useAppStore.ts`)
- [x] Manual persistence to IndexedDB via storage utilities
- [x] All actions implemented (setApiKey, setTasks, updateTask, reset, etc.)
- [x] Initialize action for hydration and storage detection

### 1.5 API Key Flow ✅
- [x] Create `ApiKeyInput.tsx` component with validation
- [x] Gemini key validation via `countTokens("test")` call
- [x] Save valid key to LocalStorage
- [x] State router in `page.tsx` (Loading → Setup → Dashboard)
- [x] "Reset Key" button functional

---

## Current Focus

**MVP Feature-Complete!** All core features implemented including the Cubit drill-down.

---

## Phase 2: Core Features

### 2.1 Inputs & Parsing ✅
- [x] Create `src/lib/vtt-parser.ts` — Loose regex VTT/SRT parser
- [x] Create `src/components/dashboard/UploadZone.tsx` — Dual file upload UI
- [x] Create `src/components/dashboard/VideoPlayer.tsx` — Visible + hidden video elements
- [x] Create `src/components/dashboard/Dashboard.tsx` — Main container
- [x] Update `page.tsx` to render Dashboard

### 2.2 AI Analysis & Screenshots ✅
- [x] Create `src/lib/gemini.ts` — AI prompt and analyzeTranscript function
- [x] Create `src/components/dashboard/TaskList.tsx` — Mobile-first task display
- [x] Create `src/hooks/useAnalysis.ts` — Orchestrator with async screenshot queue
- [x] Update Dashboard.tsx — Progress indicator, error handling, TaskList rendering

### 2.3 Cubit Drill-Down Feature ✅
- [x] Add `generateSubSteps()` to gemini.ts — 4-step breakdown prompt
- [x] Create `src/hooks/useCubit.ts` — Per-task loading state management
- [x] Update TaskList.tsx — "Cube It" button, sub-steps display
- [x] Recursion guard: Sub-steps don't show Cube It button (max depth = 1)

---

## Decisions Made

| Decision | Rationale | Date |
|----------|-----------|------|
| Zustand over Context | Less boilerplate, better performance | 2024-12-31 |
| idb-keyval over raw IDB | Simpler API, Promise-based | 2024-12-31 |
| gemini-1.5-flash | Fast, cost-effective for MVP | 2024-12-31 |
| Loose VTT regex | MacWhisper compatibility | 2024-12-31 |

---

## Known Risks

| Risk | Mitigation |
|------|------------|
| iOS Safari memory limits | Max 640px screenshots, 0.7 quality |
| Private browsing IndexedDB | Detect and warn user, use session memory |
| Gemini rate limits | Client-side queue with delay |
| HEVC codec support | Deferred to Phase 2 |

---

## Phase 2: Polish (Future)

The following features are explicitly **out of scope for MVP** but tracked for future implementation:

- [ ] **HEVC Codec Check** — Detect iOS/Windows HEVC issues before processing
- [ ] **"Talking Head" Offset** — Add +1.5s to timestamps to skip past speaker face
- [ ] **Data Export/Import (JSON)** — Allow users to backup/restore projects
- [ ] **Granular Retry Buttons** — Retry individual failed screenshots or AI calls
- [ ] **Smart Reset** — Clear project data but keep API key
- [ ] **Theme Toggle** — Light/dark mode support
- [ ] **Keyboard Shortcuts** — Quick navigation
- [ ] **Full WCAG 2.1 AA Compliance** — Screen reader support, focus management
