import { test } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';

test.describe('Performance', () => {
  test('Lighthouse Audit', async ({ page, browserName }) => {
    // Only run on Chromium because Lighthouse requires CDP
    test.skip(browserName !== 'chromium', 'Lighthouse only works on Chromium');

    await page.goto('/');

    await playAudit({
      page: page,
      thresholds: {
        performance: 50, // Low threshold to pass in CI environments which can be slow
        accessibility: 80,
        'best-practices': 80,
        seo: 80,
      },
      port: 9222,
      reports: {
        formats: {
          html: true,
        },
        name: 'lighthouse-report',
        directory: 'test-results/lighthouse',
      },
    });
  });
});
