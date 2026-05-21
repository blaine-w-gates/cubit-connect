import { test, expect } from '@playwright/test';

/**
 * Specification Engineering: Sync Reconciliation Test
 * Goal: Prove that Peer A and Peer B converge on state and respect UI locks.
 */
// TODO: TECH DEBT - Sync architecture migrated to Supabase Realtime, tests need refactoring
// See: docs/TECH_DEBT.md#sync-test-refactor
// Original test expects legacy WebSocket, needs Supabase mocking
test.describe.skip('Multi-Device Sync Reconciliation [SKIP - ARCHITECTURE MISMATCH]', () => {
    
    test.beforeEach(async ({ page }) => {
        // Debug Console
        page.on('console', (msg) => {
            const width = page.viewportSize()?.width ?? 0;
            console.log(`[Browser ${width > 500 ? 'A' : 'B'}]: ${msg.text()}`);
        });

        // Global Mock: Gemini API
        await page.route(/generativelanguage\.googleapis\.com/, async (route) => {
            const url = route.request().url();
            if (url.includes(':countTokens')) {
                await route.fulfill({ json: { totalTokens: 10 } });
            } else {
                await route.fulfill({
                    json: {
                        candidates: [{
                            content: { parts: [{ text: JSON.stringify(['MOCK_TASK_1', 'MOCK_TASK_2']) }] },
                        }],
                    },
                });
            }
        });

        // Ensure clean slate
        await page.goto('/todo');
        await page.evaluate(() => localStorage.clear());
    });

    test.skip('E2E Sync Flow: Convergence & Dynamic Locking [NEEDS SUPABASE MOCK]', async ({ browser }) => {
        test.setTimeout(120000);

        const PASSPHRASE = `test-passphrase-${Date.now()}`;
        console.log(`[TEST] Using passphrase: ${PASSPHRASE}`);

        // 1. Setup Peer A (The Seeder/Owner)
        const contextA = await browser.newContext();
        const pageA = await contextA.newPage();

        await pageA.goto('/todo', { waitUntil: 'networkidle' });
        await pageA.evaluate(() => {
            localStorage.setItem('sync_server_url', 'ws://localhost:8080');
            localStorage.setItem('theme', 'dark');
        });
        await pageA.reload({ waitUntil: 'networkidle' });

        // Wait for Sync button to be available
        await pageA.getByRole('button', { name: 'Sync', exact: true }).waitFor({ state: 'visible', timeout: 15000 });

        // Connect Peer A
        await pageA.getByRole('button', { name: 'Sync', exact: true }).click();
        await pageA.getByPlaceholder('Enter a shared secret...').fill(PASSPHRASE);
        await pageA.getByRole('button', { name: 'Establish Secure Connection' }).click();
        await expect(pageA.getByText('Securely Connected')).toBeVisible({ timeout: 10000 });
        await pageA.getByRole('button', { name: 'Close', exact: false }).or(pageA.locator('button:has(svg.lucide-x)')).click();

        // [DIAGNOSTIC] Extract Peer A state after connection
        const peerAState = await pageA.evaluate(() => {
            const store = (window as any).__STORE__;
            const state = store.getState();
            return {
                projects: state.projects.map((p: any) => ({ id: p.id, name: p.name })),
                todoRows: state.todoRows.length,
                hasPeers: state.hasPeers,
                peerCount: state.peerCount,
                roomId: state.roomId,
                projectId: state.currentProjectId,
            };
        });
        console.log('[DIAGNOSTIC] Peer A State:', JSON.stringify(peerAState, null, 2));

        // 2. Setup Peer B (The Joiner)
        const contextB = await browser.newContext();
        const pageB = await contextB.newPage();

        await pageB.goto('/todo', { waitUntil: 'networkidle' });
        await pageB.evaluate(() => {
            localStorage.setItem('sync_server_url', 'ws://localhost:8080');
            localStorage.setItem('theme', 'dark');
        });
        await pageB.reload({ waitUntil: 'networkidle' });

        // Wait for Sync button to be available
        await pageB.getByRole('button', { name: 'Sync', exact: true }).waitFor({ state: 'visible', timeout: 15000 });

        // Connect Peer B
        await pageB.getByRole('button', { name: 'Sync', exact: true }).click();
        await pageB.getByPlaceholder('Enter a shared secret...').fill(PASSPHRASE);
        await pageB.getByRole('button', { name: 'Establish Secure Connection' }).click();
        await expect(pageB.getByText('Securely Connected')).toBeVisible({ timeout: 10000 });
        await pageB.getByRole('button', { name: 'Close', exact: false }).or(pageB.locator('button:has(svg.lucide-x)')).click();

        await pageB.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });
        await expect(pageB.getByText('👥 2+')).toBeVisible();

        // [DIAGNOSTIC] Extract Peer B state after connection
        const peerBState = await pageB.evaluate(() => {
            const store = (window as any).__STORE__;
            const state = store.getState();
            return {
                projects: state.projects.map((p: any) => ({ id: p.id, name: p.name })),
                todoRows: state.todoRows.length,
                hasPeers: state.hasPeers,
                peerCount: state.peerCount,
                roomId: state.roomId,
                projectId: state.currentProjectId,
            };
        });
        console.log('[DIAGNOSTIC] Peer B State:', JSON.stringify(peerBState, null, 2));

        // [DIAGNOSTIC] Compare room IDs - they should match
        if (peerAState.roomId !== peerBState.roomId) {
            console.error(`[CRITICAL] Room ID Mismatch! A: ${peerAState.roomId}, B: ${peerBState.roomId}`);
        } else {
            console.log(`[OK] Room IDs match: ${peerAState.roomId}`);
        }

        // [DIAGNOSTIC] Compare project IDs - they should match after sync
        if (peerAState.projectId !== peerBState.projectId) {
            console.error(`[CRITICAL] Project ID Mismatch! A: ${peerAState.projectId}, B: ${peerBState.projectId}`);
        } else {
            console.log(`[OK] Project IDs match: ${peerAState.projectId}`);
        }

        // 5. AC1: Bidirectional Convergence (B -> A)
        // Peer B adds a task; Peer A must see it.
        await pageB.getByRole('button', { name: 'Task', exact: true }).click();

        // [DIAGNOSTIC] Check Peer B's tasks immediately after adding
        const peerBAfterAdd = await pageB.evaluate(() => {
            const store = (window as any).__STORE__;
            return {
                todoRows: store.getState().todoRows.map((t: any) => ({ id: t.id, task: t.task })),
            };
        });
        console.log('[DIAGNOSTIC] Peer B tasks after add:', JSON.stringify(peerBAfterAdd, null, 2));

        // Wait for sync with diagnostic polling
        let syncAttempts = 0;
        const maxAttempts = 20;
        const pollInterval = 500; // ms

        while (syncAttempts < maxAttempts) {
            const peerAState = await pageA.evaluate(() => {
                const store = (window as any).__STORE__;
                return {
                    todoRows: store.getState().todoRows.map((t: any) => ({ id: t.id, task: t.task })),
                    hasPeers: store.getState().hasPeers,
                };
            });
            console.log(`[SYNC POLL ${syncAttempts + 1}/${maxAttempts}] Peer A tasks: ${peerAState.todoRows.length}, hasPeers: ${peerAState.hasPeers}`);

            if (peerAState.todoRows.length > 0) {
                console.log('[SUCCESS] Sync completed - Peer A received task');
                break;
            }

            await pageA.waitForTimeout(pollInterval);
            syncAttempts++;
        }

        await pageA.waitForFunction(() => (window as any).__STORE__.getState().todoRows.length > 0, { timeout: 10000 });
        await expect(pageA.getByText('New Task')).toBeVisible();
        console.log('✅ AC1: Bidirectional Sync (B -> A) confirmed.');

        // 6. AC2: Dynamic Turn-Locking (B edits -> A locks)
        // Peer B performs a mutation (e.g., updating the task text).
        // Since we mock Gemini, we'll manually trigger a store update on B to simulate a sync event.
        await pageB.evaluate(() => {
            const state = (window as any).__STORE__.getState();
            state.updateTodoCell(state.todoRows[0].id, 'task', 'Peer B is typing...');
        });

        // Browser A must immediately show the Lock and the specific "Peer is making changes" reason.
        await pageA.waitForFunction(() => (window as any).__STORE__.getState().peerIsEditing === true, { timeout: 5000 });
        await expect(pageA.getByText('🔒')).toBeVisible();
        
        // Attempt to click 'Task' on A should show the "Peer is making changes" toast.
        await pageA.getByRole('button', { name: 'Task', exact: true }).click();
        await expect(pageA.getByText('A peer is currently making changes')).toBeVisible();
        console.log('✅ AC2: Dynamic Turn-Locking confirmed.');

        // 7. Test Lock Recovery: Disconnect Peer A
        await pageA.close();
        
        /**
         * AC2: Browser B must display the "Locked" icon and disable interactions.
         * The disconnect signal should be instant due to MSG_DISCONNECT (255, 255).
         */
        await pageB.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === false, { timeout: 10000 });
        await expect(pageB.getByText('👤 1')).toBeVisible();
        await expect(pageB.getByText('🔒')).toBeVisible();
        
        const taskButtonB = pageB.getByRole('button', { name: 'Task', exact: true });
        // Check for visual lock classes from our "A+" implementation
        await expect(taskButtonB).toHaveClass(/opacity-50/);
        await expect(taskButtonB).toHaveClass(/cursor-not-allowed/);

        // 6. Test Re-connection: Re-spawn Peer A
        const pageA_reborn = await contextA.newPage();
        await pageA_reborn.goto('/todo');
        await pageA_reborn.evaluate(() => {
            localStorage.setItem('sync_server_url', 'ws://localhost:8080');
            localStorage.setItem('theme', 'dark');
        });
        await pageA_reborn.reload();

        // Connect Reborn Peer A
        await pageA_reborn.getByRole('button', { name: 'Sync', exact: true }).click();
        await pageA_reborn.getByPlaceholder('Enter a shared secret...').fill(PASSPHRASE);
        await pageA_reborn.getByRole('button', { name: 'Establish Secure Connection' }).click();
        await expect(pageA_reborn.getByText('Securely Connected')).toBeVisible({ timeout: 10000 });
        await pageA_reborn.getByRole('button', { name: 'Close', exact: false }).or(pageA_reborn.locator('button:has(svg.lucide-x)')).click();

        // AC3: Browser B must re-enable interactions
        await expect(pageB.getByText('👥 2+')).toBeVisible({ timeout: 15000 });
        await expect(pageB.getByText('🔒')).toBeHidden();
        await expect(taskButtonB).not.toHaveClass(/opacity-50/);
        
        await contextA.close();
        await contextB.close();
    });
});
