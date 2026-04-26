# THE GRAVEYARD — CUBIT CONNECT
**Anti-Patterns & Failed Approaches**  
**Rule:** Every bug caught becomes a constraint. The system gets smarter over time.

---

## ACTIVE ISSUES (Currently Being Investigated)

### SYNC-001: Yjs Update Propagation Failure
**Status:** 🔴 ACTIVE — March 27, 2026  
**Severity:** Critical — Blocks multi-device sync  
**Owner:** Execution Agent (Debug Mode)

#### Symptom
- Playwright sync tests timeout
- Peers connect successfully (👥 2+ visible in UI)
- B creates task (1 row in local store)
- A never receives update (0 rows, timeout waiting)

#### Root Cause Hypothesis
Yjs updates not reaching peer despite WebSocket connection:
1. **Theory A:** Room ID mismatch — peers in different rooms
2. **Theory B:** Yjs update event not firing or not connected to broadcast
3. **Theory C:** WebSocket messages not relaying through server
4. **Theory D:** Encryption/decryption mismatch
5. **Theory E:** Yjs document not initialized when update triggered

#### Investigation Log
| Date | Test | Result | Notes |
|------|------|--------|-------|
| Mar 27 | DEBUG test | ✅ Peers connect | hasPeers=true on both |
| Mar 27 | Data sync test | ❌ Timeout | A never receives B's update |
| Mar 27 | Room ID check | ⏳ Pending | Verify roomIdHash identical |
| Mar 27 | ydoc inspection | ⏳ Pending | Expose ydoc to window for debug |

#### Prevention (Once Solved)
- Add room ID verification test
- Expose ydoc for runtime debugging
- Add WebSocket message logging in dev mode
- Create sync diagnostic dashboard

#### Files Involved
- `src/lib/networkSync.ts` — WebSocket/Yjs binding
- `src/store/useAppStore.ts` — Yjs update broadcasting
- `src/lib/cryptoSync.ts` — Encryption layer
- `sync-server/server.js` — Message relay
- `tests/ping-pong-debug.spec.ts` — Reproduction test

---

## DELETED COMPONENTS (Legacy System Removal)

### Legacy NetworkSync System
**Status:** 🗑️ DELETED — April 26, 2026  
**Reason:** Replaced by Supabase Realtime per ADR-001  
**Deletion Commit:** `chore: Remove legacy sync system and fix unit tests`

#### Components Removed
- `src/lib/networkSync.ts` — Custom WebSocket E2EE sync implementation
- `sync-server/` — Node.js relay server for WebSocket connections
- `tests/e2e/sync.spec.ts` — Legacy E2E sync tests
- `src/app/sync-test/page.tsx` — NetworkSync diagnostic page

#### Rationale
The custom WebSocket-based sync system was complex, difficult to maintain, and unreliable in production. Supabase Realtime provides:
- Managed infrastructure (no custom relay server)
- Better scalability
- Official support and documentation
- PostgreSQL-backed persistence

#### Migration Path
- Supabase Realtime is now the only supported sync transport
- Feature flag `USE_SUPABASE_SYNC` controls sync enablement
- All sync infrastructure now uses `syncManager` variable instead of `networkSync`
- Fallback logic simplified: Supabase failure = no sync (no WebSocket fallback)

---

## RESOLVED ISSUES (Lessons Learned)

### SYNC-002: The Closure Issue in waitForFunction
**Status:** ✅ RESOLVED  
**Date:** March 2026  
**Severity:** High — Broke all sync tests

#### Symptom
```typescript
// ❌ WRONG: Closure variable not in scope
await page.waitForFunction(() => 
  (window as any).__STORE__.getState().todoProjects.some((p: any) => p.name === projA)
);
// Error: ReferenceError: projA is not defined
```

#### Root Cause
Playwright's `waitForFunction` runs in browser context. Closure variables (`projA`) from Node.js test context are NOT available.

#### Solution
```typescript
// ✅ CORRECT: Pass argument explicitly
await page.waitForFunction(
  (name) => (window as any).__STORE__.getState().todoProjects.some((p: any) => p.name === name),
  projA  // <-- argument passed here
);
```

#### Prevention
- Always pass arguments to `waitForFunction`
- Never use closure variables in browser-evaluated functions
- Use type-safe wrappers for common checks

#### Files Updated
- `tests/ping-pong-simple.spec.ts` — Fixed all waitForSync calls
- Pattern now enforced in testing conventions

---

### SYNC-003: The connectDevice Deadlock
**Status:** ✅ RESOLVED  
**Date:** March 2026  
**Severity:** High — Tests hung indefinitely

#### Symptom
Tests timeout on `connectDevice()` — neither device connects.

#### Root Cause
```typescript
// ❌ WRONG: Deadlock
async function connectDevice(page, passphrase) {
  await connectToSyncServer(passphrase);
  await waitForFunction(() => hasPeers === true); // <-- DEADLOCK
}

// Device A waits for peers, but Device B hasn't connected yet
```

#### Solution
```typescript
// ✅ CORRECT: Connect without waiting, then wait for both
await connectDevice(a.page, room);  // No peer wait
await connectDevice(b.page, room);  // No peer wait
await waitForPeers(a.page);         // Now wait for both
await waitForPeers(b.page);
```

#### Prevention
- Separate "connect" from "peer discovery" phases
- Never wait for external state during setup
- Document timing dependencies explicitly

#### Files Updated
- `tests/ping-pong-simple.spec.ts` — Split connect/wait phases

---

### UI-001: The Ambiguous Selector Trap
**Status:** ✅ RESOLVED  
**Date:** March 2026  
**Severity:** Medium — Flaky tests

#### Symptom
```typescript
// ❌ WRONG: Ambiguous selector
await b.page.getByRole('button', { name: 'Task' }).click();
// Matches multiple buttons, times out
```

#### Root Cause
Substring matching finds multiple elements. Playwright waits for ONE matching element, times out if multiple found.

#### Solution
```typescript
// ✅ CORRECT: Exact match
await b.page.getByRole('button', { name: 'Task', exact: true }).click();
// OR: Use data-testid for stable selection
await b.page.getByTestId('add-task-button').click();
```

#### Prevention
- Prefer `exact: true` on all text selectors
- Use `data-testid` for test-specific stability
- Document selector strategy in testing.md

---

### AI-001: The Double-Execution Bug
**Status:** ✅ RESOLVED  
**Date:** February 2026  
**Severity:** High — Wasted API quota

#### Symptom
User clicks "Cubit" button once, two API calls fire, quota doubles.

#### Root Cause
React StrictMode double-mounts components. AI call triggered in useEffect or event handler without guard.

#### Solution
```typescript
// ✅ CORRECT: useRef lock
const isProcessing = useRef(false);

const handleCubit = async () => {
  if (isProcessing.current) return;
  isProcessing.current = true;
  try {
    await generateSubSteps(...);
  } finally {
    isProcessing.current = false;
  }
};
```

#### Prevention
- Use `useRef` lock for one-shot operations
- Or use Zustand machine state (isProcessing flag)
- Always guard against double-execution

#### Files Updated
- `src/components/TaskEditor.tsx` — Added useRef locks
- Pattern added to `.windsurfrules`

---

### AI-002: The Rate Limit Blindside
**Status:** ✅ RESOLVED  
**Date:** February 2026  
**Severity:** High — User sees crashes

#### Symptom
App crashes with 429 error when user rapidly clicks AI features.

#### Root Cause
No rate limiting or circuit breaker. User triggers multiple requests, hits Gemini quota.

#### Solution
```typescript
// ✅ CORRECT: Circuit breaker + rate limiting
const MIN_DELAY_MS = 2000;
let lastCallTime = 0;

export async function generateWithRateLimit(...) {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_DELAY_MS) {
    await delay(MIN_DELAY_MS - elapsed);
  }
  lastCallTime = Date.now();
  
  try {
    return await primaryModel.generateContent(...);
  } catch (e) {
    if (e.status === 429) {
      return await fallbackModel.generateContent(...);
    }
    throw e;
  }
}
```

#### Prevention
- MIN_DELAY_MS = 2000 between all AI calls
- Circuit breaker: Primary → Fallback → Error
- Show user-friendly message on quota exceeded

#### Files Updated
- `src/services/gemini.ts` — Implemented circuit breaker

---

### DATA-001: The IDB Migration Data Loss
**Status:** ✅ RESOLVED  
**Date:** January 2026  
**Severity:** Critical — User data lost

#### Symptom
Users report projects disappeared after update.

#### Root Cause
Workspace model migration (personalUno/personalMulti) didn't migrate legacy data properly.

#### Solution
```typescript
// ✅ CORRECT: Transparent migration with backup
async function migrateIfNeeded() {
  const legacyKey = 'cubit_connect_project_v1';
  const newKey = `cubit_uno_${deviceId}`;
  
  const legacyData = await get(legacyKey);
  if (legacyData) {
    // Copy to new namespace
    await set(newKey, stampWithWorkspace(legacyData, 'personalUno'));
    // Keep backup for 30 days
    await set(`${legacyKey}_backup`, legacyData);
    await set('migration_completed', Date.now());
  }
}
```

#### Prevention
- Never delete old data immediately
- 30-day backup retention
- Migration flag prevents re-migration
- Test migration on sample data

#### Files Updated
- `src/services/storage.ts` — Added migrationIfNeeded()

---

### VIDEO-001: The Talking Head Offset
**Status:** ✅ RESOLVED  
**Date:** December 2025  
**Severity:** Medium — Screenshots off by 0.5s

#### Symptom
Screenshots don't match transcript timestamps — show video transition frames instead of actual content.

#### Root Cause
Video seeking is async. Screenshot captured before `seeked` event fires.

#### Solution
```typescript
// ✅ CORRECT: Wait for seeked event
async function captureAtTimestamp(video: HTMLVideoElement, timestamp: number): Promise<string> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      // +0.5s buffer for transition fades
      setTimeout(() => resolve(captureFrame(video)), 500);
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = timestamp;
  });
}
```

#### Prevention
- Always wait for `video.onseeked` before capturing
- Add 0.5s buffer for transition fades
- Document in `.windsurfrules`

#### Files Updated
- `src/hooks/useVideoProcessor.ts` — Event-driven capture

---

## THE NAIVE AI TRAP COLLECTION

### TRAP-001: The UI Loop
**Pattern:** Agent gets stuck adjusting CSS padding for 10+ turns  
**Detection:** Same file edited >5 times for "polish"  
**Response:** STOP after 2 failed UI attempts, escalate to human  
**Recovery:** Back out to last working state, reassess approach

### TRAP-002: The Over-write
**Pattern:** Overwriting .env or config during scaffolding  
**Detection:** Changes to .env, .env.local, or config files  
**Response:** Never touch .env without explicit permission  
**Recovery:** Check git history, restore from backup

### TRAP-003: The Placeholder Code
**Pattern:** `// logic goes here` or `TODO: implement` in output  
**Detection:** Comments indicating incomplete implementation  
**Response:** Write complete, functional chunks only  
**Recovery:** Identify placeholder, replace with actual logic

### TRAP-004: The Macro-Planning Hallucination
**Pattern:** Agent designs architecture beyond provided spec  
**Detection:** "We should also..." or "In the future..." statements  
**Response:** Reset to spec boundaries, discard hallucinated plans  
**Recovery:** Re-read Master Spec, stay within scope

### TRAP-005: The Dependency Guessing
**Pattern:** Installing packages not in approved list  
**Detection:** New dependencies in package.json  
**Response:** Check package.json before any install  
**Recovery:** Remove unapproved packages, use existing stack

### TRAP-006: The Refactoring Reflex
**Pattern:** "While I'm here, I'll clean up..."  
**Detection:** Changes to files not in task scope  
**Response:** Don't refactor working code without plan  
**Recovery:** Revert refactoring, focus on task scope

### TRAP-007: The Verification Skip
**Pattern:** "Looks good to me" without running tests  
**Detection:** No test output in response  
**Response:** "Looks good" = NOT verification  
**Recovery:** Run full verification chain, prove with output

---

## DATA FLYWHEEL (Continuous Learning)

### How to Add to Graveyard
When a new bug is caught:

1. **Document in this file** — Add to ACTIVE or RESOLVED section
2. **Update `.cursorrules`** — Add trap to Section 7
3. **Update `master_calibration.md`** — Add to Graveyard section
4. **Update Constraint Architecture** — Add "Must Not Do" rule
5. **Add regression test** — Prevent recurrence

### Monthly Review
- Review all ACTIVE issues, move to RESOLVED when fixed
- Update prevention strategies based on new patterns
- Compress rules if getting too long (token budget)
- Celebrate resolved traps as team learning

---

## GRAVEYARD STATISTICS

| Category | Count | Status |
|----------|-------|--------|
| Active Issues | 1 | 🔴 SYNC-001 |
| Resolved Issues | 7 | ✅ Documented |
| Naive AI Traps | 7 | 📚 Catalogued |
| Total Learnings | 15 | 📈 Growing |

---

**Remember:** Every bug caught is a constraint added. The system gets smarter every sprint.
