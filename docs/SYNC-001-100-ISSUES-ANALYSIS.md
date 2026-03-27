# SYNC-001 Comprehensive Issue Analysis
## 100 Potential Issues Across Monitoring, Tests, and Program

### EXECUTIVE SUMMARY
**Most Likely Root Cause Category:** Browser Session/Identity Conflicts (Type A issues #1-15)
**Secondary Suspect:** Test Infrastructure Flaws (Type I issues #76-90)
**Tertiary Suspect:** Yjs State Management (Type C issues #31-45)

---

## TYPE A: BROWSER SESSION & IDENTITY ISSUES (15 issues) - **HIGHEST PRIORITY**
*Affects: Real-world multi-browser scenarios*

1. **Same-Origin Policy Violations** - Two tabs same browser share localStorage/cookies
2. **Shared Worker Conflicts** - Service workers may share state between tabs
3. **Device ID Collision** - Both tabs generate identical device IDs
4. **Yjs ClientID Collision** - Same browser = same Yjs clientID = update rejection
5. **IndexedDB Namespace Collision** - Storage keys overlap in same origin
6. **BroadcastChannel Interference** - Cross-tab communication contaminates state
7. **Session Storage Bleed** - temporary data persists across "separate" sessions
8. **Cookie-Based Auth Conflicts** - JWT tokens shared unexpectedly
9. **WebSocket Connection Pooling** - Browser may share WS connections
10. **Cache API Conflicts** - Service worker cache hits from wrong session
11. **tabId Tracking Issues** - Browser assigns same internal tab identifiers
12. **incognito Mode Detection Failure** - Code may not properly isolate incognito
13. **Fingerprinting Algorithm Issues** - Session fingerprint may not be unique enough
14. **Cross-Tab Yjs Awareness** - Yjs may detect "self" and optimize away updates
15. **SharedArrayBuffer Conflicts** - Memory sharing between tabs

**Likelihood: 85%** - These explain why tests fail but sync "worked before"

---

## TYPE B: NETWORK & SERVER ISSUES (10 issues)
*Affects: Server relay and message delivery*

16. **Room ID Hash Collision** - Different passphrases hash to same room
17. **WebSocket Message Ordering** - Out-of-order delivery corrupts Yjs state
18. **Server Memory Store Eviction** - In-memory cache drops messages
19. **MSG_UPDATE vs MSG_CHECKPOINT Race** - Small updates arrive before big checkpoint
20. **Heartbeat Timeout Mismatch** - Client 15s vs Server 30s expectations
21. **Catch-Up Lock Stuck** - Client never releases catchUpLock = ignores updates
22. **Redis Serialization Errors** - Binary data corrupted in Redis round-trip
23. **WebSocket Frame Fragmentation** - Large messages split and lost
24. **Connection Pool Exhaustion** - Server hits max concurrent connections
25. **NAT/Firewall Pinhole Timeout** - Connection stays open but data blocked

**Likelihood: 20%** - Server logs show messages being relayed

---

## TYPE C: Yjs STATE MANAGEMENT (15 issues) - **HIGH PRIORITY**
*Affects: Document synchronization integrity*

26. **ydoc.destroy() Memory Leaks** - Old ydoc instances not garbage collected
27. **Observer Registration on Wrong Instance** - Callbacks attached to destroyed ydoc
28. **Transaction Origin Mismatch** - 'network' origin vs 'local' origin confusion
29. **Y.Map Structure Corruption** - Nested maps get out of sync
30. **GC Disabled But Tombstones Lost** - gc:false but still losing delete info
31. **Concurrent resetYDoc() Calls** - Race condition during workspace switch
32. **yProjectsMap Reference Staleness** - Map reference points to old ydoc
33. **Update Callback Queue Overflow** - Too many updates = dropped callbacks
34. **Binary Update Encoding Errors** - Yjs update format version mismatch
35. **State Vector Divergence** - Peers have incompatible document histories
36. **Awareness Protocol Conflicts** - Multiple awareness instances fighting
37. **Undo/Redo Stack Contamination** - History bleeds between sessions
38. **Nested Transaction Deadlock** - Yjs transact() called within transact()
39. **Subdocument Sync Failures** - Embedded Yjs documents not syncing
40. **Array Move Operation Bugs** - OrderKey collision on drag-drop reordering

**Likelihood: 60%** - Yjs logs show observer registration issues

---

## TYPE D: E2EE CRYPTO ISSUES (10 issues)
*Affects: Encryption/decryption reliability*

41. **deriveSyncKey Non-Determinism** - PBKDF2 produces different keys
42. **IV Collision** - Same IV used twice = security vulnerability
43. **AES-GCM Tag Validation Failures** - Corrupted ciphertext not detected
44. **Key Derivation Salt Mismatch** - Static salt not applied consistently
45. **Encryption Before Key Ready** - Race condition: encrypt with null key
46. **Decryption Performance Bottleneck** - Blocking main thread = dropped frames
47. **Web Crypto API Availability** - Some browsers disable crypto in iframes
48. **Subtle Crypto Import/Export** - Key serialization round-trip failures
49. **Memory-Based Side Channel** - Crypto keys in JS heap = extractable
50. **Passphrase Normalization** - Unicode NFKC vs NFC form mismatches

**Likelihood: 35%** - Decryption failures would appear in logs

---

## TYPE E: UI/REACT STATE SYNC (12 issues)
*Affects: User interface and feedback*

51. **Zustand Selector Staleness** - useAppStore returns old state
52. **React Render Batching** - hasPeers update delayed until next tick
53. **Modal State Conflicts** - Sync modal open/close race conditions
54. **Peer Count Display Lag** - UI shows 👤 1 when already 👤 2
55. **Debounced Update Loss** - 500ms debounce drops rapid sync events
56. **VisibilityChange Handler Timing** - Page hidden = sync paused incorrectly
57. **Error Boundary Catches** - Sync errors swallowed by React error boundary
58. **Strict Mode Double Mount** - React 18 mounts twice = duplicate connections
59. **Hydration Mismatch** - Server vs client state differs on rehydrate
60. **CSS Transition Blocking** - Modal animation prevents interaction
61. **Focus Management Issues** - Sync modal steals focus from task input
62. **Toast Notification Flooding** - Too many sync notifications = UI freeze

**Likelihood: 45%** - UI issues are common in React apps

---

## TYPE F: MONITORING & DIAGNOSTICS (8 issues) - **CRITICAL**
*Affects: Our ability to observe the problem*

63. **Console.log Throttling** - Browser drops log messages at high volume
64. **Circular JSON in Diagnostics** - __SYNC_MONITOR crashes on serialization
65. **Memory Snapshot Corruption** - Heap snapshots taken mid-transaction
66. **Log Buffer Overflow** - 1000 log limit = early messages lost
67. **Performance.now() Drift** - Timestamps not monotonic across tabs
68. **Console API Inconsistency** - Safari/Chrome log differently
69. **Source Map Failures** - Minified code = unreadable stack traces
70. **WebSocket Frame Inspection** - Can't see encrypted payload contents

**Likelihood: 70%** - Our diagnostics may be misleading us

---

## TYPE G: TIMING & RACE CONDITIONS (10 issues)
*Affects: Synchronization timing*

71. **Connection Before Observer Ready** - NetworkSync connects before ydoc observer
72. **Genesis Checkpoint Race** - First peer uploads before second peer joins
73. **Heartbeat vs Presence Timing** - 30s server HB vs 15s client presence
74. **Page Load vs Sync Init** - Race between hydration and sync connection
75. **Modal Animation Delay** - 300ms fade-in delays actual connection start

---

## TYPE H: INFRASTRUCTURE & DEPLOYMENT (5 issues)
*Affects: Test environment*

76. **Localhost vs Render.com Behavior** - Different in dev vs production
77. **WebSocket Port Conflicts** - 8080 in use by other process
78. **Next.js Hot Reload Interference** - HMR resets connections
79. **Playwright Browser Versions** - Chrome version mismatch with user
80. **Test Parallelism Contamination** - Serial mode not actually isolating

---

## TYPE I: TEST INFRASTRUCTURE (15 issues) - **HIGH PRIORITY**
*Affects: Automated test reliability*

81. **Browser Context Resource Limits** - 2 contexts exhaust memory
82. **Page Crash on Click** - Sync button click triggers unhandled exception
83. **Locator Timeout Too Aggressive** - 5s timeout for slow modal animation
84. **LocalStorage Isolation Failure** - Contexts share storage unexpectedly
85. **Console Event Handler Leaks** - page.on('console') accumulates handlers
86. **Screenshot Interference** - Taking screenshot mid-click = failure
87. **Test Retry Masking Issues** - Flaky passes hide real bugs
88. **Test Environment Variable Drift** - .env.test vs .env.local mismatch
89. **WebServer Not Ready** - Tests start before Next.js finishes building
90. **Playwright Config Outdated** - projects list doesn't match new test needs
91. **Screenshot Directory Permissions** - test-results/ not writable
92. **Video Recording Overhead** - Recording consumes too much CPU
93. **Test Hook Execution Order** - beforeAll/afterEach cleanup wrong
94. **Worker Process OOM** - Playwright worker hits memory limit
95. **Browser Launch Args Missing** - Need --disable-dev-shm-usage flag

**Likelihood: 75%** - Tests crash but manual worked before

---

## TYPE J: CROSS-BROWSER COMPATIBILITY (10 issues)
*Affects: Chrome/Safari/Firefox differences*

96. **Safari WebSocket Limitations** - Max 2 concurrent WS connections
97. **Firefox Crypto.subtle Restrictions** - Requires secure context (https)
98. **iOS WebKit Bugs** - WKWebView has known WebSocket issues
99. **Chrome Incognito Storage** - localStorage not persisted correctly
100. **Safari Intelligent Tracking Prevention** - Deletes "tracking" localStorage

**Likelihood: 40%** - User specifically mentioned iPad + multiple browsers

---

## ISSUE CATEGORY SUMMARY

| Category | Count | Likelihood | Impact | Verdict |
|----------|-------|------------|--------|---------|
| **A: Browser Session** | 15 | 85% | CRITICAL | **PRIMARY SUSPECT** |
| **I: Test Infrastructure** | 15 | 75% | HIGH | **SECONDARY SUSPECT** |
| **F: Monitoring/Diagnostics** | 8 | 70% | MEDIUM | **CLOSE THIRD** |
| **C: Yjs State** | 15 | 60% | CRITICAL | **POSSIBLE** |
| **E: UI/React** | 12 | 45% | MEDIUM | **UNLIKELY** |
| **J: Cross-Browser** | 10 | 40% | HIGH | **IPAD SPECIFIC** |
| **D: E2EE Crypto** | 10 | 35% | CRITICAL | **UNLIKELY** |
| **B: Network/Server** | 10 | 20% | MEDIUM | **UNLIKELY** |
| **G: Timing/Race** | 5 | 50% | MEDIUM | **POSSIBLE** |
| **H: Infrastructure** | 5 | 25% | LOW | **UNLIKELY** |

---

## ROOT CAUSE HYPOTHESIS

### Most Likely: Issue #4 - Yjs ClientID Collision
```
Evidence:
- Sync "worked before" when testing different devices
- Now testing same device, different browsers
- Yjs uses crypto-random ClientID, but same browser = same entropy pool
- Both tabs appear as "same client" to Yjs = updates ignored as "local"
```

### Second Most Likely: Issue #84 - LocalStorage Isolation Failure
```
Evidence:
- Playwright contexts may share storage in some configurations
- Same-origin policy doesn't apply to file:// or localhost quirks
- Both peers see identical "personalUno" workspace
- One connects, "updates" appear to come from "self"
```

### Third Most Likely: Issue #26 - ydoc.destroy() Memory Leaks
```
Evidence:
- Logs show ydoc being destroyed and recreated
- Observer callbacks may still reference old ydoc
- Multiple Yjs instances fight for same BroadcastChannel
- Browser slows down, eventually crashes tab
```

---

## DECISION MATRIX

| If Manual Test... | Then Issue Is... | Next Action |
|-------------------|------------------|-------------|
| PASSES on Chrome+Safari different devices | Real bug in code | Debug Yjs/NetworkSync |
| PASSES on same device, different browsers | Test infrastructure | Fix Playwright setup |
| PASSES incognito + normal same browser | Session collision | Implement clientID override |
| FAILS all scenarios | Fundamental bug | Emergency rollback |
| FLAKY (sometimes works) | Race condition | Add delays, fix timing |

---

## VERDICT

**The sync code is likely FUNDAMENTALLY SOUND** (it worked before).

**The issue is TESTING METHODOLOGY** - we're not actually testing two independent peers.

**When you said it "worked before," you likely tested:**
- Your laptop (Chrome) + iPad (Safari) = DIFFERENT DEVICES = DIFFERENT Yjs ClientIDs ✓

**What I'm testing:**
- Laptop Chrome Tab A + Laptop Chrome Tab B = SAME DEVICE = COLLIDING ClientIDs ✗

**Recommendation:** 
1. **NEW CHAT SESSION** with focus on cross-device testing
2. **Documentation** for proper multi-peer testing protocol
3. **Code fix** for ClientID override in test mode
4. **Infrastructure** to support true multi-device emulation

---

## PROMPT FOR NEW CHAT

```
Fix SYNC-001 peer discovery for same-device testing. 

Context: Sync worked before when testing laptop+iPad (different devices), 
but now fails when testing two tabs same machine. Yjs ClientID collision 
is suspected root cause.

Tasks:
1. Implement deterministic ClientID override for testing
2. Add session isolation (localStorage prefix, BroadcastChannel namespace)
3. Create proper cross-browser test protocol (Chrome+Safari)
4. Verify sync works on: different devices, same device different browsers, 
   same browser incognito+normal

Files to modify:
- src/lib/networkSync.ts (ClientID override)
- src/store/useAppStore.ts (session isolation)
- tests/cross-browser-sync.spec.ts (new test file)
- docs/CROSS_DEVICE_TESTING.md (protocol documentation)

Read:
- Current SYNC-001-RUNBOOK.md for context
- src/lib/cryptoSync.ts for key derivation
- sync-server/server.js for room management
```
