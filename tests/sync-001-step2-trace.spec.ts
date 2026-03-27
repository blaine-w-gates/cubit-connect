/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';

/**
 * SYNC-001 Step 2: Trace Yjs Update Chain
 * Add console logging to trace: ydoc.on('update') → broadcastUpdate → WebSocket
 */

test('SYNC-001 Step 2: Trace update propagation', async ({ browser }) => {
  test.setTimeout(60000);
  const room = `trace-${Date.now()}`;
  
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    // Setup both pages
    for (const page of [pageA, pageB]) {
      await page.goto('/todo');
      await page.evaluate(() => {
        localStorage.setItem('cubit_api_key', btoa('test'));
        localStorage.setItem('sync_server_url', 'ws://localhost:8080');
      });
      await page.reload();
      await page.waitForFunction(() => (window as any).__STORE__?.getState()?.isHydrated);
    }

    // Connect both
    for (const page of [pageA, pageB]) {
      await page.getByRole('button', { name: 'Sync', exact: true }).click();
      await page.getByPlaceholder('Enter a shared secret...').fill(room);
      await page.getByRole('button', { name: 'Establish Secure Connection' }).click();
      await expect(page.getByText('Securely Connected')).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: 'Close', exact: false }).or(page.locator('button:has(svg.lucide-x)')).click();
    }

    // Wait for peer discovery
    await pageA.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
    await pageB.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
    
    // Start listening to console logs on A (the receiver)
    const aLogs: string[] = [];
    pageA.on('console', msg => {
      const text = msg.text();
      if (text.includes('[YJS') || text.includes('[OUTBOUND]') || text.includes('[INBOUND]') || text.includes('broadcast') || text.includes('update') || text.includes('NETWORKSYNC') || text.includes('connectToSyncServer') || text.includes('loadProject') || text.includes('registerYjsObserver') || text.includes('resetYDoc')) {
        aLogs.push(`[A] ${text}`);
      }
    });

    const bLogs: string[] = [];
    pageB.on('console', msg => {
      const text = msg.text();
      if (text.includes('[YJS') || text.includes('[OUTBOUND]') || text.includes('[INBOUND]') || text.includes('broadcast') || text.includes('update') || text.includes('NETWORKSYNC') || text.includes('connectToSyncServer') || text.includes('loadProject') || text.includes('registerYjsObserver') || text.includes('resetYDoc')) {
        bLogs.push(`[B] ${text}`);
      }
    });

    console.log('\n=== TRACING YJS UPDATE CHAIN ===');
    console.log('Creating task on B...');
    
    // B creates task - this should trigger ydoc.on('update') → broadcastUpdate
    await pageB.evaluate(() => {
      console.log('[TEST] Calling addTodoRow on B...');
      (window as any).__STORE__.getState().addTodoRow('Trace Test Task');
      console.log('[TEST] addTodoRow completed');
    });
    
    // Wait a bit for logs
    await pageB.waitForTimeout(500);
    
    console.log('\n--- B Console Logs (should show broadcast) ---');
    bLogs.forEach(log => console.log(log));
    
    console.log('\n--- A Console Logs (should show receive) ---');
    aLogs.forEach(log => console.log(log));
    
    // Check B has the task
    const rowsB = await pageB.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
    console.log('\nB rows after create:', rowsB);
    
    // Wait for A
    console.log('Waiting 5s for sync to A...');
    await pageA.waitForTimeout(5000);
    
    const rowsA = await pageA.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
    console.log('A rows after wait:', rowsA);
    
    console.log('\n--- A Console Logs (after wait) ---');
    aLogs.slice(aLogs.length - 10).forEach(log => console.log(log));
    
    console.log('=====================================\n');
    
    // Verify
    expect(rowsB).toBe(1);
    // We expect this to fail - documenting the issue
    if (rowsA === 0) {
      console.log('❌ CONFIRMED: A never received the update');
      console.log('Issue is in Yjs update chain - check logs above');
    }
    
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
