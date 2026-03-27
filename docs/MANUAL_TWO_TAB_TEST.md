# Manual Two-Tab Sync Test Protocol

## Purpose
Test bidirectional sync between two browser tabs using deterministic data and the debug overlay.

## Prerequisites
- Server running on localhost:3000
- Sync server running on localhost:8080
- Debug overlay visible (bottom right "🔧 Sync Debug" button)

## Test Procedure

### Setup (Tab A)
1. Open browser Tab A
2. Navigate to `http://localhost:3000/todo`
3. Set API key in console: `localStorage.setItem('cubit_api_key', btoa('test-key'))`
4. Reload page
5. Wait for hydration (debug overlay shows "✓ Registered")
6. Click "🔧 Sync Debug" to open overlay
7. Note the YDoc ID (should be `ydoc-...`)
8. Click "Snapshot" to capture baseline

### Setup (Tab B)
1. Open browser Tab B (same browser, different tab)
2. Navigate to `http://localhost:3000/todo`
3. Same API key setup as Tab A
4. Reload page
5. Wait for hydration
6. Open debug overlay
7. Verify YDoc ID is DIFFERENT from Tab A (each tab has its own ydoc initially)
8. Click "Snapshot" to capture baseline

### Test 1: Connection
**Goal**: Both tabs connect to same room

Tab A:
1. Click "Sync" button
2. Enter passphrase: `TEST-ROOM-001`
3. Click "Establish Secure Connection"
4. Wait for "Securely Connected"
5. Wait for "peers" indicator in debug overlay
6. Click "Snapshot"

Tab B:
1. Click "Sync" button
2. Enter same passphrase: `TEST-ROOM-001`
3. Click "Establish Secure Connection"
4. Wait for "Securely Connected"
5. Verify "peers" appears in overlay
6. Click "Snapshot"

**Expected**: Both tabs show "connected (peers)" in debug overlay

### Test 2: A → B Sync
**Goal**: Changes from Tab A appear in Tab B

Tab A:
1. Add task: Click "+ Task", type "Task from Tab A"
2. Wait 2 seconds
3. Click "Snapshot"
4. Note Z/Y project counts in overlay

Tab B:
1. Wait 5 seconds (allow sync propagation)
2. Click "Refresh" in debug overlay
3. Check if "Task from Tab A" appears in todo list
4. Click "Snapshot"
5. Check overlay for divergence warning

**Expected**: Tab B shows "Task from Tab A" without manual refresh
**Debug Info**: Compare snapshots - should show no divergence

### Test 3: B → A Sync
**Goal**: Changes from Tab B appear in Tab A

Tab B:
1. Add task: Click "+ Task", type "Task from Tab B"
2. Wait 2 seconds
3. Click "Snapshot"

Tab A:
1. Wait 5 seconds
2. Verify "Task from Tab B" appears
3. Click "Snapshot"

**Expected**: Tab A shows both tasks

### Test 4: Simultaneous Edit Detection
**Goal**: System handles concurrent edits gracefully

Tab A:
1. Start editing "Task from Tab A" (click on text)
2. Note: Overlay may show peer editing indicator

Tab B:
1. While Tab A is editing, try to edit same task
2. Observe behavior

**Expected**: Turn-based locking prevents conflicts

### Test 5: Reconnection
**Goal**: Sync resumes after disconnect

Tab A:
1. Click "Disconnect" in sync modal
2. Wait for "disconnected" status in overlay
3. Add task: "Post-disconnect task A"
4. Click "Snapshot"

Tab A:
1. Reconnect with same passphrase
2. Wait for "connected"
3. Click "Snapshot"

Tab B:
1. Wait 10 seconds
2. Check if "Post-disconnect task A" appears
3. Click "Snapshot"

**Expected**: Offline edits sync after reconnection

## Snapshot Analysis

In browser console on each tab:
```javascript
// View all snapshots
window.__SYNC_MONITOR.getSnapshots()

// Compare last two snapshots
const snaps = window.__SYNC_MONITOR.getSnapshots();
if (snaps.length >= 2) {
  console.log(window.__SYNC_MONITOR.compareSnapshots(snaps[snaps.length-2], snaps[snaps.length-1]));
}

// Full diagnostic report
console.log(window.__SYNC_MONITOR.generateDiagnosticReport());
```

## Issue Detection Guide

### Observer Not Registered
- Debug overlay shows "✗ Missing"
- Snapshots will show "Observer was LOST" on comparison
- **Root cause**: YDoc was reset but observer not re-registered

### State Divergence
- Debug overlay shows red "⚠️" with different Z/Y counts
- Zustand projects ≠ Yjs projects
- **Root cause**: Yjs update received but observer callback didn't fire

### No Peer Connection
- Debug overlay shows "connected" but no "(peers)"
- **Check**: Both tabs using same passphrase?
- **Check**: Sync server running?

### Sync Not Propagating
- Tab A adds task, Tab B never receives it
- **Check**: "Last Update" timestamp in overlay
- **Check**: Causal log for "update" events

## Data Collection

When an issue occurs, export diagnostics from both tabs:
1. Click "Export Full Diagnostics" in overlay
2. Save both files
3. Note the timestamp and test step
4. Attach to bug report

## Success Criteria

- [ ] Both tabs connect successfully
- [ ] A→B sync works within 5 seconds
- [ ] B→A sync works within 5 seconds
- [ ] No state divergence detected
- [ ] Observer remains registered throughout
- [ ] Reconnection syncs offline edits
- [ ] All snapshots show "No issues detected"
