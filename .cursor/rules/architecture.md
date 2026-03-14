# Cubit Connect — Architecture Reference

## Stack
- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, Framer Motion
- **State**: Zustand (single store: `src/store/useAppStore.ts`)
- **Real-time Sync**: Yjs (CRDT) over WebSocket relay
- **Encryption**: AES-256-GCM via Web Crypto API (`src/lib/cryptoSync.ts`)
- **Persistence**: IndexedDB via `idb-keyval` (`src/services/storage.ts`)
- **AI**: Google Gemini (`@google/generative-ai`)
- **Testing**: Playwright (E2E, 13 device presets), Vitest (unit)
- **Deployment**: GitHub Pages (static export), Render (sync relay), Upstash Redis (cache)

## Key Files
| File | Role |
|------|------|
| `src/store/useAppStore.ts` | Single Zustand store. Yjs doc, observers, all actions. ~1200 lines. |
| `src/lib/networkSync.ts` | WebSocket sync: dual-band (live diffs + checkpoints), E2EE, reconnect |
| `src/lib/cryptoSync.ts` | PBKDF2 key derivation, AES-256-GCM encrypt/decrypt, room ID hashing |
| `src/lib/yjsHelpers.ts` | Yjs ↔ TypeScript bindings for projects, rows, steps, tasks |
| `src/services/storage.ts` | IndexedDB persistence via idb-keyval |
| `src/schemas/storage.ts` | Zod schemas for stored data including yjsState blob |
| `sync-server/server.js` | WebSocket relay: room routing, Redis checkpoint/diff cache |
| `src/components/SyncSetupModal.tsx` | Sync UI: passphrase, connect/disconnect, fingerprint |

## Yjs Document Structure
```
Y.Doc (gc: false)
├── yProjectsMap (Y.Map<Y.Map>)  — Todo projects, each containing:
│   ├── id, name (Y.Text), color, orderKey
│   ├── todoRows (Y.Map<Y.Map>) — task rows with fractional ordering
│   └── priorityDials (Y.Map)
├── yTasksMap (Y.Map<Y.Map>)     — Video/engine tasks (task_name, description, sub_steps)
├── yMetaMap (Y.Map)              — projectType, scoutHistory, etc.
└── yTranscript (Y.Text)          — Video transcript
```

## Sync Flow
1. User enters passphrase → `deriveRoomId()` + `deriveKey()` via PBKDF2
2. WebSocket connects to relay with `?room=<hash>`
3. On connect: `MSG_REQUEST_CACHE` → server sends latest checkpoint + up to 100 diffs
4. `catchUpLock` prevents processing live diffs until checkpoint merged
5. Local edits → `ydoc.on('update')` → `broadcastUpdate()` (encrypted live diff)
6. After 30s idle: `broadcastCheckpoint()` (encrypted full state)
7. Remote edits → decrypt → `Y.applyUpdate(ydoc, data, 'network')` → Zustand re-render

## Critical Patterns
- All Yjs mutations MUST use `ydoc.transact()` to batch changes
- Network updates use `origin: 'network'` to prevent echo broadcast
- Soft-delete via `isDeleted: true` tombstone (never physically delete Yjs entries)
- Auto-save to IndexedDB: 500ms debounce after any store change
- Store exposes `__STORE__` on window for Playwright test access

## Workspace-Scoped Data Model (ADR-001)

See `.cursor/rules/adr-001-workspace-model.md` for the full decision record.

### Workspace Types
| Workspace | Storage | Sync | In Scope |
|-----------|---------|------|----------|
| `personalUno` | IndexedDB (browser-local) | None | Now |
| `personalMulti` | IndexedDB + E2EE relay | Yjs over WebSocket | Now |
| `teamWorkspace` | Server DB (future) | Server-authoritative | Deferred |

### Project Scope Metadata (added to every project)
```typescript
interface WorkspaceMetadata {
  workspaceType: 'personalUno' | 'personalMulti' | 'teamWorkspace';
  workspaceId: string;
  ownerId: string;
  teamId?: string;
  objectiveId?: string;
}
```

### Identity Model
| Concept | Storage | Notes |
|---------|---------|-------|
| `deviceId` | localStorage | `crypto.randomUUID()` on first visit |
| `deviceLabel` | localStorage | User-editable device name |
| `workspaceId` (uno) | localStorage | Isolates uno namespace in IDB |
| `workspaceId` (multi) | Derived from passphrase | Same as `roomId` |

### IndexedDB Namespaces
- `cubit_uno_{workspaceId}` — personal local projects
- `cubit_multi_{roomIdHash}` — synced project cache
- `cubit_team_{teamId}` — team cache (future)

Migration: existing `cubit_connect_project_v1` → `cubit_uno_{id}` on first load.

### Data Isolation Rules
1. `personalUno` data NEVER leaves the browser.
2. `personalMulti` data is E2EE; relay sees only ciphertext.
3. `workspaceType` is immutable after creation; sharing = explicit copy.
4. UI filters projects by active workspace.

## Pages
| Route | Purpose |
|-------|---------|
| `/` | Landing page (API key entry) |
| `/engine` | Video analysis engine (upload, analyze, results) |
| `/todo` | Collaborative task board (projects, rows, steps, sync) |
| `/sandbox` | Design sandbox |
