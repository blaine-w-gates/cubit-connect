/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import type { CausalEvent, YDocInstance, SyncStateMachine, InvariantViolation } from '@/lib/syncDiagnostics';

/**
 * SYNC-001 Deep Diagnostic Test
 * 
 * This test uses the comprehensive monitoring infrastructure to:
 * 1. Trace every ydoc instance lifecycle
 * 2. Verify observer registration timing
 * 3. Check for invariant violations
 * 4. Report the exact root cause of sync failures
 */

type DiagnosticReport = {
  peerName: string;
  causalLog: CausalEvent[];
  instances: YDocInstance[];
  stateMachine: SyncStateMachine;
  invariantViolations: InvariantViolation[];
  finalPhase: string;
  observerRegistered: boolean;
  activeYdocId?: string;
  networkSyncYdocId?: string;
};

type PeerDiagnostics = {
  context: BrowserContext;
  page: Page;
  name: string;
  report?: DiagnosticReport;
};

async function setupPeer(browser: Browser, name: string): Promise<PeerDiagnostics> {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('/todo');
  await page.evaluate(() => {
    localStorage.setItem('cubit_api_key', btoa('test-key'));
    localStorage.setItem('sync_server_url', 'ws://localhost:8080');
  });
  await page.reload();
  
  // Wait for hydration
  await page.waitForFunction(() => {
    const store = (window as any).__STORE__;
    return store?.getState()?.isHydrated;
  }, { timeout: 15000 });
  
  // Reset to clean state
  await page.evaluate(async () => {
    await (window as any).__STORE__.getState().resetProject();
  });
  await page.waitForTimeout(300);
  
  return { context, page, name };
}

async function collectDiagnostics(peer: PeerDiagnostics): Promise<DiagnosticReport> {
  const report = await peer.page.evaluate((peerName): DiagnosticReport => {
    const monitor = (window as any).__SYNC_MONITOR;
    if (!monitor) {
      return {
        peerName,
        causalLog: [],
        instances: [],
        stateMachine: { 
          currentPhase: 'unknown' as any, 
          phaseHistory: [], 
          observerRegistered: false 
        },
        invariantViolations: [],
        finalPhase: 'unknown',
        observerRegistered: false,
      };
    }
    
    const stateMachine = monitor.getSyncStateMachine();
    
    return {
      peerName,
      causalLog: monitor.getCausalLog(),
      instances: monitor.getAllInstances(),
      stateMachine,
      invariantViolations: monitor.getInvariantViolations(),
      finalPhase: stateMachine.currentPhase,
      observerRegistered: stateMachine.observerRegistered,
      activeYdocId: stateMachine.currentYdocId,
    };
  }, peer.name);
  
  peer.report = report;
  return report;
}

async function connectPeer(peer: PeerDiagnostics, passphrase: string): Promise<void> {
  await peer.page.getByRole('button', { name: 'Sync', exact: true }).click();
  await peer.page.getByPlaceholder('Enter a shared secret...').fill(passphrase);
  await peer.page.getByRole('button', { name: 'Establish Secure Connection' }).click();
  
  // Wait for connection
  await expect(peer.page.getByText('Securely Connected')).toBeVisible({ timeout: 20000 });
  
  // Wait for peer discovery
  await peer.page.waitForFunction(() => {
    const store = (window as any).__STORE__;
    return store?.getState()?.hasPeers === true;
  }, { timeout: 20000 });
  
  // Close modal
  await peer.page.getByRole('button', { name: 'Close', exact: false })
    .or(peer.page.locator('button:has(svg.lucide-x)'))
    .click();
}

function analyzeDiagnosticReport(report: DiagnosticReport): string[] {
  const issues: string[] = [];
  
  // Check 1: Did we reach 'live' phase?
  if (report.finalPhase !== 'live') {
    issues.push(`❌ Peer ${report.peerName}: Did not reach 'live' phase. Stuck at: ${report.finalPhase}`);
  }
  
  // Check 2: Is observer registered?
  if (!report.observerRegistered) {
    issues.push(`❌ Peer ${report.peerName}: Observer NOT registered when should be`);
  }
  
  // Check 3: Any invariant violations?
  if (report.invariantViolations.length > 0) {
    report.invariantViolations.forEach(v => {
      issues.push(`❌ Peer ${report.peerName}: INVARIANT VIOLATION - ${v.invariant}: expected ${v.expected}, got ${v.actual}`);
    });
  }
  
  // Check 4: Active ydoc instance
  const activeInstances = report.instances.filter(i => !i.destroyedAt);
  if (activeInstances.length === 0) {
    issues.push(`❌ Peer ${report.peerName}: No active ydoc instance found`);
  } else if (activeInstances.length > 1) {
    issues.push(`⚠️ Peer ${report.peerName}: Multiple active ydoc instances (${activeInstances.length}) - possible leak`);
  }
  
  // Check 5: Observer on correct ydoc
  const activeInstance = activeInstances[0];
  if (activeInstance) {
    if (!activeInstance.observerRegistered) {
      issues.push(`❌ Peer ${report.peerName}: Observer NOT registered on active ydoc ${activeInstance.id.slice(0, 8)}`);
    }
    
    if (report.activeYdocId && report.activeYdocId !== activeInstance.id) {
      issues.push(`❌ Peer ${report.peerName}: State machine ydoc (${report.activeYdocId.slice(0, 8)}) doesn't match actual active ydoc (${activeInstance.id.slice(0, 8)})`);
    }
  }
  
  // Check 6: NetworkSync attached
  if (activeInstance && !activeInstance.networkSyncAttached) {
    issues.push(`❌ Peer ${report.peerName}: NetworkSync NOT attached to active ydoc`);
  }
  
  // Check 7: Phase sequence validity
  const stateMachineErrors = report.stateMachine.phaseHistory.length < 5 
    ? [`❌ Peer ${report.peerName}: Incomplete phase sequence (${report.stateMachine.phaseHistory.length} phases)`]
    : [];
  issues.push(...stateMachineErrors);
  
  // Check 8: Updates received but not processed
  if (activeInstance && activeInstance.updatesReceived > 0 && activeInstance.zustandUpdatesTriggered === 0) {
    issues.push(`❌ Peer ${report.peerName}: CRITICAL - Received ${activeInstance.updatesReceived} updates but triggered 0 Zustand updates. Observer callback not firing!`);
  }
  
  return issues;
}

function generateRootCauseAnalysis(peerA: DiagnosticReport, peerB: DiagnosticReport): string {
  const lines: string[] = [];
  
  lines.push('\n╔════════════════════════════════════════════════════════════════╗');
  lines.push('║           SYNC-001 ROOT CAUSE ANALYSIS                         ║');
  lines.push('╚════════════════════════════════════════════════════════════════╝\n');
  
  // Compare instances
  lines.push('📊 YDOC INSTANCE COMPARISON:');
  lines.push(`  Peer A: ${peerA.instances.length} total instances, ${peerA.instances.filter(i => !i.destroyedAt).length} active`);
  lines.push(`  Peer B: ${peerB.instances.length} total instances, ${peerB.instances.filter(i => !i.destroyedAt).length} active`);
  
  const activeA = peerA.instances.filter(i => !i.destroyedAt)[0];
  const activeB = peerB.instances.filter(i => !i.destroyedAt)[0];
  
  if (activeA && activeB) {
    lines.push(`\n  Active A: ${activeA.id.slice(0, 16)}... (created by ${activeA.createdBy})`);
    lines.push(`  Active B: ${activeB.id.slice(0, 16)}... (created by ${activeB.createdBy})`);
    
    lines.push(`\n  Peer A - Observer: ${activeA.observerRegistered ? '✓' : '✗'}, NetworkSync: ${activeA.networkSyncAttached ? '✓' : '✗'}`);
    lines.push(`  Peer B - Observer: ${activeB.observerRegistered ? '✓' : '✗'}, NetworkSync: ${activeB.networkSyncAttached ? '✓' : '✗'}`);
    
    lines.push(`\n  Peer A - Updates: ${activeA.updatesReceived} received, ${activeA.observerCallbacksFired} callbacks, ${activeA.zustandUpdatesTriggered} Zustand updates`);
    lines.push(`  Peer B - Updates: ${activeB.updatesReceived} received, ${activeB.observerCallbacksFired} callbacks, ${activeB.zustandUpdatesTriggered} Zustand updates`);
  }
  
  // State machine comparison
  lines.push(`\n📊 STATE MACHINE COMPARISON:`);
  lines.push(`  Peer A - Current phase: ${peerA.finalPhase}, Observer registered: ${peerA.observerRegistered}`);
  lines.push(`  Peer B - Current phase: ${peerB.finalPhase}, Observer registered: ${peerB.observerRegistered}`);
  lines.push(`  Peer A - Phase transitions: ${peerA.stateMachine.phaseHistory.map(p => p.phase).join(' → ')}`);
  lines.push(`  Peer B - Phase transitions: ${peerB.stateMachine.phaseHistory.map(p => p.phase).join(' → ')}`);
  
  // Root cause determination
  lines.push(`\n🔍 ROOT CAUSE DETERMINATION:`);
  
  const aIssues = analyzeDiagnosticReport(peerA);
  const bIssues = analyzeDiagnosticReport(peerB);
  
  if (aIssues.length === 0 && bIssues.length === 0) {
    lines.push('  ✅ No issues detected - sync should be working correctly');
  } else {
    if (aIssues.length > 0) {
      lines.push(`\n  Peer A Issues:`);
      aIssues.forEach(issue => lines.push(`    ${issue}`));
    }
    if (bIssues.length > 0) {
      lines.push(`\n  Peer B Issues:`);
      bIssues.forEach(issue => lines.push(`    ${issue}`));
    }
    
    // Determine primary root cause
    const criticalIssue = [...aIssues, ...bIssues].find(i => 
      i.includes('CRITICAL') || 
      i.includes('INVARIANT VIOLATION') ||
      i.includes('Observer NOT registered')
    );
    
    if (criticalIssue) {
      lines.push(`\n  🎯 PRIMARY ROOT CAUSE:`);
      lines.push(`     ${criticalIssue}`);
    }
  }
  
  // Recommendations
  lines.push(`\n💡 RECOMMENDATIONS:`);
  
  if (!activeA?.observerRegistered || !activeB?.observerRegistered) {
    lines.push('  1. The ydoc observer is not being registered. Check:');
    lines.push('     - Is loadProject() returning early due to isHydrated?');
    lines.push('     - Is resetYDoc() creating a new ydoc after observer registration?');
    lines.push('     - Is the observer registration happening on the wrong ydoc instance?');
  }
  
  if (activeA?.updatesReceived === 0 && activeB?.updatesReceived === 0) {
    lines.push('  2. No updates being received. Check:');
    lines.push('     - Is the sync server running?');
    lines.push('     - Are both peers connecting to the same room?');
    lines.push('     - Is the WebSocket connection stable?');
  }
  
  if ((activeA?.updatesReceived || 0) > 0 && activeA?.zustandUpdatesTriggered === 0) {
    lines.push('  3. Updates received but not processed. Check:');
    lines.push('     - Is the ydoc.on("update") callback firing?');
    lines.push('     - Is there a debounce/throttle blocking updates?');
    lines.push('     - Is the observer registered on the same ydoc that received the update?');
  }
  
  lines.push(`\n════════════════════════════════════════════════════════════════\n`);
  
  return lines.join('\n');
}

test.describe('SYNC-001 Deep Diagnostics', () => {
  test.setTimeout(120000);
  
  test('Diagnose ydoc instance lifecycle and observer registration', async ({ browser }) => {
    const room = `diagnostic-${Date.now()}`;
    
    console.log('\n🔬 Starting SYNC-001 Deep Diagnostic...\n');
    
    // Setup peers
    const peerA = await setupPeer(browser, 'A');
    const peerB = await setupPeer(browser, 'B');
    
    // Clear any previous diagnostic data
    await peerA.page.evaluate(() => {
      const monitor = (window as any).__SYNC_MONITOR;
      if (monitor) monitor.clearAll();
    });
    await peerB.page.evaluate(() => {
      const monitor = (window as any).__SYNC_MONITOR;
      if (monitor) monitor.clearAll();
    });
    
    try {
      // Connect Peer A first
      console.log('📡 Connecting Peer A...');
      await connectPeer(peerA, room);
      
      // Collect diagnostics for A
      const diagA1 = await collectDiagnostics(peerA);
      console.log(`\n📊 Peer A after connection:`);
      console.log(`   Phase: ${diagA1.finalPhase}`);
      console.log(`   Observer: ${diagA1.observerRegistered ? '✓' : '✗'}`);
      console.log(`   Active ydoc: ${diagA1.activeYdocId?.slice(0, 8) || 'unknown'}...`);
      
      // Connect Peer B
      console.log('\n📡 Connecting Peer B...');
      await connectPeer(peerB, room);
      
      // Wait for peer discovery on both sides
      await peerA.page.waitForTimeout(500);
      
      // Collect diagnostics for both
      const diagA2 = await collectDiagnostics(peerA);
      const diagB = await collectDiagnostics(peerB);
      
      console.log(`\n📊 Peer A after B connects:`);
      console.log(`   Phase: ${diagA2.finalPhase}`);
      console.log(`   Observer: ${diagA2.observerRegistered ? '✓' : '✗'}`);
      console.log(`   Active ydoc: ${diagA2.activeYdocId?.slice(0, 8) || 'unknown'}...`);
      console.log(`   Has peers: ${await peerA.page.evaluate(() => (window as any).__STORE__.getState().hasPeers)}`);
      
      console.log(`\n📊 Peer B after connection:`);
      console.log(`   Phase: ${diagB.finalPhase}`);
      console.log(`   Observer: ${diagB.observerRegistered ? '✓' : '✗'}`);
      console.log(`   Active ydoc: ${diagB.activeYdocId?.slice(0, 8) || 'unknown'}...`);
      console.log(`   Has peers: ${await peerB.page.evaluate(() => (window as any).__STORE__.getState().hasPeers)}`);
      
      // Create a task on Peer B to test sync
      console.log('\n📝 Creating task on Peer B to test sync propagation...');
      await peerB.page.evaluate(() => {
        (window as any).__STORE__.getState().addTodoRow('SYNC-001 Diagnostic Task');
      });
      
      // Wait for potential sync
      await peerB.page.waitForTimeout(1000);
      await peerA.page.waitForTimeout(5000);
      
      // Collect final diagnostics
      const diagA3 = await collectDiagnostics(peerA);
      const diagB2 = await collectDiagnostics(peerB);
      
      // Check sync state
      const rowsA = await peerA.page.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
      const rowsB = await peerB.page.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
      
      console.log(`\n📊 FINAL SYNC STATE:`);
      console.log(`   Peer A rows: ${rowsA}`);
      console.log(`   Peer B rows: ${rowsB}`);
      
      // Print root cause analysis
      const analysis = generateRootCauseAnalysis(diagA3, diagB2);
      console.log(analysis);
      
      // Assertions based on diagnostics
      const aIssues = analyzeDiagnosticReport(diagA3);
      const bIssues = analyzeDiagnosticReport(diagB2);
      
      // Log all diagnostic reports for debugging
      const fullReportA = await peerA.page.evaluate(() => {
        const monitor = (window as any).__SYNC_MONITOR;
        return monitor?.generateDiagnosticReport?.() || 'Monitor not available';
      });
      const fullReportB = await peerB.page.evaluate(() => {
        const monitor = (window as any).__SYNC_MONITOR;
        return monitor?.generateDiagnosticReport?.() || 'Monitor not available';
      });
      
      console.log('\n📄 FULL DIAGNOSTIC REPORT - Peer A:');
      console.log(fullReportA);
      
      console.log('\n📄 FULL DIAGNOSTIC REPORT - Peer B:');
      console.log(fullReportB);
      
      // Test assertions - we expect these to potentially fail to document the issue
      if (aIssues.length > 0 || bIssues.length > 0) {
        console.log('\n⚠️ DIAGNOSTIC ISSUES FOUND - This documents the SYNC-001 root cause');
        
        // Attach diagnostics to test report
        test.info().attach('peer-a-diagnostics', {
          body: JSON.stringify(diagA3, null, 2),
          contentType: 'application/json',
        });
        test.info().attach('peer-b-diagnostics', {
          body: JSON.stringify(diagB2, null, 2),
          contentType: 'application/json',
        });
        test.info().attach('root-cause-analysis', {
          body: analysis,
          contentType: 'text/plain',
        });
        
        // We don't fail the test - we're documenting the issue
        console.log('\n✅ Diagnostic test completed - check attached reports for SYNC-001 analysis');
      } else {
        console.log('\n✅ No diagnostic issues found - sync appears to be working');
        
        // Verify actual sync worked
        expect(rowsA).toBe(rowsB);
        expect(rowsB).toBe(1);
      }
      
    } finally {
      await peerA.context.close();
      await peerB.context.close();
    }
  });
  
  test('Verify ydoc instance consistency across reconnection', async ({ browser }) => {
    const room = `reconnect-${Date.now()}`;
    
    console.log('\n🔄 Testing ydoc instance consistency across reconnection...\n');
    
    const peerA = await setupPeer(browser, 'A');
    
    try {
      // First connection
      await connectPeer(peerA, room);
      
      const diag1 = await collectDiagnostics(peerA);
      const ydocId1 = diag1.activeYdocId;
      
      console.log(`First connection ydoc: ${ydocId1?.slice(0, 8) || 'unknown'}...`);
      
      // Disconnect
      await peerA.page.evaluate(() => {
        (window as any).__STORE__.getState().disconnectSyncServer();
      });
      await peerA.page.waitForTimeout(1000);
      
      // Reconnect to same room
      await connectPeer(peerA, room);
      
      const diag2 = await collectDiagnostics(peerA);
      const ydocId2 = diag2.activeYdocId;
      
      console.log(`After reconnection ydoc: ${ydocId2?.slice(0, 8) || 'unknown'}...`);
      
      // Should be same room, so ydoc should be the same (isSameRoom optimization)
      const instances = diag2.instances;
      const createdByConnect = instances.filter(i => i.createdBy === 'resetYDoc');
      
      console.log(`Ydoc instances created by 'resetYDoc': ${createdByConnect.length}`);
      
      // If isSameRoom worked, we should only have the original ydoc
      // If isSameRoom didn't work or was bypassed, we might have a new ydoc
      
      if (ydocId1 && ydocId2 && ydocId1 === ydocId2) {
        console.log('✅ Ydoc instance preserved across reconnection (isSameRoom optimization worked)');
      } else {
        console.log('⚠️ New ydoc instance created on reconnection');
        console.log(`   Old: ${ydocId1?.slice(0, 8) || 'unknown'}...`);
        console.log(`   New: ${ydocId2?.slice(0, 8) || 'unknown'}...`);
        
        if (diag2.invariantViolations.length > 0) {
          console.log('\n❌ Invariant violations after reconnection:');
          diag2.invariantViolations.forEach(v => {
            console.log(`   ${v.invariant}: expected ${v.expected}, got ${v.actual}`);
          });
        }
      }
      
      test.info().attach('reconnection-diagnostics', {
        body: JSON.stringify(diag2, null, 2),
        contentType: 'application/json',
      });
      
    } finally {
      await peerA.context.close();
    }
  });
});
