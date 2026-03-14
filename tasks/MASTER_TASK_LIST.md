# Cubit Connect — Master Task List

Last updated: March 15, 2026

---

## Completed (Sessions 1–2)

### Session 1 — Foundation
- [x] Resolved all 90 skipped tests → 481/481 passing across 13 devices
- [x] Created cursor rules (README, architecture, workflow, sync-system, testing)
- [x] Deep audit of sync system → 5 bugs documented

### Session 2 — Sync Bug Fixes + E2E Tests
- [x] BUG-1: Fixed `idleCheckpointTimer` leak on disconnect
- [x] BUG-2: Fixed reconnect with different passphrase
- [x] BUG-5: Fixed `loadProject` race condition (single-flight mutex)
- [x] Added "last synced at" timestamp + unsynced-changes indicator in SyncSetupModal
- [x] Added sync activity callbacks in `networkSync.ts`
- [x] Added catch-up queue for live diffs during initial checkpoint download
- [x] Created `tests/e2e/sync.spec.ts` with 7 multi-device sync scenarios
- [x] All 7 sync tests pass on all 13 devices
- [x] Added `flushSyncNow()` store action for deterministic test sync

### Session 2.5 — Planning Phase
- [x] Created ADR-001: Workspace-Scoped Data Model (personalUno/personalMulti/teamWorkspace)
- [x] Updated architecture.md with workspace model, identity model, IDB namespaces
- [x] Updated sync-system.md with sync boundaries, disconnect behavior matrix, conflict policy
- [x] Updated README.md with phase markers, lessons learned, calibration guidance
- [x] Created test tier system: `test:quick`, `test:sync`, `test:full` npm scripts
- [x] Updated testing.md with tier table, decision guide, sync test helpers
- [x] Updated workflow.md with tiered test references

---

## Epic 1: Workspace Infrastructure (Weeks 1–2)

Goal: Implement the foundational data model and storage layer that separates
personalUno from personalMulti, so that all subsequent features build on clean
workspace isolation.

### 1.1 Generate persistent device identity
- Generate `deviceId` via `crypto.randomUUID()` on first visit
- Store in `localStorage('cubit_device_id')`
- Add optional `deviceLabel` in `localStorage('cubit_device_label')`
- Expose `getDeviceId()` utility in `src/lib/identity.ts`
- **Files**: new `src/lib/identity.ts`, update `src/store/useAppStore.ts`
- **Effort**: Small (1 hr)
- **Test tier**: quick

### 1.2 Add workspace metadata to project schema
- Add `WorkspaceMetadata` fields to `TodoProjectSchema` in `src/schemas/storage.ts`:
  `workspaceType`, `workspaceId`, `ownerId`, optional `teamId`, optional `objectiveId`
- Add same fields to the Yjs project map structure in `yjsHelpers.ts`
- Default all new projects to `personalUno` with the browser's `workspaceId`
- **Files**: `src/schemas/storage.ts`, `src/lib/yjsHelpers.ts`, `src/store/useAppStore.ts`
- **Effort**: Medium (2 hrs)
- **Test tier**: quick

### 1.3 Namespace IndexedDB storage by workspace
- Replace single `cubit_connect_project_v1` key with namespaced keys:
  - `cubit_uno_{workspaceId}` for personal-uno
  - `cubit_multi_{roomIdHash}` for personal-multi
- Update `storageService` with workspace-aware `getProject(workspaceId)` and
  `saveProject(workspaceId, ...)` methods
- **Files**: `src/services/storage.ts`, `src/store/useAppStore.ts`
- **Effort**: Medium (3 hrs)
- **Test tier**: quick + sync

### 1.4 Migrate existing data to personalUno namespace
- On first load after upgrade: detect old `cubit_connect_project_v1` key
- Copy all existing projects into `cubit_uno_{newWorkspaceId}` with
  `workspaceType: 'personalUno'` metadata
- Keep old key as read-only backup for 30 days
- Show no disruption to the user — data appears exactly as before
- **Files**: `src/services/storage.ts` (migration function), `src/store/useAppStore.ts`
- **Effort**: Medium (2 hrs)
- **Test tier**: quick (add unit test for migration)

### 1.5 Workspace selector UI
- Add workspace switcher in sidebar or above project tabs
- Two modes visible: "My Projects" (personalUno) and "Shared Projects" (personalMulti)
- Switching workspaces swaps the active Y.Doc and project list
- personalMulti shows the sync status badge; personalUno does not
- **Files**: new component (e.g., `src/components/WorkspaceSelector.tsx`),
  update `src/components/todo/TodoSidebar.tsx`, `src/store/useAppStore.ts`
- **Effort**: Medium (3 hrs)
- **Test tier**: quick + full (layout across 13 devices)

---

## Epic 2: Personal-Multi Stabilization (Weeks 2–4)

Goal: Make the personalMulti sync experience reliable enough for daily use
across 2–3 personal devices.

### 2.1 Scope personalUno Y.Doc isolation
- When workspace is `personalUno`, Y.Doc is standalone — never attached to NetworkSync
- When workspace is `personalMulti`, Y.Doc attaches to NetworkSync with passphrase
- Switching workspaces disposes current observers, re-inits from target namespace
- **Files**: `src/store/useAppStore.ts`
- **Effort**: Medium (3 hrs)
- **Test tier**: sync

### 2.2 Robust disconnect/reconnect UX
- Visual state machine: Disconnected → Connecting → Connected → Reconnecting
- "Offline" banner when network is lost (not just WebSocket close)
- Preserve data in IDB namespace on disconnect (already works, formalize tests)
- "Switch room" flow: disconnect old → connect new → load new namespace
- **Files**: `src/store/useAppStore.ts`, `src/components/SyncSetupModal.tsx`
- **Effort**: Medium (3 hrs)
- **Test tier**: sync

### 2.3 Encryption and stress tests
- Verify data on the wire is encrypted (not readable without passphrase)
- Wrong passphrase cannot read room data (already tested — expand coverage)
- 5+ rapid project creates across 3 devices
- Rapid typing on same task from 2 devices
- Disconnect/reconnect cycles under load
- **Files**: `tests/e2e/sync.spec.ts` (add scenarios)
- **Effort**: Large (4 hrs)
- **Test tier**: sync

### 2.4 Storage quota monitoring
- Track approximate IDB usage per namespace
- Warn user when approaching browser storage limits
- Offer "Export and clear old data" option
- **Files**: `src/services/storage.ts`, `src/components/SyncSetupModal.tsx` or settings
- **Effort**: Small (2 hrs)
- **Test tier**: quick

### 2.5 Incremental IDB persistence
- Currently saves full `Y.encodeStateAsUpdate(ydoc)` every 500ms
- Evaluate `y-indexeddb` provider for incremental updates
- If adopted: replace custom persistence; if not: document why
- **Files**: `src/store/useAppStore.ts`, possibly `src/services/storage.ts`
- **Effort**: Medium (3 hrs)
- **Test tier**: quick + sync

---

## Epic 3: Release Quality & Polish (Weeks 4–6)

Goal: Harden the personal experience to the point where it can be used daily
without surprises, and prepare the foundation for team features.

### 3.1 Error boundary with Yjs recovery
- Catch Yjs corruption gracefully (e.g., malformed update from relay)
- Show "Something went wrong" UI with "Reset local data" option
- Log the error for debugging
- **Files**: new `src/components/ErrorBoundary.tsx`, wrap todo page
- **Effort**: Medium (2 hrs)
- **Test tier**: quick

### 3.2 Fix accessibility color contrast violations
- `text-zinc-400` on `bg-zinc-50` (sidebar): ratio 2.51, need 4.5
- `text-green-600` on `bg-white` (Dial Left): ratio 3.24, need 4.5
- `text-yellow-600` on `bg-white` (Dial Right): ratio 2.94, need 4.5
- **Files**: affected component stylesheets
- **Effort**: Small (1 hr)
- **Test tier**: full (verify across devices)

### 3.3 Fix nested interactive control (a11y)
- Project card has `role="button"` with a nested color-change button
- Restructure so screen readers can announce both actions
- **Files**: `src/components/todo/ProjectCard.tsx` or equivalent
- **Effort**: Small (30 min)
- **Test tier**: full

### 3.4 Mobile navigation improvements
- Hamburger menu close-on-navigate
- Swipe gesture for sidebar on mobile
- Bottom sheet for modals on mobile
- **Files**: sidebar and modal components
- **Effort**: Medium (3 hrs)
- **Test tier**: full

### 3.5 Project ownership tracking
- Creator device is "owner" by default
- Store `ownedBy: deviceId` in project workspace metadata
- Display "Created by [device label]" in project details
- Ownership transfer flow (UI + store action)
- **Files**: `src/store/useAppStore.ts`, `src/schemas/storage.ts`, project UI
- **Effort**: Medium (2 hrs)
- **Test tier**: quick + sync

### 3.6 Optimize Yjs observer throttle
- Profile 100ms debounce with large project counts
- Adjust if bottleneck detected
- **Files**: `src/store/useAppStore.ts`
- **Effort**: Small (1 hr)
- **Test tier**: perf

---

## Epic 4: Team-Ready Scaffolding (After Week 6 — Design Only)

These items are NOT built during the personal stabilization phase. They are
documented here so implementation decisions in Epics 1–3 don't conflict.

### 4.1 Role model draft
- Define roles: owner, admin, member, viewer
- Document permission matrix for project/task/step CRUD
- **Output**: ADR document, no code

### 4.2 Team data model design
- Team: `{ id, name, ownerId, members[], subscription, createdAt }`
- Member: `{ userId, deviceId, name, role, joinedAt }`
- Team projects linked to team, synced to all members
- **Output**: ADR document + schema draft

### 4.3 Subscription tier schema
- Free: personal use only
- Team: shared projects, manager dashboard, member management
- Define what's gated and how enforcement works
- **Output**: ADR document

### 4.4 Objective/scoreboard entity contracts
- Define objective entity: `{ id, name, projects[], status, targetDate }`
- Scoreboard status derivation from rabbit position
- Touchbase entry schema and linkage
- **Output**: ADR document + TypeScript interfaces

### 4.5 `/manager` route scaffold
- Page shell with tabs: Team, Projects, Scoreboard, Settings
- No functionality — just routing and placeholder UI
- **Effort**: Medium (2 hrs)

---

## Session Roadmap

| Session | Epic | Focus | Estimated Time |
|---------|------|-------|---------------|
| **3** | Epic 1 | Device identity + schema + namespace + migration | 6–8 hrs |
| **4** | Epic 1 + 2 | Workspace selector UI + Y.Doc isolation + disconnect UX | 6–8 hrs |
| **5** | Epic 2 | Encryption/stress tests + storage quota + incremental persistence | 4–6 hrs |
| **6** | Epic 3 | Error boundary + a11y fixes + mobile nav | 4–6 hrs |
| **7** | Epic 3 | Ownership tracking + observer optimization + stabilization | 4–6 hrs |
| **8** | Epic 4 | Team architecture ADRs + manager route scaffold | 4–6 hrs |
