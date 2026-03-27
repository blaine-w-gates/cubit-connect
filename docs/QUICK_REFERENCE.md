# CUBIT CONNECT — AGENT QUICK REFERENCE
**One-page cheat sheet for fast lookup**

---

## 🚨 CURRENT CRITICAL ISSUE

**SYNC-001:** Yjs updates not propagating despite peer connection  
**Status:** 🔴 ACTIVE — March 27, 2026  
**Pattern:** B creates task (1 row), A never receives (0 rows), timeout  
**Files:** `tests/ping-pong-debug.spec.ts`, `src/lib/networkSync.ts`  
**Debug:** See `docs/GRAVEYARD.md` Section SYNC-001

---

## 📋 PHASE CHECKLIST

### Phase 0: Environmental Sanity (MUST RUN)
```bash
npm run type-check  # Pass?
npm run lint        # Pass?
npm run test:quick  # Pass?
git status          # Clean?
```

### Phase 1: Execute
- Work on ONE sub-task (< 2 hours)
- No scope creep

### Phase 2: Verify
- Deterministic proof required
- "Looks good" ≠ verification

### Phase 3: Commit
```bash
git commit -m "[Agent] Verified completion: {Task}"
```

---

## 🎯 COMMON COMMANDS

```bash
# Development
npm run dev
npm run build

# Testing
npm run test              # Unit tests
npm run test:quick        # Quick tier (~30s)
npm run test:sync         # Sync tests (~2m)
npm run test:full         # All 13 devices (~10m)

# Quality
npm run type-check
npm run lint
npm run format
```

---

## 🎭 PLAYWRIGHT PATTERNS

### ✅ CORRECT
```typescript
// Exact match selector
await page.getByRole('button', { name: 'Task', exact: true }).click();

// Store evaluation for sync
await page.waitForFunction(() => 
  (window as any).__STORE__.getState().todoRows.length > 0
);

// Pass args explicitly (no closures!)
await page.waitForFunction(
  (name) => (window as any).__STORE__.getState().todoProjects.some(p => p.name === name),
  projectName
);
```

### ❌ WRONG
```typescript
// Ambiguous selector
await page.getByRole('button', { name: 'Task' }).click();

// Closure variable (will fail!)
await page.waitForFunction(() => checkRow(projA));
```

---

## 🔗 SYNC DEBUGGING

### Yjs Update Chain
1. `ydoc.on('update')` → Detect local change
2. `broadcastUpdate()` → Encrypt
3. WebSocket → Send to relay
4. Relay → Broadcast to peers
5. Peer → Decrypt → `applyUpdate()`

### NetworkSync Lifecycle
1. **Connection** → WebSocket opens
2. **Key Derivation** → `deriveSyncKey(passphrase)`
3. **Room Join** → `deriveRoomId(passphrase)`
4. **Peer Discovery** → `hasPeers = true`
5. **Data Sync** → Updates propagate

### Debug Access
```typescript
// In browser console
const store = (window as any).__STORE__;
store.getState().hasPeers;      // Peer connection status
store.getState().syncStatus;     // 'connected' | 'disconnected'
store.getState().todoRows;       // Current tasks
store.flushSyncNow();            // Force Yjs sync
```

---

## 🚫 THE GRAVEYARD (Quick Reference)

| Trap | Symptom | Prevention |
|------|---------|------------|
| **SYNC-001** | Peers connect but data doesn't sync | Check room ID, trace Yjs chain |
| **Closure Issue** | `ReferenceError in waitForFunction` | Pass args explicitly |
| **UI Loop** | Stuck on CSS for 10+ turns | Stop after 2 attempts |
| **Double-Exec** | Duplicate API calls | Use useRef lock |
| **Rate Limit** | 429 errors | Respect MIN_DELAY_MS=2000 |

Full details: `docs/GRAVEYARD.md`

---

## 📁 CRITICAL FILES

### Services & State
- `src/services/gemini.ts` — AI brain
- `src/services/storage.ts` — IndexedDB
- `src/lib/networkSync.ts` — Yjs/WebSocket sync
- `src/store/useAppStore.ts` — Zustand state

### Testing
- `tests/e2e/sync.spec.ts` — Multi-device tests
- `tests/ping-pong-debug.spec.ts` — Current debug
- `playwright.config.ts` — Test config

### Documentation
- `master_calibration.md` — Master rules
- `.cursorrules` — IDE constraints
- `docs/GRAVEYARD.md` — Anti-patterns
- `docs/AGENT_ROLES.md` — Role definitions

---

## ⬆️ ESCALATION TRIGGERS

STOP and ask human if:
- [ ] SYNC-001 or sync tests failing
- [ ] Cannot verify with deterministic test
- [ ] Instructions conflict with Master Calibration
- [ ] Need to install new dependency
- [ ] Modifying frozen zone (VideoInput.tsx)

---

## 🎨 THEME TOKENS

### Light Mode
- Background: `#FAFAFA` (Zinc-50)
- Surface: `white`
- Text: `text-zinc-900`
- Accent: `text-purple-700`

### Dark Mode
- Background: `#1C1917` (Stone-900)
- Surface: `stone-800`
- Text: `text-stone-100`
- Accent: `text-purple-400`

---

## 🔑 AI CONSTANTS

```typescript
MIN_DELAY_MS = 2000           // Rate limit
MAX_CANVAS_PX = 640          // Image downscale
PRIMARY_MODEL = 'gemini-2.5-flash'
FALLBACK_MODEL = 'gemini-2.5-flash-lite'
```

---

**Last Updated:** March 27, 2026  
**For Full Details:** See `master_calibration.md`
