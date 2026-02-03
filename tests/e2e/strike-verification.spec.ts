import { test, expect } from '@playwright/test';

// USER PROVIDED KEY - FOR VERIFICATION ONLY
const TEST_API_KEY = "AIzaSyDGaVCjDFo4xP1tPq5PnPvZ--sP6S7WYPE";

test.describe.serial('Tier 3 Verification: Strikes 15, 16, 17', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
    });

    test('Full Flow: Ignition -> Manifesto -> Scout -> Export', async ({ page }) => {
        // 1. IGNITION
        console.log('--- STEP 1: IGNITION ---');
        await page.goto('/');
        await page.getByPlaceholder(/Enter API keys/i).fill(TEST_API_KEY);

        const countTokensPromise = page.waitForResponse(resp =>
            resp.url().includes('generativelanguage.googleapis.com') &&
            resp.url().includes('countTokens')
        );

        await page.getByRole('button', { name: /START/i }).click();

        const countTokensResp = await countTokensPromise;
        expect(countTokensResp.status()).toBe(200);
        console.log('Ignition: Network call passed (200 OK).');

        await expect(page).toHaveURL(/\/engine/);
        console.log('Ignition: Redirect to Engine successful.');

        // 2. MANIFESTO (Zero State)
        console.log('--- STEP 2: MANIFESTO ---');
        // Check finding by text with fuzzy match to handle periods/newlines
        await expect(page.getByText(/Process, Don't Just Perform/i)).toBeVisible();

        const scoutCard = page.getByRole('button', { name: /Scout/i }).first();
        await expect(scoutCard).toBeVisible();
        console.log('Manifesto: Zero State Verified.');

        // 3. SCOUT MODAL
        console.log('--- STEP 3: SCOUT MODAL ---');
        await scoutCard.click();

        const modal = page.locator('div.fixed.inset-0');
        await expect(modal).toBeVisible();

        // Scope search to modal to avoid ambiguity
        // ScoutModal header has "Scout" text
        await expect(modal.getByText('Scout', { exact: true })).toBeVisible();

        // 4. LIVE SEARCH
        console.log('--- STEP 4: LIVE SEARCH ---');
        await page.getByPlaceholder(/Enter a topic/i).fill('Minimalist Design');

        // Setup listener BEFORE click
        const generatePromise = page.waitForResponse(resp =>
            resp.url().includes('generativelanguage.googleapis.com') &&
            resp.url().includes('generateContent')
        );

        await page.getByRole('button', { name: /Generate/i }).click();

        const generateResp = await generatePromise;
        console.log('Scout: API Response Status:', generateResp.status());

        if (generateResp.status() !== 200) {
            console.error('API Error:', await generateResp.text());
        }
        expect(generateResp.status()).toBe(200);

        // Wait for results (buttons in grid)
        const resultButton = modal.locator('button.group').first();
        // Note: ScoutModal results use className="group flex..."
        // Or simpler: locator('text=Minimalist') or just wait for buttons inside grid

        // Let's use the layout structure:
        // <div className="grid grid-cols-1 ..."> <button ...>
        await expect(resultButton).toBeVisible({ timeout: 20000 });
        console.log('Scout: Results Rendered.');

        // 5. COPY
        await resultButton.click();
        await expect(page.getByText('Copied')).toBeVisible();

        // Close Modal
        await page.getByRole('button').filter({ has: page.locator('svg.lucide-x') }).click();
        await expect(modal).toBeHidden();

        // 6. EXPORT CHECKS
        console.log('--- STEP 6: EXPORT ---');
        const exportControls = page.getByRole('button', { name: /PDF/i });
        await expect(exportControls).toBeVisible();
    });

    test('Header/Mobile: Scout Button Presence', async ({ page }) => {
        await page.addInitScript((key) => {
            localStorage.setItem('cubit_api_key', key);
        }, TEST_API_KEY);

        await page.goto('/engine');

        // Desktop
        await page.setViewportSize({ width: 1280, height: 720 });
        const desktopScout = page.getByRole('button', { name: 'Scout', exact: true });
        await expect(desktopScout).toBeVisible();

        // Mobile (iPhone SE)
        await page.setViewportSize({ width: 320, height: 568 });
        await page.waitForTimeout(500);

        // Logo Check
        await expect(page.getByText('Cubit Connect')).toBeVisible();
        // Badge Hidden Check
        const engineBadge = page.locator('span', { hasText: 'Engine' });
        await expect(engineBadge).toBeHidden();

        // Scout Icon Check (Mobile only shows icon)
        // Find button containing svg.lucide-compass
        // or just ensure we don't crash
    });
});
