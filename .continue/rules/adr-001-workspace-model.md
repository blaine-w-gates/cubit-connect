# ADR-001: Workspace-Scoped Data Model

Status: **Accepted** — March 15, 2026

## Context

Cubit Connect currently treats all projects as a single flat collection stored
in one IndexedDB key and optionally synced to a single E2EE relay room. There
is no distinction between projects the user wants to keep private on one
browser versus projects they want shared across their devices. This blocks the
product roadmap for personal multi-device sync, family/couple shared
accounts, and future team subscriptions.

## Decision

Adopt a three-tier workspace model. Only the first two tiers are in scope for
the next 6 weeks; the third tier is documented here so that schema decisions
made now do not conflict with it later.

### Workspace Types

| Workspace | Storage | Sync | Identity | Scope |
|-----------|---------|------|----------|-------|
| `personalUno` | IndexedDB (browser-local) | None | Anonymous browser (no account required) | Single browser tab/profile |
| `personalMulti` | IndexedDB + E2EE relay | Yjs over WebSocket | Passphrase-derived room + optional device UUID | Same person across browsers/devices |
| `teamWorkspace` | Server database (future) | Server-authoritative + Yjs awareness (future) | Authenticated user account (future) | Subscription-scoped team |

### Project Scope Fields (added to every project)

```typescript
interface WorkspaceMetadata {
  workspaceType: 'personalUno' | 'personalMulti' | 'teamWorkspace';
  workspaceId: string;   // For uno: browser-generated UUID stored in localStorage
                          // For multi: SHA-256 hash of passphrase (same as roomId)
                          // For team: server-assigned team ID (future)
  ownerId: string;        // For uno/multi: device UUID
                          // For team: authenticated user ID (future)
  teamId?: string;        // Only set for teamWorkspace (future)
  objectiveId?: string;   // Links project to an objective (future endeavor page)
}
```

### Data Isolation Rules

1. `personalUno` projects are NEVER broadcast over any network channel.
   They exist only in the browser's IndexedDB under a namespace key.
2. `personalMulti` projects sync only within the E2EE room derived from
   the user's passphrase. They are encrypted end-to-end; the relay and
   Redis cache see only ciphertext.
3. A project's `workspaceType` is immutable after creation. To "share" a
   personal-uno project, the user creates a copy in the personalMulti
   workspace (explicit action, not automatic).
4. The workspace selector in the UI shows only projects belonging to the
   active workspace. Switching workspaces swaps the visible project list
   and the active Yjs document context.

### Identity Model

| Concept | Storage | Purpose |
|---------|---------|---------|
| `deviceId` | `localStorage('cubit_device_id')` | Persistent per-browser identity; generated on first visit via `crypto.randomUUID()` |
| `deviceLabel` | `localStorage('cubit_device_label')` | User-editable name (e.g., "James's MacBook") |
| `workspaceId` (uno) | `localStorage('cubit_uno_workspace_id')` | Isolates uno projects in IndexedDB namespace |
| `workspaceId` (multi) | Derived from passphrase at connect time | Shared across devices that enter the same passphrase |

### IndexedDB Namespace Strategy

Instead of the current single key `cubit_connect_project_v1`, storage will
be namespaced:

- `cubit_uno_{workspaceId}` — personal-uno Yjs state + project data
- `cubit_multi_{roomIdHash}` — personal-multi Yjs state + project data
- `cubit_team_{teamId}` (future) — team workspace cache

The migration path for existing users: on first load after upgrade, all
existing projects are assigned `workspaceType: 'personalUno'` and moved to
the uno namespace. The old `cubit_connect_project_v1` key is kept as a
read-only backup for 30 days, then garbage-collected.

### Yjs Document Scoping

Each workspace gets its own `Y.Doc` instance:

- `personalUno`: standalone Y.Doc, never attached to NetworkSync.
- `personalMulti`: Y.Doc attached to NetworkSync with the user's
  passphrase-derived room.
- Switching workspaces disposes the current Y.Doc observers and
  re-initializes from the target namespace's IndexedDB state.

### Disconnect / Offline Behavior

| Event | personalUno | personalMulti |
|-------|-------------|---------------|
| Browser closed | Data persists in IndexedDB | Data persists in IndexedDB; unsynced edits flagged |
| Network lost | No effect | Edits continue locally; `hasUnsyncedChanges` set to true |
| Explicit disconnect | N/A | Data remains in local IndexedDB; sync badge shows "Offline" |
| Reconnect | N/A | Yjs CRDT auto-merges; `lastSyncedAt` updated; `hasUnsyncedChanges` cleared |
| Switch to different passphrase | N/A | Old room disconnected; new room connected; old data stays in its namespace |

### Future-Proofing for Team Workspace

The following are NOT implemented now but are reserved in the schema:

- `teamId` field on projects (nullable, unused for personal modes)
- `objectiveId` field on projects (nullable, links to future endeavor page)
- `role` field concept (owner/admin/member/viewer) documented but not enforced
- Scoreboard status derivation from rabbit position (contract defined, not built)

## Consequences

- Every project carries workspace metadata; UI filters by active workspace.
- Storage service needs workspace-aware load/save methods.
- Existing single-key storage requires a one-time migration.
- NetworkSync lifecycle is tied to workspace switching, not just
  connect/disconnect.
- The store interface grows by ~5 fields but gains clean separation.
