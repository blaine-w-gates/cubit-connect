/**
 * Minimal Two-Peer Sync Test
 * 
 * The simplest possible test for bidirectional sync:
 * - Two peers connect to same room
 * - Peer A adds a task
 * - Verify Peer B receives it
 * - Peer B adds a task  
 * - Verify Peer A receives it
 * 
 * No complex UI interactions, just core sync validation.
 */

import { test, expect } from '@playwright/test';
import type { Page, Browser, BrowserContext } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Minimal Two-Peer Sync', () => {
  test.setTimeout(120000);
  
  async function getRoomName(): Promise<string> {
    // Generate room name that will be consistent for both peers in same test
    return `minimal-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
  
  async function setupPeers(browser: Browser): Promise<{ 
    pageA: Page; 
    pageB: Page; 
    context: BrowserContext;
    logsA: string[];
    logsB: string[];
  }> {
    // Use single context with two pages (lighter than two contexts)
    const context = await browser.newContext();
    
    const logsA: string[] = [];
    const logsB: string[] = [];
    
    // Setup Peer A
    const pageA = await context.newPage();
    pageA.on('console', msg => {
      const text = `[A] ${msg.type()}: ${msg.text()}`;
      logsA.push(text);
      console.log(text);
    });
    pageA.on('pageerror', err => {
      const text = `[A] PAGE ERROR: ${err.message}`;
      logsA.push(text);
      console.error(text);
    });
    
    await pageA.goto('/todo');
    await pageA.evaluate(() => {
      localStorage.setItem('cubit_api_key', btoa('minimal-test-key'));
      localStorage.setItem('sync_server_url', 'ws://localhost:8080');
    });
    await pageA.reload();
    await pageA.waitForFunction(() => {
      const store = (window as unknown as { __STORE__?: { getState: () => { isHydrated: boolean } } }).__STORE__;
      return store?.getState()?.isHydrated;
    }, { timeout: 15000 });
    console.log('[A] Peer setup complete');
    
    // Setup Peer B
    const pageB = await context.newPage();
    pageB.on('console', msg => {
      const text = `[B] ${msg.type()}: ${msg.text()}`;
      logsB.push(text);
      console.log(text);
    });
    pageB.on('pageerror', err => {
      const text = `[B] PAGE ERROR: ${err.message}`;
      logsB.push(text);
      console.error(text);
    });
    
    await pageB.goto('/todo');
    await pageB.evaluate(() => {
      localStorage.setItem('cubit_api_key', btoa('minimal-test-key'));
      localStorage.setItem('sync_server_url', 'ws://localhost:8080');
    });
    await pageB.reload();
    await pageB.waitForFunction(() => {
      const store = (window as unknown as { __STORE__?: { getState: () => { isHydrated: boolean } } }).__STORE__;
      return store?.getState()?.isHydrated;
    }, { timeout: 15000 });
    console.log('[B] Peer setup complete');
    
    return { pageA, pageB, context, logsA, logsB };
  }
  
  async function connectPeer(page: Page, name: string, room: string): Promise<boolean> {
    try {
      // Open sync modal
      await page.getByRole('button', { name: 'Sync', exact: true }).click();
      
      // Enter room passphrase
      await page.getByPlaceholder('Enter a shared secret...').fill(room);
      
      // Connect
      await page.getByRole('button', { name: 'Establish Secure Connection' }).click();
      
      // Wait for connected status
      await page.waitForFunction(() => {
        const store = (window as unknown as { __STORE__?: { getState: () => { syncStatus: string } } }).__STORE__;
        return store?.getState()?.syncStatus === 'connected';
      }, { timeout: 20000 });
      
      console.log(`[${name}] Connected to room: ${room}`);
      
      // Wait for peer discovery (or timeout if alone)
      let peerDiscovered = false;
      try {
        await page.waitForFunction(() => {
          const store = (window as unknown as { __STORE__?: { getState: () => { hasPeers: boolean } } }).__STORE__;
          return store?.getState()?.hasPeers === true;
        }, { timeout: 10000 });
        console.log(`[${name}] Peer discovered`);
        peerDiscovered = true;
      } catch {
        console.log(`[${name}] No peer yet (may be first to connect)`);
      }
      
      // Close modal - use try/catch in case page state changed
      try {
        await page.getByRole('button', { name: 'Close', exact: false })
          .or(page.locator('button:has(svg.lucide-x)'))
          .first()
          .click({ timeout: 5000 });
      } catch (e) {
        console.log(`[${name}] Modal close skipped or failed: ${e}`);
        // Modal might already be closed, that's OK
      }
      
      return peerDiscovered;
    } catch (error) {
      console.error(`[${name}] Connection failed:`, error);
      return false;
    }
  }
  
  async function addTask(page: Page, taskName: string): Promise<void> {
    // Click add task button
    await page.getByRole('button', { name: /add task/i }).click();
    
    // Type task name
    await page.keyboard.type(taskName);
    await page.keyboard.press('Enter');
    
    console.log(`Added task: ${taskName}`);
    
    // Wait for debounce
    await page.waitForTimeout(500);
  }
  
  async function getTaskCount(page: Page): Promise<number> {
    return page.evaluate(() => {
      const store = (window as unknown as { __STORE__?: { getState: () => { todoRows: Array<unknown> } } }).__STORE__;
      return store?.getState()?.todoRows?.length || 0;
    });
  }
  
  async function getDiagnostics(page: Page) {
    return page.evaluate(() => {
      const monitor = (window as unknown as { __SYNC_MONITOR?: { 
        generateDiagnosticReport: () => string;
        getSnapshots: () => Array<unknown>;
      } }).__SYNC_MONITOR;
      
      return {
        report: monitor?.generateDiagnosticReport?.() || 'Monitor not available',
        snapshotCount: monitor?.getSnapshots?.().length || 0,
      };
    });
  }
  
  async function waitForTaskCount(page: Page, expectedCount: number, timeoutMs = 15000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const count = await getTaskCount(page);
      if (count >= expectedCount) {
        return true;
      }
      await page.waitForTimeout(500);
    }
    
    return false;
  }
  
  async function getRoomIdFromPeer(page: Page): Promise<string | null> {
    return page.evaluate(() => {
      const store = (window as unknown as { __STORE__?: { getState: () => { activeWorkspaceId: string | null } } }).__STORE__;
      return store?.getState()?.activeWorkspaceId || null;
    });
  }
  
  test('A→B sync: Task added on A appears on B', async ({ browser }) => {
    const roomName = await getRoomName();
    
    // Setup both peers in single context
    const { pageA, pageB, context, logsA, logsB } = await setupPeers(browser);
    
    try {
      // Connect both to same room
      await connectPeer(pageA, 'A', roomName);
      await connectPeer(pageB, 'B', roomName);
      
      // Verify both peers are in the same room
      const roomA = await getRoomIdFromPeer(pageA);
      const roomB = await getRoomIdFromPeer(pageB);
      console.log(`[TEST] Peer A room: ${roomA?.slice(0, 8)}, Peer B room: ${roomB?.slice(0, 8)}`);
      
      if (roomA !== roomB) {
        console.error(`[TEST ERROR] Room mismatch! A: ${roomA}, B: ${roomB}`);
      }
      
      // Wait for both to see each other
      await pageA.waitForFunction(() => {
        const store = (window as unknown as { __STORE__?: { getState: () => { hasPeers: boolean } } }).__STORE__;
        return store?.getState()?.hasPeers === true;
      }, { timeout: 15000 });
      
      await pageB.waitForFunction(() => {
        const store = (window as unknown as { __STORE__?: { getState: () => { hasPeers: boolean } } }).__STORE__;
        return store?.getState()?.hasPeers === true;
      }, { timeout: 15000 });
      
      // Get initial counts
      const initialA = await getTaskCount(pageA);
      const initialB = await getTaskCount(pageB);
      
      console.log(`Initial counts - A: ${initialA}, B: ${initialB}`);
      
      // Peer A adds task
      await addTask(pageA, 'From Peer A');
      
      // Wait for sync to B
      const receivedOnB = await waitForTaskCount(pageB, initialB + 1, 15000);
      
      // Verify
      const finalA = await getTaskCount(pageA);
      const finalB = await getTaskCount(pageB);
      
      console.log(`Final counts - A: ${finalA}, B: ${finalB}`);
      
      if (!receivedOnB) {
        // Capture diagnostics on failure
        const diagA = await getDiagnostics(pageA);
        const diagB = await getDiagnostics(pageB);
        
        console.log('\n=== BROWSER LOGS Peer A ===');
        console.log(logsA.filter(l => l.includes('PRESENCE') || l.includes('NETWORK') || l.includes('PEER')).join('\n'));
        console.log('\n=== BROWSER LOGS Peer B ===');
        console.log(logsB.filter(l => l.includes('PRESENCE') || l.includes('NETWORK') || l.includes('PEER')).join('\n'));
        
        console.log('\n=== DIAGNOSTICS Peer A ===');
        console.log(diagA.report);
        console.log('\n=== DIAGNOSTICS Peer B ===');
        console.log(diagB.report);
        
        test.info().attach('peer-a-diagnostics', {
          body: diagA.report,
          contentType: 'text/plain',
        });
        test.info().attach('peer-b-diagnostics', {
          body: diagB.report,
          contentType: 'text/plain',
        });
      }
      
      expect(receivedOnB, 'Task should sync from A to B').toBe(true);
      expect(finalB).toBe(initialB + 1);
      
    } finally {
      await context.close();
    }
  });
  
  test('B→A sync: Task added on B appears on A', async ({ browser }) => {
    const roomName = await getRoomName();
    
    // Setup both peers in single context
    const { pageA, pageB, context } = await setupPeers(browser);
    
    try {
      // Connect both to same room
      await connectPeer(pageA, 'A', roomName);
      await connectPeer(pageB, 'B', roomName);
      
      // Wait for peer discovery
      await pageA.waitForFunction(() => {
        const store = (window as unknown as { __STORE__?: { getState: () => { hasPeers: boolean } } }).__STORE__;
        return store?.getState?.()?.hasPeers === true;
      }, { timeout: 15000 });
      
      // Get initial counts
      const initialA = await getTaskCount(pageA);
      
      // Peer B adds task
      await addTask(pageB, 'From Peer B');
      
      // Wait for sync to A
      const receivedOnA = await waitForTaskCount(pageA, initialA + 1, 15000);
      
      // Verify
      const finalA = await getTaskCount(pageA);
      
      if (!receivedOnA) {
        const diagA = await getDiagnostics(pageA);
        const diagB = await getDiagnostics(pageB);
        
        console.log('\n=== DIAGNOSTICS Peer A ===');
        console.log(diagA.report);
        console.log('\n=== DIAGNOSTICS Peer B ===');
        console.log(diagB.report);
        
        test.info().attach('peer-a-diagnostics', {
          body: diagA.report,
          contentType: 'text/plain',
        });
        test.info().attach('peer-b-diagnostics', {
          body: diagB.report,
          contentType: 'text/plain',
        });
      }
      
      expect(receivedOnA, 'Task should sync from B to A').toBe(true);
      expect(finalA).toBe(initialA + 1);
      
    } finally {
      await context.close();
    }
  });
});
