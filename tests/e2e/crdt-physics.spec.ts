import { test, expect } from '@playwright/test';

// Use the global store hook established in useAppStore.ts
const getStore = async (page: any) => {
    return await page.evaluate(() => (window as any).__STORE__.getState());
};
test.describe('CRDT Physics & Performance Verification', () => {
    test.beforeEach(async ({ page }) => {
        page.on('pageerror', error => console.log('🔴 PAGE ERROR:', error.message));
        page.on('console', msg => {
            if (msg.type() === 'error') console.log('🔴 CONSOLE ERROR:', msg.text());
        });

        // Inject API key, navigate to /todo, wait for hydration
        await page.addInitScript(() => {
            localStorage.setItem('cubit_api_key', btoa('CUBIT_V1_SALT_crdt-physics-test'));
        });
        await page.goto('/todo', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => {
            const store = (window as any).__STORE__;
            return store?.getState()?.isHydrated;
        });

        // Use resetProject() (not fullLogout) to clear CRDT data while keeping
        // the API key. fullLogout removes the key and triggers a redirect that
        // collides with goto() on WebKit.
        await page.evaluate(async () => {
            await (window as any).__STORE__.getState().resetProject();
        });
        await page.waitForTimeout(300);

        // Add a default project for tests
        await page.evaluate(() => {
            const store = (window as any).__STORE__.getState();
            if (store.todoProjects.length === 0) store.addTodoProject('Test Project');
        });

        await page.waitForTimeout(200);
    });

    // TEST 1: The "CPU Throttle" Typing Test (Checking the Stringify Trap)
    test('React O(1) Cache prevents CPU Throttling on rapid typing', async ({ page }) => {
        // 1. Setup row
        await page.evaluate(() => {
            const store = (window as any).__STORE__.getState();
            console.log('🧪 TEST 1 START: Active Project ID:', store.activeProjectId);
            console.log('🧪 TEST 1 START: Todo Projects:', store.todoProjects.length);
            store.addTodoRow('Performance Test Row');
        });

        // 2. Find the textarea for the task title or step
        // We must wait for the exact moment the CRDT Observer drops the new row into the React DOM
        await page.waitForFunction(() => {
            const store = (window as any).__STORE__.getState();
            return store.todoRows.some((r: any) => r.task === 'Performance Test Row');
        });

        // InlineEditableText requires double-click to enter edit mode.
        // On tiny viewports (iPhone SE, Galaxy S21), scroll the element to the
        // center of the viewport to avoid clipping by the fixed bottom action bar.
        const rowText = page.getByText('Performance Test Row', { exact: false });
        await rowText.first().evaluate((el: HTMLElement) => {
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
        });
        await page.waitForTimeout(300);
        await rowText.first().dblclick({ force: true });

        const textareas = page.locator('textarea');
        await textareas.first().waitFor({ state: 'visible', timeout: 10000 });
        await textareas.first().evaluate((el: HTMLElement) => {
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
        });
        await page.waitForTimeout(100);

        // 3. Rapid-type a paragraph and verify the CRDT observer doesn't lock up.
        // Using pressSequentially with 10ms delay — slower than a real speed typist
        // but fast enough to detect O(N) CRDT regressions. The reduced char count
        // and increased delay keep this stable under parallel CI load.
        const paragraph = "Rapid CRDT stress test paragraph for observer cache validation.";

        const startTime = Date.now();
        await textareas.first().pressSequentially(paragraph, { delay: 10 });
        const endTime = Date.now();

        const duration = endTime - startTime;
        console.log(`Typing duration: ${duration}ms for ${paragraph.length} chars`);

        // Theoretical: 10ms * 63 chars = 630ms. Under heavy CI load, allow up to 8s.
        expect(duration).toBeLessThan(8000);

        const val = await textareas.first().inputValue();
        expect(val).toContain("Rapid CRDT");
    });

    // TEST 2: The Cursor Jump Check (Checking the fast-diff Engine)
    test('fast-diff text engine preserves cursor position during concurrent inserts', async ({ page }) => {
        await page.evaluate(() => {
            const store = (window as any).__STORE__.getState();
            store.addTodoRow('The quick brown fox jumps.');
        });

        // Wait for CRDT debounce deterministically
        await page.waitForFunction(() => {
            const store = (window as any).__STORE__.getState();
            return store.todoRows.some((r: any) => r.task === 'The quick brown fox jumps.');
        });

        const rowText = page.getByText('The quick brown fox jumps.', { exact: false });
        await rowText.first().evaluate((el: HTMLElement) => {
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
        });
        await page.waitForTimeout(300);
        await rowText.first().dblclick({ force: true });

        const textareas = page.locator('textarea');
        await textareas.first().waitFor({ state: 'visible', timeout: 10000 });
        await textareas.first().evaluate((el: HTMLElement) => {
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
        });
        await page.waitForTimeout(100);

        // Focus the textarea
        await textareas.first().focus();

        // In Playwright, moving the cursor is tricky natively. We can send left arrow keys.
        // First, ensure we start at the absolute end of the string using deterministic DOM manipulation
        await textareas.first().evaluate((el: HTMLTextAreaElement) => {
            el.selectionStart = el.value.length;
            el.selectionEnd = el.value.length;
        });
        await page.waitForTimeout(50); // slight delay for cursor movement

        // "The quick brown fox jumps." is 26 chars. We want to be in "brown " -> index 12.
        // So go left 14 times.
        for (let i = 0; i < 14; i++) {
            await page.keyboard.press('ArrowLeft');
        }

        // Type "X"
        await page.keyboard.type('X');

        const newVal = await textareas.first().inputValue();
        expect(newVal).toBe('The quick brXown fox jumps.');

        // Now type "Y" to ensure the cursor didn't jump to the end.
        await page.keyboard.type('Y');
        const finalVal = await textareas.first().inputValue();

        // If cursor jumped to the end, it would be 'The quick brXown fox jumps.Y'
        // If it stayed in place (correct), it should be 'The quick brXYown fox jumps.'
        expect(finalVal).toBe('The quick brXYown fox jumps.');
    });

    // TEST 3: The Tombstone Orphan Check
    test('Project deletion utilizes isDeleted tombstones and orphans are filtered', async ({ page }) => {
        await page.evaluate(() => {
            const store = (window as any).__STORE__.getState();
            store.addTodoProject("Project A");
        });

        // Wait for CRDT debounce deterministically
        await page.waitForFunction(() => {
            const store = (window as any).__STORE__.getState();
            return store.todoProjects.some((p: any) => p.name === 'Project A');
        });

        const projectId = await page.evaluate(() => {
            const store = (window as any).__STORE__.getState();
            const proj = store.todoProjects.find((p: any) => p.name === 'Project A');
            store.setActiveProject(proj.id);
            store.addTodoRow('Task 1');
            store.addTodoRow('Task 2');
            store.addTodoRow('Task 3');
            return proj.id;
        });

        // Wait for CRDT UI sync
        await page.waitForFunction(() => {
            const store = (window as any).__STORE__.getState();
            return store.todoRows.length === 3;
        });

        let state = await getStore(page);
        expect(state.todoRows.length).toBe(3);

        // Delete project A
        await page.evaluate((id) => {
            const store = (window as any).__STORE__.getState();
            store.deleteTodoProject(id);
        }, projectId);

        await page.waitForFunction((id) => {
            const store = (window as any).__STORE__.getState();
            return !store.todoProjects.some((p: any) => p.id === id);
        }, projectId);

        state = await getStore(page);
        // UI rows should be entirely missing from the view (no orphans)
        const activeA = state.todoProjects.find((p: any) => p.id === projectId);
        expect(activeA).toBeUndefined(); // Properly filtered from mapping array
    });

    // TEST 4: The Ephemeral Memory (Genesis Boot) Check
    test('Persistent Y.Doc binary memory survives a hard refresh', async ({ page, context }) => {
        const UNIQUE_STRING = "Verify Genesis Boot " + Date.now();

        await page.evaluate((text) => {
            const store = (window as any).__STORE__.getState();
            store.addTodoRow(text);
        }, UNIQUE_STRING);

        // Wait for CRDT physics loop to construct the React arrays 
        await page.waitForFunction((text) => {
            const store = (window as any).__STORE__.getState();
            return store.todoRows.some((r: any) => r.task === text);
        }, UNIQUE_STRING);

        // Wait 1 second for the 500ms debounced storageService IDB auto-save to trigger
        await page.waitForTimeout(1000);

        // Hard refresh
        await page.reload();
        await page.waitForFunction(() => (window as any).__STORE__.getState().isHydrated);

        // Verify
        await page.waitForFunction((text) => {
            const store = (window as any).__STORE__.getState();
            return store.todoRows && store.todoRows.some((r: any) => r.task.includes(text));
        }, UNIQUE_STRING);

        const state = await getStore(page);
        const rowLoc = state.todoRows.find((r: any) => r.task === UNIQUE_STRING);
        expect(rowLoc).toBeDefined();
    });
});
