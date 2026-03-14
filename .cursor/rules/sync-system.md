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

### BUG-1: idleCheckpointTimer not cleared on disconnect
- **File**: `src/store/useAppStore.ts`
- **Impact**: Timer fires after disconnect, calls `broadcastCheckpoint` on null
- **Fix**: Clear timer in `disconnectSyncServer()`

### BUG-2: Cannot reconnect with different passphrase
- **File**: `src/store/useAppStore.ts`, `connectToSyncServer`
- **Impact**: `if (!networkSync)` guard prevents reconnect; user must disconnect first
- **Fix**: Auto-disconnect before connecting with new passphrase

### BUG-3: No per-project sharing model
- **Impact**: ALL projects are shared in one room; no personal vs shared distinction
- **Required**: Project-level sync scoping for team feature

### BUG-4: No device identity
- **Impact**: Cannot track which device made changes, no authority transfer
- **Required**: Device UUID, display name, and role (owner/editor/viewer)

### BUG-5: Single loadProject guard may race
- **File**: `src/store/useAppStore.ts`
- **Impact**: Two rapid navigations could both enter loadProject before `isHydrated`
- **Fix**: Use a mutex/lock pattern

## Offline Behavior

### Current State
- Local edits persist to IndexedDB (500ms debounced auto-save)
- Full Yjs state blob saved, not incremental
- On reconnect, Yjs CRDT auto-merges (no explicit conflict resolution)
- No visual indicator of "you have unsynced changes"

### Gaps
- No offline queue or pending-changes tracker
- No "last synced at" timestamp shown to user
- No detection of diverged state after long offline period
- No y-indexeddb provider (custom full-state persistence instead)

## What's Needed for Multi-Device Team Sync

### Phase 1: Fix existing sync bugs
- Clear idleCheckpointTimer on disconnect
- Allow reconnect with different passphrase
- Add "last synced" timestamp in UI
- Add unsynced-changes indicator

### Phase 2: Per-project sharing
- Split Yjs doc into per-project sub-documents
- Each project gets its own room/passphrase or uses a shared team key
- Personal projects stay local-only (never broadcast)
- Shared projects use the sync relay

### Phase 3: Device identity and authority
- Generate persistent device UUID on first visit
- Store device name/label
- Track "project owner" (who created it)
- Allow ownership transfer between devices
- Role-based permissions (owner/editor/viewer)

### Phase 4: Team/Manager features
- Subscription system for managers
- Team creation and member invite flow
- Team projects vs personal projects
- Manager dashboard with activity log
- Separate Yjs rooms per team
