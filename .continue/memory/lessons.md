# Lessons Learned — Cubit Connect

## How to Use This File
This is an append-only log of corrections and lessons given to Kimi. It prevents repeated mistakes across sessions.

---

## Date: 2026-05-19
## Topic: Yjs Origin String Consistency in Sync Bridges
## Context: SYNC-001 debug showed that updates received via Supabase Realtime merged into the Y.Doc but didn't update the UI.
## Lesson: Origin strings act as an implicit trust and communication boundary in Yjs sync bridges. The origin used when applying inbound updates (e.g., in `supabaseSyncProd.ts`) must exactly match the origin that the store observer (e.g., `useAppStore.ts`) filters for. Changing one without the other silently breaks the UI re-render bridge without raising any compilation or runtime errors. Standardize on `'network'` globally for all incoming network-synced updates.
## Related: active-issues.md (SYNC-001)

---

## Date: 2026-05-19
## Topic: AI Self-Assessment Accuracy
## Context: Multiple AI models assessed the same codebase and reached conflicting conclusions.
## Lesson: AI models hallucinate file counts and directory states when not reading carefully. Always verify with ls/read_file before stating facts about the filesystem. Kimi initially claimed 7+10 rule files; actual count was 6+9. Windsurf claimed directories were empty; they were not.
## Related: GRAVEYARD.md TRAP-007 (Verification Skip)

---

## Date: 2026-03-27
## Topic: Yjs Handler Registration Lifecycle
## Context: SYNC-001 debug showed Yjs update handlers registered on old ydoc instances after resetYDoc() creates new ones.
## Lesson: Event listeners do NOT transfer to new Y.Doc instances. When resetYDoc() is called, ALL handlers must be re-registered on the new instance. The handler must be inside resetYDoc() itself, not in functions that call it.
## Related: SYNC001_CONTEXT.md, GRAVEYARD.md ACTIVE ISSUES

---

## Date: 2026-03
## Topic: Playwright waitForFunction Closures
## Context: Tests failed with `ReferenceError: projA is not defined` in browser context.
## Lesson: Playwright's waitForFunction runs in browser context. Closure variables from Node.js test context are NOT available. Always pass arguments explicitly: `await page.waitForFunction((name) => check(name), projA)`.
## Related: GRAVEYARD.md SYNC-002

---

## Date: 2026-03
## Topic: Rebuild Before E2E After Store Changes
## Context: New Zustand actions were not available in Playwright browser context.
## Lesson: Playwright tests use the static `out/` build, NOT dev mode. Always run `npx next build` before E2E tests after modifying the store, actions, or any runtime code.
## Related: .cursor/rules/README.md "Lessons Learned" section

---

## Date: 2026-03
## Topic: Safari Y.Text Concurrent Edit Behavior
## Context: Safari WebKit produced duplicate tokens when two devices edited the same Y.Text field concurrently.
## Lesson: Use `toContain` assertions for cross-browser CRDT text tests, not exact equality. WebKit's character-level interleaving is non-deterministic.
## Related: .cursor/rules/README.md "Lessons Learned" section

---

## Date: 2026-02
## Topic: AI Double-Execution Prevention
## Context: User clicked "Cubit" once, two API calls fired.
## Lesson: React StrictMode double-mounts. Always use useRef lock OR Zustand machine state for one-shot operations. Never rely on React component lifecycle alone.
## Related: GRAVEYARD.md AI-001

---

## Date: 2026-02
## Topic: Rate Limiting and Circuit Breaker
## Context: App crashed with 429 errors when user rapidly clicked AI features.
## Lesson: MIN_DELAY_MS = 2000 between ALL AI calls. Implement circuit breaker (Primary → Fallback → Error). Show user-friendly message on quota exceeded, not raw error.
## Related: GRAVEYARD.md AI-002

---

## Date: 2026-01
## Topic: IndexedDB Migration Safety
## Context: Users lost projects after workspace model migration.
## Lesson: NEVER delete old data immediately. Always 30-day backup retention. Always set migration flag to prevent re-migration. Test migration on sample data before release.
## Related: GRAVEYARD.md DATA-001

---

## Date: 2025-12
## Topic: Video Capture Event-Driven Pattern
## Context: Screenshots were off by 0.5s because we captured before video seek completed.
## Lesson: ALWAYS wait for `video.onseeked` event. NEVER loop through timestamps synchronously. Use recursive function/queue with event listeners.
## Related: GRAVEYARD.md VIDEO-001, master_calibration.md Graveyard Trap 9
