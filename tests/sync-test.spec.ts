import { test, expect } from '@playwright/test';

test.describe('Sync Test Page', () => {
  test('page loads with all diagnostic elements', async ({ page }) => {
    // Navigate to sync-test page
    await page.goto('/sync-test');
    
    // Verify main title
    await expect(page.getByText('Yjs Sync Diagnostic')).toBeVisible();
    
    // Verify status indicators
    await expect(page.getByText('DISCONNECTED')).toBeVisible();
    await expect(page.getByText('ydoc:')).toBeVisible();
    await expect(page.getByText('clientID:')).toBeVisible();
    
    // Verify connection controls
    await expect(page.getByPlaceholder('Enter passphrase...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
    
    // Verify text areas
    await expect(page.getByText('Local Input (You)')).toBeVisible();
    await expect(page.getByText('Received from Network')).toBeVisible();
    await expect(page.getByPlaceholder('Type here to test sync...')).toBeVisible();
    await expect(page.getByPlaceholder('Network updates will appear here...')).toBeVisible();
    
    // Verify status panel
    await expect(page.getByText('Connection')).toBeVisible();
    await expect(page.getByText('Y.Doc Created')).toBeVisible();
    await expect(page.getByText('Y.Doc Instance')).toBeVisible();
    await expect(page.getByText('Yjs ClientID')).toBeVisible();
    await expect(page.getByText('Peers')).toBeVisible();
    
    // Verify event log
    await expect(page.getByText('Event Log (Last 50)')).toBeVisible();
    await expect(page.getByText('No events yet...')).toBeVisible();
    
    // Verify instructions
    await expect(page.getByText('Testing Instructions:')).toBeVisible();
    
    // Verify diagnostic indicators
    await expect(page.getByText('Observer Status')).toBeVisible();
    await expect(page.getByText('WebSocket Status')).toBeVisible();
    await expect(page.getByText('Data Sync')).toBeVisible();
  });

  test('connect button creates ydoc and enables textarea', async ({ page }) => {
    await page.goto('/sync-test');
    
    // Initially textarea should be disabled (no ydoc created)
    const textarea = page.getByPlaceholder('Type here to test sync...');
    await expect(textarea).toBeDisabled();
    
    // Click connect
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for connection
    await expect(page.getByText('CONNECTING')).toBeVisible();
    
    // Wait a bit for connection attempt
    await page.waitForTimeout(2000);
    
    // Check that ydoc was created (YD.Created shows YES)
    await expect(page.getByText('● YES')).toBeVisible();
    
    // Now textarea should be enabled
    await expect(textarea).toBeEnabled();
  });

  test('typing in local input creates local update logs', async ({ page }) => {
    await page.goto('/sync-test');
    
    // Connect first
    await page.getByRole('button', { name: 'Connect' }).click();
    await page.waitForTimeout(2000);
    
    // Type in local input
    const textarea = page.getByPlaceholder('Type here to test sync...');
    await textarea.fill('Hello test');
    
    // Wait a bit
    await page.waitForTimeout(500);
    
    // Check that local update was logged
    const eventLog = page.locator('.bg-black.rounded-lg');
    await expect(eventLog.getByText('LOCAL:', { exact: false })).toBeVisible();
  });
});
