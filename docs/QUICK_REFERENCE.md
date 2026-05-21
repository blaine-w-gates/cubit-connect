# CUBIT CONNECT — AGENT QUICK REFERENCE
**One-page cheat sheet for fast lookup. Updated May 21, 2026.**

---

## 🚨 CURRENT STATE (May 21, 2026)

**Phase:** 6 COMPLETE — Auth & Identity deployed. Maintenance mode.
**Sync Transport:** Supabase Realtime (legacy WebSocket DELETED April 26, 2026)
**SYNC-001:** ✅ RESOLVED — Origin mismatch fixed in commit 881721a (May 19)
**Feature Flag:** USE_SUPABASE_SYNC defaults to false (Safe Mode)

---

## 📋 PHASE CHECKLIST

### Phase 0: Environmental Sanity Check (MUST RUN)
\`\`\`bash
npm run type-check  # Pass?
npm run lint        # Pass?
npm run test:quick  # Pass?
git status          # Clean?
\`\`\`

### Phase 1: Execute
- Work on ONE sub-task (< 2 hours)
- No scope creep

### Phase 2: Verify
- Deterministic proof required
- "Looks good" ≠ verification

### Phase 3: Commit
\`\`\`bash
git commit -m "[Agent] Verified completion: {Task}"
\`\`\`

---

## 🎯 COMMON COMMANDS

\`\`\`bash
# Development
npm run dev
npm run build

# Testing (NO test:sync script — deleted with legacy system)
npm run test              # Unit tests only (Vitest)
npm run test:quick        # Unit + CRDT physics E2E (~2 min)
npm run test:full         # All 13 device E2E presets (~30 min)
npm run test:perf         # Lighthouse audit

# Quality
npm run type-check
npm run lint
npm run format
\`\`\`

---

## 🎭 PLAYWRIGHT PATTERNS

### ✅ CORRECT
\`\`\`typescript
// Exact match selector
await page.getByRole("button", { name: "Task", exact: true }).click();

// Store evaluation for sync
await page.waitForFunction(() => 
  (window as any).__STORE__.getState().todoRows.length > 0
);

// Pass args explicitly (no closures!)
await page.waitForFunction(
  (name) => (window as any).__STORE__.getState().todoProjects.some(p => p.name === name),
  projectName
);
\`\`\`

### ❌ WRONG
\`\`\`typescript
// Ambiguous selector
await page.getByRole("button", { name: "Task" }).click();

// Closure variable (will fail!)
await page.waitForFunction(() => checkRow(projA));
\`\`\`

---

## 🔗 SYNC ARCHITECTURE (Current: Supabase Realtime)

```
Device A ←→ Supabase Realtime Channel ←→ Device B
```

- **Transport:** @supabase/supabase-js Realtime (not WebSocket)
- **Encryption:** AES-256-GCM, E2EE (passphrase-derived key)
- **Room:** SHA-256 hash of passphrase
- **Origin contract:** Inbound updates use "network" — must match registerYjsObserver() filter

### Yjs Update Chain
1. ydoc.on("update") → detect local change
2. SupabaseSyncProd.broadcastUpdate() → encrypt → Supabase broadcast
3. Peer receives → decryptUpdate() → Y.applyUpdate(ydoc, decrypted, "network")
4. registerYjsObserver() sees origin === "network" → syncFromYjs() → Zustand re-render

### Debug Access
\`\`\`typescript
// In browser console
const store = (window as any).__STORE__;
store.getState().syncStatus;       // "connected" | "disconnected"
store.getState().todoRows;          // Current tasks
store.getState().activeWorkspaceId; // Room fingerprint

// Diagnostics (if debug build)
(window as any).__SYNC_MONITOR?.generateDiagnosticReport();
\`\`\`

---

## 🚫 THE GRAVEYARD (Quick Reference)

| Trap | Symptom | Prevention |
|------|---------|------------|
| **Origin Mismatch** | Peers connect but UI does not update | Use "network" for all inbound updates |
| **Closure Issue** | ReferenceError in waitForFunction | Pass args explicitly |
| **UI Loop** | Stuck on CSS for 10+ turns | Stop after 2 attempts |
| **Double-Exec** | Duplicate API calls | Use useRef lock |
| **Rate Limit** | 429 errors | Respect MIN_DELAY_MS=2000 |

Full details: docs/GRAVEYARD.md

---

## 📁 CRITICAL FILES

### Services & State
- src/services/gemini.ts — AI brain
- src/services/storage.ts — IndexedDB (namespaced per workspace)
- src/lib/supabaseSyncProd.ts — Production sync (Supabase Realtime)
- src/lib/supabaseClient.ts — Supabase client with retry
- src/store/useAppStore.ts — Zustand state + Yjs doc

### Testing
- tests/e2e/crdt-physics.spec.ts — CRDT physics (active E2E)
- tests/integration/e2eeRuntime.test.ts — E2EE verification
- playwright.config.ts — 13 device presets

### Documentation
- master_calibration.md — Master rules
- .continue/rules/ — Active rule set (9 files)
- docs/GRAVEYARD.md — Anti-patterns
- docs/AGENT_ROLES.md — Role definitions
- PHASE6_COMPLETION.md — Phase 6 status

---

## ⬆️ ESCALATION TRIGGERS

STOP and ask human if:
- [ ] SYNC-001 regressions or sync tests failing
- [ ] Cannot verify with deterministic test
- [ ] Instructions conflict with Master Calibration
- [ ] Need to install new dependency
- [ ] Modifying frozen zone (VideoInput.tsx)

---

## 🎨 THEME TOKENS

### Light Mode
- Background: #FAFAFA (Zinc-50)
- Surface: white
- Text: text-zinc-900
- Accent: text-purple-700

### Dark Mode
- Background: #1C1917 (Stone-900)
- Surface: stone-800
- Text: text-stone-100
- Accent: text-purple-400

---

## 🔑 AI CONSTANTS

\`\`\`typescript
MIN_DELAY_MS = 2000           // Rate limit
MAX_CANVAS_PX = 640          // Image downscale
PRIMARY_MODEL = "gemini-2.5-flash"
FALLBACK_MODEL = "gemini-2.5-flash-lite"
\`\`\`

---

**Last Updated:** May 21, 2026
**For Full Details:** See master_calibration.md
