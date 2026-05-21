# Architectural Decisions — Cubit Connect

## How to Use This File
This is an append-only log of architecture decisions that must persist across sessions. Kimi reads this on every new chat to avoid re-deciding already-settled questions.

---

## Date: 2026-04-26
## Topic: Legacy Sync System Deletion
## Context: Custom WebSocket relay was unreliable and complex to maintain.
## Decision: Deleted `src/lib/networkSync.ts`, `sync-server/`, and all legacy sync tests. Replaced with Supabase Realtime per ADR-001.
## Rationale: Managed infrastructure, better scalability, official support, PostgreSQL-backed persistence.
## Rejected Alternatives: Keep WebSocket relay (unreliable), rewrite relay (high effort, no guarantee).
## Related: docs/adr-001-workspace-model.md, docs/GRAVEYARD.md (DELETED COMPONENTS section)

---

## Date: 2026-03-15
## Topic: Workspace-Scoped Data Model (ADR-001)
## Context: All projects were a single flat collection with no privacy/sharing distinction.
## Decision: Adopt three-tier workspace model: personalUno (local), personalMulti (E2EE sync), teamWorkspace (future server-authoritative).
## Rationale: Enables multi-device sync, future team features, and clear data isolation.
## Rejected Alternatives: Per-project sharing (complex), manual export/import (poor UX).
## Related: .cursor/rules/adr-001-workspace-model.md

---

## Date: 2026-03
## Topic: Defer y-indexeddb Adoption (ADR-002)
## Context: `y-indexeddb` would store incremental Yjs updates instead of full state snapshots.
## Decision: DEFER. Keep current full-state save every 500ms.
## Rationale: Full state is typically < 1MB. No user-reported performance issues. Refactor touches loadProject, resetYDoc, migration, workspace switching — high regression risk.
## Revisit When: Doc size exceeds ~5MB, team features significantly grow Y.Doc, or battery-sensitive devices report slow saves.
## Related: docs/adr-002-y-indexeddb-evaluation.md

---

## Date: 2026-01
## Topic: API Key Storage
## Context: API keys were stored in localStorage unencrypted.
## Decision: Encrypt API keys via `src/lib/crypto.ts` before storing in localStorage.
## Rationale: Prevents trivial credential exposure if device is compromised.
## Related: master_calibration.md Phase 5 deliverables

---

## Date: 2025-12
## Topic: Video Screenshot Capture Method
## Context: Screenshots didn't match transcript timestamps (off by 0.5s).
## Decision: Wait for `video.onseeked` event + 0.5s buffer for transition fades.
## Rationale: Video seeking is async. Capturing before seeked fires produces wrong frames.
## Related: GRAVEYARD.md VIDEO-001
