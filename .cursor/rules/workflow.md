# Cubit Connect — AI Workflow Rules

These rules define how AI assistants should work on this project. Inspired by
structured workflow modes (plan → engineer → review → test → ship).

## Cognitive Modes

### 1. PLAN Mode (before writing code)
- Restate the problem from the user's perspective
- Ask: "What is the real product need hiding inside this request?"
- Identify affected files, components, and data flows
- Produce pseudocode or architecture diagram for complex changes
- List edge cases, failure modes, and test requirements
- Get user confirmation before proceeding to implementation

### 2. ENGINEER Mode (implementation)
- Follow the plan exactly; do not improvise scope
- Make changes in small, testable increments
- Run lint checks after every substantive edit
- Prefix event handlers with `handle` (e.g., `handleClick`)
- All Yjs mutations inside `ydoc.transact()`
- Never physically delete Yjs entries — use `isDeleted: true` tombstones
- Use fractional indexing (`fractional-indexing`) for ordering

### 3. REVIEW Mode (before committing)
- Check for race conditions (especially in sync code)
- Verify trust boundaries (user input, network data, crypto)
- Look for N+1 patterns, stale reads, missing error handling
- Ensure no `test.skip()` or `test.fixme()` was introduced
- Verify dark mode classes on all new UI elements
- Check touch targets are ≥44px on interactive elements
- Verify `safe-area-inset-*` on fixed-position elements

### 4. TEST Mode (verification)
- Run `npx playwright test --project="Desktop Chrome" --ignore-snapshots`
- For cross-browser: run each of the 13 device presets individually
- All 481 tests must pass with 0 skipped
- New features require new E2E tests
- Performance-sensitive code needs the CRDT typing benchmark

### 5. SHIP Mode (commit and push)
- Run `npx next build` to verify production build
- Run lint: `npx eslint src/`
- Stage only relevant files (never commit .env or credentials)
- Write commit messages: `type(scope): description` format
- Push to `main` branch

## Testing Infrastructure
- **13 Playwright device presets**: Desktop Chrome/Firefox/Safari/Edge, iPad Safari (portrait + landscape), iPad Pro Safari (portrait + landscape), Galaxy Tab, Mobile Safari, Mobile Safari Mini, Mobile Chrome, Galaxy S21
- **Test files**: `tests/` (root-level E2E), `tests/e2e/` (CRDT, production, QA, strikes), `tests/performance/` (Lighthouse)
- **Global timeout**: 60s per test
- **Web server**: `npx serve -s out` on localhost:3000

## Sync System Rules
- The sync relay is at `wss://cubit-sync-relay.onrender.com`
- Redis checkpoint/diff cache has 7-day TTL
- Always test sync changes with at least 2 browser contexts
- E2EE: passphrase → PBKDF2 → AES-256-GCM; room ID is SHA-256 hash
- `catchUpLock` prevents processing live diffs during initial sync
- Watchdog at 2.5s unlocks if no checkpoint arrives (empty room case)

## File Organization
- Components: `src/components/` (flat) + `src/components/todo/` (todo-specific)
- Store: single file `src/store/useAppStore.ts` (Zustand + Yjs)
- Sync: `src/lib/networkSync.ts`, `src/lib/cryptoSync.ts`, `src/lib/yjsHelpers.ts`
- Storage: `src/services/storage.ts`, `src/schemas/storage.ts`
- Tests: `tests/` (Playwright E2E), `src/tests/` (Vitest unit)

## Communication Style
- The project owner is a designer, not a programmer
- Explain technical decisions in plain language
- Use screenshots and visual evidence when debugging UI issues
- Always state what changed, why, and what to test manually
