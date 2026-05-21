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

## Phase 5: Feature Expansion ✅

**Status:** COMPLETED (2026-04-27)

### Delivered
- Scout Feature (multi-platform search assistant) ✅
- Manifesto / Onboarding flow ✅
- Markdown Export ✅
- Dark Mode ✅
- Mobile Header (hamburger menu) ✅
- API Key encryption ✅
- Zod schema validation ✅
- Gemini Model Migration (3.0/3.1 Upgrade) ✅
- Toast Notifications (`sonner`) ✅
- Drag-and-Drop task reordering ✅
- Pre-commit Hooks (`husky`) ✅
- Offline Indicator (sticky banner) ✅
- Performance Monitoring (IDB size warning at 50MB) ✅
- Centralized AI Prompt Templates (`src/prompts/`) ✅

### Technical Debt
- Sync E2E tests skipped (architecture mismatch) - see `docs/TECH_DEBT.md`

## Phase 6: User Identity & Sync Infrastructure (Next)

**Status:** Specification Required

### Goals
- Anonymous → Registered user migration path
- Supabase Authentication integration
- RLS policies for data security
- Anonymous sync behavior definition
- Data ownership model

### Deliverables
- [ ] ADR-005: User Identity Architecture
- [ ] ADR-006: Sync Strategy for Anonymous Users
- [ ] Schema: Users table with auth integration
- [ ] Migration: Device-based → Account-based identity
- [ ] Feature: User registration/login flow
- [ ] Feature: Data migration on registration
