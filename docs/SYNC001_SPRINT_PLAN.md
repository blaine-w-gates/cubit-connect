# SYNC-001 Sprint Execution Plan

## Sprint Overview

**Objective**: Achieve 100% reliable two-device sync (Chrome ↔ Safari) before expanding to multi-browser, multi-device, and edge case scenarios.

**Philosophy**: Manual testing with real browsers takes precedence over automated tests. We fix real bugs first, then fix test infrastructure.

---

## SPRINT 0: State Validation (START HERE)
**Duration**: 1 session (today)  
**Goal**: Determine actual current state through manual testing  
**Dependency**: Requires your participation (iPad + Computer)

### Tasks

#### 0.1 Preparation (5 minutes)
- [ ] Ensure iPad and computer are on same WiFi network
- [ ] Open Chrome on computer (normal mode, not incognito)
- [ ] Open Safari on iPad
- [ ] Have both devices visible for simultaneous testing

#### 0.2 Manual Test Protocol (10 minutes)
1. **Computer (Chrome)**:
   - Navigate to: `https://cubit-connect-url/todo` (production URL)
   - Open DevTools → Console (F12)
   - Click "🔒 Sync" button
   - Enter passphrase: `manual-test-2024`
   - Click "Establish Secure Connection"
   - Wait for "Securely Connected" status
   - **Record**: Session Fingerprint shown (e.g., "A1B2")
   - **Record**: Peer count shown (👤 1 initially)

2. **iPad (Safari)**:
   - Navigate to same URL
   - Open JavaScript console (Settings → Advanced → Web Inspector)
   - Click "🔒 Sync" button
   - Enter **same passphrase**: `manual-test-2024`
   - Click "Establish Secure Connection"
   - **Verify**: Same Session Fingerprint as computer
   - **Watch**: Peer count should change to 👤 2 within 15 seconds

3. **Data Sync Test**:
   - Close sync modal on both devices
   - On computer: Add a todo task named "Test from Chrome"
   - Wait 5 seconds
   - Check iPad: Task should appear automatically
   - On iPad: Add a todo task named "Test from iPad"
   - Wait 5 seconds
   - Check computer: Task should appear

#### 0.3 Results Documentation
Fill out this template:
```
=== MANUAL TEST RESULTS ===
Date: [fill in]
Environment: [Production/Local]

Computer (Chrome):
- Session Fingerprint: [e.g., A1B2]
- Peer Count after 15s: [👤 1 or 👤 2]
- Console Errors: [None/List them]
- Data Sync Received: [YES/NO]

iPad (Safari):
- Session Fingerprint: [e.g., A1B2]
- Peer Count after 15s: [👤 1 or 👤 2]
- Console Errors: [None/List them]
- Data Sync Received: [YES/NO]

VERDICT: [PASS / FAIL]

If FAIL:
- What failed: [Peer discovery / Data sync / Other]
- Error messages: [Copy from console]
- Screenshots: [Attach if possible]
```

#### 0.4 Decision Gate
Based on your results:

**If PASS**: Proceed to Sprint 1 (Hardening)
**If FAIL**: We debug together in this chat session before proceeding

---

## SPRINT 1: Two-Device Hardening (2-3 sessions)
**Status**: BLOCKED until Sprint 0 completes  
**Goal**: Chrome ↔ Safari works 100% reliably

### 1.1 If Manual Test PASSES
**Hypothesis**: Sync code is fundamentally sound; issues are with test infrastructure

**Tasks**:
- [ ] Run manual test 3 more times to confirm consistency
- [ ] Document any intermittent behavior
- [ ] Verify Session Fingerprint always matches
- [ ] Verify peer discovery always succeeds within 15s
- [ ] Verify bidirectional data sync works

**Deliverable**: Manual test passes 3/3 times consistently

### 1.2 If Manual Test FAILS
**Hypothesis**: Real bug exists in sync code

**Tasks**:
- [ ] Debug with user watching (screen share if possible)
- [ ] Check console for specific error messages
- [ ] Compare Session Fingerprints (must match)
- [ ] Check for "[PRESENCE]" logs in console
- [ ] Check for "E2EE Decryption failed" errors
- [ ] Identify root cause from 100-issue analysis
- [ ] Implement fix
- [ ] Re-test until pass

**Deliverable**: Manual test passes after fix

### 1.3 Cross-Mode Testing (Same Computer)
**Goal**: Verify same-device testing now works with ClientID fix

**Tasks**:
- [ ] Chrome (normal) ↔ Chrome Incognito
- [ ] Chrome ↔ Safari (both on same computer)
- [ ] Verify both show 👤 2
- [ ] Verify data syncs

**Deliverable**: Same-device testing works reliably

---

## SPRINT 2: Automated Test Reliability (2 sessions)
**Status**: BLOCKED until Sprint 1 completes  
**Goal**: Automated tests reflect real-world behavior

### 2.1 Playwright Investigation
**Tasks**:
- [ ] Review why Playwright tests fail when manual passes
- [ ] Document specific failure modes
- [ ] Check if localStorage isolation is working
- [ ] Check if ClientID isolation is working

### 2.2 Test Infrastructure Fixes
**Tasks**:
- [ ] Implement session isolation in tests
- [ ] Ensure each test page has unique ClientID
- [ ] Add proper cleanup between tests
- [ ] Reduce test flakiness

### 2.3 Reliable Test Suite
**Tasks**:
- [ ] Create test that passes 10/10 times
- [ ] Test cross-browser scenarios in CI
- [ ] Add test reporting

**Deliverable**: Automated test pass rate 95%+

---

## SPRINT 3: Multi-Browser Matrix (3 sessions)
**Status**: BLOCKED until Sprint 2 completes  
**Goal**: All major browser combinations work

### 3.1 Browser Support Matrix

| Combination | Priority | Manual Test | Automated Test | Status |
|-------------|----------|-------------|----------------|--------|
| Chrome ↔ Safari (diff devices) | P0 | ☐ | ☐ | NOT STARTED |
| Chrome ↔ Chrome Incognito | P0 | ☐ | ☐ | NOT STARTED |
| Chrome ↔ Safari (same computer) | P1 | ☐ | ☐ | NOT STARTED |
| Chrome ↔ Firefox | P1 | ☐ | ☐ | NOT STARTED |
| Chrome ↔ Edge | P1 | ☐ | ☐ | NOT STARTED |
| Safari ↔ Firefox | P2 | ☐ | ☐ | NOT STARTED |
| iPad Safari ↔ Desktop Chrome | P0 | ☐ | ☐ | NOT STARTED |
| Android Chrome ↔ iPad Safari | P1 | ☐ | ☐ | NOT STARTED |

### 3.2 Manual Testing (Each combination 3 times)
**Tasks**:
- [ ] Test each P0 combination 3 times
- [ ] Test each P1 combination 2 times
- [ ] Document browser-specific quirks
- [ ] Create compatibility matrix

**Deliverable**: All P0 combinations pass 3/3 times

### 3.3 Browser-Specific Fixes
**Tasks**:
- [ ] Fix any Safari-specific issues
- [ ] Fix any Firefox-specific issues
- [ ] Test crypto.subtle availability
- [ ] Add polyfills if needed

---

## SPRINT 4: Three-Device Sync (2 sessions)
**Status**: BLOCKED until Sprint 3 completes  
**Goal**: 3+ devices sync correctly

### 4.1 Manual Testing
**Tasks**:
- [ ] Chrome + Safari + Firefox simultaneous connection
- [ ] Verify all show 👤 3
- [ ] Test data syncs to all 3 devices
- [ ] Test device leaving and rejoining

### 4.2 Edge Cases
**Tasks**:
- [ ] All 3 edit simultaneously (conflict resolution)
- [ ] One device with slow connection
- [ ] One device with intermittent connection

**Deliverable**: 3-device sync works reliably

---

## SPRINT 5: Resilience & Real-World (3 sessions)
**Status**: BLOCKED until Sprint 4 completes  
**Goal**: System handles realistic usage patterns

### 5.1 Sleep/Wake Testing
**Tasks**:
- [ ] Device sleeps 1min → wakes → reconnects within 30s
- [ ] Device sleeps 5min → wakes → syncs changes
- [ ] Device sleeps 30min → wakes → full state sync

### 5.2 Offline Resilience
**Tasks**:
- [ ] Device offline → makes changes → reconnects (delta sync)
- [ ] All devices offline → one makes changes → all reconnect
- [ ] Network interruption mid-sync

### 5.3 Long-Running Test
**Tasks**:
- [ ] 4-hour continuous sync test
- [ ] Monitor memory usage
- [ ] Monitor connection stability

### 5.4 Resource Monitoring
**Tasks**:
- [ ] Document CPU usage patterns
- [ ] Document memory usage patterns
- [ ] Document battery impact (mobile)

**Deliverable**: All resilience tests pass

---

## SPRINT 6: Production Hardening (2 sessions)
**Status**: BLOCKED until Sprint 5 completes  
**Goal**: System ready for public release

### 6.1 Performance Optimization
**Tasks**:
- [ ] Tune checkpoint frequency (currently 30s)
- [ ] Tune presence heartbeat (currently 15s)
- [ ] Optimize message batching if needed

### 6.2 Error Handling
**Tasks**:
- [ ] User-friendly error messages
- [ ] Automatic reconnection with backoff
- [ ] Clear status indicators

### 6.3 Documentation
**Tasks**:
- [ ] End-user sync guide
- [ ] Troubleshooting guide
- [ ] Browser compatibility chart
- [ ] Known limitations documented

### 6.4 Final Validation
**Tasks**:
- [ ] Complete acceptance criteria verification
- [ ] Security review (E2EE implementation)
- [ ] Performance benchmarks

**Deliverable**: 95%+ test pass rate, documentation complete

---

## Current Status Dashboard

| Sprint | Status | Blocker | Completion |
|--------|--------|---------|------------|
| Sprint 0: Validation | 🔴 NOT STARTED | Waiting for your manual test | 0% |
| Sprint 1: Hardening | ⬜ BLOCKED | Needs Sprint 0 | 0% |
| Sprint 2: Automated Tests | ⬜ BLOCKED | Needs Sprint 1 | 0% |
| Sprint 3: Multi-Browser | ⬜ BLOCKED | Needs Sprint 2 | 0% |
| Sprint 4: 3+ Devices | ⬜ BLOCKED | Needs Sprint 3 | 0% |
| Sprint 5: Resilience | ⬜ BLOCKED | Needs Sprint 4 | 0% |
| Sprint 6: Production | ⬜ BLOCKED | Needs Sprint 5 | 0% |

**Overall Progress**: 0% (Sprint 0 not started)

---

## Immediate Next Step

**Action Required From You**:
Run the manual test described in Sprint 0.1 and Sprint 0.2 above.

**Time Required**: 15 minutes  
**What You Need**:
- Your iPad with Safari
- Your computer with Chrome
- Both on same WiFi
- Production Cubit Connect URL

**Expected Outcome**:
Either:
1. ✅ "Test PASSED - Chrome and Safari show 👤 2 and sync data"
2. ❌ "Test FAILED - [specific failure mode]"

Based on your result, we'll either:
- **If PASS**: Continue with Sprint 1 (hardening and test infrastructure)
- **If FAIL**: Debug the issue immediately in this chat

---

## Resource Requirements

### Your Time Commitment
- Sprint 0: 15 minutes (today)
- Sprint 1: 30 minutes (manual testing)
- Sprint 2: 15 minutes (validation)
- Sprint 3: 60 minutes (cross-browser testing)
- Sprint 4: 30 minutes (3-device testing)
- Sprint 5: 60 minutes (resilience testing)
- Sprint 6: 15 minutes (final validation)

**Total**: ~3.5 hours of your testing time over multiple sessions

### My Time Commitment
- Code fixes and improvements: ~8-12 hours
- Test infrastructure: ~4-6 hours
- Documentation: ~2-4 hours

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Manual test fails | Debug immediately, don't proceed until fixed |
| Browser-specific issues | Document limitations, fix critical ones |
| Time constraints | Prioritize P0 scenarios, defer P2 |
| 3+ device complexity | Defer to Sprint 4, focus on 2-device first |

---

## Definition of Done

**SYNC-001 Complete When**:
1. ✅ Manual Chrome ↔ Safari test passes 3/3 times
2. ✅ Automated tests pass 95%+ of the time
3. ✅ Browser compatibility matrix documented
4. ✅ 3-device sync tested and working
5. ✅ Resilience tests (sleep, offline) pass
6. ✅ User documentation complete
7. ✅ You confirm: "Sync works reliably for my use case"

---

## Decision: Continue Here vs New Chat

**RECOMMENDATION**: Continue in **THIS CHAT** for Sprint 0 because:

1. **Immediate feedback needed**: I need your manual test results now
2. **Possible debugging**: If test fails, we debug immediately
3. **Context preserved**: All 100 issues and analysis are here
4. **Fast iteration**: Can make changes and re-test quickly

**When to Start New Chat**:
- After Sprint 0 completes and we know the state
- Beginning Sprint 1 if it spans multiple days
- Any major architectural changes

---

## Ready to Begin?

**Please run the manual test in Sprint 0 and report results.**

I'll wait for your response with either:
1. Test passed - we proceed to hardening
2. Test failed - we debug immediately
3. Questions about the test procedure
