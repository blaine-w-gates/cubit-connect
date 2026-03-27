import { test, expect, type Browser } from '@playwright/test';

/**
 * Minimal ping-pong test using UI interactions
 */

type DeviceSession = {
  context: any;
  page: any;
};

async function setupDevice(browser: Browser, name: string): Promise<DeviceSession> {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('/todo');
  await page.evaluate(() => {
    localStorage.setItem('cubit_api_key', btoa('CUBIT_V1_SALT_test'));
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

async function waitForPeers(page: any) {
  await page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 20000 });
}

test('UI-based ping-pong: projects and tasks', async ({ browser }) => {
  test.setTimeout(120000);
  const room = `ui-${Date.now()}`;
  
  const a = await setupDevice(browser, 'A');
  const b = await setupDevice(browser, 'B');

  try {
    // Connect both
    await connectDevice(a.page, room);
    await connectDevice(b.page, room);
    await waitForPeers(a.page);
    await waitForPeers(b.page);
    console.log('✅ Both devices connected');

    // A creates project via UI
    await a.page.getByRole('button', { name: 'Project' }).click();
    const projA = `Proj-A-${Date.now()}`;
    await a.page.getByPlaceholder(/Project name/i).fill(projA);
    await a.page.getByRole('button', { name: /Create|Add/ }).click();
    
    // B should see the project
    await expect(b.page.getByText(projA)).toBeVisible({ timeout: 10000 });
    console.log('✅ A→B project sync via UI works');

    // B clicks on project
    await b.page.getByText(projA).click();
    
    // B adds task via UI (like working test)
    await b.page.getByRole('button', { name: 'Task', exact: true }).click();
    await b.page.waitForTimeout(500);
    
    // A should see the task via store state (like working test)
    await a.page.waitForFunction(() => (window as any).__STORE__.getState().todoRows.length > 0, { timeout: 10000 });
    await expect(a.page.getByText('New Task')).toBeVisible({ timeout: 10000 });
    console.log('✅ B→A task sync via UI works');

    // A uses Cubit button
    await a.page.getByRole('button', { name: 'Cubit' }).click();
    await a.page.waitForTimeout(500);
    
    // Wait for steps to appear
    await expect(a.page.getByText(/Step 1/i)).toBeVisible({ timeout: 15000 });
    
    // B should see steps too
    await expect(b.page.getByText(/Step 1/i)).toBeVisible({ timeout: 10000 });
    console.log('✅ A→B Cubit steps sync works');
    
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
