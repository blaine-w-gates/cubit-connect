import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SYNC-001 Root Cause Diagnostic
 * This test captures detailed logs to identify why observer isn't firing.
 */

test('Diagnostic: Capture full console logs for sync failure analysis', async ({ browser }) => {
  const timestamp = Date.now();
  const logDir = path.join(process.cwd(), 'test-logs');
  fs.mkdirSync(logDir, { recursive: true });

  // Create contexts
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // Capture ALL console logs
  const logsA: string[] = [];
  const logsB: string[] = [];

  pageA.on('console', msg => {
    const text = `[A] ${msg.type()}: ${msg.text()}`;
    logsA.push(text);
    console.log(text);
  });

  pageB.on('console', msg => {
    const text = `[B] ${msg.type()}: ${msg.text()}`;
    logsB.push(text);
    console.log(text);
  });

  try {
    const targetUrl = 'https://blaine-w-gates.github.io/cubit-connect/todo';

    // Navigate both
    await pageA.goto(targetUrl);
    await pageB.goto(targetUrl);
    await pageA.waitForTimeout(3000);
    await pageB.waitForTimeout(3000);

    // Get initial ydoc state from both
    const initialStateA = await pageA.evaluate(() => {
      const store = (window as any).__STORE__;
      const state = store?.getState?.() || {};
      return {
        isHydrated: state.isHydrated,
        todoProjectsCount: state.todoProjects?.length || 0,
        syncStatus: state.syncStatus,
        hasPeers: state.hasPeers
      };
    });

    const initialStateB = await pageB.evaluate(() => {
      const store = (window as any).__STORE__;
      const state = store?.getState?.() || {};
      return {
        isHydrated: state.isHydrated,
        todoProjectsCount: state.todoProjects?.length || 0,
        syncStatus: state.syncStatus,
        hasPeers: state.hasPeers
      };
    });

    console.log('Initial State A:', initialStateA);
    console.log('Initial State B:', initialStateB);

    // Join sync on A
    await pageA.getByRole('button', { name: 'Sync' }).click();
    await pageA.getByPlaceholder('Enter a shared secret...').fill('diag-test-2024');
    await pageA.getByRole('button', { name: 'Establish Secure Connection' }).click();
    await pageA.waitForTimeout(3000);

    // Join sync on B
    await pageB.getByRole('button', { name: 'Sync' }).click();
    await pageB.getByPlaceholder('Enter a shared secret...').fill('diag-test-2024');
    await pageB.getByRole('button', { name: 'Establish Secure Connection' }).click();
    await pageB.waitForTimeout(3000);

    // Wait for connection
    await pageA.waitForTimeout(5000);
    await pageB.waitForTimeout(5000);

    // Check state after connection
    const connectedStateA = await pageA.evaluate(() => {
      const store = (window as any).__STORE__;
      const state = store?.getState?.() || {};
      return {
        syncStatus: state.syncStatus,
        hasPeers: state.hasPeers,
        todoProjectsCount: state.todoProjects?.length || 0,
        ydoc: (window as any).getYDoc ? 'available' : 'not available'
      };
    });

    const connectedStateB = await pageB.evaluate(() => {
      const store = (window as any).__STORE__;
      const state = store?.getState?.() || {};
      return {
        syncStatus: state.syncStatus,
        hasPeers: state.hasPeers,
        todoProjectsCount: state.todoProjects?.length || 0,
        ydoc: (window as any).getYDoc ? 'available' : 'not available'
      };
    });

    console.log('Connected State A:', connectedStateA);
    console.log('Connected State B:', connectedStateB);

    // Create project on A using direct ydoc mutation (bypasses UI)
    const projectCreated = await pageA.evaluate(() => {
      try {
        const store = (window as any).__STORE__;
        const ydoc = (window as any).getYDoc?.();

        console.log('[DIAG] Creating project directly...');
        console.log('[DIAG] ydoc available:', !!ydoc);
        console.log('[DIAG] store available:', !!store);

        // Use store action
        store.getState().addTodoProject('DIAG PROJECT');

        return {
          success: true,
          projectsAfter: store.getState().todoProjects?.length || 0,
          lastProject: store.getState().todoProjects?.[0]?.name || 'none'
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    });

    console.log('Project creation result:', projectCreated);

    // Wait and check B
    await pageB.waitForTimeout(5000);

    const finalStateB = await pageB.evaluate(() => {
      const store = (window as any).__STORE__;
      const state = store?.getState?.() || {};
      return {
        todoProjectsCount: state.todoProjects?.length || 0,
        projects: state.todoProjects?.map((p: any) => p.name) || [],
        hasPeers: state.hasPeers
      };
    });

    console.log('Final State B:', finalStateB);

    // Save all logs
    fs.writeFileSync(path.join(logDir, `diag-A-${timestamp}.log`), logsA.join('\n'));
    fs.writeFileSync(path.join(logDir, `diag-B-${timestamp}.log`), logsB.join('\n'));
    fs.writeFileSync(path.join(logDir, `diag-summary-${timestamp}.json`), JSON.stringify({
      initialStateA, initialStateB,
      connectedStateA, connectedStateB,
      projectCreated, finalStateB
    }, null, 2));

    console.log('Logs saved to:', logDir);

    // Assertions for debugging
    expect(connectedStateA.hasPeers || connectedStateB.hasPeers).toBeTruthy();

  } finally {
    await contextA.close();
    await contextB.close();
  }
});
