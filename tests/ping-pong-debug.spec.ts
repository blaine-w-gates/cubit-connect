import { test, expect, type Browser } from '@playwright/test';

test('Debug Yjs sync propagation', async ({ browser }) => {
  test.setTimeout(60000);
  const room = `debug-${Date.now()}`;
  
  const a = await browser.newContext().then(c => c.newPage().then(p => ({ context: c, page: p })));
  const b = await browser.newContext().then(c => c.newPage().then(p => ({ context: c, page: p })));

  try {
    // Setup
    for (const p of [a.page, b.page]) {
      await p.goto('/todo');
      await p.evaluate(() => {
        localStorage.setItem('cubit_api_key', btoa('test'));
        localStorage.setItem('sync_server_url', 'ws://localhost:8080');
      });
      await p.reload();
      await p.waitForFunction(() => (window as any).__STORE__?.getState()?.isHydrated);
      await p.evaluate(async () => { await (window as any).__STORE__.getState().resetProject(); });
    }

    // Connect both
    for (const p of [a.page, b.page]) {
      await p.getByRole('button', { name: 'Sync', exact: true }).click();
      await p.getByPlaceholder('Enter a shared secret...').fill(room);
      await p.getByRole('button', { name: 'Establish Secure Connection' }).click();
      await expect(p.getByText('Securely Connected')).toBeVisible({ timeout: 15000 });
      await p.getByRole('button', { name: 'Close', exact: false }).or(p.locator('button:has(svg.lucide-x)')).click();
    }

    // Wait for peers
    await a.page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
    await b.page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
    console.log('✅ Peers connected');

    // Wait for sync init
    await a.page.waitForTimeout(2000);
    await b.page.waitForTimeout(2000);

    // Check initial ydoc state
    const ydocA_before = await a.page.evaluate(() => (window as any).ydoc?.store?.toString() || 'no ydoc');
    const ydocB_before = await b.page.evaluate(() => (window as any).ydoc?.store?.toString() || 'no ydoc');
    console.log('Ydoc A before:', ydocA_before.substring(0, 100));
    console.log('Ydoc B before:', ydocB_before.substring(0, 100));

    // B creates task via store directly
    await b.page.evaluate(() => (window as any).__STORE__.getState().addTodoRow('Debug Task'));
    
    // Check B's state
    await b.page.waitForTimeout(500);
    const rowsB = await b.page.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
    console.log('B has rows:', rowsB);

    // Wait and check A
    await a.page.waitForTimeout(5000);
    const rowsA = await a.page.evaluate(() => (window as any).__STORE__.getState().todoRows.length);
    console.log('A has rows:', rowsA);

    // Check ydoc after
    const ydocA_after = await a.page.evaluate(() => (window as any).ydoc?.store?.toString() || 'no ydoc');
    const ydocB_after = await b.page.evaluate(() => (window as any).ydoc?.store?.toString() || 'no ydoc');
    console.log('Ydoc A after:', ydocA_after.substring(0, 100));
    console.log('Ydoc B after:', ydocB_after.substring(0, 100));

    // Verify
    expect(rowsA).toBe(rowsB);
    
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
