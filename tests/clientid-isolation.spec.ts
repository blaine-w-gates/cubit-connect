/**
 * SYNC-001 ClientID Isolation Test
 * 
 * This test verifies that peer discovery works correctly when testing
 * with multiple tabs on the same device. The key fix is ensuring each
 * tab has a unique Yjs ClientID so updates aren't ignored as "local changes".
 * 
 * Before the fix: Two Chrome tabs on same machine would generate identical
 * Yjs ClientIDs (from same crypto entropy pool) and ignore each other's updates.
 * 
 * After the fix: Each tab generates a deterministic unique ClientID, enabling
 * proper peer discovery and sync on same-device testing.
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const SYNC_PASSPHRASE = 'test-same-device-123';
const PEER_DISCOVERY_TIMEOUT = 15000; // 15 seconds max for peer indicator

/**
 * Helper: Wait for peer indicator to show "2" peers
 */
async function waitForPeerCount(page: Page, expectedCount: number, timeoutMs: number = PEER_DISCOVERY_TIMEOUT): Promise<boolean> {
  try {
    const indicatorSelector = `[data-testid="peer-indicator"]:has-text("👤 ${expectedCount}")`;
    await page.waitForSelector(indicatorSelector, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper: Get current peer count from UI
 */
async function getPeerCount(page: Page): Promise<number> {
  const indicator = await page.locator('[data-testid="peer-indicator"]').first();
  if (!await indicator.isVisible().catch(() => false)) {
    return 1; // Default: alone
  }
  
  const text = await indicator.textContent();
  const match = text?.match(/👤\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Helper: Open sync modal and connect
 */
async function connectToSyncRoom(page: Page, passphrase: string): Promise<void> {
  // Open sync modal
  await page.click('[data-testid="sync-button"]');
  await page.waitForSelector('[data-testid="sync-modal"]', { state: 'visible' });
  
  // Enter passphrase
  await page.fill('[data-testid="passphrase-input"]', passphrase);
  
  // Click connect
  await page.click('[data-testid="connect-button"]');
  
  // Wait for connected status
  await page.waitForSelector('[data-testid="sync-status-connected"]', { timeout: 10000 });
}

/**
 * Helper: Create test data (a todo row) on a page
 */
async function createTestData(page: Page, taskText: string): Promise<void> {
  // Switch to todo view if needed
  await page.click('[data-testid="todo-tab"]');
  
  // Add a todo row
  await page.click('[data-testid="add-todo-row"]');
  await page.fill('[data-testid="todo-task-input"]:focus', taskText);
  await page.keyboard.press('Enter');
  
  // Wait for sync activity to propagate
  await page.waitForTimeout(500);
}

/**
 * Helper: Get all todo rows text from a page
 */
async function getTodoRows(page: Page): Promise<string[]> {
  const rows = await page.locator('[data-testid="todo-row"]').all();
  const texts: string[] = [];
  
  for (const row of rows) {
    const text = await row.locator('[data-testid="todo-task-text"]').textContent().catch(() => '');
    if (text) texts.push(text.trim());
  }
  
  return texts;
}

test.describe('SYNC-001: ClientID Isolation for Same-Device Testing', () => {
  
  test.describe.configure({ mode: 'serial' });
  
  test('Two tabs in same browser context should have unique ClientIDs', async ({ browser }) => {
    // Use a single browser context (same device simulation)
    const context = await browser.newContext();
    
    try {
      // Create two pages (tabs) in the same context
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      
      // Load app in both pages
      await page1.goto('/');
      await page2.goto('/');
      
      // Wait for app to be ready
      await page1.waitForSelector('[data-testid="app-ready"]', { timeout: 10000 });
      await page2.waitForSelector('[data-testid="app-ready"]', { timeout: 10000 });
      
      // Check ClientIDs are different via console logs
      const clientIdLogs1: string[] = [];
      const clientIdLogs2: string[] = [];
      
      page1.on('console', msg => {
        const text = msg.text();
        if (text.includes('deterministic ClientID')) {
          clientIdLogs1.push(text);
        }
      });
      
      page2.on('console', msg => {
        const text = msg.text();
        if (text.includes('deterministic ClientID')) {
          clientIdLogs2.push(text);
        }
      });
      
      // Both pages should show unique ClientIDs in logs
      expect(clientIdLogs1.length).toBeGreaterThan(0);
      expect(clientIdLogs2.length).toBeGreaterThan(0);
      
      // Extract ClientIDs
      const extractClientId = (logs: string[]): number | null => {
        for (const log of logs) {
          const match = log.match(/ClientID:\s*(\d+)/);
          if (match) return parseInt(match[1], 10);
        }
        return null;
      };
      
      const clientId1 = extractClientId(clientIdLogs1);
      const clientId2 = extractClientId(clientIdLogs2);
      
      console.log(`Page 1 ClientID: ${clientId1}`);
      console.log(`Page 2 ClientID: ${clientId2}`);
      
      // Verify ClientIDs are different (the key fix!)
      expect(clientId1).not.toBeNull();
      expect(clientId2).not.toBeNull();
      expect(clientId1).not.toBe(clientId2);
      
      console.log('✅ ClientID isolation verified: Each tab has unique ClientID');
      
    } finally {
      await context.close();
    }
  });

  test('Two tabs should discover each other within 15 seconds', async ({ browser }) => {
    const context = await browser.newContext();
    
    try {
      // Create two pages
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      
      // Load app in both pages
      await page1.goto('/');
      await page2.goto('/');
      
      await page1.waitForSelector('[data-testid="app-ready"]', { timeout: 10000 });
      await page2.waitForSelector('[data-testid="app-ready"]', { timeout: 10000 });
      
      // Connect both to same sync room
      await connectToSyncRoom(page1, SYNC_PASSPHRASE);
      await connectToSyncRoom(page2, SYNC_PASSPHRASE);
      
      console.log('Both pages connected to sync room');
      
      // Wait for peer discovery on both pages
      const [peerFound1, peerFound2] = await Promise.all([
        waitForPeerCount(page1, 2, PEER_DISCOVERY_TIMEOUT),
        waitForPeerCount(page2, 2, PEER_DISCOVERY_TIMEOUT),
      ]);
      
      // Log current peer counts for debugging
      const count1 = await getPeerCount(page1);
      const count2 = await getPeerCount(page2);
      
      console.log(`Page 1 peer count: ${count1}`);
      console.log(`Page 2 peer count: ${count2}`);
      
      // Verify peer discovery succeeded
      expect(peerFound1, 'Page 1 should detect Page 2 as peer').toBe(true);
      expect(peerFound2, 'Page 2 should detect Page 1 as peer').toBe(true);
      
      console.log('✅ Peer discovery successful: Both tabs show 👤 2');
      
    } finally {
      await context.close();
    }
  });

  test('Data should sync between two tabs on same device', async ({ browser }) => {
    const context = await browser.newContext();
    
    try {
      // Create two pages
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      
      // Load app in both pages
      await page1.goto('/');
      await page2.goto('/');
      
      await page1.waitForSelector('[data-testid="app-ready"]', { timeout: 10000 });
      await page2.waitForSelector('[data-testid="app-ready"]', { timeout: 10000 });
      
      // Connect both to same sync room
      await connectToSyncRoom(page1, SYNC_PASSPHRASE);
      await connectToSyncRoom(page2, SYNC_PASSPHRASE);
      
      // Wait for peer discovery
      await Promise.all([
        waitForPeerCount(page1, 2, PEER_DISCOVERY_TIMEOUT),
        waitForPeerCount(page2, 2, PEER_DISCOVERY_TIMEOUT),
      ]);
      
      // Create test data on page 1
      const testTaskText = 'Same-device sync test task';
      await createTestData(page1, testTaskText);
      
      // Wait for sync to propagate
      await page1.waitForTimeout(2000);
      
      // Switch to todo view on page 2 and verify data synced
      await page2.click('[data-testid="todo-tab"]');
      await page2.waitForTimeout(500);
      
      // Check if task appears on page 2
      const page2Rows = await getTodoRows(page2);
      console.log('Page 2 todo rows:', page2Rows);
      
      expect(page2Rows).toContain(testTaskText);
      
      console.log('✅ Data sync successful: Task from Page 1 appeared on Page 2');
      
    } finally {
      await context.close();
    }
  });

  test('Session fingerprint should match but ClientIDs should differ', async ({ browser }) => {
    const context = await browser.newContext();
    
    try {
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      
      await page1.goto('/');
      await page2.goto('/');
      
      await page1.waitForSelector('[data-testid="app-ready"]', { timeout: 10000 });
      await page2.waitForSelector('[data-testid="app-ready"]', { timeout: 10000 });
      
      // Connect to same room
      await connectToSyncRoom(page1, SYNC_PASSPHRASE);
      await connectToSyncRoom(page2, SYNC_PASSPHRASE);
      
      // Get fingerprints from both pages
      const fingerprint1 = await page1.locator('[data-testid="room-fingerprint"]').textContent().catch(() => '');
      const fingerprint2 = await page2.locator('[data-testid="room-fingerprint"]').textContent().catch(() => '');
      
      console.log(`Page 1 fingerprint: ${fingerprint1}`);
      console.log(`Page 2 fingerprint: ${fingerprint2}`);
      
      // Fingerprints should match (same room)
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).not.toBe('');
      
      // Get ClientIDs via window.__SYNC_MONITOR
      const clientId1 = await page1.evaluate(() => {
        const monitor = (window as unknown as { __SYNC_MONITOR?: { getAllInstances: () => Array<{ id: string }> } }).__SYNC_MONITOR;
        const instances = monitor?.getAllInstances?.() || [];
        return instances[0]?.id || null;
      });
      
      const clientId2 = await page2.evaluate(() => {
        const monitor = (window as unknown as { __SYNC_MONITOR?: { getAllInstances: () => Array<{ id: string }> } }).__SYNC_MONITOR;
        const instances = monitor?.getAllInstances?.() || [];
        return instances[0]?.id || null;
      });
      
      // ClientIDs (ydoc instance IDs) should be different
      expect(clientId1).not.toBe(clientId2);
      
      console.log('✅ Fingerprint match and ClientID difference verified');
      
    } finally {
      await context.close();
    }
  });
});
