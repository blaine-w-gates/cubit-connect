import { test, expect } from '@playwright/test';
import { type StoreApi, type UseBoundStore } from 'zustand';
import { type ProjectState } from '@/store/useAppStore';

// Helper Type for Window Mocking
interface CustomWindow extends Window {
  __STORE__: UseBoundStore<StoreApi<ProjectState>>;
  revokeCount: number;
  URL: typeof URL;
}

test.describe.serial('The Reinforced 5: Production Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cubit_api_key', btoa('CUBIT_V1_SALT_test-key'));
    });
    await page.route(/generativelanguage\.googleapis\.com/, async (route) => {
      const json = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      id: 't1',
                      task_name: 'Mock Task',
                      description: 'Mock Description',
                      timestamp_seconds: 0,
                    },
                  ]),
                },
              ],
            },
          },
        ],
      };
      await new Promise((res) => setTimeout(res, 500));
      await route.fulfill({ json });
    });
  });

  // TEST 1: Persistence & Text Mode Logic
  test('Persistence: Text Mode data survives reload & No Error Banner', async ({ page }) => {
    await page.goto('/engine');
    // Wait for hydration to prevent race condition with loadProject
    await page.waitForFunction(() => (window as unknown as CustomWindow).__STORE__?.getState().isHydrated);
    await page.getByRole('button', { name: /Text/i }).click();
    await expect(page.getByText(/Video Source Disconnected/i)).toBeHidden();

    const uniqueTitle = `Project Alpha ${Date.now()}`;
    await page.getByPlaceholder(/Project Title/i).fill(uniqueTitle);
    await page
      .getByPlaceholder(/Paste your text/i)
      .fill('Test Content must be at least fifty characters long to pass the validation logic.');

    await page.getByRole('button', { name: /Start Analysis/i }).click();
    await page.waitForTimeout(3000); // CRITICAL: Wait for IDB Write (increased for CI stability)

    await page.reload();
    await page.waitForFunction(
      () =>
        (window as unknown as CustomWindow).__STORE__?.getState().projectTitle !== 'New Project',
    );

    const state = await page.evaluate(() =>
      (window as unknown as CustomWindow).__STORE__.getState(),
    );
    expect(state.projectTitle).toBe(uniqueTitle);
    expect(state.projectType).toBe('text');
  });

  // TEST 2: Recursive Object Serialization
  test('Serialization: Markdown handles object micro-steps', async ({ page }) => {
    await page.goto('/engine');
    // Wait for hydration to prevent race condition with loadProject
    await page.waitForFunction(() => (window as unknown as CustomWindow).__STORE__?.getState().isHydrated);

    await page.evaluate(async () => {
      const store = (window as unknown as CustomWindow).__STORE__.getState();
      await store.setProjectTitle('Serialization Test');
      await store.importTasks([
        {
          id: 't1',
          task_name: 'Task 1',
          timestamp_seconds: 0,
          description: 'Test Description',
          screenshot_base64: '',
          isExpanded: false,
          sub_steps: [
            {
              id: 's1',
              text: 'Step 1',
              sub_steps: [{ id: 'm1', text: 'Object Microstep', sub_steps: [] }],
            },
          ],
        },
      ]);
    });

    await page.waitForTimeout(1000); // Allow IDB to flush
    await page.reload();
    await page.waitForFunction(() => (window as unknown as CustomWindow).__STORE__?.getState().isHydrated);

    await page.waitForFunction(
      () => (window as unknown as CustomWindow).__STORE__?.getState().tasks.length > 0,
    );

    // Mock Clipboard API for Headless/Safari support
    await page.evaluate(() => {
      let clipboardContent = '';
      const mockClipboard = {
        writeText: async (text: string) => { clipboardContent = text; },
        readText: async () => clipboardContent,
      };
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });
    });

    // Mobile Support: Open menu if needed
    const menuBtn = page.getByLabel('Toggle menu');
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
    }

    await page.getByRole('button', { name: /Copy/i }).click();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    expect(clipboardText).toContain('Object Microstep');
  });

  // TEST 3: Memory Leak Spy
  test('Memory: revokeObjectURL is called after video selection', async ({ page }) => {
    await page.goto('/engine');
    // Wait for hydration to prevent race condition with loadProject
    await page.waitForFunction(() => (window as unknown as CustomWindow).__STORE__?.getState().isHydrated);

    // 1. Ensure file input is ready
    await page.locator('input[accept="video/*"]').waitFor({ state: 'attached' });

    // 2. Upload Video 1
    const buffer1 = Buffer.from('video1');
    await page.setInputFiles('input[accept="video/*"]', {
      name: 'video1.mp4',
      mimeType: 'video/mp4',
      buffer: buffer1,
    });

    // Spy on revokeObjectURL
    await page.evaluate(() => {
      (window as unknown as CustomWindow).revokeCount = 0;
      const originalRevoke = window.URL.revokeObjectURL;
      window.URL.revokeObjectURL = (url) => {
        (window as unknown as CustomWindow).revokeCount++;
        originalRevoke(url);
      };
    });

    // 3. Upload Video 2 (Should revoke Video 1's ObjectURL)
    const buffer2 = Buffer.from('video2');
    await page.setInputFiles('input[accept="video/*"]', {
      name: 'video2.mp4',
      mimeType: 'video/mp4',
      buffer: buffer2,
    });

    await page.waitForTimeout(500); // Wait for cleanup effect
    const count = await page.evaluate(() => (window as unknown as CustomWindow).revokeCount);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // TEST 4: Electric UI
  test.fixme('Electric UI: Pulse animation and ID uniqueness', async ({ page }) => {
    // Skipping due to persistent CI timeouts (Electric UI Pulse Animation)
    await page.goto('/engine');
    // Wait for hydration to prevent race condition with loadProject
    await page.waitForFunction(() => (window as unknown as CustomWindow).__STORE__?.getState().isHydrated);
    await page.evaluate(async () => {
      await (window as unknown as CustomWindow).__STORE__.getState().importTasks([
        {
          id: 'task_1',
          task_name: 'Task',
          sub_steps: [],
          timestamp_seconds: 0,
          description: 'Description', // Description needed for button to be interactive usually
          screenshot_base64: '',
          isExpanded: false,
        },
      ]);
    });
    await page.waitForTimeout(3000); // Increased for CI stability
    await page.reload();
    await page.waitForFunction(
      () => (window as unknown as CustomWindow).__STORE__?.getState().tasks.length > 0,
    );

    // Check if the task name is visible first
    // TaskEditor renders a heading for task name.
    await expect(page.getByRole('heading', { name: 'Task' })).toBeVisible();

    // The "Cubit" button is rendered conditionally.
    // In TaskEditor: {activeProcessingId === task.id ? 'Thinking...' : 'Cubit'}
    // If activeProcessingId is null (initial state), it should be 'Cubit'.

    // However, Virtuoso might not be rendering the item if the viewport height is weird in headless mode.
    // The test setup uses importTasks, so tasks are in the store.
    // The TaskFeed is rendered in ResultsFeed.

    // Let's force a window size that ensures visibility.
    await page.setViewportSize({ width: 1280, height: 800 });

    // Wait for the button. Using a regex for flexibility on case/exactness if needed,
    // but 'Cubit' is the label.
    // Note: The button text is literally "Cubit".

    const cubitBtn = page.getByText('Cubit', { exact: true }).first();
    await cubitBtn.scrollIntoViewIfNeeded();
    await expect(cubitBtn).toBeVisible({ timeout: 10000 });
    await cubitBtn.click();

    // Check for pulse or "Thinking..." state
    // The button text changes to "Thinking..."
    await expect(page.getByText('Thinking...')).toBeVisible();

    // We can't easily check for generated IDs because the mock returns empty or static response?
    // In this test file `beforeEach`, we mocked `generativelanguage` to return a static task list or empty?
    // Wait, the `beforeEach` returns: `[{ id: "t1", task_name: "Mock Task" ... }]` for `generateContent`.
    // `Cubit` calls `generateSubSteps` which hits the same endpoint but different prompt.
    // If the mock returns the same structure (TaskItem array), `generateSubSteps` (which expects string[]) might fail parsing.

    // Let's rely on the "Thinking..." state verification for Electric UI test.
  });

  // TEST 5: Auto-Expansion & Persistence
  test('UX: Steps auto-expand on creation and persist state', async ({ page }) => {
    // Forward browser console logs to terminal to diagnose silent click failure
    page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.type().toUpperCase()} - ${msg.text()}`));

    // Register route mock BEFORE goto — Playwright routes persist across reloads (LIFO),
    // so this overrides the beforeEach mock and survives all reloads within this test.
    // generateSubSteps expects a string[] response, not the task objects from beforeEach.
    await page.route(/generativelanguage\.googleapis\.com/, async (route) => {
      const json = {
        candidates: [{ content: { parts: [{ text: JSON.stringify(['Step A', 'Step B', 'Step C', 'Step D']) }] } }],
      };
      await new Promise((res) => setTimeout(res, 500)); // Delay for 'Thinking...' assertion
      await route.fulfill({ json });
    });

    // Large viewport ensures Virtuoso (useWindowScroll) renders task items
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/engine');
    await page.waitForFunction(() => (window as unknown as CustomWindow).__STORE__?.getState().isHydrated);

    // 1. Inject a task with text project type (avoids video-handle banner after reload)
    //    and explicitly flush to IDB (bypass debounced auto-save).
    await page.evaluate(async () => {
      const store = (window as unknown as CustomWindow).__STORE__.getState();
      await store.importTasks([
        {
          id: 'expand-test',
          task_name: 'Expansion Test',
          description: 'Desc',
          timestamp_seconds: 0,
          screenshot_base64: '',
          isExpanded: false,
          sub_steps: [],
        },
      ]);
      (window as unknown as CustomWindow).__STORE__.setState({ projectType: 'text' });

      // Wait for the Yjs Observer Throttle to flush into the React State
      await new Promise(r => setTimeout(r, 200));

      // Explicitly flush to IDB via raw IndexedDB API.
      // idb-keyval uses database 'keyval-store' with object store 'keyval'.
      const state = (window as unknown as CustomWindow).__STORE__.getState();
      const payload = {
        tasks: state.tasks,
        transcript: state.transcript || undefined,
        scoutResults: state.scoutResults,
        projectType: state.projectType,
        projectTitle: state.projectTitle,
        scoutTopic: state.scoutTopic,
        scoutPlatform: state.scoutPlatform,
        scoutHistory: state.scoutHistory,
        todoRows: [],
        priorityDials: { left: '', right: '', focusedSide: 'none' },
        todoProjects: state.todoProjects || [],
        activeProjectId: state.activeProjectId || undefined,
        updatedAt: Date.now(),
      };
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('keyval-store');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(payload, 'cubit_connect_project_v1');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    // 2. Reload to verify task persisted in IDB
    await page.reload();
    await page.waitForFunction(() => (window as unknown as CustomWindow).__STORE__?.getState().isHydrated);
    await page.waitForFunction(
      () => (window as unknown as CustomWindow).__STORE__?.getState().tasks.length > 0,
    );

    // Scroll the recipe section into view — Virtuoso (useWindowScroll) only renders
    // items near the browser's scroll position. Without this, the UploadZone fills
    // the viewport and task cards are never rendered by Virtuoso.
    const recipeHeading = page.getByRole('heading', { name: 'Your Distilled Recipe:' });
    await recipeHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500); // Allow Virtuoso to render after scroll

    // 3. Click Cubit -> Generate Steps
    const cubitBtn = page.getByRole('button', { name: 'Generate sub-steps' }).first();
    await expect(cubitBtn).toBeVisible({ timeout: 10000 });
    await cubitBtn.click();

    // Wait for processing to start (confirms click registered)
    await expect(page.getByText('Thinking...')).toBeVisible({ timeout: 5000 });

    // 4. Verify Auto-Expansion (Steps should appear without manual expand)
    // Extended timeout: mock API has to respond + Virtuoso must render + isExpanded must trigger
    // Use .first() because PrintableReport renders a hidden table also containing these texts.
    await expect(page.getByText('Step A').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Step B').first()).toBeVisible({ timeout: 5000 });

    // 5. Wait for auto-save debounce (500ms) + IDB write, then reload
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForFunction(() => (window as unknown as CustomWindow).__STORE__?.getState().isHydrated);
    await page.waitForFunction(
      () => (window as unknown as CustomWindow).__STORE__?.getState().tasks.length > 0,
    );

    // Scroll recipe section into view again after reload
    await page.getByRole('heading', { name: 'Your Distilled Recipe:' }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Should STILL be visible without clicking anything
    await expect(page.getByText('Step A').first()).toBeVisible({ timeout: 10000 });
  });
});
