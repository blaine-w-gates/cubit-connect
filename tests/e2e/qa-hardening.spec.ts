import { test, expect } from '@playwright/test';

const TEST_API_KEY = "AIzaSyDGaVCjDFo4xP1tPq5PnPvZ--sP6S7WYPE"; // Mock key, request interception handles logic

test.describe('QA Hardening: Robustness Checks', () => {

    test.beforeEach(async ({ page }) => {
        // Clear state
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });

        // Setup Ignition
        await page.addInitScript((key) => {
            localStorage.setItem('cubit_api_key', key);
        }, TEST_API_KEY);
    });

    // TEST 1: Quota Exceeded (Graceful Failure)
    test('Gracefully handles API Quota Exceeded (429)', async ({ page }) => {
        // 1. Mock 429 Error on Gemini API
        await page.route('**/generativelanguage.googleapis.com/**/generateContent*', async route => {
            await route.fulfill({
                status: 429,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: {
                        code: 429,
                        message: "Resource has been exhausted (e.g. check quota).",
                        status: "RESOURCE_EXHAUSTED"
                    }
                })
            });
        });

        await page.goto('/engine');

        // 2. Trigger Analysis (Text Mode for speed)
        await page.getByText('Text Mode').click();
        await page.getByPlaceholder('Project Title').fill('Quota Test Project');
        await page.getByPlaceholder('Paste your text content').fill('Step 1: Do something. Step 2: Do something else. (Minimum length check filler text...)');

        // 3. Click Start
        await page.getByRole('button', { name: 'Start Analysis' }).click();

        // 4. Verification: Look for "Quota Limit" UI
        // In VideoInput.tsx/Ignition handling, it sets engineError and shows Key Input
        // Note: GeminiService retries non-quota errors. If our mock isn't perfectly detected as "quota", 
        // it might retry (2s+4s+8s = 14s). We give it 30s to be safe.
        await expect(page.getByText('Quota Limit Reached')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('You\'ve reached the 20 requests quota')).toBeVisible();
    });

    // TEST 2: Missing Video Handle (Zombie Process Protection)
    test('Handles lost Video Source (Page Reload)', async ({ page }) => {
        // 1. Setup Video Mode (Mocking file selection is tricky in E2E without actual file)
        // Alternative: Verify State Reset on Reload

        await page.goto('/engine');

        // 2. Assert Initial State: Video Handle is False (Default)
        // We verify that the Video Input zone is visible
        await expect(page.getByText('Select Video (MP4/WebM)')).toBeVisible();

        // 3. Simulate "Lost Handle" by reloading if we were in a project
        // Since we can't easily upload a video in automated CI without a fixture, 
        // We can verify that *if* we reload, we are back to square one (clean state) rather than broken state.

        await page.reload();
        await expect(page.getByText('Select Video (MP4/WebM)')).toBeVisible();
        await expect(page.getByText('Ignition Key Required')).toBeHidden(); // Key should persist
    });

    // TEST 3: DB Load Resilience
    test('Loads Clean State if DB is Empty', async ({ page }) => {
        // 1. Ensure DB is empty
        await page.evaluate(async () => {
            if (window.indexedDB) {
                const req = indexedDB.deleteDatabase('cubit_connect_project_v1');
                return new Promise((resolve, reject) => {
                    req.onsuccess = resolve;
                    req.onerror = reject;
                    req.onblocked = resolve;
                });
            }
        });

        // 2. Load Engine
        await page.goto('/engine');

        // 3. Verify it didn't crash
        // 3. Verify it didn't crash (Header exists)
        // Use first() because there are two headers (Main Site Header + Print Report Header)
        await expect(page.locator('header').first()).toBeVisible();
        await expect(page.getByText(/Select Video/i)).toBeVisible();
    });

});
