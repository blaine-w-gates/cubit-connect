# Maintenance Protocol: Keeping Cubit on the Bleeding Edge

This document outlines the scheduled checks required to keep Cubit Connect robust, secure, and compatible with the latest AI advancements.

## 🕒 Weekly Checks

### 1. The Gemini Pulse Check
**Why:** Google Gemini models iterate rapidly (e.g., `flash` -> `flash-lite` -> `pro`). Deprecation emails are often the only warning.
**Action:**
1.  Check the [Google AI Studio Models Page](https://aistudio.google.com/).
2.  Verify if `gemini-2.5-flash-lite` (our current model) is still:
    -   **Active** (not Deprecated).
    -   **Free Tier Eligible** (Critical for our users).
    -   **Rate Limit Stable** (Did they lower the RPM?).
3.  If a new model (e.g., `gemini-3.0`) is out, bench-test it in `src/services/gemini.ts`.

### 2. Dependency Audit
**Why:** Next.js and Tailwind iterate fast. Security vulnerabilities appear weekly.
**Action:**
1.  Run `npm audit`. Fix high-severity issues immediately.
2.  Run `npm outdated`. Look for major version bumps in:
    -   `next`
    -   `@google/generative-ai`
    -   `tailwindcss`
3.  *Note:* Do not blindly upgrade `idb-keyval` or `zustand` without testing persistence.

### 3. Mobile Smash Check
**Why:** Mobile browsers (Safari especially) change viewport logic frequently.
**Action:**
1.  Open the app in Chrome DevTools "iPhone SE" mode.
2.  Check the Header: Do the buttons overlap the Logo?
3.  Check the "Ignition" form: Is the keyboard covering the input?

## 🗓️ Monthly Checks

### 1. The "Clean Enterprise" Review
**Why:** Features creep in. Styles drift.
**Action:**
1.  Scan for any new "Dark Mode" inconsistencies (e.g., hardcoded white backgrounds).
2.  Verify `globals.css` hasn't bloated with unused `@layer components`.

### 2. Performance Budget (Lighthouse)
**Why:** We promised <100ms interaction.
**Action:**
1.  Run `npm run test:perf`.
2.  Ensure Accessibility score is >90.
3.  Ensure "Time to Interactive" is <1.5s on 4G.

### 3. Test Suite Integrity
**Why:** Tests rot. `gemini_rate_limit.test.ts` is known to flake.
**Action:**
1.  Run `npm test` 5 times in a row.
2.  If flake > 20%, refactor the test.

## 🚨 Emergency Protocols

**If Gemini API Returns 404/410 (Deprecated):**
1.  Immediately update `MODEL_NAME` in `src/services/gemini.ts`.
2.  Deploy hotfix to GitHub Pages/Render.

**If LocalStorage Wipe Occurs:**
1.  Verify `idb-keyval` integrity.
2.  Remind users to use the "Export Project" JSON backup feature.
