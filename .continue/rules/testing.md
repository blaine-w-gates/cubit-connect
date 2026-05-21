# Cubit Connect — Testing Standards & Protocols

## The Vibe Coder Testing Rule
Because the user does not code, all new features must be easily verifiable. Every contribution must pass automated verification or include a clear, step-by-step manual verification plan for the human operator.

## Test Tiers (use the right one for the job)

| Tier | Command | What It Runs | Time | When to Use |
|------|---------|-------------|------|-------------|
| **Quick** | `npm run test:quick` | Vitest unit tests + CRDT physics on Chrome | ~2 min | After logic/store/schema changes |
| **Sync** | `npm run test:sync` | Sync E2E on Chrome + Safari | ~5 min | After any sync/network/encryption changes |
| **Full** | `npm run test:full` | All tests on all 13 devices | ~30 min | Before releases, after UI/layout changes |
| **Perf** | `npm run test:perf` | Lighthouse audit (Chromium) | ~2 min | After performance-sensitive changes |
| **Unit** | `npm run test` | Vitest only (no Playwright) | ~30s | After pure utility/schema changes |

### Decision Guide
- Changed a Zustand action or schema? → `test:quick`
- Changed networkSync, cryptoSync, or sync UI? → `test:sync`
- Changed layout, CSS, or responsive behavior? → `test:full`
- Changed only a test or test helper? → run that specific test file
- Ready to push? → `test:full` (or at minimum `test:quick` + `test:sync`)

### Prerequisites
All Playwright tiers require a production build:
```bash
npx next build
```
If you changed the store or any runtime code, you MUST rebuild before running Playwright tests — the browser uses the static `out/` build, not dev mode.

## Test Infrastructure

### Playwright E2E (13 device presets)
| Category | Devices |
|----------|---------|
| Desktop | Chrome, Firefox, Safari, Edge |
| iPad/Tablet | iPad Safari (portrait + landscape), iPad Pro Safari (portrait + landscape), Galaxy Tab |
| Mobile | Mobile Safari (iPhone 12), Mobile Safari Mini (iPhone SE), Mobile Chrome (Pixel 5), Galaxy S21 |

### Raw Commands (for manual use)
```bash
# Single device
npx playwright test --project="Desktop Chrome" --ignore-snapshots --reporter=line --workers=2

# Sync tests only (2 devices for coverage)
npx playwright test --project="Desktop Chrome" --project="Desktop Safari" tests/e2e/sync.spec.ts --ignore-snapshots --reporter=line --workers=1

# All 13 devices (sequential per-project for reliability)
for proj in "Desktop Chrome" "Desktop Firefox" "Desktop Safari" "Desktop Edge" \
            "iPad Safari" "iPad Safari Landscape" "iPad Pro Safari" "iPad Pro Safari Landscape" \
            "Galaxy Tab" "Mobile Safari" "Mobile Safari Mini" "Mobile Chrome" "Galaxy S21"; do
  npx playwright test --project="$proj" --ignore-snapshots --reporter=line --workers=2 || exit 1;
done
```

### Vitest Unit Tests
```bash
npm run test          # run once
npm run test:watch    # watch mode for development
npm run test:ui       # Vitest UI dashboard
```

### Current Test Count
- **Playwright**: 37+ tests per device × 13 devices + 7 sync tests + 1 Lighthouse
- **Vitest**: 6 unit test files (validation, storage perf, selectors, gemini rate limit, export, store reproduction)
- **Required: 0 skipped, 0 failed**

## Test Files Reference Map
| File | Tests | What it covers | Tier |
|------|-------|---------------|------|
| `tests/accessibility.spec.ts` | 2 | Landing + Engine page WCAG compliance | full |
| `tests/cross-browser.spec.ts` | 9 | Touch targets, viewport, clipboard, dark mode, safe-area, modals | full |
| `tests/scout.spec.ts` | 2 | Scout feature happy path + platform toggle | full |
| `tests/stress.spec.ts` | 9 | Route protection, crash resilience, persistence, layout, API errors | full |
| `tests/waitlist.spec.ts` | 2 | Engine manifesto grid + analysis flow | full |
| `tests/e2e/crdt-physics.spec.ts` | 4 | CRDT typing perf, cursor position, tombstones, Y.Doc persistence | quick |
| `tests/e2e/production-ready.spec.ts` | 4 | Text mode, markdown, video memory, step auto-expansion | full |
| `tests/e2e/qa-hardening.spec.ts` | 3 | API quota (429), video source loss, empty DB | full |
| `tests/e2e/strike-verification.spec.ts` | 2 | Full ignition→scout→export flow, mobile scout presence | full |
| `tests/e2e/sync.spec.ts` | 7 | Multi-device sync scenarios (create, merge, offline, encryption) | sync |
| `tests/performance/lighthouse.spec.ts` | 1 | Lighthouse audit (Chromium only, separate project) | perf |
| `tests/unit/*.test.ts` | 6 files | Validation, storage, selectors, rate limits, export, store | quick (vitest) |

## Rules for New Tests & Playwright Patterns
1. **No skipped tests**: Never use `test.skip()` or `test.fixme()` in pushed code — fix it or delete it.
2. **Timeouts**: Use `test.setTimeout(60000)` for tests with landing-page navigation flows.
3. **Ambiguity**: Use `.first()` on locators that might match multiple elements to prevent Playwright exceptions.
4. **Mobile Scroll**: Use `scrollIntoView({ block: 'center' })` before interacting on mobile viewports.
5. **Layout branching**: Check viewport width, not the `isMobile` flag, for layout-specific branches.
6. **Zustand tracking**: Use `waitForFunction` for store state assertions (`window.__STORE__.getState()`).
7. **API Mocking**: Mock ALL Gemini API calls — never hit real production APIs during testing.
8. **CRDT Isolation**: For CRDT tests, use `resetProject()` not `fullLogout()` to avoid redirect races.
9. **Sync isolation**: For sync tests, use `flushSyncNow()` + `reconnectAndCatchUp()` for deterministic sync points.
10. **Text Assertions**: Use `toContain` (not `toBe`) for Y.Text assertions that may vary across Safari/WebKit engines.

## Sync Test Helpers (`tests/e2e/sync.spec.ts`)
| Helper | Purpose |
|--------|---------|
| `setupDevice(browser)` | Create fresh browser context with API key, navigate to `/todo` |
| `connectDevice(page, passphrase)` | Connect to sync room and wait for `connected` status |
| `waitForProject(page, name)` | Poll store until named project appears |
| `waitForTaskInAnyProject(page, taskName)` | Poll store for task across all projects |
| `reconnectAndCatchUp(page, passphrase)` | Disconnect → reconnect → force full state exchange |
| `flushSyncNow()` (store action) | Force immediate `broadcastCheckpoint` |

## Manual Verification Protocol
When automated testing is not feasible (e.g. initial sandbox styling), provide a structured Verification Plan:
1. Exact click-by-click instructions.
2. Expected visual/functional outcome.
3. Error instructions: Paste any console or command error logs back into chat.

## Viewport & Device Gotchas
- iPhone SE (320px): "Engine" badge hidden (min-[360px]:inline-block).
- iPad Pro Landscape (1194px): `isMobile=true` but renders desktop layout (>768px).
- Galaxy Tab (800px): `isMobile=true` but renders desktop layout (>768px).
- Virtuoso: Only renders list items near scroll position — scroll to items before asserting.
- Safari WebKit: May duplicate tokens in concurrent Y.Text edits — use `toContain` assertions.

## Debt Warning
If the user asks to skip testing or ship quickly, warn once about the potential accumulation of technical debt, then proceed if they insist.
