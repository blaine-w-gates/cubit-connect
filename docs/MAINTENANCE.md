# Maintenance Protocol: Keeping Cubit on the Bleeding Edge

This document outlines the scheduled checks required to keep Cubit Connect robust, secure, and compatible with the latest AI advancements.

## 🕒 Weekly Checks

### 1. The Gemini Pulse Check

**Why:** Google Gemini models iterate rapidly. Deprecation emails are often the only warning.
**Action:**

1.  Check the [Google AI Studio Models Page](https://aistudio.google.com/).
2.  Verify if our current models are still active:
    - **Primary:** `gemini-2.5-flash` — Active? Free Tier? Rate Limit Stable?
    - **Fallback:** `gemini-2.5-flash-lite` — Active? Free Tier?
3.  If a new model is released, bench-test in `src/services/gemini.ts` by updating `PRIMARY_MODEL` / `FALLBACK_MODEL`.
4.  Check the circuit breaker cooldown duration (currently 60s) is appropriate.

### 2. Dependency Audit

**Why:** Next.js and Tailwind iterate fast. Security vulnerabilities appear weekly.
**Action:**

1.  Run `npm audit`. Fix high-severity issues immediately.
2.  Run `npm outdated`. Look for major version bumps in:
    - `next`
    - `@google/generative-ai`
    - `tailwindcss`
    - `zod`
3.  _Note:_ Do not blindly upgrade `idb-keyval` or `zustand` without testing persistence.

### 3. Mobile Smash Check

**Why:** Mobile browsers (Safari especially) change viewport logic frequently.
**Action:**

1.  Open the app in Chrome DevTools "iPhone SE" mode.
2.  Check the Header: Do the hamburger menu items overlap?
3.  Check the "Ignition" form: Is the keyboard covering the input?

## 🗓️ Monthly Checks

### 1. The "Clean Enterprise" Review

**Why:** Features creep in. Styles drift.
**Action:**

1.  Scan for any Dark/Light Mode inconsistencies (e.g., hardcoded backgrounds).
2.  Verify `globals.css` hasn't bloated with unused `@layer components`.
3.  Test `ThemeSelector.tsx` toggle in both modes.

### 2. Performance Budget (Lighthouse)

**Why:** We promised <100ms interaction.
**Action:**

1.  Run `npm run test:perf`.
2.  Ensure Accessibility score is >90.
3.  Ensure "Time to Interactive" is <1.5s on 4G.

### 3. Test Suite Integrity

**Why:** Tests rot. E2E tests are known to flake under CI.
**Action:**

1.  Run `npm test` 5 times in a row.
2.  If flake > 20%, refactor the test.
3.  Run `npx playwright test` and verify E2E pass rate.

### 4. Schema Validation Audit

**Why:** Zod schemas in `src/schemas/` are the contract between storage and UI.
**Action:**

1.  Compare `src/schemas/storage.ts` interfaces against `docs/data_models.md`.
2.  Ensure `src/lib/validation.ts` parsers match `src/schemas/gemini.ts`.

## 🚨 Emergency Protocols

**If Gemini API Returns 404/410 (Deprecated):**

1.  Update `PRIMARY_MODEL` and/or `FALLBACK_MODEL` in `src/services/gemini.ts`.
2.  The circuit breaker will auto-switch to fallback, but both models may need updating.
3.  Deploy hotfix.

**If LocalStorage Wipe Occurs:**

1.  Verify `idb-keyval` integrity (IndexedDB stores project data, not LocalStorage).
2.  API keys in LocalStorage are encrypted — verify `src/lib/crypto.ts` still decrypts.
3.  Remind users to use the "Export Project" JSON backup feature.
