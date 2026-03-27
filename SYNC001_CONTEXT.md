# SYNC-001 Debugging Context

## Problem Summary
Yjs updates ARE being received and merged into the Y.Doc on peer A (confirmed by "🟢 [INBOUND] Decrypted and successfully merged" log), BUT the Zustand store's `todoRows` stays at 0 and the `syncFromYjs` action is never called.

## Root Cause Theory
The Yjs bridge handler (`ydoc.on('update', ...)` with `origin === 'network'`) is not firing because it's registered on the wrong Yjs document instance. When `resetYDoc()` is called, it creates a NEW Y.Doc, but handlers don't transfer to new instances.

## What Has Been Attempted

### 1. Initial Diagnosis (✓)
- Room ID verification: PASS (both peers derive same room ID)
- Peer connection: PASS (👥 2+ showing on both)
- Data sync: FAIL (B has 1 row, A has 0 rows after sync)

### 2. Implementation of syncFromYjs (✓)
- Added `syncFromYjs: () => void` to ProjectState interface
- Implemented `syncFromYjs` action that extracts data from Yjs maps and updates Zustand store
- Added console.log for verification

### 3. Handler Registration Attempt 1 - Module Level (✗)
- Tried registering handler at module level with `if (typeof window !== 'undefined')`
- FAILED because `window` is undefined during SSR, so handler never registered

### 4. Handler Registration Attempt 2 - In loadProject() (✗)
- Moved handler registration to `loadProject()` after hydration
- FAILED because `loadProject()` only runs once on initial load
- When connecting to sync, `resetYDoc()` may be called, creating NEW ydoc
- Handler remains on OLD ydoc, never fires for network updates

### 5. Handler Registration Attempt 3 - In connectToSyncServer() AFTER loadProject() (✗)
- Moved handler to `connectToSyncServer()` at lines 742-751
- This is AFTER potential `resetYDoc()` call and AFTER `loadProject()`
- SHOULD be on correct ydoc instance, BUT debug logs still not appearing
- Test result: Still 0 rows on peer A

## Code Locations

### Current Handler Registration (useAppStore.ts:742-751)
```typescript
// --- YJS TO ZUSTAND BRIDGE (Register on current ydoc) ---
// This MUST be registered AFTER potential resetYDoc() call above
// to ensure it's on the correct ydoc instance that NetworkSync will use
ydoc.on('update', (_update: Uint8Array, origin: string) => {
  console.log('[YJS BRIDGE] Update event, origin:', origin);
  if (origin === 'network') {
    console.log('[YJS BRIDGE] Network update - calling syncFromYjs immediately');
    useAppStore.getState().syncFromYjs();
  }
});
```

### NetworkSync Update Application (networkSync.ts:274-276)
```typescript
this.ydoc.transact(() => {
  Y.applyUpdate(this.ydoc, yjsData);
}, 'network');
```

### resetYDoc() Function (useAppStore.ts:36-63)
```typescript
function resetYDoc(): Y.Doc {
  ydoc.destroy();
  ydoc = new Y.Doc({ gc: false });
  yProjectsMap = ydoc.getMap<Y.Map<any>>('projects');
  yTasksMap = ydoc.getMap<Y.Map<any>>('tasks');
  yMetaMap = ydoc.getMap<any>('meta');
  yTranscript = ydoc.getText('transcript');
  
  // Re-register the Yjs-to-Zustand bridge handler on the new ydoc instance
  // This is necessary because event listeners don't transfer to new instances
  if (typeof window !== 'undefined') {
    ydoc.on('update', (_update, origin) => {
      console.log('[YJS BRIDGE] Update received, origin:', origin);
      if (origin === 'network') {
        console.log('[YJS BRIDGE] Network update detected, triggering syncFromYjs...');
        if ((window as any)._crdtRenderDebounce) {
          clearTimeout((window as any)._crdtRenderDebounce);
        }
        (window as any)._crdtRenderDebounce = setTimeout(() => {
          console.log('[YJS BRIDGE] Executing syncFromYjs...');
          useAppStore.getState().syncFromYjs();
        }, 100);
      }
    });
  }
  
  return ydoc;
}
```

### syncFromYjs Action (useAppStore.ts:1505-1559)
```typescript
syncFromYjs: () => {
  // Extract current state from Yjs (same logic as debounced handler in loadProject)
  const rawYProjects = Array.from(yProjectsMap.values()).filter(p => !p.get('isDeleted'));
  const rawYTasks = Array.from(yTasksMap.values()).filter(t => !t.get('isDeleted'));

  // Map through cache for Structural Sharing (simple version without cache for now)
  const sharedProjects = rawYProjects.map(yProj => extractTodoProjectFromYMap(yProj));
  const sharedTasks = rawYTasks.map(yTask => extractTaskItemFromYMap(yTask));

  const updatedProjects = sortYMapList(sharedProjects);
  const currentActiveId = get().activeProjectId;
  const actProj = updatedProjects.find(p => p.id === currentActiveId) || updatedProjects[0];

  // Document State Render Engine
  let transcript = get().transcript;
  const textFromCRDT = yTranscript.toString();
  transcript = textFromCRDT === "" ? null : textFromCRDT;

  let projectType = get().projectType;
  if (yMetaMap.has('projectType')) projectType = yMetaMap.get('projectType');

  let projectTitle = get().projectTitle;
  if (yMetaMap.has('projectTitle')) projectTitle = yMetaMap.get('projectTitle');

  let scoutResults = get().scoutResults;
  if (yMetaMap.has('scoutResults')) {
    const raw = yMetaMap.get('scoutResults');
    if (raw) {
      try { scoutResults = JSON.parse(raw); } catch { }
    }
  }

  let scoutHistory = get().scoutHistory;
  if (yMetaMap.has('scoutHistory')) {
    const raw = yMetaMap.get('scoutHistory');
    if (raw) {
      try { scoutHistory = JSON.parse(raw); } catch { }
    }
  }

  set({
    todoProjects: updatedProjects,
    tasks: sharedTasks,
    activeProjectId: actProj?.id || null,
    todoRows: actProj ? actProj.todoRows : [],
    priorityDials: actProj ? actProj.priorityDials : { left: '', right: '', focusedSide: 'none' },
    transcript,
    projectType,
    projectTitle,
    scoutResults,
    scoutHistory,
  });
  
  console.log('🔄 syncFromYjs: Extracted', updatedProjects.length, 'projects,', actProj?.todoRows?.length || 0, 'rows');
},
```

## Test Results
```
=== TRACING YJS UPDATE CHAIN ===
Creating task on B...

--- B Console Logs (should show broadcast) ---
[B] 📡 [YJS] Local change detected (length: 379, origin: null). Broadcasting...
[B] 📡 [OUTBOUND] Sending live P2P Diff (408 bytes)
[B] 📡 [OUTBOUND] Sending live P2P Diff (408 bytes)

--- A Console Logs (should show receive) ---
[A] 📥 [INBOUND] Received live P2P Diff (408 bytes)
[A] 🟢 [INBOUND] Decrypted and successfully merged into Y.Doc!
[A] 📥 [INBOUND] Received live P2P Diff (408 bytes)
[A] 🟢 [INBOUND] Decrypted and successfully merged into Y.Doc!

B rows after create: 1
Waiting 5s for sync to A...
A rows after wait: 0  <-- SHOULD BE 1
```

## Hypotheses to Test

1. **Handler registration on wrong ydoc**: Even though handler is registered after `resetYDoc()`, maybe the ydoc reference is somehow different from what NetworkSync uses.

2. **Build not reflecting changes**: The debug logs in the handler aren't appearing - maybe the build is stale or caching old code.

3. **Multiple handler registrations**: Maybe handlers are being registered multiple times and conflicting.

4. **Origin mismatch**: NetworkSync applies updates with origin 'network', but maybe the handler sees a different origin.

## Files Modified
- `/Users/jamesgates/Documents/cube it connect/cube it connect b/src/store/useAppStore.ts` - Added syncFromYjs action and Yjs bridge handlers

## Next Steps
1. Verify that the ydoc passed to NetworkSync is the same instance that the handler is registered on
2. Add a log right before handler registration to confirm it runs
3. Add a log in NetworkSync to verify it's applying updates to the expected ydoc
4. Consider adding the handler to resetYDoc() itself to guarantee it's on every new ydoc
5. Check if there's a CORS or iframe issue preventing console logs from appearing

## Meta Documentation Created
- `master_calibration.md` - Specification Engineering framework
- `.cursorrules` - IDE constraints
- `docs/AGENT_ROLES.md` - Agent role definitions
- `docs/GRAVEYARD.md` - Anti-patterns & lessons
- `docs/QUICK_REFERENCE.md` - One-page cheat sheet
- `tests/sync-001-step1-roomid.spec.ts` - Room ID verification test
- `tests/sync-001-step2-trace.spec.ts` - Update propagation trace test
