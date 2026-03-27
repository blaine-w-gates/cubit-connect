# SYNC-001 Phase 1 Findings Report

## Executive Summary

**Status**: Phase 1 monitoring infrastructure complete and validated
**Key Finding**: Peers connect to room but don't discover each other (SYNC-001 confirmed)
**Next Action Required**: Manual browser testing with debug overlay

## What Was Built

### 1. Monitoring Infrastructure ✅
- Causal event logging (sequence numbered)
- YDoc instance tracking with lifecycle monitoring
- State machine phase transitions
- Invariant assertion system
- All accessible via `window.__SYNC_MONITOR`

### 2. Visual Debug Overlay ✅
- Real-time sync health dashboard
- Shows: YDoc ID, observer status, sync status, peer count
- Divergence detection (Zustand vs Yjs)
- One-click snapshots with comparison
- One-click diagnostic export

### 3. State Snapshot System ✅
- Before/after state capture
- Automatic comparison between snapshots
- Tracks: phase, ydoc ID, observer status, event count

### 4. Test Suite ✅
- Single-peer tests: All passing (local CRDT works)
- Two-peer tests: Reveals SYNC-001 issue

## SYNC-001 Symptoms Confirmed

### Symptom 1: Ghost Peers
**Observation**: Both tabs show:
- "Securely Connected" ✅
- "👤 1" (only themselves) ❌
- Expected: "👤 2" (self + peer)

**What this means**: WebSocket connects to room, but presence heartbeat not received by peer

### Symptom 2: No Data Sync
**Observation**: 
- Tab A adds task
- Tab B never receives it
- No "📥 [INBOUND]" messages in console

**What this means**: Updates broadcast but not received (or not applied)

### Symptom 3: Connection Without Communication
**Observation**:
- Both peers show "connected" status
- Both in same room (verified by fingerprint match)
- No peer discovery event fires

## Root Cause Hypotheses (Prioritized)

### Hypothesis 1: Dumb Relay Not Broadcasting (70% confidence)
**Theory**: Server receives presence heartbeat but doesn't broadcast to other peers
**Evidence**: 
- Both peers connect successfully
- No "[PRESENCE] Received" logs (need to verify in browser console)

**Test**: Open browser dev tools, check console for:
```
[PRESENCE] Broadcasting presence heartbeat from ydoc...
[PRESENCE] Received peer heartbeat on ydoc...
```

If only "Broadcasting" appears, relay is not forwarding.

### Hypothesis 2: Timing/Race Condition (20% confidence)
**Theory**: Second peer connects after first peer's presence interval missed
**Evidence**: 
- Presence sent every 5 seconds
- If peer B connects at t=2s, misses peer A's heartbeat at t=0s
- Must wait until t=5s for next heartbeat

**Test**: Wait 10+ seconds after both connect, check if peer count updates

### Hypothesis 3: Encryption Key Mismatch (10% confidence)
**Theory**: Peers derive different encryption keys from same passphrase
**Evidence**: 
- Same passphrase should derive same key
- If keys differ, updates decrypt to garbage and are rejected

**Test**: Log the key fingerprint in NetworkSync constructor

## Debugging Protocol (Next Steps)

### Step 1: Manual Two-Tab Test
1. Open Tab A, navigate to /todo
2. Open debug overlay (🔧 Sync Debug button)
3. Click "Sync", enter "DEBUG-ROOM-001"
4. Open browser console (Cmd+Option+J)
5. Look for: `[PRESENCE] Broadcasting presence heartbeat...`
6. Repeat in Tab B
7. Check if Tab A shows: `[PRESENCE] Received peer heartbeat...`

### Step 2: Capture Diagnostics
If peer discovery fails:
1. Click "Snapshot" on both tabs
2. Click "Export Full Diagnostics" on both tabs
3. Save files as `tab-a-failed.txt` and `tab-b-failed.txt`
4. Attach to bug report

### Step 3: Check Server
1. Check sync server logs
2. Verify it's running: `curl http://localhost:8080/health`
3. Check if server sees both connections

## Files Created/Modified

```
src/lib/syncDiagnostics.ts          - Core monitoring + snapshots
src/components/SyncDebugOverlay.tsx - Visual dashboard
docs/MANUAL_TWO_TAB_TEST.md         - Manual testing guide
docs/SYNC001_PHASE1_REVIEW.md       - Phase 1 review
tests/single-peer-sanity.spec.ts    - Local CRDT tests
tests/minimal-two-peer.spec.ts      - Two-peer sync tests
```

## Confidence Assessment

| Component | Confidence | Notes |
|-----------|-----------|-------|
| Monitoring | 95% | Validated working |
| Local Sync | 98% | Single-peer tests pass |
| Network Layer | 60% | Connects but doesn't communicate |
| Root Cause | 30% | Need browser console verification |

## Recommendations

### Immediate (Today)
1. Run manual two-tab test with browser console open
2. Check for presence heartbeat logs
3. If issue confirmed in browser, check Dumb Relay server

### Short Term (This Week)
1. Add server-side connection logging
2. Test with direct WebSocket (bypass encryption)
3. Verify room ID hash matches between peers

### Medium Term
1. Build sync simulator (mock server)
2. Add automated regression tests
3. Implement connection health checks

## Conclusion

Phase 1 delivered a robust monitoring and debugging infrastructure. The SYNC-001 issue is confirmed reproducible: peers connect but don't discover each other. The next step requires manual browser testing with console logs to determine if the issue is:
- Dumb Relay not broadcasting
- Timing/race condition
- Encryption mismatch

All tools are in place to diagnose and fix once root cause is identified.
