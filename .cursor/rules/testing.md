# Cubit Connect — Testing Standards

## Test Infrastructure

### Playwright E2E (13 device presets)
| Category | Devices |
|----------|---------|
| Desktop | Chrome, Firefox, Safari, Edge |
| iPad/Tablet | iPad Safari (portrait + landscape), iPad Pro Safari (portrait + landscape), Galaxy Tab |
| Mobile | Mobile Safari (iPhone 12), Mobile Safari Mini (iPhone SE), Mobile Chrome (Pixel 5), Galaxy S21 |

### Commands
```bash
# Single device
npx playwright test --project="Desktop Chrome" --ignore-snapshots --reporter=line --workers=2

# All devices (run sequentially per-project for reliability)
for proj in "Desktop Chrome" "Desktop Firefox" "Desktop Safari" "Desktop Edge" \
            "iPad Safari" "iPad Safari Landscape" "iPad Pro Safari" "iPad Pro Safari Landscape" \
            "Galaxy Tab" "Mobile Safari" "Mobile Safari Mini" "Mobile Chrome" "Galaxy S21"; do
  npx playwright test --project="$proj" --ignore-snapshots --reporter=line --workers=2
done

# Build first
npx next build
```

### Current Test Count
- **37 tests per device × 13 devices = 481 total**
- **Required: 0 skipped, 0 failed**

## Test Files
| File | Tests | What it covers |
|------|-------|---------------|
| `tests/accessibility.spec.ts` | 2 | Landing + Engine page WCAG compliance |
| `tests/cross-browser.spec.ts` | 9 | Touch targets, viewport, clipboard, dark mode, safe-area, modals |
| `tests/scout.spec.ts` | 2 | Scout feature happy path + platform toggle |
| `tests/stress.spec.ts` | 9 | Route protection, crash resilience, persistence, layout, API errors |
| `tests/waitlist.spec.ts` | 2 | Engine manifesto grid + analysis flow |
| `tests/e2e/crdt-physics.spec.ts` | 4 | CRDT typing perf, cursor position, tombstones, Y.Doc persistence |
| `tests/e2e/production-ready.spec.ts` | 4 | Text mode, markdown, video memory, step auto-expansion |
| `tests/e2e/qa-hardening.spec.ts` | 3 | API quota (429), video source loss, empty DB |
| `tests/e2e/strike-verification.spec.ts` | 2 | Full ignition→scout→export flow, mobile scout presence |
| `tests/performance/lighthouse.spec.ts` | 1 | Lighthouse audit (Chromium only, separate project) |

## Rules for New Tests
1. Never use `test.skip()` or `test.fixme()` — fix or delete
2. Use `test.setTimeout(60000)` for tests with landing-page navigation flow
3. Use `.first()` on locators that might match multiple elements
4. Use `scrollIntoView({ block: 'center' })` before interacting on mobile
5. Check viewport width, not `isMobile` flag, for layout branching
6. Use `waitForFunction` for Zustand store state checks
7. Mock ALL Gemini API calls — never hit real APIs
8. For CRDT tests, use `resetProject()` not `fullLogout()` to avoid redirect races

## Viewport Gotchas
- iPhone SE (320px): "Engine" badge hidden (min-[360px]:inline-block)
- iPad Pro Landscape (1194px): isMobile=true but renders desktop layout (>768px)
- Galaxy Tab (800px): isMobile=true but renders desktop layout (>768px)
- Virtuoso only renders items near scroll position — scroll to items before asserting
