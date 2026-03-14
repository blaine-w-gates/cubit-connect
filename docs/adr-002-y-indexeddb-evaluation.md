# ADR-002: y-indexeddb Evaluation (Epic 2.5)

**Status**: Deferred  
**Date**: March 2025

## Context

We currently persist the Y.Doc by encoding the full state every 500ms and saving it to our custom IndexedDB schema via `storageService.saveProject()`. The `y-indexeddb` package is the official Yjs persistence provider that stores incremental updates instead of full snapshots.

## Evaluation

### y-indexeddb Benefits

- **Incremental updates**: Stores only deltas, not full state. Smaller writes, faster saves.
- **Faster load**: Can apply stored updates incrementally instead of one large `Y.applyUpdate()`.
- **Official support**: Maintained by the Yjs team, ~220K weekly downloads.
- **Auto-cleanup**: `provider.destroy()` is called when `ydoc.destroy()` runs (workspace switch).

### Integration Complexity

1. **Workspace namespacing**: We use `getStorageKey(workspaceType, workspaceId)` for keys. y-indexeddb uses a `docName` string. We could pass the same key as docName. When `resetYDoc()` runs, we destroy the old ydoc (provider auto-destroys) and create a new ydoc + new `IndexeddbPersistence(newDocName, newYdoc)`.

2. **Unified payload**: Our `StoredProjectData` includes engine data (tasks, transcript, scoutResults, etc.) and `yjsState`. All of this lives in the Y.Doc (yTasksMap, yTranscript, yMetaMap). y-indexeddb would persist only the Y.Doc. We could remove `yjsState` from our schema and rely entirely on y-indexeddb for Y.Doc persistence. Engine data is already in yMetaMap, so no duplication.

3. **Migration**: Existing users have data in our idb-keyval format. We would need a one-time migration: load from legacy key, apply to ydoc, let y-indexeddb persist it, then clear legacy key. Non-trivial but feasible.

4. **Load flow**: Currently `loadProject()` fetches from storage, applies `yjsState` to ydoc, then extracts. With y-indexeddb, we would create the provider first, wait for `synced`, then run our extraction. The load order would change.

### Decision: Defer

**Reasons:**

- Current full-state save every 500ms works for typical personal use (dozens of projects, hundreds of tasks). Full state is usually &lt; 1MB.
- Refactor touches `loadProject`, `resetYDoc`, migration, and workspace switching. Risk of regressions.
- No user-reported performance issues with persistence.
- Better to adopt when we have concrete pain (e.g. slow saves, large-doc load times) or when adding team features that increase doc size.

**Revisit when:**

- Doc size exceeds ~5MB and users report slow saves/loads.
- We add team/scoreboard features that significantly grow the Y.Doc.
- We want to reduce write amplification for battery-sensitive devices.
