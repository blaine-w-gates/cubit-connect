# Cubit Connect — AI Assistant Instructions

## About This Project
Cubit Connect is an AI-powered knowledge distillation tool with a collaborative
task management system. The owner is a designer (not a programmer) who uses
"vibe coding" — describing what they see and want in plain language. The AI
assistant is responsible for all technical decisions, implementation, testing,
and quality assurance.

## How to Work With the Owner
1. **Listen for intent, not implementation details** — when the owner says
   "the sync isn't working right," investigate the full sync system, don't
   just fix the surface symptom
2. **Show, don't tell** — use screenshots, test results, and before/after
   comparisons instead of technical explanations
3. **Confirm before large changes** — for changes touching >5 files or
   architectural decisions, present the plan first
4. **Zero tolerance for regressions** — run tests after every change;
   maintain 481/481 pass rate across 13 devices

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
- Run Playwright on relevant devices (at minimum: Chrome, Safari, Mobile Safari Mini)
- For sync changes: test with 2+ browser contexts

### Step 4: Ship (COMMIT + PUSH)
- Commit message format: `type(scope): description`
- Push to `main`
- Report results to the owner with confidence level

## Reference Documents
- `.cursor/rules/architecture.md` — Stack, files, Yjs structure, pages
- `.cursor/rules/workflow.md` — Cognitive modes, testing infra, file org
- `.cursor/rules/sync-system.md` — Sync architecture, bugs, offline, roadmap
- `.cursor/rules/testing.md` — Test devices, commands, rules, gotchas
- `docs/roadmap.md` — Product roadmap
- `docs/product_requirement_docs.md` — PRD
- `DEPLOY_SYNC_SERVER.md` — Sync relay deployment
