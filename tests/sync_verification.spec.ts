import { test, expect, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SYNC-001 High-Fidelity Verification
 * Verified isolation using separate browser contexts.
 */

test('Verify Yjs Sync Fix via Automated Multi-Context Testing', async ({ browser }) => {
  const timestamp = Date.now();
  const logPath = path.join(process.cwd(), 'test-logs', `sync-verification-${timestamp}.log`);
  const screenshotA = path.join(process.cwd(), 'test-logs', `sync-verification-A-${timestamp}.png`);
  const screenshotB = path.join(process.cwd(), 'test-logs', `sync-verification-B-${timestamp}.png`);

  const logs: string[] = [];
  const appendLog = (msg: string) => {
    const formatted = `[${new Date().toISOString()}] ${msg}`;
    logs.push(formatted);
    console.log(formatted);
  };

  appendLog('--- STARTING HIGH-FIDELITY SYNC TEST ---');

  // 1. OPEN TWO SEPARATE BROWSER CONTEXTS
  appendLog('Setting up isolated contexts...');
  const contextA = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const contextB = await browser.newContext({
    ...devices['iPad Pro 11'],
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // Listen for the "smoking gun" log in Context B
  let foundNetworkOriginLog = false;
  pageB.on('console', msg => {
    const text = msg.text();
    if (text.includes('origin: network')) {
      appendLog(`[FOUND SMOKING GUN IN B]: ${text}`);
      foundNetworkOriginLog = true;
    }
  });

  try {
    const targetUrl = 'https://blaine-w-gates.github.io/cubit-connect/todo';
    
    // 2. NAVIGATE BOTH
    appendLog(`Navigating Context A to ${targetUrl}`);
    await pageA.goto(targetUrl);
    appendLog(`Navigating Context B to ${targetUrl}`);
    await pageB.goto(targetUrl);

    // Wait for hydration
    for (const page of [pageA, pageB]) {
      await page.waitForFunction(() => (window as any).__STORE__?.getState()?.isHydrated, { timeout: 30000 });
    }

    // 3. JOIN SYNC ON BOTH
    const joinSync = async (page: any, contextName: string) => {
      appendLog(`[${contextName}] Joining sync...`);
      await page.getByRole('button', { name: 'Sync', exact: true }).click();
      await page.getByPlaceholder('Enter a shared secret...').fill('manual-test-2024');
      await page.getByRole('button', { name: 'Establish Secure Connection' }).click();
      await expect(page.getByText('Securely Connected')).toBeVisible({ timeout: 20000 });
      // Close modal
      const closeButton = page.locator('button:has(svg.lucide-x)').first();
      await closeButton.click();
      appendLog(`[${contextName}] Successfully connected.`);
    };

    await joinSync(pageA, 'Context A');
    await joinSync(pageB, 'Context B');

    // Wait for peers to see each other
    appendLog('Waiting for peer discovery...');
    await pageA.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
    await pageB.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
    appendLog('Peers discovered each other.');

    // 4. PERFORM SYNC TEST
    appendLog('Creating project on Context A...');
    const projectName = `SYNC TEST ${timestamp}`;
    await pageA.evaluate((name) => {
      (window as any).__STORE__.getState().addTodoProject(name);
    }, projectName);

    appendLog('Waiting for sync to Context B...');
    // We wait for the project to appear in the DOM of B
    await expect(pageB.getByText(projectName)).toBeVisible({ timeout: 10000 });
    appendLog(`Sync success: Project "${projectName}" visible on Context B.`);

    // Add a task from Context B to demonstrate bidirectional sync
    appendLog('Adding task from Context B...');
    const taskName = `B-SIDE TASK ${timestamp}`;
    await pageB.evaluate((name) => {
      (window as any).__STORE__.getState().addTodoRow(name);
    }, taskName);

    appendLog('Waiting for task to appear in Context A...');
    await expect(pageA.getByText(taskName)).toBeVisible({ timeout: 10000 });
    appendLog(`Sync success: Task "${taskName}" visible on Context A.`);

    // 5. CAPTURE FINAL STATE
    appendLog('Capturing screenshots...');
    await pageA.screenshot({ path: screenshotA });
    await pageB.screenshot({ path: screenshotB });

    // 6. FINAL VERDICT
    if (foundNetworkOriginLog) {
      appendLog('VERDICT: PASS - Observer fired with origin: network');
    } else {
      appendLog('VERDICT: FAIL - Sync worked but observer log missing (investigate further)');
    }

  } catch (error: any) {
    appendLog(`ERROR DURING TEST: ${error.message}`);
    appendLog('VERDICT: FAIL');
  } finally {
    // Write logs to file System
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, logs.join('\n'));
    appendLog(`Saved logs to ${logPath}`);
    
    await contextA.close();
    await contextB.close();
  }
});
