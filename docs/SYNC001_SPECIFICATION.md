# SYNC-001 Specification Engineering Document

## 1. SELF-CONTAINED PROBLEM STATEMENT

### Primary Issue
The Cubit Connect real-time synchronization feature (SYNC-001) exhibits inconsistent behavior:
- **Working**: Cross-device sync (Chrome on laptop ↔ Safari on iPad) functions correctly
- **Broken**: Same-device sync (Chrome Tab A ↔ Chrome Tab B) fails with peer discovery stuck at 👤 1
- **Symptom**: Peers connect to server with matching Session Fingerprint but don't detect each other

### Secondary Issues
1. Automated Playwright tests fail while manual testing passes (sometimes)
2. Three-device sync scenario not yet validated
3. Offline/sleeping device behavior undefined and untested
4. Test infrastructure may be masking or causing issues

### Root Cause Hypothesis
Yjs ClientID collision: Same-browser tabs generate identical ClientIDs from shared crypto entropy pool, causing Yjs to ignore "peer" updates as "local changes".

---

## 2. STRICT, VERIFIABLE ACCEPTANCE CRITERIA

### Phase 1: Two-Device Sync (MVP)
**Goal**: Chrome ↔ Safari sync works reliably

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| P1-1 | Chrome + Safari (different devices) show 👤 2 within 15s | Manual test protocol |
| P1-2 | Task created on Chrome appears on Safari within 5s | Manual observation |
| P1-3 | Task created on Safari appears on Chrome within 5s | Manual observation |
| P1-4 | Same Session Fingerprint on both devices | Visual confirmation |
| P1-5 | No "E2EE Decryption failed" errors in console | Console inspection |
| P1-6 | Manual test passes 3/3 consecutive attempts | Repeated testing |

### Phase 2: Same-Device Sync
**Goal**: Chrome + Chrome incognito or Chrome + Safari on same machine works

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| P2-1 | Chrome Tab + Chrome Incognito show 👤 2 within 15s | Manual test protocol |
| P2-2 | Data syncs bidirectionally between tabs | Manual observation |
| P2-3 | Automated Playwright test passes | CI/CD verification |
| P2-4 | ClientIDs are unique per tab (verified in logs) | Console inspection |

### Phase 3: Multi-Browser Support
**Goal**: Firefox, Edge, mobile Safari, Chrome Android all work

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| P3-1 | Chrome ↔ Firefox sync works | Manual cross-browser test |
| P3-2 | Chrome ↔ Edge sync works | Manual cross-browser test |
| P3-3 | iPad Safari ↔ Desktop Chrome sync works | Manual device test |
| P3-4 | Android Chrome ↔ iPad Safari sync works | Manual device test |
| P3-5 | All combinations pass manual test protocol | Test matrix completion |

### Phase 4: Resilience & Edge Cases
**Goal**: System handles real-world usage patterns

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| P4-1 | 3+ devices can sync simultaneously | Manual multi-device test |
| P4-2 | Device sleeping → waking reconnects within 30s | Simulated sleep test |
| P4-3 | Device offline 5min → changes sync when reconnected | Network interruption test |
| P4-4 | Last device standing maintains data (no data loss) | Single device persistence test |
| P4-5 | Conflict resolution handles simultaneous edits | Concurrent edit test |
| P4-6 | 24-hour continuous sync test passes (no memory leaks) | Long-running test |

### Phase 5: Production Hardening
**Goal**: System ready for public use

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| P5-1 | 95%+ automated test pass rate over 100 runs | Statistical testing |
| P5-2 | Sync server handles 100 concurrent rooms | Load testing |
| P5-3 | Memory usage stable over 8-hour session | Performance monitoring |
| P5-4 | Documentation complete for end users | Documentation review |
| P5-5 | Error handling graceful (user-friendly messages) | Error injection testing |

---

## 3. CONSTRAINT ARCHITECTURE

### MUST DO
1. **MUST** verify 2-device sync works before expanding to 3+ devices
2. **MUST** use manual testing with real browsers before trusting automated tests
3. **MUST** test Chrome ↔ Safari as the primary cross-browser scenario
4. **MUST** verify Session Fingerprint matching before debugging sync issues
5. **MUST** have the user confirm manual tests pass before declaring success
6. **MUST** document all test results and failures
7. **MUST** fix root causes, not symptoms (no workarounds that hide bugs)

### MUST NOT DO
1. **MUST NOT** assume automated Playwright tests reflect real browser behavior
2. **MUST NOT** test same-browser regular + regular tabs (same instance = invalid test)
3. **MUST NOT** proceed to 3+ device scenarios until 2-device is 100% reliable
4. **MUST NOT** ignore browser console errors during testing
5. **MUST NOT** change production code to accommodate broken tests
6. **MUST NOT** skip manual verification even if automated tests pass
7. **MUST NOT** optimize performance before correctness is proven

### SHOULD DO (when applicable)
1. **SHOULD** test with user's actual devices (iPad, computer) when possible
2. **SHOULD** test during different network conditions (WiFi, cellular)
3. **SHOULD** monitor resource usage during extended tests
4. **SHOULD** have rollback plan for any code changes

### SHOULD NOT DO (unless necessary)
1. **SHOULD NOT** modify core sync algorithm without explicit user direction
2. **SHOULD NOT** add features before fixing existing bugs
3. **SHOULD NOT** optimize for edge cases before common cases work

---

## 4. GRANULAR TASK DECOMPOSITION (Sprints)

### SPRINT 0: Immediate Validation (Complete First)
**Duration**: 1 session
**Goal**: Confirm current state with manual test

**Tasks**:
- [ ] User runs manual sync test (Chrome ↔ Safari)
- [ ] User reports results using template
- [ ] If FAIL: Debug with user watching
- [ ] If PASS: Document and proceed

**Exit Criteria**:
- Manual test result recorded
- Decision: Fix bugs first OR proceed with sprints

---

### SPRINT 1: Two-Device Hardening
**Duration**: 2-3 sessions
**Goal**: Chrome ↔ Safari works 100% of the time

**Tasks**:
1. **Investigation**
   - [ ] List 100 potential issues (comprehensive analysis)
   - [ ] Categorize issues by type and likelihood
   - [ ] Identify top 5 most probable root causes
   
2. **Testing Infrastructure**
   - [ ] Create manual test protocol document
   - [ ] Add test data-ids to UI components for verification
   - [ ] Create browser console monitoring script
   - [ ] Document debug page usage
   
3. **Manual Testing Matrix**
   - [ ] Chrome (computer) ↔ Safari (iPad) - 3 runs
   - [ ] Chrome (computer) ↔ Chrome Incognito (computer) - 3 runs
   - [ ] Safari (computer) ↔ Chrome (computer) - 3 runs
   - [ ] Record all results with screenshots/logs
   
4. **Bug Fixes (if any found)**
   - [ ] Fix identified issues
   - [ ] Re-test after each fix
   - [ ] Verify no regressions

**Exit Criteria**:
- 3/3 manual tests pass for Chrome ↔ Safari
- All acceptance criteria P1-1 through P1-6 satisfied

---

### SPRINT 2: Automated Test Reliability
**Duration**: 2 sessions
**Goal**: Automated tests reflect real-world behavior

**Tasks**:
1. **Test Analysis**
   - [ ] Review why Playwright tests fail when manual passes
   - [ ] Identify test infrastructure issues
   - [ ] Document Playwright limitations
   
2. **Test Improvements**
   - [ ] Implement ClientID isolation for same-device testing
   - [ ] Add proper session isolation (localStorage, BroadcastChannel)
   - [ ] Create reliable 2-peer test that mimics real devices
   
3. **Cross-Browser Testing**
   - [ ] Add Playwright projects for Chrome, Safari, Firefox
   - [ ] Create cross-browser sync test
   - [ ] Verify test passes with different browser combinations
   
4. **CI Integration**
   - [ ] Ensure tests run reliably in CI
   - [ ] Add test result reporting

**Exit Criteria**:
- Automated test passes match manual test results
- Test passes 10/10 consecutive runs

---

### SPRINT 3: Multi-Browser Matrix
**Duration**: 3 sessions
**Goal**: All major browser combinations work

**Tasks**:
1. **Browser Support Matrix**
   | Combination | Priority | Status |
   |-------------|----------|--------|
   | Chrome ↔ Safari | P0 | Sprint 1 |
   | Chrome ↔ Firefox | P1 | Sprint 3 |
   | Chrome ↔ Edge | P1 | Sprint 3 |
   | Safari ↔ Firefox | P2 | Sprint 3 |
   | iPad Safari ↔ Desktop Chrome | P0 | Sprint 1 |
   | Android Chrome ↔ iPad Safari | P1 | Sprint 3 |
   
2. **Testing**
   - [ ] Manual test each combination 3 times
   - [ ] Document browser-specific quirks
   - [ ] Create browser compatibility matrix
   
3. **Fixes**
   - [ ] Address browser-specific issues
   - [ ] Add polyfills if needed
   - [ ] Test crypto.subtle availability across browsers

**Exit Criteria**:
- All P0 and P1 combinations pass 3/3 tests
- Browser compatibility matrix documented

---

### SPRINT 4: Three-Device Sync
**Duration**: 2 sessions
**Goal**: 3+ devices sync correctly

**Tasks**:
1. **Manual Testing**
   - [ ] Chrome + Safari + Firefox simultaneous connection
   - [ ] Verify all show 👤 3
   - [ ] Test data syncs to all 3 devices
   - [ ] Test device leaving and rejoining
   
2. **Edge Cases**
   - [ ] All 3 edit simultaneously (conflict resolution)
   - [ ] One device slow connection
   - [ ] One device intermittent connection
   
3. **Documentation**
   - [ ] Document 3-device behavior
   - [ ] Document any limitations

**Exit Criteria**:
- 3-device sync works reliably
- Device join/leave handled gracefully

---

### SPRINT 5: Resilience & Real-World Scenarios
**Duration**: 3 sessions
**Goal**: System handles realistic usage patterns

**Tasks**:
1. **Sleep/Wake Testing**
   - [ ] Device sleeps for 1min, wakes, reconnects
   - [ ] Device sleeps for 5min, wakes, syncs changes
   - [ ] Device sleeps for 30min, wakes, full state sync
   
2. **Offline Resilience**
   - [ ] Device offline, makes changes, reconnects (delta sync)
   - [ ] All devices offline, one makes changes, all reconnect
   - [ ] Network interruption mid-sync
   
3. **Long-Running Test**
   - [ ] 4-hour continuous sync test
   - [ ] Monitor memory usage
   - [ ] Monitor connection stability
   
4. **Resource Monitoring**
   - [ ] Document CPU usage patterns
   - [ ] Document memory usage patterns
   - [ ] Document battery impact (mobile)

**Exit Criteria**:
- All resilience tests pass
- Memory usage stable (no leaks)
- Reconnection reliable

---

### SPRINT 6: Production Hardening
**Duration**: 2 sessions
**Goal**: System ready for public release

**Tasks**:
1. **Performance Optimization**
   - [ ] Checkpoint frequency tuning (currently 30s)
   - [ ] Presence heartbeat optimization (currently 15s)
   - [ ] Message batching if needed
   
2. **Error Handling**
   - [ ] User-friendly error messages
   - [ ] Automatic reconnection with backoff
   - [ ] Clear status indicators
   
3. **Documentation**
   - [ ] End-user sync guide
   - [ ] Troubleshooting guide
   - [ ] Browser compatibility chart
   - [ ] Known limitations documented
   
4. **Final Validation**
   - [ ] Complete acceptance criteria verification
   - [ ] Security review (E2EE implementation)
   - [ ] Performance benchmarks

**Exit Criteria**:
- 95%+ test pass rate
- Documentation complete
- User acceptance sign-off

---

## 5. DECISION FRAMEWORK

### When to Continue in Current Chat
- Fixing specific identified bugs
- Implementing ClientID isolation (already done)
- Small test improvements
- Documentation updates

### When to Start New Chat
- Beginning a new Sprint
- Major architectural changes
- Comprehensive 100-issue analysis
- Multi-day task execution

### Current Recommendation
**START NEW CHAT** for Sprint 0 (Manual Validation) because:
1. Need user's real-time participation
2. Uncertain current state (may need debugging)
3. Requires iterative testing
4. Should not be interrupted

---

## 6. RISK ASSESSMENT

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Manual tests fail (real bug) | Medium | High | Debug together, don't proceed until fixed |
| Playwright never matches reality | Medium | Medium | Rely on manual testing, use automation for smoke tests only |
| Browser compatibility issues | High | Medium | Test matrix early, document limitations |
| 3+ device complexity | Medium | Medium | Defer to Sprint 4, focus on 2-device first |
| Server scalability | Low | High | Load test in Sprint 6 |
| Crypto/E2EE issues | Low | Critical | Security review in Sprint 6 |

---

## 7. SUCCESS METRICS

### Primary Metrics
- **Manual Test Pass Rate**: 100% for P0 scenarios
- **Automated Test Pass Rate**: 95%+ over 100 runs
- **Mean Time To Peer Discovery**: < 15 seconds
- **Sync Latency**: < 5 seconds for task propagation

### Secondary Metrics
- **Memory Growth**: < 10% over 8 hours
- **Reconnection Time**: < 10 seconds after sleep
- **Browser Combinations Supported**: 6+ (from matrix)
- **Max Concurrent Devices**: 5+ per room

### Confidence Levels
- **Current Confidence**: 60% (needs manual validation)
- **Post-Sprint 1 Target**: 90%
- **Post-Sprint 6 Target**: 99%
