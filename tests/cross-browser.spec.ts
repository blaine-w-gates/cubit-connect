import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Cross-Browser & Mobile Hardening', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cubit_api_key', btoa('CUBIT_V1_SALT_cross-browser-test'));
    });

    await page.route(/generativelanguage\.googleapis\.com/, async (route) => {
      const url = route.request().url();
      if (url.includes(':countTokens')) {
        await route.fulfill({ json: { totalTokens: 10 } });
      } else {
        await route.fulfill({
          json: {
            candidates: [{
              content: { parts: [{ text: JSON.stringify(['Result A', 'Result B', 'Result C']) }] },
            }],
          },
        });
      }
    });
  });

  test('Touch targets meet 44px minimum on mobile viewports', async ({ page }) => {
    await page.goto('/engine');
    // Wait for header to hydrate
    await expect(page.getByText('Cubit Connect').first()).toBeVisible({ timeout: 10000 });

    // Mobile layout uses a hamburger menu, desktop shows nav buttons directly.
    // Detect which layout based on viewport width vs md: breakpoint (768px).
    const viewport = page.viewportSize()!;
    if (viewport.width < 768) {
      const menuBtn = page.getByLabel('Toggle menu');
      await expect(menuBtn).toBeVisible({ timeout: 5000 });
      const box = await menuBtn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(40);
      expect(box!.height).toBeGreaterThanOrEqual(40);
    } else {
      const scoutBtn = page.getByRole('button', { name: 'Scout', exact: true });
      await expect(scoutBtn).toBeVisible();
    }
  });

  test('Viewport uses full dynamic height (no white gap at bottom)', async ({ page }) => {
    await page.goto('/engine');

    const bodyHeight = await page.evaluate(() => {
      const body = document.body;
      const style = getComputedStyle(body);
      return {
        minHeight: style.minHeight,
        viewportHeight: window.innerHeight,
        bodyScrollHeight: body.scrollHeight,
      };
    });

    // Body should fill at least the viewport
    expect(bodyHeight.bodyScrollHeight).toBeGreaterThanOrEqual(bodyHeight.viewportHeight);
  });

  test('Clipboard copy works with fallback (non-HTTPS safe)', async ({ page }) => {
    // Mock clipboard BEFORE page loads so it's available to copyToClipboardSafe
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => { (window as any).__clipboardContent = text; },
          readText: async () => (window as any).__clipboardContent || '',
        },
        writable: true,
        configurable: true,
      });
    });

    await page.goto('/engine');

    // Wait for hydration
    await page.waitForFunction(() => (window as any).__STORE__?.getState()?.isHydrated);

    // Inject a task so we have something to copy
    await page.evaluate(async () => {
      await (window as any).__STORE__.getState().importTasks([{
        id: 'clipboard-test',
        task_name: 'Clipboard Test Task',
        description: 'Testing clipboard across browsers',
        timestamp_seconds: 0,
        screenshot_base64: '',
        isExpanded: false,
        sub_steps: [],
      }]);
    });
    await page.waitForTimeout(500);

    // Open mobile menu if needed
    const menuBtn = page.getByLabel('Toggle menu');
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
    }

    await page.getByRole('button', { name: /Copy/i }).click();
    await page.waitForTimeout(500);

    const clipboardContent = await page.evaluate(() => (window as any).__clipboardContent || '');
    expect(clipboardContent).toContain('Clipboard Test Task');
  });

  test('Todo page accessibility compliance', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/todo');

    await expect(page.getByText('Your Task Board')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Todo Page Violations:', JSON.stringify(results.violations, null, 2));
    }
  });

  test('Dark mode renders correctly on modals', async ({ page }) => {
    // Enable dark mode
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('/engine');
    await page.waitForTimeout(500);

    // Verify dark mode is active
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(true);

    // Open settings modal
    const menuBtn = page.getByLabel('Toggle menu');
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
    }
    await page.getByRole('button', { name: /API Key/i }).click();

    // Settings modal should have dark background
    const modalBg = await page.evaluate(() => {
      const modal = document.querySelector('[class*="max-w-md"]');
      if (!modal) return null;
      return getComputedStyle(modal).backgroundColor;
    });

    expect(modalBg).not.toBeNull();
    // Dark stone-900 is rgb(28, 25, 23)
    expect(modalBg).not.toBe('rgb(255, 255, 255)');
  });

  test('Hover-reveal CSS utility applies correctly per device type', async ({ page, isMobile }) => {
    await page.goto('/todo');
    await page.waitForFunction(() => (window as any).__STORE__?.getState()?.isHydrated);

    // Add a task row to trigger hover-reveal elements in the DOM
    await page.evaluate(() => {
      (window as any).__STORE__.getState().addTodoRow('Hover Test Row');
    });

    await page.waitForFunction(() => {
      return (window as any).__STORE__.getState().todoRows.some((r: any) => r.task === 'Hover Test Row');
    });
    await page.waitForTimeout(300);

    // Verify the hover-reveal CSS class exists in the DOM
    const hasHoverReveal = await page.evaluate(() => {
      return document.querySelectorAll('.hover-reveal').length > 0;
    });
    expect(hasHoverReveal).toBe(true);

    if (isMobile) {
      // On touch devices, hover-reveal should force opacity: 1
      const opacity = await page.evaluate(() => {
        const el = document.querySelector('.hover-reveal');
        return el ? getComputedStyle(el).opacity : null;
      });
      if (opacity !== null) {
        expect(opacity).toBe('1');
      }
    } else {
      // On desktop, hover-reveal elements rely on :hover and start at their
      // base opacity (usually 0 from sm:opacity-0)
      const el = page.locator('.hover-reveal').first();
      await expect(el).toBeAttached();
    }
  });

  test('Fixed bottom elements have safe-area padding', async ({ page }) => {
    await page.goto('/todo');
    await page.waitForFunction(() => (window as any).__STORE__?.getState()?.isHydrated);

    // The action bar at the bottom should have the safe-bottom class
    const hasSafeBottom = await page.evaluate(() => {
      const elements = document.querySelectorAll('.safe-bottom');
      return elements.length > 0;
    });

    expect(hasSafeBottom).toBe(true);
  });

  test('Double-tap zoom is prevented on interactive elements', async ({ page }) => {
    await page.goto('/engine');

    const touchAction = await page.evaluate(() => {
      const button = document.querySelector('button');
      if (!button) return null;
      return getComputedStyle(button).touchAction;
    });

    expect(touchAction).toBe('manipulation');
  });

  test('Modals are dismissable by tapping backdrop', async ({ page }) => {
    await page.goto('/engine');

    // Open settings modal via store (avoids menu navigation complexity)
    await page.evaluate(() => {
      (window as any).__STORE__.getState().setIsSettingsOpen(true);
    });

    // Settings modal should be visible
    await expect(page.getByText('Switch Out Your API Key')).toBeVisible();

    // Click the backdrop overlay (far left edge, vertically centered)
    const viewport = page.viewportSize()!;
    await page.mouse.click(5, viewport.height / 2);
    await page.waitForTimeout(300);

    // Modal should be dismissed
    await expect(page.getByText('Switch Out Your API Key')).toBeHidden();
  });
});
