import { test, expect, type Browser, type Page, type BrowserContext } from '@playwright/test';

/**
 * Ping-Pong Bidirectional Sync Test - Simplified
 * Validates A→B and B→A sync for core operations
 */

type DeviceSession = {
  context: BrowserContext;
  page: Page;
  name: string;
};

async function setupDevice(browser: Browser, name: string): Promise<DeviceSession> {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('/todo');
  await page.evaluate(() => {
    localStorage.setItem('cubit_api_key', btoa('CUBIT_V1_SALT_test'));
    localStorage.setItem('sync_server_url', 'ws://localhost:8080');
    localStorage.setItem('theme', 'dark');
  });
  await page.reload();
  
  await page.waitForFunction(() => (window as any).__STORE__?.getState()?.isHydrated);
  await page.evaluate(async () => { await (window as any).__STORE__.getState().resetProject(); });
  await page.waitForTimeout(300);

  return { context, page, name };
}

async function connectDevice(page: Page, passphrase: string) {
  await page.getByRole('button', { name: 'Sync', exact: true }).click();
  await page.getByPlaceholder('Enter a shared secret...').fill(passphrase);
  await page.getByRole('button', { name: 'Establish Secure Connection' }).click();
  await expect(page.getByText('Securely Connected')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Close', exact: false }).or(page.locator('button:has(svg.lucide-x)')).click();
}

async function waitForPeers(page: Page) {
  await page.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 20000 });
}

async function waitForSync(page: Page, checkFn: (arg: any) => boolean, arg?: any, timeout = 15000) {
  await page.waitForFunction(checkFn, arg, { timeout });
}

test.describe('Ping-Pong Sync', () => {
  test.setTimeout(180000);

  test('Projects sync A→B and B→A', async ({ browser }) => {
    const room = `proj-${Date.now()}`;
    const projA = `Project-A-${Date.now()}`;
    const projB = `Project-B-${Date.now()}`;
    
    const a = await setupDevice(browser, 'A');
    const b = await setupDevice(browser, 'B');

    try {
      // Connect both (without waiting for peers initially)
      await connectDevice(a.page, room);
      await connectDevice(b.page, room);
      
      // NOW wait for peer discovery (after both are connected)
      await waitForPeers(a.page);
      await waitForPeers(b.page);

      // A creates project → B receives
      await a.page.evaluate((name) => (window as any).__STORE__.getState().addTodoProject(name), projA);
      await waitForSync(b.page, (name) => (window as any).__STORE__.getState().todoProjects.some((p: any) => p.name === name), projA);
      
      let stateB = await b.page.evaluate(() => (window as any).__STORE__.getState().todoProjects.map((p: any) => p.name));
      expect(stateB).toContain(projA);
      console.log('✅ A→B project sync works');

      // B creates project → A receives
      await b.page.evaluate((name) => (window as any).__STORE__.getState().addTodoProject(name), projB);
      await waitForSync(a.page, (name) => (window as any).__STORE__.getState().todoProjects.some((p: any) => p.name === name), projB);
      
      let stateA = await a.page.evaluate(() => (window as any).__STORE__.getState().todoProjects.map((p: any) => p.name));
      expect(stateA).toContain(projB);
      console.log('✅ B→A project sync works');

      // Verify both have both projects
      stateA = await a.page.evaluate(() => (window as any).__STORE__.getState().todoProjects.map((p: any) => p.name));
      stateB = await b.page.evaluate(() => (window as any).__STORE__.getState().todoProjects.map((p: any) => p.name));
      expect(stateA).toEqual(expect.arrayContaining([projA, projB]));
      expect(stateB).toEqual(expect.arrayContaining([projA, projB]));
      
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('Tasks sync with steps A→B and B→A', async ({ browser }) => {
    const room = `task-${Date.now()}`;
    const projectName = `Task-Project-${Date.now()}`;
    const taskA = `Task-From-A-${Date.now()}`;
    const taskB = `Task-From-B-${Date.now()}`;
    
    const a = await setupDevice(browser, 'A');
    const b = await setupDevice(browser, 'B');

    try {
      // Connect both and wait for peers
      await connectDevice(a.page, room);
      await connectDevice(b.page, room);
      await waitForPeers(a.page);
      await waitForPeers(b.page);

      // Create shared project on A
      await a.page.evaluate((name) => (window as any).__STORE__.getState().addTodoProject(name), projectName);
      await waitForSync(b.page, (name) => (window as any).__STORE__.getState().todoProjects.some((p: any) => p.name === name), projectName);
      
      // Activate on both
      const projId = await a.page.evaluate(() => {
        const p = (window as any).__STORE__.getState().todoProjects[0];
        (window as any).__STORE__.getState().setActiveProject(p.id);
        return p.id;
      });
      await b.page.evaluate((id) => (window as any).__STORE__.getState().setActiveProject(id), projId);
      await a.page.waitForTimeout(500);

      // A adds task → B receives
      await a.page.evaluate((task) => (window as any).__STORE__.getState().addTodoRow(task), taskA);
      await waitForSync(b.page, (task) => (window as any).__STORE__.getState().todoRows.some((r: any) => r.task === task), taskA);
      
      let rowsB = await b.page.evaluate(() => (window as any).__STORE__.getState().todoRows.map((r: any) => r.task));
      expect(rowsB).toContain(taskA);
      console.log('✅ A→B task sync works');

      // B adds steps → A receives
      const rowId = await b.page.evaluate(() => (window as any).__STORE__.getState().todoRows.find((r: any) => r.task.includes('Task-From-A')).id);
      await b.page.evaluate((id) => (window as any).__STORE__.getState().setTodoSteps(id, ['Step 1', 'Step 2', 'Step 3', 'Step 4']), rowId);
      
      await waitForSync(a.page, (text) => (window as any).__STORE__.getState().todoRows.some((r: any) => r.steps?.[0]?.text === text), 'Step 1');
      
      const rowA = await a.page.evaluate(() => (window as any).__STORE__.getState().todoRows.find((r: any) => r.steps?.[0]?.text === 'Step 1'));
      expect(rowA?.steps?.map((s: any) => s.text)).toEqual(['Step 1', 'Step 2', 'Step 3', 'Step 4']);
      console.log('✅ B→A steps sync works');

      // B adds task → A receives
      await b.page.evaluate((task) => (window as any).__STORE__.getState().addTodoRow(task), taskB);
      await waitForSync(a.page, (task) => (window as any).__STORE__.getState().todoRows.some((r: any) => r.task === task), taskB);
      
      let rowsA = await a.page.evaluate(() => (window as any).__STORE__.getState().todoRows.map((r: any) => r.task));
      expect(rowsA).toContain(taskB);
      console.log('✅ B→A task sync works');
      
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('Dials and rabbit sync A↔B', async ({ browser }) => {
    const room = `dial-${Date.now()}`;
    const projectName = `Dial-Project-${Date.now()}`;
    const taskName = `Dial-Task-${Date.now()}`;
    
    const a = await setupDevice(browser, 'A');
    const b = await setupDevice(browser, 'B');

    try {
      // Connect both and wait for peers
      await connectDevice(a.page, room);
      await connectDevice(b.page, room);
      await waitForPeers(a.page);
      await waitForPeers(b.page);

      // Setup shared project
      await a.page.evaluate((name) => (window as any).__STORE__.getState().addTodoProject(name), projectName);
      await waitForSync(b.page, (name) => (window as any).__STORE__.getState().todoProjects.some((p: any) => p.name === name), projectName);
      
      const projId = await a.page.evaluate(() => {
        const p = (window as any).__STORE__.getState().todoProjects[0];
        (window as any).__STORE__.getState().setActiveProject(p.id);
        return p.id;
      });
      await b.page.evaluate((id) => (window as any).__STORE__.getState().setActiveProject(id), projId);

      // Add task with steps
      await a.page.evaluate((task) => (window as any).__STORE__.getState().addTodoRow(task), taskName);
      await waitForSync(b.page, () => (window as any).__STORE__.getState().todoRows.length > 0, undefined);
      
      // Add steps
      const rowId = await a.page.evaluate(() => (window as any).__STORE__.getState().todoRows[0].id);
      await a.page.evaluate((id) => (window as any).__STORE__.getState().setTodoSteps(id, ['S1', 'S2', 'S3', 'S4']), rowId);
      await b.page.waitForTimeout(500);

      // A sets dial → B sees
      await a.page.evaluate((text) => (window as any).__STORE__.getState().setDialPriority('left', text), 'Priority-A');
      await waitForSync(b.page, () => {
        const p = (window as any).__STORE__.getState().todoProjects.find((p: any) => p.id === (window as any).__STORE__.getState().activeProjectId);
        return p?.priorityDials?.left === 'Priority-A';
      }, undefined);
      console.log('✅ A→B dial sync works');

      // B focuses dial → A sees
      await b.page.evaluate(() => (window as any).__STORE__.getState().setDialFocus('right'));
      await waitForSync(a.page, () => {
        const p = (window as any).__STORE__.getState().todoProjects.find((p: any) => p.id === (window as any).__STORE__.getState().activeProjectId);
        return p?.priorityDials?.focusedSide === 'right';
      }, undefined);
      console.log('✅ B→A dial focus sync works');

      // A moves rabbit (completes step) → B sees
      const rid = await a.page.evaluate(() => (window as any).__STORE__.getState().todoRows[0].id);
      await a.page.evaluate((id) => (window as any).__STORE__.getState().completeStepsUpTo(id, 1), rid);
      await waitForSync(b.page, () => (window as any).__STORE__.getState().todoRows[0]?.steps?.[0]?.isCompleted === true, undefined);
      console.log('✅ A→B rabbit/step sync works');

      // B moves rabbit → A sees  
      await b.page.evaluate((id) => (window as any).__STORE__.getState().completeStepsUpTo(id, 3), rid);
      await waitForSync(a.page, () => (window as any).__STORE__.getState().todoRows[0]?.steps?.[3]?.isCompleted === true, undefined);
      console.log('✅ B→A rabbit/step sync works');
      
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });
});
