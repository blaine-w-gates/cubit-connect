import { test, expect } from '@playwright/test';

/**
 * SYNC-001 Step 1: Verify Room ID Derivation
 * This test checks if both peers derive the same room ID
 */

test('SYNC-001 Step 1: Room ID match check', async ({ browser }) => {
  test.setTimeout(30000);
  const room = `test-${Date.now()}`;
  
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

    // Connect A
    await pageA.getByRole('button', { name: 'Sync', exact: true }).click();
    await pageA.getByPlaceholder('Enter a shared secret...').fill(room);
    await pageA.getByRole('button', { name: 'Establish Secure Connection' }).click();
    await expect(pageA.getByText('Securely Connected')).toBeVisible({ timeout: 15000 });
    await pageA.getByRole('button', { name: 'Close', exact: false }).or(pageA.locator('button:has(svg.lucide-x)')).click();
    
    // Connect B
    await pageB.getByRole('button', { name: 'Sync', exact: true }).click();
    await pageB.getByPlaceholder('Enter a shared secret...').fill(room);
    await pageB.getByRole('button', { name: 'Establish Secure Connection' }).click();
    await expect(pageB.getByText('Securely Connected')).toBeVisible({ timeout: 15000 });
    await pageB.getByRole('button', { name: 'Close', exact: false }).or(pageB.locator('button:has(svg.lucide-x)')).click();

    // Wait for peer discovery
    await pageA.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
    await pageB.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });

    // IMMEDIATE: Check room IDs match
    const roomIdA = await pageA.evaluate(() => (window as any).__STORE__.getState().activeWorkspaceId);
    const roomIdB = await pageB.evaluate(() => (window as any).__STORE__.getState().activeWorkspaceId);
    
    console.log('\n=== ROOM ID VERIFICATION ===');
    console.log('Room passphrase:', room);
    console.log('Room ID A:', roomIdA);
    console.log('Room ID B:', roomIdB);
    console.log('Room IDs match:', roomIdA === roomIdB);
    console.log('============================\n');
    
    expect(roomIdA).toBeTruthy();
    expect(roomIdB).toBeTruthy();
    expect(roomIdA).toBe(roomIdB);

    // Check sync status
    const syncA = await pageA.evaluate(() => (window as any).__STORE__.getState().syncStatus);
    const syncB = await pageB.evaluate(() => (window as any).__STORE__.getState().syncStatus);
    const peersA = await pageA.evaluate(() => (window as any).__STORE__.getState().hasPeers);
    const peersB = await pageB.evaluate(() => (window as any).__STORE__.getState().hasPeers);
    
    console.log('Sync status A:', syncA, '| hasPeers:', peersA);
    console.log('Sync status B:', syncB, '| hasPeers:', peersB);
    
    expect(syncA).toBe('connected');
    expect(syncB).toBe('connected');
    expect(peersA).toBe(true);
    expect(peersB).toBe(true);

  } finally {
    await contextA.close();
    await contextB.close();
  }
});
