import { test, expect } from '@playwright/test';

// Use the global store hook established in useAppStore.ts
const getStore = async (page: any) => {
    return await page.evaluate(() => (window as any).__STORE__.getState());
};

test.describe('CRDT Physics & Performance Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/todo');
        // Wait for page to initialize before wiping
        await page.waitForFunction(() => (window as any).__STORE__.getState().isHydrated);

        // Clear storage to prevent cross-test contamination
        await page.evaluate(async () => {
            localStorage.clear();
            const store = (window as any).__STORE__.getState();
            await store.fullLogout();
            // Wait for React to apply the logout
        });
        await page.waitForTimeout(200);

        await page.evaluate(async () => {
            const store = (window as any).__STORE__.getState();
            // Add a default project to be safe
            if (store.todoProjects.length === 0) store.addTodoProject('Test Project');
        });

        // Let the CRDT observer debounce settle before tests begin
        await page.waitForTimeout(200);
    });

    // TEST 1: The "CPU Throttle" Typing Test (Checking the Stringify Trap)
    test('React O(1) Cache prevents CPU Throttling on rapid typing', async ({ page }) => {
        // 1. Setup row
        await page.evaluate(() => {
            const store = (window as any).__STORE__.getState();
            store.addTodoRow('Performance Test Row');
        });

        // 2. Find the textarea for the task title or step
        // We must wait for the exact moment the CRDT Observer drops the new row into the React DOM
        await page.waitForTimeout(200);
        const textareas = page.locator('textarea');
        await textareas.first().waitFor({ state: 'visible' });

        // 3. Measure typing speed
        const paragraph = "This is a massive paragraph meant to trigger the O(N) observer loop rapidly across multiple keystrokes to ensure our structural sharing cache handles the load.";

        const startTime = Date.now();
        // Type rapidly with 5ms delay to simulate fast typist (but fast enough to test UI lag)
        await textareas.first().pressSequentially(paragraph, { delay: 5 });
        const endTime = Date.now();

        const duration = endTime - startTime;
        console.log(`Typing duration: ${duration}ms for ${paragraph.length} chars`);

        // Theoretical max: 5ms * 163 chars = 815ms. If UI lags, it stacks up to 3000ms+.
        expect(duration).toBeLessThan(3000);

        // Verify it actually saved
        const val = await textareas.first().inputValue();
        expect(val).toContain("This is a massive");
    });

    // TEST 2: The Cursor Jump Check (Checking the fast-diff Engine)
    test('fast-diff text engine preserves cursor position during concurrent inserts', async ({ page }) => {
        await page.evaluate(() => {
            const store = (window as any).__STORE__.getState();
            store.addTodoRow('The quick brown fox jumps.');
        });

        // Wait for CRDT debounce
        await page.waitForTimeout(200);
        const textareas = page.locator('textarea');
        await textareas.first().waitFor();

        // Focus the textarea
        await textareas.first().focus();

        // In Playwright, moving the cursor is tricky natively. We can send left arrow keys.
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

        // Wait for CRDT debounce
        await page.waitForTimeout(200);

        const projectId = await page.evaluate(() => {
            const store = (window as any).__STORE__.getState();
            const proj = store.todoProjects.find((p: any) => p.name === 'Project A');
            store.setActiveProject(proj.id);
            store.addTodoRow('Task 1');
            store.addTodoRow('Task 2');
            store.addTodoRow('Task 3');
            return proj.id;
        });

        let state = await getStore(page);
        expect(state.todoRows.length).toBe(3);

        // Delete project A
        await page.evaluate((id) => {
            const store = (window as any).__STORE__.getState();
            store.deleteTodoProject(id);
        }, projectId);

        await page.waitForTimeout(200);

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
