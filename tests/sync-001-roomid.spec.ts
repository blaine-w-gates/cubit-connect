import { test, expect } from '@playwright/test';

/**
 * SYNC-001 Debug Test - Room ID Verification
 * Theory: Peers might be in different rooms due to roomId mismatch
 */

test('SYNC-001 Debug: Verify room ID derivation', async ({ browser }) => {
  test.setTimeout(60000);
  const room = `roomid-test-${Date.now()}`;
  
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

    // Connect both to same room
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
    console.log('✅ Both peers connected');

    // CRITICAL: Check room IDs match
    const roomIdA = await pageA.evaluate(() => (window as any).__STORE__.getState().activeWorkspaceId);
    const roomIdB = await pageB.evaluate(() => (window as any).__STORE__.getState().activeWorkspaceId);
    
    console.log('Room ID A:', roomIdA?.slice(0, 16) + '...');
    console.log('Room ID B:', roomIdB?.slice(0, 16) + '...');
    console.log('Room IDs match:', roomIdA === roomIdB);
    
    expect(roomIdA).toBe(roomIdB);
    
    // Check sync status
    const syncStatusA = await pageA.evaluate(() => (window as any).__STORE__.getState().syncStatus);
    const syncStatusB = await pageB.evaluate(() => (window as any).__STORE__.getState().syncStatus);
    console.log('Sync status A:', syncStatusA);
    console.log('Sync status B:', syncStatusB);
    
    // Check hasPeers
    const hasPeersA = await pageA.evaluate(() => (window as any).__STORE__.getState().hasPeers);
    const hasPeersB = await pageB.evaluate(() => (window as any).__STORE__.getState().hasPeers);
    console.log('Has peers A:', hasPeersA);
    console.log('Has peers B:', hasPeersB);
    
    // Now test data sync
    console.log('Creating task on B...');
    await pageB.evaluate(() => {
      (window as any).__STORE__.getState().addTodoRow('SYNC-001 Test Task');
    });
    
    // Wait for B to have the task
    await pageB.waitForFunction(() => (window as any).__STORE__.getState().todoRows.length > 0, { timeout: 5000 });
    const rowsB = await pageB.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
    console.log('B has rows:', rowsB);
    
    // Wait for A to receive it
    console.log('Waiting for A to receive...');
    try {
      await pageA.waitForFunction(() => (window as any).__STORE__.getState().todoRows.length > 0, { timeout: 10000 });
      const rowsA = await pageA.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
      console.log('✅ A received task! Rows:', rowsA);
    } catch (e) {
      const rowsA = await pageA.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
      console.log('❌ A never received. Rows:', rowsA);
      throw new Error('Data sync failed - room IDs matched but data did not propagate');
    }

  } finally {
    await contextA.close();
    await contextB.close();
  }
});
