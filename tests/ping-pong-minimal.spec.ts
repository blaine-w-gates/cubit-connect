import { test, expect, type Browser } from '@playwright/test';

/**
 * Minimal ping-pong test - validates bidirectional sync works
 * Based on the working sync-reconciliation.spec.ts pattern
 */

async function setupDevice(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('/todo');
  await page.evaluate(() => {
    localStorage.setItem('cubit_api_key', btoa('test'));
    localStorage.setItem('sync_server_url', 'ws://localhost:8080');
  });
  await page.reload();
  
  await page.waitForFunction(() => (window as any).__STORE__?.getState()?.isHydrated);
  await page.evaluate(async () => { await (window as any).__STORE__.getState().resetProject(); });
  await page.waitForTimeout(300);

  return { context, page };
}

async function connectDevice(page: any, passphrase: string) {
  await page.getByRole('button', { name: 'Sync', exact: true }).click();
  await page.getByPlaceholder('Enter a shared secret...').fill(passphrase);
  await page.getByRole('button', { name: 'Establish Secure Connection' }).click();
  await expect(page.getByText('Securely Connected')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Close', exact: false }).or(page.locator('button:has(svg.lucide-x)')).click();
}

test('Ping-pong: B creates task, A receives it', async ({ browser }) => {
  test.setTimeout(60000);
  const room = `ping-${Date.now()}`;
  
  const a = await setupDevice(browser);
  const b = await setupDevice(browser);

  try {
    // Connect A
    await connectDevice(a.page, room);
    
    // Connect B
    await connectDevice(b.page, room);
    
    // Wait for peer discovery on both
    await a.page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
    await b.page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
    console.log('✅ Both connected and discovered');
    
    // Wait for sync to fully initialize
    await a.page.waitForTimeout(1000);
    await b.page.waitForTimeout(1000);
    
    // DEBUG: Check initial state
    const initialRowsA = await a.page.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
    const initialRowsB = await b.page.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
    console.log(`Initial rows - A: ${initialRowsA}, B: ${initialRowsB}`);

    // B adds task via UI
    console.log('Clicking Task button on B...');
    await b.page.getByRole('button', { name: 'Task', exact: true }).click();
    
    // DEBUG: Check B's state after click
    await b.page.waitForTimeout(500);
    const afterClickRowsB = await b.page.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
    console.log(`After click - B has ${afterClickRowsB} rows`);
    
    // A receives it
    console.log('Waiting for A to receive task...');
    await a.page.waitForFunction(() => (window as any).__STORE__.getState().todoRows.length > 0, { timeout: 10000 });
    await expect(a.page.getByText('New Task')).toBeVisible({ timeout: 10000 });
    
    console.log('✅ B→A task sync confirmed');
    
    // Verify stores match
    const rowsA = await a.page.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
    const rowsB = await b.page.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
    expect(rowsA).toBe(rowsB);
    expect(rowsA).toBe(1);
    
    console.log('✅ Stores converged');
    
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test('Ping-pong: A dials, B receives', async ({ browser }) => {
  test.setTimeout(60000);
  const room = `dial-${Date.now()}`;
  
  const a = await setupDevice(browser);
  const b = await setupDevice(browser);

  try {
    await connectDevice(a.page, room);
    await connectDevice(b.page, room);
    await a.page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
    await b.page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });

    // A sets dial priority
    await a.page.evaluate((text) => (window as any).__STORE__.getState().setDialPriority('left', text), 'From-A');
    
    // B should see it
    await b.page.waitForFunction(() => {
      const store = (window as any).__STORE__.getState();
      const proj = store.todoProjects.find((p: any) => p.id === store.activeProjectId);
      return proj?.priorityDials?.left === 'From-A';
    }, { timeout: 10000 });
    
    console.log('✅ A→B dial sync confirmed');
    
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
