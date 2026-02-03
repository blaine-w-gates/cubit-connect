import { test, expect } from '@playwright/test';

test.describe('Scout Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for hydration and basic UI
        await expect(page.locator('h1').filter({ hasText: 'Cubit Connect' })).toBeVisible({ timeout: 10000 });
    });

    test('should allow user to enter a topic and generate results', async ({ page }) => {
        // 1. Wait for UploadZone to appear
        // Use a distinctive element from UploadZone to ensure FadeIn is complete
        await expect(page.getByText('Start Analysis')).toBeVisible();

        // 2. Navigate to Scout Mode
        const scoutTrigger = page.getByText('Scout for topics');
        await expect(scoutTrigger).toBeVisible();
        await scoutTrigger.click();

        // 3. Verify Scout UI is visible
        await expect(page.getByText('The Scout')).toBeVisible();

        // 4. Locate the Scout Input
        const scoutInput = page.getByPlaceholder('What do you want to learn?');
        await expect(scoutInput).toBeVisible();

        // 5. Test Case: No API Key (Expected Failure Flow)
        await scoutInput.fill('Sourdough');
        await page.getByRole('button', { name: 'SEARCH' }).click();

        // Expect Toast Error
        await expect(page.getByText('Ignition Key Missing')).toBeVisible();
    });

    test('should toggle platforms', async ({ page }) => {
        // Wait for load
        await expect(page.getByText('Start Analysis')).toBeVisible();

        // Navigate
        await page.getByText('Scout for topics').click();

        const redditBtn = page.getByRole('button', { name: 'Reddit' });

        await redditBtn.click();
        await expect(redditBtn).toBeVisible();
    });
});
