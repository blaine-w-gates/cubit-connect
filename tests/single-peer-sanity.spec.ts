/**
 * Single-Peer Sanity Test Suite
 * 
 * Validates that local CRDT operations work correctly WITHOUT any sync:
 * - Yjs updates fire correctly
 * - Observer callbacks trigger
 * - Zustand state updates
 * - No divergence between Yjs and Zustand
 * 
 * This isolates "local sync" from "network sync" issues.
 */

import { test, expect } from '@playwright/test';
import type { Page, Browser, BrowserContext } from '@playwright/test';

type PeerSession = {
  context: BrowserContext;
  page: Page;
};

async function setupPeer(browser: Browser): Promise<PeerSession> {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate and hydrate
  await page.goto('/todo');
  await page.evaluate(() => {
    localStorage.setItem('cubit_api_key', btoa('sanity-test-key'));
  });
  await page.reload();
  
  // Wait for hydration
  await page.waitForFunction(() => {
    const store = (window as unknown as { __STORE__?: { getState: () => { isHydrated: boolean } } }).__STORE__;
    return store?.getState()?.isHydrated;
  }, { timeout: 15000 });
  
  return { context, page };
}

async function getMonitoringReport(page: Page) {
  return page.evaluate(() => {
    const monitor = (window as unknown as { __SYNC_MONITOR?: { 
      generateDiagnosticReport: () => string;
      getAllInstances: () => Array<{ id: string; observerRegistered: boolean }>;
    } }).__SYNC_MONITOR;
    
    if (!monitor) return { error: 'Monitor not found' };
    
    return {
      report: monitor.generateDiagnosticReport(),
      instances: monitor.getAllInstances(),
    };
  });
}

async function getStoreState(page: Page) {
  return page.evaluate(() => {
    const store = (window as unknown as { __STORE__?: { getState: () => {
      todoProjects: Array<{ id: string; name: string; todoRows: Array<unknown> }>;
      todoRows: Array<unknown>;
      isHydrated: boolean;
      syncStatus: string;
    } } }).__STORE__;
    return store?.getState();
  });
}

test.describe('Single-Peer Sanity Tests', () => {
  test.setTimeout(60000);
  
  test('Local CRDT: Add task updates both Yjs and Zustand', async ({ browser }) => {
    const peer = await setupPeer(browser);
    
    try {
      // Get initial state
      const initialState = await getStoreState(peer.page);
      expect(initialState).toBeTruthy();
      expect(initialState?.isHydrated).toBe(true);
      
      const initialProjectCount = initialState?.todoProjects.length || 0;
      const initialRowCount = initialState?.todoRows.length || 0;
      
      // Add a task via UI
      await peer.page.getByRole('button', { name: /add task/i }).click();
      await peer.page.waitForTimeout(500);
      
      // Get final state
      const finalState = await getStoreState(peer.page);
      const finalRowCount = finalState?.todoRows.length || 0;
      
      // Verify local update worked
      expect(finalRowCount).toBe(initialRowCount + 1);
      
      // Check monitoring for any issues
      const monitoring = await getMonitoringReport(peer.page);
      console.log('Monitoring report:', monitoring.report);
      
      // Verify observer is registered
      const activeInstance = monitoring.instances?.find((i: { id: string; observerRegistered: boolean; destroyedAt?: number }) => !i.destroyedAt);
      expect(activeInstance?.observerRegistered).toBe(true);
      
      console.log('✅ Local CRDT test passed: Task added successfully');
      
    } finally {
      await peer.context.close();
    }
  });
  
  test('Observer fires on Yjs update', async ({ browser }) => {
    const peer = await setupPeer(browser);
    
    try {
      // Clear any previous events
      await peer.page.evaluate(() => {
        const monitor = (window as unknown as { __SYNC_MONITOR?: { clearAll: () => void } }).__SYNC_MONITOR;
        monitor?.clearAll?.();
      });
      
      // Add task via store (triggers Yjs update)
      await peer.page.evaluate(() => {
        const store = (window as unknown as { __STORE__?: { getState: () => { addTodoRow: (task: string) => void } } }).__STORE__;
        store?.getState?.().addTodoRow?.('Observer Test Task');
      });
      
      await peer.page.waitForTimeout(500);
      
      // Check causal log for observer events
      const causalLog = await peer.page.evaluate(() => {
        const monitor = (window as unknown as { __SYNC_MONITOR?: { getCausalLog: () => Array<{ phase: string; action: string }> } }).__SYNC_MONITOR;
        return monitor?.getCausalLog?.() || [];
      });
      
      // Look for observer-related events
      const observerEvents = causalLog.filter((e: { phase: string; action: string }) => 
        e.phase === 'observer' || e.action.includes('observer')
      );
      
      console.log('Observer events found:', observerEvents.length);
      expect(observerEvents.length).toBeGreaterThan(0);
      
    } finally {
      await peer.context.close();
    }
  });
  
  test('No state divergence after local operations', async ({ browser }) => {
    const peer = await setupPeer(browser);
    
    try {
      // Perform multiple operations
      for (let i = 0; i < 3; i++) {
        await peer.page.evaluate((index) => {
          const store = (window as unknown as { __STORE__?: { getState: () => { addTodoRow: (task: string) => void } } }).__STORE__;
          store?.getState?.().addTodoRow?.(`Task ${index}`);
        }, i);
        await peer.page.waitForTimeout(300);
      }
      
      // Wait for debounced updates
      await peer.page.waitForTimeout(1500);
      
      // Check state consistency
      const consistency = await peer.page.evaluate(() => {
        const store = (window as unknown as { __STORE__?: { getState: () => {
          todoProjects: Array<{ todoRows: Array<unknown> }>;
          todoRows: Array<unknown>;
        } } }).__STORE__;
        const ydoc = (window as unknown as { __YDOC__?: { getMap: (name: string) => { values: () => Iterable<unknown> } } }).__YDOC__;
        
        const state = store?.getState?.();
        const zustandRowCount = state?.todoRows?.length || 0;
        
        // Count Yjs projects
        const yProjects = ydoc?.getMap?.('projects');
        let yjsRowCount = 0;
        if (yProjects) {
          for (const proj of yProjects.values()) {
            const p = proj as { get?: (key: string) => { values?: () => Iterable<unknown> } | undefined };
            const rows = p.get?.('todoRows');
            if (rows?.values) {
              yjsRowCount += Array.from(rows.values()).length;
            }
          }
        }
        
        return {
          zustandRowCount,
          yjsRowCount,
          diverged: zustandRowCount !== yjsRowCount,
        };
      });
      
      console.log('Consistency check:', consistency);
      expect(consistency.diverged).toBe(false);
      
    } finally {
      await peer.context.close();
    }
  });
});
