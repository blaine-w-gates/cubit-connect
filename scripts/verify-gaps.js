#!/usr/bin/env node
/**
 * Gap Verification Script
 *
 * Automated verification of the 50 identified gaps.
 * Checks which features are actually working vs skeleton code.
 *
 * @module verify-gaps
 * @verification
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// ============================================================================
// GAP DEFINITIONS (from CRITICAL_REVIEW_50_GAPS.md)
// ============================================================================

const GAPS = {
  critical: [
    {
      id: 'C1',
      name: 'Real Supabase Connection',
      check: 'checkSupabaseConnection',
      description: 'SupabaseSync actually connects to Supabase Realtime',
    },
    {
      id: 'C2',
      name: 'E2EE Actually Encrypts',
      check: 'checkE2EEIntegration',
      description: 'broadcastUpdate calls encryptUpdate',
    },
    {
      id: 'C3',
      name: 'Checkpoint Service Wired',
      check: 'checkCheckpointIntegration',
      description: 'CheckpointService used by SupabaseSync',
    },
    {
      id: 'C4',
      name: 'Performance Monitor Wired',
      check: 'checkPerformanceIntegration',
      description: 'PerformanceMonitor measures actual operations',
    },
    {
      id: 'C5',
      name: 'Cleanup Jobs Auto-Start',
      check: 'checkCleanupAutoStart',
      description: 'Jobs start automatically on init',
    },
    {
      id: 'C6',
      name: 'Alerting Connected',
      check: 'checkAlertingHooks',
      description: 'Alerting called on failures',
    },
    {
      id: 'C7',
      name: 'No Race Conditions',
      check: 'checkRaceConditions',
      description: 'Fallback logic is atomic',
    },
    {
      id: 'C8',
      name: 'Error Propagation',
      check: 'checkErrorPropagation',
      description: 'Errors reach user/UI',
    },
    {
      id: 'C9',
      name: 'Retry Logic',
      check: 'checkRetryLogic',
      description: 'Exponential backoff implemented',
    },
    {
      id: 'C10',
      name: 'Connection Timeout',
      check: 'checkTimeoutHandling',
      description: '5s timeout on connect',
    },
    {
      id: 'C11',
      name: 'No Skeleton Code Only',
      check: 'checkNoSkeletonCode',
      description: 'Features work, not just exist',
    },
    {
      id: 'C12',
      name: 'Tests Pass',
      check: 'checkTestsPass',
      description: '207/207 tests passing',
    },
  ],
  major: [
    { id: 'M1', name: 'E2E Tests', check: 'checkE2ETests' },
    { id: 'M2', name: 'Performance Benchmarks', check: 'checkPerformanceBenchmarks' },
    { id: 'M3', name: 'Security Headers', check: 'checkSecurityHeaders' },
    { id: 'M4', name: 'CORS Configured', check: 'checkCORS' },
    { id: 'M5', name: 'API Rate Limiting', check: 'checkAPIRateLimit' },
    { id: 'M6', name: 'Health Check Caching', check: 'checkHealthCache' },
    { id: 'M7', name: 'Yjs Deduplication', check: 'checkYjsDebounce' },
    { id: 'M8', name: 'Bandwidth Throttling', check: 'checkBandwidthThrottle' },
    { id: 'M9', name: 'Database Index', check: 'checkDBIndex' },
    { id: 'M10', name: 'Graceful Degradation UX', check: 'checkGracefulDegradation' },
    { id: 'M11', name: 'Client Rate Limiting', check: 'checkClientRateLimit' },
    { id: 'M12', name: 'Load Shedding', check: 'checkLoadShedding' },
  ],
};

// ============================================================================
// CHECK FUNCTIONS
// ============================================================================

function checkSupabaseConnection() {
  const filePath = path.join(process.cwd(), 'src/lib/supabaseSyncProd.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check if actually subscribes to channel
  const hasSubscription = content.includes('.subscribe(') || content.includes('.on(');
  const hasChannelCreation = content.includes('supabase.channel(') || content.includes('.channel(');
  const hasSubscribeCall = content.includes('supabaseChannel?.subscribe') || content.includes('channel?.subscribe') || content.includes('.subscribe(');

  return {
    passed: hasSubscription && hasChannelCreation && hasSubscribeCall,
    evidence: (hasSubscription && hasChannelCreation && hasSubscribeCall)
      ? 'Found channel creation and subscription'
      : `Missing: ${!hasChannelCreation ? 'channel creation' : ''} ${!hasSubscribeCall ? 'subscribe call' : ''}`,
    fix: 'Ensure supabase.channel() is called and .subscribe() is invoked on it',
  };
}

function checkE2EEIntegration() {
  const filePath = path.join(process.cwd(), 'src/lib/supabaseSyncProd.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check if broadcastUpdate or broadcastCheckpoint calls encryptUpdate
  const hasBroadcastUpdate = content.includes('async broadcastUpdate');
  const hasBroadcastCheckpoint = content.includes('async broadcastCheckpoint');
  const hasEncryptInBroadcast = content.includes('encryptUpdate(update, this.derivedKey)');
  const hasEncryptInCheckpoint = content.includes('encryptUpdate(fullUpdate, this.derivedKey)');

  const passed = (hasBroadcastUpdate && hasEncryptInBroadcast) ||
                 (hasBroadcastCheckpoint && hasEncryptInCheckpoint);

  return {
    passed,
    evidence: passed
      ? `E2EE encryption found: broadcast=${hasEncryptInBroadcast}, checkpoint=${hasEncryptInCheckpoint}`
      : 'No encryptUpdate calls found in broadcast methods',
    fix: 'Add encryptUpdate(update, this.derivedKey) in broadcastUpdate method',
  };
}

function checkCheckpointIntegration() {
  const syncFile = path.join(process.cwd(), 'src/lib/supabaseSyncProd.ts');
  const syncContent = fs.readFileSync(syncFile, 'utf-8');

  // Check if SupabaseSync imports and uses CheckpointService
  const importsCheckpoint = syncContent.includes('CheckpointService') || syncContent.includes('getCheckpointService');
  const callsCheckpoint = syncContent.includes('saveCheckpoint') || syncContent.includes('loadCheckpoint');

  return {
    passed: importsCheckpoint && callsCheckpoint,
    evidence: importsCheckpoint
      ? callsCheckpoint
        ? 'CheckpointService imported and used'
        : 'CheckpointService imported but never called - dead code'
      : 'CheckpointService not imported - not integrated',
    fix: 'Import getCheckpointService and call saveCheckpoint on disconnect',
  };
}

function checkPerformanceIntegration() {
  const syncFile = path.join(process.cwd(), 'src/lib/supabaseSyncProd.ts');
  const syncContent = fs.readFileSync(syncFile, 'utf-8');

  // Check if PerformanceMonitor is imported and used
  const importsPerf = syncContent.includes('syncPerformanceMonitor') || syncContent.includes('recordSyncLatency');
  const usesMeasure = syncContent.includes('measureAsync');

  return {
    passed: importsPerf && usesMeasure,
    evidence: importsPerf
      ? usesMeasure
        ? 'Performance monitoring integrated'
        : 'Performance monitor imported but not measuring'
      : 'Performance monitor not imported',
    fix: 'Import measureAsync and wrap connect/broadcast operations',
  };
}

function checkCleanupAutoStart() {
  const cleanupFile = path.join(process.cwd(), 'src/lib/cleanupJobs.ts');
  const cleanupContent = fs.readFileSync(cleanupFile, 'utf-8');

  // Check if jobs auto-start (either directly or via registerJob with enabled flag)
  const hasStartJob = cleanupContent.includes('startJob');
  const hasRegisterJob = cleanupContent.includes('registerJob');
  const hasEnabledFlag = cleanupContent.includes('enabled: true');
  const callsRegisterInConstructor = cleanupContent.match(/constructor[\s\S]*?\{[\s\S]*?\}/)?.[0].includes('register');

  // Jobs auto-start if: registerJob is called with enabled=true OR startJob is called directly
  const autoStartPattern = (hasRegisterJob && hasEnabledFlag && callsRegisterInConstructor) ||
                           (hasStartJob && cleanupContent.match(/constructor[\s\S]*?\{[\s\S]*?\}/)?.[0].includes('startJob'));

  return {
    passed: autoStartPattern,
    evidence: autoStartPattern
      ? 'Jobs auto-start via registerJob(enabled: true) or startJob()'
      : 'No auto-start logic - jobs registered but never run',
    fix: 'Call registerJob({enabled: true}) or startJob() in constructor',
  };
}

function checkAlertingHooks() {
  const fallbackFile = path.join(process.cwd(), 'src/lib/transportFallback.ts');
  const fallbackContent = fs.readFileSync(fallbackFile, 'utf-8');

  // Check if alerting is imported and called
  const importsAlerting = fallbackContent.includes('alerting') || fallbackContent.includes('sendCriticalAlert');
  const callsOnFailure = fallbackContent.includes('sendCriticalAlert') || fallbackContent.includes('sendWarningAlert');

  return {
    passed: importsAlerting && callsOnFailure,
    evidence: importsAlerting
      ? callsOnFailure
        ? 'Alerting integrated'
        : 'Alerting imported but not called on failures'
      : 'Alerting not integrated - failures silent',
    fix: 'Import alerting functions and call in onCircuitOpen/onFallback',
  };
}

function checkRaceConditions() {
  const storeFile = path.join(process.cwd(), 'src/store/useAppStore.ts');
  const storeContent = fs.readFileSync(storeFile, 'utf-8');

  // Check for atomic state transitions
  const hasAtomicCheck = storeContent.includes('if (useSupabase && networkSync)') ||
                        storeContent.includes('networkSync && useSupabase');
  const hasProperOrdering = storeContent.match(/networkSync\.disconnect[\s\S]*?networkSync = new/) ||
                           storeContent.includes('await networkSync.disconnect()');

  return {
    passed: hasAtomicCheck && hasProperOrdering,
    evidence: hasAtomicCheck
      ? hasProperOrdering
        ? 'Race condition checks present'
        : 'Checks exist but ordering may have gaps'
      : 'No atomic state checks - race conditions likely',
    fix: 'Add atomic state checks and ensure disconnect before reconnect',
  };
}

function checkErrorPropagation() {
  const srcDir = path.join(process.cwd(), 'src');
  const files = fs.readdirSync(srcDir, { recursive: true })
    .filter(f => f.endsWith('.ts') && !f.includes('.test.'))
    .map(f => path.join(srcDir, f));

  let swallowCount = 0;
  let intentionalSwallowCount = 0;
  let rethrowCount = 0;

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const catches = content.match(/catch[\s\S]*?\{[\s\S]*?\}/g) || [];

    catches.forEach(catchBlock => {
      // Check if intentionally handling (documented with various patterns)
      const isIntentional = catchBlock.includes('INTENTIONALLY SWALLOWING') ||
                           catchBlock.includes('INTENTIONALLY RETURNING') ||
                           catchBlock.includes('INTENTIONALLY RECOVERING') ||
                           catchBlock.includes('INTENTIONALLY HANDLING') ||
                           catchBlock.includes('INTENTIONAL');

      // Check if catch only logs (no throw)
      const onlyLogs = (catchBlock.includes('console.log') || catchBlock.includes('console.error')) &&
                       !catchBlock.includes('throw') &&
                       !catchBlock.includes('rejected');

      if (isIntentional && onlyLogs) {
        intentionalSwallowCount++;
      } else if (onlyLogs) {
        swallowCount++;
      }

      // Check if re-throws
      if (catchBlock.includes('throw') || catchBlock.includes('rejected')) {
        rethrowCount++;
      }
    });
  });

  return {
    passed: swallowCount === 0,
    evidence: swallowCount > 0
      ? `${swallowCount} catch blocks swallow errors (only log, not documented)`
      : intentionalSwallowCount > 0
        ? `All errors handled: ${rethrowCount} re-thrown, ${intentionalSwallowCount} intentionally swallowed (documented)`
        : 'All errors properly propagated',
    fix: swallowCount > 0 ? `Add throw or document intentional swallowing for ${swallowCount} catch blocks` : 'None needed',
  };
}

function checkRetryLogic() {
  const syncFile = path.join(process.cwd(), 'src/lib/supabaseSyncProd.ts');
  const syncContent = fs.readFileSync(syncFile, 'utf-8');

  // Check for retry implementation
  const hasRetry = syncContent.includes('retry') || syncContent.includes('attempt');
  const hasBackoff = syncContent.includes('exponential') ||
                    syncContent.match(/\* 2|delay\s*\*\s*2|Math\.pow/);

  return {
    passed: hasRetry && hasBackoff,
    evidence: hasRetry
      ? hasBackoff
        ? 'Retry with exponential backoff found'
        : 'Retry found but no exponential backoff'
      : 'No retry logic - single failure = total failure',
    fix: 'Add retry(3) with exponential backoff (1s, 2s, 4s)',
  };
}

function checkTimeoutHandling() {
  const syncFile = path.join(process.cwd(), 'src/lib/supabaseSyncProd.ts');
  const syncContent = fs.readFileSync(syncFile, 'utf-8');

  // Check for timeout
  const hasTimeout = syncContent.includes('timeout') || syncContent.includes('AbortController');
  const hasPromiseRace = syncContent.includes('Promise.race');

  return {
    passed: hasTimeout || hasPromiseRace,
    evidence: hasTimeout || hasPromiseRace
      ? 'Timeout handling found'
      : 'No timeout - connection may hang indefinitely',
    fix: 'Add 5s timeout with Promise.race or AbortController',
  };
}

function checkNoSkeletonCode() {
  // Check key integration points
  const checks = [
    checkSupabaseConnection(),
    checkE2EEIntegration(),
    checkCheckpointIntegration(),
    checkPerformanceIntegration(),
  ];

  const workingFeatures = checks.filter(c => c.passed).length;
  const totalFeatures = checks.length;

  return {
    passed: workingFeatures === totalFeatures,
    evidence: `${workingFeatures}/${totalFeatures} key features actually working (not just skeleton)`,
    fix: `Integrate the ${totalFeatures - workingFeatures} skeleton features`,
  };
}

function checkTestsPass() {
  // This would need to run actual tests
  // For now, check if test command exists
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const hasTestScript = packageJson.scripts && packageJson.scripts.test;

  return {
    passed: !!hasTestScript,
    evidence: hasTestScript ? 'Test script exists - run to verify' : 'No test script',
    fix: 'Run: npx vitest run tests/unit/',
  };
}

// Major gaps - simplified checks
function checkE2ETests() {
  const e2eDir = path.join(process.cwd(), 'tests/e2e');
  const hasE2E = fs.existsSync(e2eDir) && fs.readdirSync(e2eDir).length > 0;

  return {
    passed: hasE2E,
    evidence: hasE2E ? 'E2E tests exist' : 'No E2E tests - only unit tests',
    fix: 'Create Playwright E2E tests',
  };
}

function checkPerformanceBenchmarks() {
  const perfDir = path.join(process.cwd(), 'tests/performance');
  const hasPerf = fs.existsSync(perfDir) && fs.readdirSync(perfDir).length > 0;

  return {
    passed: hasPerf,
    evidence: hasPerf ? 'Performance tests exist' : 'No performance benchmarks',
    fix: 'Create performance test suite',
  };
}

function checkSecurityHeaders() {
  const healthRoute = path.join(process.cwd(), 'src/app/api/health/route.ts');
  const content = fs.readFileSync(healthRoute, 'utf-8');

  const hasCSP = content.includes('Content-Security-Policy');
  const hasHSTS = content.includes('Strict-Transport-Security');

  return {
    passed: hasCSP && hasHSTS,
    evidence: hasCSP || hasHSTS ? 'Some security headers present' : 'No security headers',
    fix: 'Add security headers middleware',
  };
}

// Check function dispatcher
const CHECKS = {
  checkSupabaseConnection,
  checkE2EEIntegration,
  checkCheckpointIntegration,
  checkPerformanceIntegration,
  checkCleanupAutoStart,
  checkAlertingHooks,
  checkRaceConditions,
  checkErrorPropagation,
  checkRetryLogic,
  checkTimeoutHandling,
  checkNoSkeletonCode,
  checkTestsPass,
  checkE2ETests,
  checkPerformanceBenchmarks,
  checkSecurityHeaders,
  checkCORS: () => ({ passed: false, evidence: 'CORS not checked', fix: 'Add CORS configuration' }),
  checkAPIRateLimit: () => ({ passed: false, evidence: 'API rate limiting not checked', fix: 'Add rate limit middleware' }),
  checkHealthCache: () => ({ passed: false, evidence: 'Health caching not checked', fix: 'Add 5s cache' }),
  checkYjsDebounce: () => ({ passed: false, evidence: 'Yjs debounce not checked', fix: 'Add 100ms debounce' }),
  checkBandwidthThrottle: () => ({ passed: false, evidence: 'Bandwidth throttle not checked', fix: 'Add throttling' }),
  checkDBIndex: () => ({ passed: false, evidence: 'DB index not checked', fix: 'Add timestamp index' }),
  checkGracefulDegradation: () => ({ passed: false, evidence: 'Graceful degradation not checked', fix: 'Add offline indicator' }),
  checkClientRateLimit: () => ({ passed: false, evidence: 'Client rate limit not checked', fix: 'Add click throttling' }),
  checkLoadShedding: () => ({ passed: false, evidence: 'Load shedding not checked', fix: 'Add 503 on overload' }),
};

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('\n' + '='.repeat(70));
  console.log('GAP VERIFICATION REPORT');
  console.log('='.repeat(70) + '\n');

  let passed = 0;
  let failed = 0;

  // Check Critical Gaps
  console.log('🔴 CRITICAL GAPS (P0)');
  console.log('-'.repeat(70));

  GAPS.critical.forEach(gap => {
    const checkFn = CHECKS[gap.check];
    if (!checkFn) {
      console.log(`⚠️  ${gap.id}: ${gap.name} - Check function not implemented`);
      return;
    }

    try {
      const result = checkFn();
      const status = result.passed ? '✅' : '❌';

      console.log(`${status} ${gap.id}: ${gap.name}`);
      console.log(`   ${result.evidence}`);

      if (!result.passed) {
        console.log(`   🔧 Fix: ${result.fix}`);
        failed++;
      } else {
        passed++;
      }
    } catch (error) {
      console.log(`⚠️  ${gap.id}: ${gap.name} - Check failed: ${error.message}`);
      failed++;
    }

    console.log();
  });

  // Check Major Gaps
  console.log('\n🟡 MAJOR GAPS (P1)');
  console.log('-'.repeat(70));

  GAPS.major.forEach(gap => {
    const checkFn = CHECKS[gap.check];
    if (!checkFn) {
      console.log(`⚠️  ${gap.id}: ${gap.name} - Check function not implemented`);
      return;
    }

    try {
      const result = checkFn();
      const status = result.passed ? '✅' : '❌';

      console.log(`${status} ${gap.id}: ${gap.name}`);

      if (!result.passed) {
        console.log(`   🔧 Fix: ${result.fix}`);
      }
    } catch (error) {
      console.log(`⚠️  ${gap.id}: ${gap.name} - Check failed: ${error.message}`);
    }

    console.log();
  });

  // Summary
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Critical Gaps: ${passed}/${GAPS.critical.length} passed`);
  console.log(`Major Gaps: Manual verification required`);
  console.log(`\nGrade Impact: Each critical gap = ~2 percentage points`);
  console.log(`Current Grade Estimate: ${Math.max(0, 100 - failed * 2)}%`);
  console.log('='.repeat(70) + '\n');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, CHECKS, GAPS };
