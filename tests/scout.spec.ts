import { test, expect } from '@playwright/test';

test.describe('Scout Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Gemini API
    await page.route(/generativelanguage\.googleapis\.com/, async (route) => {
      const url = route.request().url();
      if (url.includes(':countTokens')) {
        await route.fulfill({ json: { totalTokens: 10 } });
      } else {
        const json = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify(['#SourdoughStarter', '#BakingTips', '#BreadMaking']),
                  },
                ],
              },
            },
          ],
        };
        await route.fulfill({ json });
      }
    });
  });

  test('Happy Path: Ignite and Scout', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Visit Landing Page
    await page.goto('/');
    await expect(page.locator('h1').filter({ hasText: 'Recipes for Life' })).toBeVisible();

    // 2. Ignite (Login)
    await page.getByPlaceholder(/Enter API key/i).fill('VALID_TEST_KEY');
    await page.getByRole('button', { name: 'START' }).click();

    // 3. Verify Engine Loaded
    await page.waitForURL('**/engine', { timeout: 60000, waitUntil: 'commit' });
    await expect(page.getByRole('heading', { name: 'Cubit Connect' }).first()).toBeVisible({ timeout: 15000 });

    // 4. Open Scout — wait for UI to be interactive after navigation
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Scout' }).first().click();

    // 5. Verify Scout View
    await expect(page.getByRole('heading', { name: 'The Scout' })).toBeVisible({ timeout: 10000 });

    // 6. Enter Topic and Search
    const scoutInput = page.getByPlaceholder('What do you want to learn?');
    await expect(scoutInput).toBeVisible();
    await scoutInput.fill('Sourdough');
    await page.getByRole('button', { name: 'SEARCH', exact: true }).click();

    // 7. Verify Results
    await expect(page.getByText('#SourdoughStarter')).toBeVisible({ timeout: 15000 });
  });

  test('Happy Path: Toggle Platforms', async ({ page }) => {
    // Inject key to skip login
    await page.addInitScript(() => {
      localStorage.setItem('cubit_api_key', btoa('CUBIT_V1_SALT_test-key'));
    });

    await page.goto('/engine');

    // Open Scout
    await page.getByRole('button', { name: 'Scout' }).first().click();

    // Toggle Platform
    const redditBtn = page.getByRole('button', { name: 'Reddit' });
    await redditBtn.click();

    // Verify visual state
    await expect(redditBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
