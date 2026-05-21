# Technical Debt Register

## Overview

This document tracks known technical debt that is intentionally deferred to maintain velocity. Each entry includes context, impact, and recommended resolution timeline.

---

## SYNC-001: Sync Test Architecture Mismatch

**Status:** Deferred  
**Priority:** High (blocks CI green status)  
**Estimated Resolution:** 4-6 hours  
**Deferral Date:** 2026-04-27  

### Problem

E2E sync tests were written for legacy WebSocket architecture (`networkSync.ts` using `ws://localhost:8080`). The application has migrated to Supabase Realtime (`SupabaseSyncProd`), but tests remain incompatible.

### Root Cause Analysis

| Issue | Evidence |
|-------|----------|
| Test sets orphaned localStorage key | `localStorage.setItem('sync_server_url', 'ws://localhost:8080')` in test setup |
| Code never reads this key | `grep -r "sync_server_url" src/` returns empty |
| Feature flag defaults to false | `DEFAULT_USE_SUPABASE_SYNC = false` in `featureFlags.ts:25` |
| Early return when disabled | `useAppStore.ts:1167-1171` returns without establishing sync |
| State property names wrong | Tests access `roomId`, `currentProjectId`, `projects` - actual names are `roomFingerprint`, `activeProjectId`, `todoProjects` |

### Affected Tests (All Skipped)

| Test File | Skip Reason |
|-----------|-------------|
| `tests/sync-reconciliation.spec.ts` | Architecture mismatch - WebSocket vs Supabase |
| `tests/ping-pong-sync.spec.ts` | Architecture mismatch |
| `tests/sync-001-diagnostics.spec.ts` | Architecture mismatch |
| `tests/sync-001-roomid.spec.ts` | Architecture mismatch |
| `tests/sync-001-step1-roomid.spec.ts` | Architecture mismatch |
| `tests/sync-001-step2-trace.spec.ts` | Architecture mismatch |
| `tests/sync-isolation.spec.ts` | Architecture mismatch |
| `tests/sync_diagnostic.spec.ts` | Architecture mismatch |
| `tests/sync_verification.spec.ts` | Architecture mismatch |
| `tests/sync-test.spec.ts` | Page deleted (`/sync-test` no longer exists) |

### Resolution Strategy

**Option 1: Fix Tests for Supabase (Recommended)**
- Enable feature flag in test environment
- Mock Supabase Realtime channel/presence
- Update state property access
- Time: 4-6 hours

**Option 2: Delete Obsolete Tests**
- Remove all sync tests
- Rely on unit tests with mocked Supabase
- Time: 30 minutes
- Risk: Loss of E2E sync coverage

### When to Resolve

**Trigger:** Phase 6 (User Identity) completion OR sync architecture stabilization

**Success Criteria:**
```bash
npm run test:e2e
# All tests pass, no skipped sync tests
```

---

## Test File Lint Errors

**Status:** Accepted  
**Priority:** Low  

### Problem

Test files contain `@typescript-eslint/no-explicit-any` violations. These are pre-existing and do not affect production code.

### Files Affected
- `tests/sync-reconciliation.spec.ts` (13 instances)
- `tests/sync-isolation.spec.ts` (5 instances)
- `tests/sync-001-roomid.spec.ts` (15 instances)
- Other sync test files

### Resolution

**Option A:** Add `/* eslint-disable @typescript-eslint/no-explicit-any */` to test files  
**Option B:** Properly type the test fixtures (time-intensive, low value)

**Recommendation:** Option A when fixing sync tests

---

## Change Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-04-27 | Skipped 10 sync test files | Documented in this register |
| 2026-04-27 | Created TECH_DEBT.md | Centralized debt tracking |
