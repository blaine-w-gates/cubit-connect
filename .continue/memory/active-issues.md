# Active Issues — Cubit Connect

## How to Use This File
This file tracks bugs that are currently being investigated. Kimi reads this on every new chat to avoid asking "what's the current issue?" Read-only unless adding new issues or moving resolved ones to lessons.md.

---

## Recently Resolved Issues

### SYNC-001: Yjs Update Propagation Failure

**Status:** ✅ RESOLVED (Commit `881721a`) — May 19, 2026
**Severity:** Critical (previously blocked multi-device sync)
**Files:** `src/lib/supabaseSyncProd.ts`, `src/store/useAppStore.ts`

#### Root Cause
There was an origin string mismatch in the sync transport pipeline. The production sync manager (`supabaseSyncProd.ts`) was applying incoming updates and checkpoints to the Y.Doc using the origin `'remote'`. However, the Zustand store observer (`useAppStore.ts`) was configured to listen only for origin `'network'` updates to trigger Zustand store re-renders (`syncFromYjs()`). Because `'remote' !== 'network'`, incoming synced updates were merged into the CRDT document but never auto-called to update the user interface.

#### Resolution
Standardized all inbound sync update/checkpoint applications and echo-suppression checks in `supabaseSyncProd.ts` to use the origin `'network'`.

#### Verification
- Unit and integration tests passed (`test:quick`).
- Manual browser verification (two tabs, same passphrase, live sync updates) is **pending**.

---


## Legacy Sync System Status

**Note:** As of April 26, 2026, the custom WebSocket relay (`src/lib/networkSync.ts`, `sync-server/`) has been DELETED. Sync is now handled by Supabase Realtime with feature flag `USE_SUPABASE_SYNC`. The SYNC-001 issue may or may not persist with the new transport — this has not been verified.

### Verification Needed
- [ ] Does SYNC-001 reproduce with Supabase Realtime?
- [ ] Are Supabase Realtime E2E tests passing?
- [ ] Does the `syncFromYjs` bridge work with the new `syncManager` variable?

---

## Known Quota Issue

**Status:** ⚠️ MONITORED
**Issue:** Gemini API rate limits (429 errors)
**Mitigation:** Circuit breaker with dual-model fallback. MIN_DELAY_MS = 2000.
**Action if recurring:** Increase delay, implement exponential backoff, or add queue.
