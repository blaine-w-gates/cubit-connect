# Cubit Connect — Sync System Deep Reference

This document is the definitive reference for the real-time sync system.
Any AI assistant working on sync features MUST read this first.

## Architecture Overview

```
Device A ←→ WebSocket Relay (Render) ←→ Device B
               ↕
         Redis (Upstash)
      checkpoint + diffs cache
```

- **Protocol**: Custom binary over WebSocket (not y-websocket)
- **Encryption**: End-to-end AES-256-GCM; relay only sees encrypted blobs
- **Room**: Derived from passphrase via SHA-256 hash
- **Key**: Derived from passphrase via PBKDF2 (100k iterations)

## Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `MSG_UPDATE` (0x01) | Client → Relay → Peers | Encrypted Yjs diff (live keystroke) |
| `MSG_CHECKPOINT` (0x02) | Client → Relay | Encrypted full Yjs state (sent after 30s idle) |
| `MSG_REQUEST_CACHE` (0x03) | Client → Relay | Request latest checkpoint + buffered diffs |
| `MSG_CACHE_RESPONSE` (0x04) | Relay → Client | Response with checkpoint + diffs array |
| `MSG_HEARTBEAT` (0x05) | Client ↔ Relay | Keepalive (echoed, not broadcast) |

## Connection Lifecycle

1. User enters passphrase in SyncSetupModal
2. `connectToSyncServer(passphrase)` → derive roomId + key
3. WebSocket opens to `wss://cubit-sync-relay.onrender.com?room=<hash>`
4. Client sends `MSG_REQUEST_CACHE`
5. Server responds with `MSG_CACHE_RESPONSE` (checkpoint + up to 100 diffs)
6. Client applies checkpoint, then diffs oldest→newest, then unlocks `catchUpLock`
7. Live diffs now flow bidirectionally

## Known Bugs (as of March 2026)

### BUG-1: idleCheckpointTimer not cleared on disconnect — FIXED (Session 2)
- **File**: `src/store/useAppStore.ts`
- **Fix applied**: Timer cleared in `disconnectSyncServer()` and `fullLogout()`.

### BUG-2: Cannot reconnect with different passphrase — FIXED (Session 2)
- **File**: `src/store/useAppStore.ts`
- **Fix applied**: `connectToSyncServer()` auto-disconnects existing connection first.

### BUG-3: No per-project sharing model — OPEN (addressed by ADR-001)
- **Impact**: ALL projects are shared in one room; no personal vs shared distinction.
- **Plan**: Workspace-scoped data model separates personalUno (local) from
  personalMulti (synced). See `.cursor/rules/adr-001-workspace-model.md`.

### BUG-4: No device identity — OPEN (deferred to implementation phase)
- **Impact**: Cannot track which device made changes, no authority transfer.
- **Plan**: Generate persistent `deviceId` via `crypto.randomUUID()` on first visit;
  store in localStorage. Implementation scheduled for workspace migration epic.

### BUG-5: Single loadProject guard may race — FIXED (Session 2)
- **File**: `src/store/useAppStore.ts`
- **Fix applied**: Single-flight mutex (`loadProjectInFlight`) prevents concurrent loads.

## Sync vs Local Storage Boundaries

### What Syncs (personalMulti workspace)

| Data | Mechanism | Notes |
|------|-----------|-------|
| All projects in `yProjectsMap` | Yjs CRDT over E2EE relay | Includes todoRows, steps, dials |
| All tasks in `yTasksMap` | Yjs CRDT over E2EE relay | Video/engine tasks |
| Metadata in `yMetaMap` | Yjs CRDT over E2EE relay | projectType, scoutHistory |
| Transcript in `yTranscript` | Yjs CRDT over E2EE relay | Y.Text with character-level merge |

### What NEVER Syncs (stays browser-local)

| Data | Storage | Reason |
|------|---------|--------|
| API key (`cubit_api_key`) | localStorage | Per-device credential |
| Device ID (`cubit_device_id`) | localStorage | Per-browser identity |
| Device label (`cubit_device_label`) | localStorage | User preference |
| UI state (activeMode, processingRowId, lastAddedRowId) | Zustand (memory) | Ephemeral UI |
| personalUno projects | IndexedDB (namespaced) | By design: private to one browser |
| Log entries | Zustand (memory) | Debug-only, not persisted across sessions |

### Source of Truth by Workspace Type

| Workspace | Source of Truth | Fallback |
|-----------|----------------|----------|
| `personalUno` | Local IndexedDB | None (data exists only here) |
| `personalMulti` (online) | Yjs CRDT state (merged across devices) | Local IndexedDB cache |
| `personalMulti` (offline) | Local IndexedDB (diverged) | Auto-merges on reconnect via Yjs |
| `teamWorkspace` (future) | Server database | Local cache for offline reads |

## Offline Behavior

### Current State (after Session 2 fixes)
- Local edits persist to IndexedDB (500ms debounced auto-save)
- Full Yjs state blob saved as `Y.encodeStateAsUpdate(ydoc)`
- On reconnect, Yjs CRDT auto-merges (no explicit conflict resolution needed)
- `lastSyncedAt` timestamp shown in SyncSetupModal
- `hasUnsyncedChanges` badge shown when local edits haven't been confirmed by relay
- `flushSyncNow()` available for forcing immediate checkpoint broadcast

### Disconnect Scenarios

| Scenario | What Happens | User Sees |
|----------|-------------|-----------|
| Network drops mid-session | WebSocket `onclose` fires; exponential backoff reconnect starts | Status badge turns yellow → "Reconnecting..." |
| User clicks Disconnect | `disconnectSyncServer()` called; `idleCheckpointTimer` cleared; data stays in IDB | Status shows "Disconnected"; data remains accessible locally |
| Browser tab closed while connected | WebSocket closes; relay detects absence via heartbeat timeout | On next visit: data loaded from IDB; user can reconnect |
| Browser tab closed while offline | Last auto-saved IDB state is preserved | On next visit: data loaded from IDB; unsynced changes flagged |
| Switch to different passphrase | Old room disconnected cleanly → new room connected | Seamless transition; old data in its IDB namespace |
| Long offline (>7 days) | Redis cache may have expired; but Yjs state vector merge still works if any peer has full state | Full CRDT merge on reconnect; may be slow for large docs |

### Conflict Policy

Yjs CRDTs resolve all conflicts automatically using the following rules:
- `Y.Map` (projects, rows): last-writer-wins per key
- `Y.Text` (project names, transcript): character-level interleaving; concurrent
  inserts at the same position may produce non-deterministic ordering (known
  Safari text duplication issue — see README.md lessons learned)
- `Y.Array` (sub_steps): position-aware; concurrent inserts at different
  positions merge cleanly; same-position inserts interleave

There is no manual conflict resolution UI and none is planned for personal modes.

### Gaps Remaining
- No offline queue (Yjs handles this implicitly via state vector merge)
- No y-indexeddb provider (custom full-state persistence instead)
- No incremental IDB persistence (full state blob on every save)
- No storage quota monitoring or cleanup
- No "repair mode" UX for irrecoverably diverged state

## Roadmap for Multi-Device Sync

### Phase 1: Fix existing sync bugs — DONE (Session 2)
- ~~Clear idleCheckpointTimer on disconnect~~ ✓
- ~~Allow reconnect with different passphrase~~ ✓
- ~~Add "last synced" timestamp in UI~~ ✓
- ~~Add unsynced-changes indicator~~ ✓
- ~~Fix loadProject race condition~~ ✓
- ~~Queue live diffs during catch-up~~ ✓

### Phase 2: Workspace isolation + storage namespacing (Current — Weeks 1–4)
- Implement workspace-scoped data model (ADR-001)
- Namespace IndexedDB storage per workspace type
- Migrate existing data to personalUno namespace
- Add workspace selector UI
- Generate persistent device identity
- Separate personalUno Y.Doc (never attached to NetworkSync)

### Phase 3: Personal-multi stabilization (Weeks 3–6)
- Robust disconnect/reconnect UX with state preservation
- Storage quota monitoring and warnings
- Incremental IDB persistence (reduce save payload)
- Stress test with 3+ devices and large project counts
- Release-quality sync for personal-multi

### Phase 4: Team-ready scaffolding (After Week 6, design only)
- Role model draft (owner/admin/member/viewer)
- Team data model (server-side, not E2EE)
- Subscription tier schema
- Objective/scoreboard entity contracts
- Separate Yjs rooms per team
