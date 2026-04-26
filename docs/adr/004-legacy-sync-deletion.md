# ADR 004: Legacy Sync System Deletion

**Status**: Accepted  
**Date**: April 26, 2026  
**Decision Makers**: Engineering Team  

## Context

The Cubit Connect application originally used a custom WebSocket-based synchronization system (`NetworkSync`) for real-time collaborative features. This system was built before Supabase Realtime was adopted as the primary sync infrastructure.

The legacy system consisted of:
- `src/lib/networkSync.ts` - Custom WebSocket E2EE sync implementation
- `sync-server/` - Node.js relay server for WebSocket connections
- `tests/e2e/sync.spec.ts` - Legacy E2E sync tests
- `src/app/sync-test/page.tsx` - NetworkSync diagnostic page

## Problem

The custom WebSocket-based sync system had several critical issues:

1. **Maintenance Burden**: Complex, custom-built code requiring ongoing maintenance
2. **Reliability Issues**: Unreliable in production with connection drops and message loss
3. **Infrastructure Cost**: Required custom relay server deployment and monitoring
4. **Security Complexity**: Custom E2EE implementation required security audits
5. **Technical Debt**: Duplicated effort with Supabase Realtime providing same functionality

## Decision

We decided to **completely delete** the legacy NetworkSync system and migrate exclusively to Supabase Realtime.

### Rationale

1. **Supabase Realtime Advantages**:
   - Managed infrastructure (no custom relay server)
   - Better scalability through PostgreSQL-backed persistence
   - Official support and documentation
   - Battle-tested in production
   - Built-in security features

2. **Simplified Architecture**:
   - Single sync transport (Supabase Realtime)
   - Reduced code complexity
   - Fewer moving parts in production
   - Eliminated WebSocket fallback logic

3. **Cost Reduction**:
   - No sync-server deployment needed
   - Reduced monitoring surface area
   - Lower operational overhead

## Consequences

### Positive
- Eliminated ~2000 lines of custom sync code
- Removed sync-server deployment complexity
- Simplified mental model (one sync system, not two)
- Reduced CI pipeline complexity (no sync-focused test jobs)
- Faster build times (fewer files to compile)

### Negative
- Lost custom WebSocket fallback capability
- Supabase outage = no sync (acceptable trade-off)
- Had to rename types throughout codebase (networkSync → sync)

## Migration Path

1. **For Users**: No action required. Supabase Realtime is now the only sync transport.

2. **For Developers**:
   - All sync infrastructure now uses `syncManager` variable instead of `networkSync`
   - YDocInstance type uses `syncAttached` instead of `networkSyncAttached`
   - SyncPhase types use `sync_creating`/`sync_connecting` instead of `networkSync_creating`/`networkSync_connecting`
   - Function `markNetworkSyncAttached` renamed to `markSyncAttached`

3. **Feature Flag**: `USE_SUPABASE_SYNC` controls sync enablement (already in place)

## Implementation

Deletion commit: `chore: Remove legacy sync system and fix unit tests`

### Files Deleted
```
src/lib/networkSync.ts        (1,847 lines)
sync-server/                  (entire directory)
tests/e2e/sync.spec.ts        (312 lines)
src/app/sync-test/page.tsx    (156 lines)
```

### Files Modified
```
src/lib/syncDiagnostics.ts    (type renames)
src/store/useAppStore.ts      (variable rename, import updates)
tests/sync-001-diagnostics.spec.ts  (property updates)
tests/unit/supabaseSync.test.ts     (class reference fixes)
tests/unit/sentryIntegration.test.ts (window mock fixes)
tests/integration/supabaseRealtime.test.ts (clientID fix)
tests/e2e/featureFlags.spec.ts       (type assertion fix)
tests/unit/components/ErrorBoundary.test.tsx (import path fix)
```

## Alternatives Considered

1. **Keep as Fallback**: Rejected - adds complexity, Supabase reliability makes this unnecessary
2. **Gradual Migration**: Rejected - dual systems create more confusion than value
3. **Archive Code**: Rejected - version control preserves history, no need to keep dead code

## References

- ADR-001: Supabase Realtime Adoption
- docs/GRAVEYARD.md: Contains archived documentation from deleted system
- DEPLOY_SYNC_SERVER.md: Archived deployment instructions
