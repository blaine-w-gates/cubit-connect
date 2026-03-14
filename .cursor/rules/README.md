# Cubit Connect — AI Assistant Instructions

## About This Project
Cubit Connect is an AI-powered knowledge distillation tool with a collaborative
task management system. The owner is a designer (not a programmer) who uses
"vibe coding" — describing what they see and want in plain language. The AI
assistant is responsible for all technical decisions, implementation, testing,
and quality assurance.

## Current Phase (updated March 15, 2026)

**Phase: Personal Stabilization (Weeks 1–6)**

Session 1 established the codebase: 481 E2E tests across 13 devices, cursor
rules, structured workflows. Session 2 fixed 3 critical sync bugs (timer leak,
passphrase reconnect, loadProject race), added sync status UI, created 7
multi-device sync E2E tests, and pushed at 91eef68. Session 3 implemented
Epic 1 (Workspace Infrastructure): device identity, schema metadata,
namespaced IndexedDB storage, legacy data migration, and workspace selector UI.

Current focus:
- Stabilizing personalMulti Y.Doc isolation and disconnect UX (Epic 2).
- Stress testing multi-device sync with 3+ devices.
- NOT building team/subscription features yet.

### Milestone Targets
| Week | Deliverable |
|------|-------------|
| 1–2 | Architecture docs locked, fast test scripts, schema migration design |
| 3–4 | Workspace selector UI, storage namespacing, personal-uno isolation |
| 5–6 | Personal-multi stabilization, disconnect UX, release-quality sync |

## Lessons Learned (carry forward)

1. **Rebuild after store changes** — new Zustand actions are not available in
   the Playwright browser context until `npx next build` is run. Always
   rebuild before E2E testing after modifying the store.
2. **Safari Y.Text merging** — Safari WebKit can produce duplicate tokens when
   two devices edit the same Y.Text field concurrently. Use `toContain`
   assertions for cross-browser CRDT text tests, not exact equality.
3. **Deterministic sync in tests** — passive 30-second idle checkpoints are
   too slow for tests. Use `flushSyncNow()` + `reconnectAndCatchUp()` helpers
   to force checkpoint exchange at test-defined sync points.
4. **30-minute full test suite** — running all 13 devices × 37+ tests takes
   ~30 minutes. Use tiered test commands (`test:quick`, `test:sync`,
   `test:full`) to match iteration speed to the type of change.
5. **Sync E2E flakiness** — network-dependent tests are inherently flaky.
   Always seed state, flush sync explicitly, and reconnect before assertions.
   Never rely on implicit timing.

## Calibration Guidance for New AI Instances

If you are a new AI instance picking up this project:

1. **Read ALL cursor rules first** — the files in `.cursor/rules/` are the
   single source of truth for architecture, sync protocol, testing standards,
   and workflow modes. They are kept up to date.
2. **Check the ADR log** — `.cursor/rules/adr-*.md` files record architectural
   decisions. Read them before proposing changes to data models or sync.
3. **Run `test:quick` first** — before making changes, verify the baseline
   passes. If it doesn't, fix regressions before new work.
4. **The owner describes intent, not code** — translate their descriptions
   into technical plans. Confirm scope before implementing.
5. **Workspace model is locked** — personalUno, personalMulti, and (future)
   teamWorkspace. Do not invent new tiers or change the isolation rules
   without an ADR.
6. **The store is the center of gravity** — `src/store/useAppStore.ts` is
   ~1200 lines and owns all state. Understand it before editing.

## How to Work With the Owner
1. **Listen for intent, not implementation details** — when the owner says
   "the sync isn't working right," investigate the full sync system, don't
   just fix the surface symptom
2. **Show, don't tell** — use screenshots, test results, and before/after
   comparisons instead of technical explanations
3. **Confirm before large changes** — for changes touching >5 files or
   architectural decisions, present the plan first
4. **Zero tolerance for regressions** — run tests after every change;
   maintain the full pass rate across 13 devices

## Workflow (follow this order)

### Step 1: Understand (PLAN)
- Read the relevant cursor rules in `.cursor/rules/`
- Read the affected source files
- Restate the problem in plain language
- Identify all affected files and data flows
- For complex changes: present pseudocode/architecture, get confirmation

### Step 2: Implement (ENGINEER)
- Follow the plan exactly
- Small, testable increments
- Run lints after edits
- Yjs changes inside `ydoc.transact()`
- Use soft-delete tombstones, never physical delete

### Step 3: Verify (REVIEW + TEST)
- Self-review for race conditions, trust boundaries, missing error handling
- `npx next build` must succeed
- Choose appropriate test tier:
  - `npm run test:quick` — unit + CRDT tests (~2 min) — use for logic changes
  - `npm run test:sync` — sync E2E on Chrome + Safari (~5 min) — use for sync changes
  - `npm run test:full` — all 13 devices (~30 min) — use before releases
- For sync changes: test with 2+ browser contexts

### Step 4: Ship (COMMIT + PUSH)
- Commit message format: `type(scope): description`
- Push to `main`
- Report results to the owner with confidence level

## Reference Documents
- `.cursor/rules/architecture.md` — Stack, files, Yjs structure, workspace model, pages
- `.cursor/rules/adr-001-workspace-model.md` — Workspace architecture decision record
- `.cursor/rules/workflow.md` — Cognitive modes, testing infra, file org
- `.cursor/rules/sync-system.md` — Sync architecture, bugs, offline, roadmap
- `.cursor/rules/testing.md` — Test devices, commands, tiers, rules, gotchas
- `tasks/MASTER_TASK_LIST.md` — Prioritized implementation epics
- `docs/roadmap.md` — Product roadmap
- `docs/product_requirement_docs.md` — PRD
- `DEPLOY_SYNC_SERVER.md` — Sync relay deployment
