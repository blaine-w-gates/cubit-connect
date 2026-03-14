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

### Session 3 — Workspace Infrastructure (Epic 1)
- [x] Created `src/lib/identity.ts` — persistent deviceId, deviceLabel, unoWorkspaceId
- [x] Added workspace metadata (workspaceType, workspaceId, ownerId, teamId, objectiveId) to TodoProjectSchema
- [x] Updated Yjs helpers to bind/extract workspace metadata on projects
- [x] Replaced single IDB key with namespaced `cubit_uno_{id}` / `cubit_multi_{hash}` keys
- [x] Added `migrateIfNeeded()` for transparent legacy→uno migration with 30-day backup
- [x] Added `switchWorkspace` action and `activeWorkspaceType`/`activeWorkspaceId` to store
- [x] Created `WorkspaceSelector` component ("My Projects" / "Shared Projects")
- [x] Wired WorkspaceSelector into BookTabSidebar above project list
- [x] All 23 quick tests pass (19 unit + 4 CRDT)
- [x] All 14 sync tests pass (7 Chrome + 7 Safari)
- [x] Production build succeeds

---

## Epic 1: Workspace Infrastructure (Weeks 1–2) — COMPLETED (Session 3)

Goal: Implement the foundational data model and storage layer that separates
personalUno from personalMulti, so that all subsequent features build on clean
workspace isolation.

### 1.1 Generate persistent device identity ✅
- Created `src/lib/identity.ts` with `getDeviceId()`, `getDeviceLabel()`, `getUnoWorkspaceId()`
- Persistent UUIDs stored in localStorage
- `getStorageKey()` builds namespace keys per workspace type

### 1.2 Add workspace metadata to project schema ✅
- Added `workspaceType`, `workspaceId`, `ownerId`, `teamId?`, `objectiveId?` to `TodoProjectSchema`
- Added `WorkspaceTypeEnum` Zod schema with defaults
- Updated `bindTodoProjectToYMap` and `extractTodoProjectFromYMap` in yjsHelpers
- All new projects stamped with active workspace metadata

### 1.3 Namespace IndexedDB storage by workspace ✅
- Replaced single `cubit_connect_project_v1` with `cubit_uno_{id}` / `cubit_multi_{hash}`
- `storageService.getProject()` and `saveProject()` accept workspace params
- `clearProject()` is workspace-scoped
- Auto-save subscription passes active workspace to save

### 1.4 Migrate existing data to personalUno namespace ✅
- `storageService.migrateIfNeeded()` detects legacy key, copies to uno namespace
- Projects stamped with `workspaceType: 'personalUno'` during migration
- Old key kept as backup; `cleanupLegacyBackup()` removes after 30 days
- Migration flag in localStorage prevents re-migration

### 1.5 Workspace selector UI ✅
- Created `src/components/WorkspaceSelector.tsx` with "My Projects" / "Shared Projects" tabs
- Wired into `BookTabSidebar.tsx` above the project list
- "Shared Projects" opens sync modal if not connected
- Connected state shows green shield icon

---

## Epic 2: Personal-Multi Stabilization (Weeks 2–4) — PARTIALLY COMPLETE (Session 3b)

Goal: Make the personalMulti sync experience reliable enough for daily use
across 2–3 personal devices.

### 2.1 Scope personalUno Y.Doc isolation ✅
- Y.Doc is now mutable (`let` not `const`); `resetYDoc()` creates a fresh instance
- `switchWorkspace()` calls `resetYDoc()` before loading new namespace
- personalUno Y.Doc is never attached to NetworkSync (switchWorkspace disconnects)
- Reconnecting to same room preserves offline edits (no Y.Doc reset)

### 2.2 Robust disconnect/reconnect UX ✅
- `connectToSyncServer()` auto-switches workspace to personalMulti with roomIdHash
- Disconnect preserves data in IDB namespace; user stays in personalMulti (offline)
- Manual switch back to personalUno via WorkspaceSelector
- Todo page shows "Local Only" badge in personalUno, sync badges in personalMulti
- WorkspaceSelector shows WifiOff icon when personalMulti is active but disconnected

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
| **3** | Epic 1 | Device identity + schema + namespace + migration + workspace UI ✅ | Complete |
| **3b** | Epic 2 (2.1–2.2) | Y.Doc isolation + disconnect/reconnect UX ✅ | Complete |
| **4** | Epic 2 (2.3–2.5) | Stress tests + storage quota + incremental persistence | 6–8 hrs |
| **5** | Epic 2 | Encryption/stress tests + storage quota + incremental persistence | 4–6 hrs |
| **6** | Epic 3 | Error boundary + a11y fixes + mobile nav | 4–6 hrs |
| **7** | Epic 3 | Ownership tracking + observer optimization + stabilization | 4–6 hrs |
| **8** | Epic 4 | Team architecture ADRs + manager route scaffold | 4–6 hrs |
