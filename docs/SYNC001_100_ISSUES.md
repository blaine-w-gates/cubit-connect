# SYNC-001: 100-Issue Comprehensive Analysis

## Executive Summary

**Status**: Pre-validation phase - manual testing needed to determine actual state
**Primary Suspects**: 
1. Yjs ClientID collision (85% confidence for same-device testing)
2. Test infrastructure inadequacy (70% confidence for automation issues)
3. Real sync bug requiring debugging (40% confidence if manual tests fail)

**Recommendation**: Run manual Chrome ↔ Safari test before extensive changes

---

## Issue Categories

### CATEGORY A: Browser Session & Identity Conflicts (15 issues)
*Affects: Real-world multi-browser scenarios | Priority: CRITICAL*

| # | Issue | Description | Likelihood | Detection | Fix Complexity |
|---|-------|-------------|------------|-----------|----------------|
| A1 | Same-Origin Policy Violations | Two tabs share localStorage/cookies unexpectedly | Medium | Check storage isolation | Medium |
| A2 | Shared Worker Conflicts | Service workers sharing state between tabs | Low | Check SW scope | Low |
| A3 | Device ID Collision | Both tabs generate identical device IDs | Low | Check identity.ts | Low |
| A4 | **Yjs ClientID Collision** | Same browser = same Yjs clientID = update rejection | **HIGH** | Console ClientID check | **EASY** |
| A5 | IndexedDB Namespace Collision | Storage keys overlap in same origin | Medium | Check storage keys | Medium |
| A6 | BroadcastChannel Interference | Cross-tab communication contaminates state | Medium | Check channel names | Medium |
| A7 | Session Storage Bleed | Temporary data persists across sessions | Low | Check sessionStorage | Low |
| A8 | Cookie-Based Auth Conflicts | JWT tokens shared unexpectedly | Low | Check cookie scope | Low |
| A9 | WebSocket Connection Pooling | Browser shares WS connections between tabs | Low | Check WS isolation | Hard |
| A10 | Cache API Conflicts | Service worker cache hits from wrong session | Low | Check cache keys | Medium |
| A11 | tabId Tracking Issues | Browser assigns same internal identifiers | Low | Not fixable | N/A |
| A12 | Incognito Mode Detection Failure | Code may not properly isolate incognito | Medium | Check incognito logic | Medium |
| A13 | Fingerprinting Algorithm Issues | Session fingerprint may not be unique enough | Low | Check deriveRoomId | Medium |
| A14 | Cross-Tab Yjs Awareness | Yjs detects "self" and optimizes away updates | **HIGH** | Check Yjs behavior | **EASY** |
| A15 | SharedArrayBuffer Conflicts | Memory sharing between tabs | Very Low | Check SAB usage | Hard |

**Top 3 in Category:**
- **A4 (Yjs ClientID Collision)**: 85% likelihood - Same device = same entropy = same ID
- **A14 (Cross-Tab Yjs Awareness)**: 80% likelihood - Yjs may detect "same client"
- **A6 (BroadcastChannel Interference)**: 60% likelihood - May cause state contamination

---

### CATEGORY B: Network & Server Issues (10 issues)
*Affects: Server relay and message delivery | Priority: MEDIUM*

| # | Issue | Description | Likelihood | Detection | Fix Complexity |
|---|-------|-------------|------------|-----------|----------------|
| B1 | Room ID Hash Collision | Different passphrases hash to same room | Very Low | Check hash distribution | Hard |
| B2 | WebSocket Message Ordering | Out-of-order delivery corrupts Yjs state | Low | Check message sequence | Hard |
| B3 | Server Memory Store Eviction | In-memory cache drops messages | Low | Check server logs | Medium |
| B4 | MSG_UPDATE vs MSG_CHECKPOINT Race | Small updates arrive before big checkpoint | Medium | Check timing logs | Medium |
| B5 | Heartbeat Timeout Mismatch | Client 15s vs Server 30s expectations | Low | Check HB intervals | Low |
| B6 | Catch-Up Lock Stuck | Client never releases catchUpLock | Medium | Check lock state | Medium |
| B7 | Redis Serialization Errors | Binary data corrupted in Redis round-trip | N/A | No Redis used | N/A |
| B8 | WebSocket Frame Fragmentation | Large messages split and lost | Low | Check WS frame size | Medium |
| B9 | Connection Pool Exhaustion | Server hits max concurrent connections | Very Low | Check server metrics | Medium |
| B10 | NAT/Firewall Pinhole Timeout | Connection open but data blocked | Low | Check connectivity | Hard |

**Top 2 in Category:**
- **B4 (MSG_UPDATE Race)**: 50% likelihood - Timing sensitive
- **B6 (Catch-Up Lock)**: 40% likelihood - Logic error possible

---

### CATEGORY C: Yjs State Management (15 issues)
*Affects: Document synchronization integrity | Priority: HIGH*

| # | Issue | Description | Likelihood | Detection | Fix Complexity |
|---|-------|-------------|------------|-----------|----------------|
| C1 | ydoc.destroy() Memory Leaks | Old ydoc instances not garbage collected | Medium | Memory profiling | Medium |
| C2 | Observer Registration on Wrong Instance | Callbacks attached to destroyed ydoc | **HIGH** | Check observer ydoc ID | **EASY** |
| C3 | Transaction Origin Mismatch | 'network' origin vs 'local' origin confusion | Medium | Check origin strings | Medium |
| C4 | Y.Map Structure Corruption | Nested maps get out of sync | Medium | Check map structure | Hard |
| C5 | GC Disabled But Tombstones Lost | gc:false but still losing delete info | Low | Check Yjs gc behavior | Hard |
| C6 | Concurrent resetYDoc() Calls | Race condition during workspace switch | Medium | Add mutex | Medium |
| C7 | yProjectsMap Reference Staleness | Map reference points to old ydoc | **HIGH** | Check map references | **EASY** |
| C8 | Update Callback Queue Overflow | Too many updates = dropped callbacks | Low | Check callback queue | Medium |
| C9 | Binary Update Encoding Errors | Yjs update format version mismatch | Very Low | Check Yjs version | Hard |
| C10 | State Vector Divergence | Peers have incompatible document histories | Medium | Check state vectors | Hard |
| C11 | Awareness Protocol Conflicts | Multiple awareness instances fighting | Medium | Check awareness setup | Medium |
| C12 | Undo/Redo Stack Contamination | History bleeds between sessions | N/A | No undo/redo | N/A |
| C13 | Nested Transaction Deadlock | Yjs transact() called within transact() | Low | Check transaction nesting | Medium |
| C14 | Subdocument Sync Failures | Embedded Yjs documents not syncing | N/A | No subdocs | N/A |
| C15 | Array Move Operation Bugs | OrderKey collision on drag-drop reordering | Low | Check orderKey gen | Medium |

**Top 3 in Category:**
- **C2 (Observer Wrong Instance)**: 75% likelihood - resetYDoc() creates new ydoc
- **C7 (Map Reference Staleness)**: 70% likelihood - yProjectsMap may point to old doc
- **C1 (Memory Leaks)**: 50% likelihood - ydoc.destroy() may not clean up

---

### CATEGORY D: E2EE Crypto Issues (10 issues)
*Affects: Encryption/decryption reliability | Priority: HIGH*

| # | Issue | Description | Likelihood | Detection | Fix Complexity |
|---|-------|-------------|------------|-----------|----------------|
| D1 | deriveSyncKey Non-Determinism | PBKDF2 produces different keys | Very Low | Check key derivation | Critical |
| D2 | IV Collision | Same IV used twice = security vulnerability | Low | Check IV generation | Medium |
| D3 | AES-GCM Tag Validation Failures | Corrupted ciphertext not detected | Low | Check decryption errors | Medium |
| D4 | Key Derivation Salt Mismatch | Static salt not applied consistently | Very Low | Check salt usage | Critical |
| D5 | Encryption Before Key Ready | Race condition: encrypt with null key | Medium | Check key initialization | Medium |
| D6 | Decryption Performance Bottleneck | Blocking main thread = dropped frames | Low | Profile crypto operations | Medium |
| D7 | Web Crypto API Availability | Some browsers disable crypto in iframes | Low | Check crypto.subtle | Medium |
| D8 | Subtle Crypto Import/Export | Key serialization round-trip failures | Low | Check key format | Medium |
| D9 | Memory-Based Side Channel | Crypto keys in JS heap = extractable | N/A | By design | N/A |
| D10 | Passphrase Normalization | Unicode NFKC vs NFC form mismatches | Very Low | Check string normalization | Low |

**Top 2 in Category:**
- **D5 (Encryption Before Key Ready)**: 40% likelihood - Race condition possible
- **D3 (AES-GCM Failures)**: 30% likelihood - Would show in console

---

### CATEGORY E: UI/React State Sync (12 issues)
*Affects: User interface and feedback | Priority: MEDIUM*

| # | Issue | Description | Likelihood | Detection | Fix Complexity |
|---|-------|-------------|------------|-----------|----------------|
| E1 | Zustand Selector Staleness | useAppStore returns old state | Medium | Check Zustand version | Medium |
| E2 | React Render Batching | hasPeers update delayed until next tick | Medium | Check render timing | Medium |
| E3 | Modal State Conflicts | Sync modal open/close race conditions | Low | Check modal state | Low |
| E4 | Peer Count Display Lag | UI shows 👤 1 when already 👤 2 | Medium | Check UI update logic | Easy |
| E5 | Debounced Update Loss | 500ms debounce drops rapid sync events | Low | Check debounce logic | Medium |
| E6 | VisibilityChange Handler Timing | Page hidden = sync paused incorrectly | Medium | Check visibility logic | Medium |
| E7 | Error Boundary Catches | Sync errors swallowed by React error boundary | Low | Check error handling | Medium |
| E8 | Strict Mode Double Mount | React 18 mounts twice = duplicate connections | **HIGH** | Check StrictMode | **EASY** |
| E9 | Hydration Mismatch | Server vs client state differs on rehydrate | Low | Check hydration | Medium |
| E10 | CSS Transition Blocking | Modal animation prevents interaction | Low | Check CSS | Easy |
| E11 | Focus Management Issues | Sync modal steals focus from task input | Low | Check focus logic | Low |
| E12 | Toast Notification Flooding | Too many sync notifications = UI freeze | Low | Check notification rate | Low |

**Top 2 in Category:**
- **E8 (Strict Mode Double Mount)**: 80% likelihood - React 18 default behavior
- **E4 (Peer Count Lag)**: 50% likelihood - UI may lag behind state

---

### CATEGORY F: Monitoring & Diagnostics (10 issues)
*Affects: Our ability to observe the problem | Priority: MEDIUM*

| # | Issue | Description | Likelihood | Detection | Fix Complexity |
|---|-------|-------------|------------|-----------|----------------|
| F1 | Console.log Throttling | Browser drops log messages at high volume | Medium | Check log output | Easy |
| F2 | Circular JSON in Diagnostics | __SYNC_MONITOR crashes on serialization | Low | Check serialization | Easy |
| F3 | Memory Snapshot Corruption | Heap snapshots taken mid-transaction | Low | Check snapshot timing | Medium |
| F4 | Log Buffer Overflow | 1000 log limit = early messages lost | Low | Check buffer size | Easy |
| F5 | Performance.now() Drift | Timestamps not monotonic across tabs | Very Low | Check time source | N/A |
| F6 | Console API Inconsistency | Safari/Chrome log differently | Medium | Check cross-browser | Easy |
| F7 | Source Map Failures | Minified code = unreadable stack traces | Low | Check source maps | Medium |
| F8 | WebSocket Frame Inspection | Can't see encrypted payload contents | By Design | Expected | N/A |
| F9 | Missing Critical Logs | Key state transitions not logged | **HIGH** | Check logging coverage | **EASY** |
| F10 | Log Noise Obscures Signal | Too much logging hides important messages | Medium | Check log levels | Easy |

**Top 2 in Category:**
- **F9 (Missing Critical Logs)**: 70% likelihood - Need better observability
- **F1 (Console Throttling)**: 50% likelihood - High volume logs may be dropped

---

### CATEGORY G: Timing & Race Conditions (8 issues)
*Affects: Synchronization timing | Priority: MEDIUM*

| # | Issue | Description | Likelihood | Detection | Fix Complexity |
|---|-------|-------------|------------|-----------|----------------|
| G1 | Connection Before Observer Ready | NetworkSync connects before ydoc observer | **HIGH** | Check initialization order | **EASY** |
| G2 | Genesis Checkpoint Race | First peer uploads before second peer joins | Medium | Check timing | Medium |
| G3 | Heartbeat vs Presence Timing | 30s server HB vs 15s client presence | Low | Check HB timing | Low |
| G4 | Page Load vs Sync Init | Race between hydration and sync connection | Medium | Check load timing | Medium |
| G5 | Modal Animation Delay | 300ms fade-in delays actual connection | Low | Check modal timing | Low |
| G6 | Reconnect Storm | Multiple tabs reconnect simultaneously | Medium | Add jitter | Medium |
| G7 | Transaction Interleaving | Multiple transact() calls interleave | Medium | Check transaction order | Hard |
| G8 | setState During Render | React warning about state updates | Low | Check render cycle | Medium |

**Top 2 in Category:**
- **G1 (Connection Before Observer)**: 75% likelihood - Classic race condition
- **G2 (Genesis Checkpoint Race)**: 50% likelihood - Timing sensitive

---

### CATEGORY H: Test Environment & Infrastructure (15 issues)
*Affects: Automated test reliability | Priority: HIGH*

| # | Issue | Description | Likelihood | Detection | Fix Complexity |
|---|-------|-------------|------------|-----------|----------------|
| H1 | Browser Context Resource Limits | 2 contexts exhaust memory | Medium | Check resource usage | Medium |
| H2 | Page Crash on Click | Sync button click triggers unhandled exception | Medium | Check error logs | Medium |
| H3 | Locator Timeout Too Aggressive | 5s timeout for slow modal animation | Medium | Increase timeout | Easy |
| H4 | LocalStorage Isolation Failure | Contexts share storage unexpectedly | **HIGH** | Check storage isolation | **EASY** |
| H5 | Console Event Handler Leaks | page.on('console') accumulates handlers | Low | Check handler cleanup | Easy |
| H6 | Screenshot Interference | Taking screenshot mid-click = failure | Low | Check timing | Easy |
| H7 | Test Retry Masking Issues | Flaky passes hide real bugs | Medium | Disable retries | Easy |
| H8 | Test Environment Variable Drift | .env.test vs .env.local mismatch | Medium | Check env vars | Easy |
| H9 | WebServer Not Ready | Tests start before Next.js finishes building | Low | Check server readiness | Easy |
| H10 | Playwright Config Outdated | Projects list doesn't match new test needs | Medium | Update config | Easy |
| H11 | Screenshot Directory Permissions | test-results/ not writable | Low | Check permissions | Easy |
| H12 | Video Recording Overhead | Recording consumes too much CPU | Low | Disable recording | Easy |
| H13 | Test Hook Execution Order | beforeAll/afterEach cleanup wrong | Medium | Check hook order | Medium |
| H14 | Worker Process OOM | Playwright worker hits memory limit | Medium | Increase memory | Easy |
| H15 | Browser Launch Args Missing | Need --disable-dev-shm-usage flag | Low | Check launch args | Easy |

**Top 3 in Category:**
- **H4 (LocalStorage Isolation)**: 80% likelihood - Contexts may share storage
- **H1 (Resource Limits)**: 60% likelihood - 2 contexts may exhaust resources
- **H2 (Page Crash)**: 50% likelihood - Unhandled exceptions

---

### CATEGORY I: Cross-Browser Compatibility (12 issues)
*Affects: Chrome/Safari/Firefox differences | Priority: MEDIUM*

| # | Issue | Description | Likelihood | Detection | Fix Complexity |
|---|-------|-------------|------------|-----------|----------------|
| I1 | Safari WebSocket Limitations | Max 2 concurrent WS connections | Low | Check Safari limits | Hard |
| I2 | Firefox Crypto.subtle Restrictions | Requires secure context (https) | Low | Check Firefox crypto | Medium |
| I3 | iOS WebKit Bugs | WKWebView has known WebSocket issues | Medium | Test on iOS | Hard |
| I4 | Chrome Incognito Storage | localStorage not persisted correctly | Medium | Check incognito | Medium |
| I5 | Safari Intelligent Tracking Prevention | Deletes "tracking" localStorage | Low | Check ITP behavior | Hard |
| I6 | Browser-Specific Yjs Behavior | Yjs optimizations differ by browser | Low | Check Yjs code | Hard |
| I7 | WebRTC Interference | May conflict with WebSocket | Very Low | Check WebRTC | Hard |
| I8 | IndexedDB Quota Differences | Browser IDB limits vary | Low | Check IDB quota | Medium |
| I9 | Event Loop Timing Differences | setTimeout/setInterval precision varies | Low | Check timing | Hard |
| I10 | ES6 Feature Support | Some browsers lack features | Very Low | Check transpilation | Easy |
| I11 | CSS Grid/Flexbox Differences | UI layout issues cross-browser | Low | Check CSS | Easy |
| I12 | Touch Event Handling | Mobile vs desktop event differences | Medium | Check touch events | Medium |

**Top 2 in Category:**
- **I3 (iOS WebKit Bugs)**: 40% likelihood - Known WebSocket issues on iOS
- **I4 (Chrome Incognito Storage)**: 40% likelihood - Incognito storage ephemeral

---

### CATEGORY J: Architecture & Design (13 issues)
*Affects: Overall system design | Priority: MEDIUM*

| # | Issue | Description | Likelihood | Detection | Fix Complexity |
|---|-------|-------------|------------|-----------|----------------|
| J1 | Single Point of Failure (Server) | Server crash = no sync | By Design | Expected | N/A |
| J2 | No Offline Queue | Changes made offline may be lost | By Design | Expected | Hard |
| J3 | Last-Write-Wins Conflict Resolution | Concurrent edits may overwrite | By Design | Expected | Medium |
| J4 | No Delta Sync | Always send full checkpoint | By Design | Expected | Medium |
| J5 | Memory-Only Presence Tracking | No server-side presence | By Design | Expected | N/A |
| J6 | No Version Compatibility | Old clients can't sync with new format | Low | Check versioning | Hard |
| J7 | No Rate Limiting | Client can flood server | Low | Add rate limiting | Medium |
| J8 | Hardcoded Server URL | Can't easily switch servers | Low | Check config | Easy |
| J9 | No Connection Quality Metrics | Can't detect slow/bad connections | Low | Add metrics | Medium |
| J10 | Binary Message Format | Hard to debug encrypted messages | By Design | Expected | N/A |
| J11 | No Automatic Recovery | Must manually reconnect on error | By Design | Expected | Medium |
| J12 | Single Room per Client | Can't be in multiple rooms | By Design | Expected | N/A |
| J13 | Presence via Data Channel | Uses Yjs updates for presence (hacky) | By Design | Expected | Medium |

**Note**: Category J issues are mostly by design and may not need fixing, just documentation.

---

## Likelihood Rankings (Top 20)

| Rank | Issue | Likelihood | Category | Impact |
|------|-------|------------|----------|--------|
| 1 | A4 - Yjs ClientID Collision | 85% | A | CRITICAL |
| 2 | E8 - Strict Mode Double Mount | 80% | E | MEDIUM |
| 3 | H4 - LocalStorage Isolation Failure | 80% | H | HIGH |
| 4 | C2 - Observer Wrong Instance | 75% | C | HIGH |
| 5 | G1 - Connection Before Observer | 75% | C | HIGH |
| 6 | C7 - Map Reference Staleness | 70% | C | HIGH |
| 7 | F9 - Missing Critical Logs | 70% | F | MEDIUM |
| 8 | A14 - Cross-Tab Yjs Awareness | 80% | A | CRITICAL |
| 9 | H1 - Resource Limits | 60% | H | MEDIUM |
| 10 | A6 - BroadcastChannel Interference | 60% | A | MEDIUM |
| 11 | B4 - MSG_UPDATE Race | 50% | B | MEDIUM |
| 12 | B6 - Catch-Up Lock Stuck | 40% | B | MEDIUM |
| 13 | C1 - Memory Leaks | 50% | C | MEDIUM |
| 14 | E4 - Peer Count Lag | 50% | E | LOW |
| 15 | F1 - Console Throttling | 50% | F | LOW |
| 16 | G2 - Genesis Checkpoint Race | 50% | G | MEDIUM |
| 17 | H2 - Page Crash | 50% | H | MEDIUM |
| 18 | D5 - Encryption Before Key Ready | 40% | D | HIGH |
| 19 | I3 - iOS WebKit Bugs | 40% | I | HIGH |
| 20 | I4 - Chrome Incognito Storage | 40% | I | MEDIUM |

---

## Issue Type Categorization

| Type | Description | Count | Top Issues |
|------|-------------|-------|------------|
| **IDENTITY** | ClientID, session, device identification | 15 | A4, A14, A3 |
| **STATE** | Yjs state management, observers, references | 15 | C2, C7, C1 |
| **INFRASTRUCTURE** | Testing, environment, CI/CD | 15 | H4, H1, H2 |
| **TIMING** | Race conditions, ordering, delays | 12 | G1, G2, B4 |
| **UI/REACT** | React lifecycle, rendering, state | 12 | E8, E4, E2 |
| **NETWORK** | WebSocket, server, message delivery | 10 | B6, B4, B10 |
| **CRYPTO** | E2EE, encryption, key derivation | 10 | D5, D3, D1 |
| **MONITORING** | Logging, diagnostics, observability | 10 | F9, F1, F2 |
| **CROSS-BROWSER** | Browser compatibility | 12 | I3, I4, I2 |
| **ARCHITECTURE** | Design decisions, trade-offs | 13 | J1, J2, J3 |

---

## Decision Matrix

| Scenario | Likely Cause | Action |
|----------|--------------|--------|
| Manual Chrome ↔ Safari PASSES, Auto FAILS | H4 (Test Infrastructure) | Fix Playwright isolation |
| Manual Chrome ↔ Safari FAILS (diff fingerprint) | D1 (Crypto) or A13 | Check deriveRoomId |
| Manual Chrome ↔ Safari FAILS (same fingerprint, no peers) | A4 (ClientID) or C2 (Observer) | Debug sync code |
| Manual Chrome ↔ Safari FAILS (console errors) | D3 (Crypto) or C1 (Memory) | Fix errors |
| Same-device Chrome+Chrome fails | A4 (ClientID Collision) | Already fixed |
| Intermittent failures | G1 (Race) or E8 (Double Mount) | Add synchronization |
| iPad specific issues | I3 (iOS Bugs) or I4 (Incognito) | Platform-specific fixes |

---

## Recommended Investigation Order

1. **Validate State** - Run manual Chrome ↔ Safari test
2. **If PASS**: Focus on H4 (Test Infrastructure) - automated tests don't reflect reality
3. **If FAIL (diff fingerprint)**: Focus on D1/A13 (Crypto) - Room ID derivation broken
4. **If FAIL (same fingerprint)**: Focus on A4/C2/G1 (Core Sync) - Fundamental sync bug
5. **If INTERMITTENT**: Focus on E8/G2 (Timing) - Race conditions in init sequence

---

## Confidence Assessment

| Area | Confidence Level | Reason |
|------|------------------|--------|
| Same-device testing | 70% | ClientID fix implemented, needs verification |
| Cross-device testing | 50% | User said it worked before, but unverified now |
| Automated tests | 30% | Known issues with Playwright isolation |
| 3+ device support | 20% | Not yet tested |
| Production readiness | 40% | Needs comprehensive validation |

---

## Next Steps Recommendation

**IMMEDIATE** (Before any code changes):
1. User runs manual Chrome ↔ Safari test
2. Document exact results (pass/fail, errors, logs)
3. Determine which category of issues we're dealing with

**SHORT TERM** (After validation):
1. If manual passes: Fix test infrastructure (H4, H1, H2)
2. If manual fails: Debug core sync (A4, C2, G1)

**MEDIUM TERM**:
1. Expand to full browser matrix (Sprint 3)
2. 3+ device support (Sprint 4)
3. Resilience testing (Sprint 5)

**LONG TERM**:
1. Production hardening (Sprint 6)
2. Performance optimization
3. Documentation and user guides
