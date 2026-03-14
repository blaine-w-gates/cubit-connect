# Cubit Connect — Master Task List

Last updated: March 14, 2026

## Priority 1: Fix Sync Bugs (CRITICAL — blocks all multi-device work)

### 1.1 Fix idleCheckpointTimer leak on disconnect
- **File**: `src/store/useAppStore.ts`
- **Bug**: Timer fires after disconnect, calls broadcastCheckpoint on null
- **Fix**: Clear timer in `disconnectSyncServer()`
- **Effort**: Small (15 min)

### 1.2 Fix reconnect with different passphrase
- **File**: `src/store/useAppStore.ts`, `connectToSyncServer`
- **Bug**: `if (!networkSync)` guard prevents reconnect; must disconnect first
- **Fix**: Auto-disconnect before connecting with new passphrase
- **Effort**: Small (30 min)

### 1.3 Fix loadProject race condition
- **File**: `src/store/useAppStore.ts`
- **Bug**: Two rapid navigations could both enter loadProject before isHydrated
- **Fix**: Mutex/lock pattern
- **Effort**: Medium (1 hr)

### 1.4 Add "last synced" timestamp to UI
- **File**: `src/components/SyncSetupModal.tsx`, store
- **Feature**: Show when data was last synced; unsynced changes indicator
- **Effort**: Medium (1 hr)

## Priority 2: End-to-End Sync Testing (CRITICAL — validates all multi-device)

### 2.1 Write Playwright multi-context sync tests
- Create `tests/e2e/sync.spec.ts` with two browser contexts sharing a room
- Test: Device A creates project → Device B sees it
- Test: Device B creates task → Device A sees it
- Test: Both devices edit same task simultaneously → CRDT merges
- Test: Device A disconnects, makes offline edits → reconnects → sync merges
- Test: Three devices connect to same room → all see all changes
- **Effort**: Large (4-6 hrs)

### 2.2 Test encryption correctness
- Verify data is encrypted on the wire (not readable in Redis)
- Verify wrong passphrase cannot read room data
- Test key derivation consistency across devices
- **Effort**: Medium (2 hrs)

### 2.3 Stress test sync under load
- 5+ rapid project creates across 3 devices
- Rapid typing on same task from 2 devices
- Network interruption simulation (disconnect/reconnect cycles)
- **Effort**: Large (3-4 hrs)

## Priority 3: Per-Project Sharing Model (ARCHITECTURE — enables teams)

### 3.1 Design per-project sharing architecture
- Split "shared" vs "personal" projects
- Personal projects: never leave the device (local-only Yjs doc)
- Shared projects: sync via relay in a room
- Each project gets a `shareMode: 'local' | 'shared'` flag
- Shared projects use a `roomId` derived from team/project passphrase
- **Effort**: Design (2 hrs), Implementation (8-12 hrs)

### 3.2 Implement project-level rooms
- Each shared project gets its own WebSocket room
- Device can be connected to multiple rooms simultaneously
- Personal projects stay in local IndexedDB only
- **Effort**: Large (8 hrs)

### 3.3 UI for sharing a project
- "Share Project" button on project card
- Generate shareable passphrase/link
- "Stop Sharing" to make it local-only again
- **Effort**: Medium (3 hrs)

## Priority 4: Device Identity & Authority

### 4.1 Generate persistent device UUID
- Create on first visit, store in localStorage
- Include in Yjs awareness protocol
- Track device name/label (editable in settings)
- **Effort**: Small (1 hr)

### 4.2 Track project ownership
- Creator device is "owner" by default
- Store `ownedBy: deviceId` in project metadata
- Owner can transfer ownership
- **Effort**: Medium (2 hrs)

### 4.3 Role-based permissions
- Owner: full control (create, edit, delete, transfer)
- Editor: create tasks/steps, edit, but not delete project
- Viewer: read-only
- **Effort**: Large (4-6 hrs)

## Priority 5: Offline & Reconnection

### 5.1 Unsynced changes indicator
- Track whether local state has diverged from last server checkpoint
- Show visual badge: "3 unsynced changes"
- Auto-sync on reconnect
- **Effort**: Medium (2 hrs)

### 5.2 Offline queue
- Buffer Yjs updates when offline
- Replay on reconnect
- Show "syncing X changes..." progress
- **Effort**: Medium (3 hrs)

### 5.3 Graceful degradation
- App works fully offline (already mostly works)
- Clear messaging when sync server is unreachable
- Auto-reconnect with exponential backoff (already exists)
- **Effort**: Small (1 hr)

## Priority 6: Manager/Team Page (NEW FEATURE)

### 6.1 Design team data model
- Team: { id, name, ownerId, members[], subscription }
- Member: { deviceId, name, role, joinedAt }
- Team projects: linked to team, synced to all members
- Personal projects: never shared with team
- **Effort**: Design (3 hrs)

### 6.2 Create /manager route
- Dashboard showing team members, projects, activity
- Invite flow: generate invite code → member enters code → joins team
- Remove member flow
- **Effort**: Large (8-12 hrs)

### 6.3 Subscription system
- Manager pays for team features
- Free tier: personal use only (current behavior)
- Team tier: shared projects, manager dashboard, member management
- **Effort**: Large (depends on payment provider)

### 6.4 Dual-instance support
- Same device has "Personal" and "Team" contexts
- Switch between contexts in sidebar
- Team projects and personal projects are separate Yjs docs
- **Effort**: Large (6-8 hrs)

## Priority 7: UI/UX Polish

### 7.1 Fix accessibility color contrast violations
- `text-zinc-400` on `bg-zinc-50` (sidebar "1 project" text): ratio 2.51, need 4.5
- `text-green-600` on `bg-white` (Dial Left): ratio 3.24, need 4.5
- `text-yellow-600` on `bg-white` (Dial Right): ratio 2.94, need 4.5
- **Effort**: Small (1 hr)

### 7.2 Fix nested interactive control (a11y)
- Project card has `role="button"` with a nested color-change button
- Screen readers can't announce this correctly
- **Effort**: Small (30 min)

### 7.3 Mobile navigation improvements
- Hamburger menu close-on-navigate
- Swipe gesture for sidebar on mobile
- Bottom sheet for modals on mobile
- **Effort**: Medium (3-4 hrs)

## Priority 8: Performance & Infrastructure

### 8.1 Replace full-state IDB persistence with y-indexeddb
- Current: saves full Y.encodeStateAsUpdate every 500ms
- Better: y-indexeddb provider with incremental updates
- **Effort**: Medium (2-3 hrs)

### 8.2 Optimize Yjs observer throttle
- Current: 100ms debounce on Yjs → Zustand sync
- Profile for bottlenecks with large project counts
- **Effort**: Small (1-2 hrs)

### 8.3 Add error boundary with recovery
- Catch Yjs corruption gracefully
- Offer "Reset local data" option
- **Effort**: Medium (2 hrs)

---

## Recommended Session Order

| Session | Focus | Estimated Time |
|---------|-------|---------------|
| **Next (Session 2)** | Priority 1 (sync bugs) + Priority 2.1 (sync tests) | 4-6 hrs |
| **Session 3** | Priority 2.2-2.3 (encryption + stress tests) + Priority 5 (offline) | 4-6 hrs |
| **Session 4** | Priority 3 (per-project sharing) | 6-8 hrs |
| **Session 5** | Priority 4 (device identity) + Priority 7.1-7.2 (a11y) | 4-6 hrs |
| **Session 6** | Priority 6 (manager/team page design + scaffold) | 6-8 hrs |
| **Session 7** | Priority 6 cont'd (team features implementation) | 6-8 hrs |
| **Session 8** | Priority 8 (performance) + final integration testing | 4-6 hrs |
