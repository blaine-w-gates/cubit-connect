# NEXT SESSION PROMPT — Cubit Connect
# Generated: May 21, 2026 | Context: 82% full — FRESH CHAT REQUIRED

## STEP 1: READ THESE FILES FIRST (in order)

1. `master_calibration.md` — Project constitution, Trade-off Hierarchy, workflow rules
2. `docs/QUICK_REFERENCE.md` — Current state cheat sheet (May 21, 2026)
3. `.continue/memory/active-issues.md` — List of open/closed issues
4. `.continue/memory/decisions.md` — ADR records including legacy sync deletion
5. `tasks/active_context.md` — Current phase status and follow-up tasks

## STEP 2: UNDERSTAND CURRENT STATE

- **Phase:** 6 COMPLETE — Auth & Identity deployed. Maintenance mode.
- **Sync Transport:** Supabase Realtime (legacy WebSocket DELETED April 26, 2026)
- **SYNC-001:** ✅ RESOLVED — Origin mismatch fixed in commit `881721a` (May 19)
  - `src/lib/supabaseSyncProd.ts`: All inbound updates now use `origin: "network"`
  - `src/store/useAppStore.ts`: `registerYjsObserver()` filters on `origin === "network"`
  - `tests/integration/e2eeRuntime.test.ts`: Updated to match
  - `vitest.config.ts`: `reporters` (not `reporter`) for TypeScript compliance
- **Feature Flag:** `USE_SUPABASE_SYNC` defaults to `false` (Safe Mode)
- **Last Test Run:** `test:quick` PASSED — 454 unit tests + 4 CRDT physics E2E tests

## STEP 3: REMAINING ISSUES TO ADDRESS

| Priority | Issue | Status | Next Action |
|----------|-------|--------|-------------|
| P0 | Manual browser verification of SYNC-001 fix | ⏳ PENDING | User to test: open Tab A, connect sync, open Tab B, same passphrase, add row in A, verify appears in B |
| P1 | Update `package.json` test:sync script | ⏳ PENDING | Script references deleted `tests/e2e/sync.spec.ts` — update or remove |
| P1 | Clean up debug log files in root (~30 files) | ⏳ PENDING | Delete `ws-debug-*.log`, `supabase-debug-*.log`, etc. |
| P2 | Write Supabase Realtime E2E sync tests | ⏳ PENDING | Replace legacy sync tests with Supabase-based multi-device tests |
| P2 | Storage quota monitoring | ⏳ PENDING | Warn users when IndexedDB approaches quota |
| P3 | Team workspace scaffolding | ⏳ PENDING | Design-only after Week 6 |

## STEP 4: WHAT TO DO NOW

**Before any code changes:**
1. Run Phase 0 checks: `npm run type-check && npm run lint && npm run test:quick`
2. Verify git status is clean
3. Confirm with user which issue to work on next

**Recommended next issue (if user says "go"):**
- Clean up root directory pollution (P1) — safe, no functional changes, immediate value
- OR update `test:sync` script in package.json (P1) — prevents confusion

## STEP 5: USER CONTEXT

- **Name:** James
- **Role:** Founder, Software Architect, 10+ years
- **Style:** Direct, first-principles, hates unnecessary abstraction
- **Testing:** Prefers deterministic verification; will do manual browser tests
- **Next expected action:** Manual verification of SYNC-001 (two-tab sync test)

---

**When this file was created:** Chat context at 82%, requiring fresh session
**Commit this file with:** `git add docs/NEXT_SESSION_PROMPT.md && git commit -m "[Agent] Add session handoff prompt for next chat"`