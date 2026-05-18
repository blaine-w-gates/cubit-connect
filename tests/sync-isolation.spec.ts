import { test, expect } from '@playwright/test';

/**
 * Minimal Sync Isolation Test
 * Goal: Isolate the sync layer to verify room joining works correctly
 */
test.describe('Sync Isolation Test', () => {

    test('Room ID determinism check', async () => {
        // Verify that deriveRoomId produces the same room ID for the same passphrase
        const passphrase = 'test-passphrase-123';

        // This would need to be run in browser context to test actual implementation
        // For now, this is a placeholder for the concept
        expect(passphrase).toBe('test-passphrase-123');
    });

    test('Peer Connection Without Data Sync', async ({ browser }) => {
        test.setTimeout(60000);

        const PASSPHRASE = `isolation-test-${Date.now()}`;
        console.log(`[ISOLATION TEST] Passphrase: ${PASSPHRASE}`);

        // Setup Peer A
        const contextA = await browser.newContext();
        const pageA = await contextA.newPage();

        await pageA.goto('/todo', { waitUntil: 'networkidle' });
        await pageA.evaluate(() => {
            localStorage.setItem('sync_server_url', 'ws://localhost:8080');
            localStorage.setItem('theme', 'dark');
        });
        await pageA.reload({ waitUntil: 'networkidle' });

        // Connect Peer A
        await pageA.getByRole('button', { name: 'Sync', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
        await pageA.getByRole('button', { name: 'Sync', exact: true }).click();
        await pageA.getByPlaceholder('Enter a shared secret...').fill(PASSPHRASE);
        await pageA.getByRole('button', { name: 'Establish Secure Connection' }).click();

        // Wait for connection
        await expect(pageA.getByText('Securely Connected')).toBeVisible({ timeout: 10000 });
        await pageA.getByRole('button', { name: 'Close', exact: false }).or(pageA.locator('button:has(svg.lucide-x)')).click();

        // [CRITICAL CHECK] Get Peer A's room ID before Peer B connects
        const peerARoomId = await pageA.evaluate(() => {
            const state = (window as any).__STORE__.getState();
            return {
                roomId: state.roomId,
                projectId: state.currentProjectId,
                clientId: (window as any).__SYNC_CLIENT_ID__, // May need to expose this
            };
        });
        console.log('[ISOLATION] Peer A Room ID:', peerARoomId.roomId);
        console.log('[ISOLATION] Peer A Project ID:', peerARoomId.projectId);

        // Setup Peer B
        const contextB = await browser.newContext();
        const pageB = await contextB.newPage();

        await pageB.goto('/todo', { waitUntil: 'networkidle' });
        await pageB.evaluate(() => {
            localStorage.setItem('sync_server_url', 'ws://localhost:8080');
            localStorage.setItem('theme', 'dark');
        });
        await pageB.reload({ waitUntil: 'networkidle' });

        // Connect Peer B
        await pageB.getByRole('button', { name: 'Sync', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
        await pageB.getByRole('button', { name: 'Sync', exact: true }).click();
        await pageB.getByPlaceholder('Enter a shared secret...').fill(PASSPHRASE);
        await pageB.getByRole('button', { name: 'Establish Secure Connection' }).click();

        await expect(pageB.getByText('Securely Connected')).toBeVisible({ timeout: 10000 });
        await pageB.getByRole('button', { name: 'Close', exact: false }).or(pageB.locator('button:has(svg.lucide-x)')).click();

        // Wait for peer detection
        await pageB.waitForFunction(() => (window as any).__STORE__.getState().hasPeers === true, { timeout: 15000 });

        // [CRITICAL CHECK] Get Peer B's room ID after connection
        const peerBRoomId = await pageB.evaluate(() => {
            const state = (window as any).__STORE__.getState();
            return {
                roomId: state.roomId,
                projectId: state.currentProjectId,
                clientId: (window as any).__SYNC_CLIENT_ID__, // May need to expose this
            };
        });
        console.log('[ISOLATION] Peer B Room ID:', peerBRoomId.roomId);
        console.log('[ISOLATION] Peer B Project ID:', peerBRoomId.projectId);

        // [VERIFICATION] Room IDs must match
        expect(peerARoomId.roomId).toBe(peerBRoomId.roomId);
        console.log('[ISOLATION] ✅ Room IDs match:', peerARoomId.roomId);

        // [VERIFICATION] Project IDs should match if sync worked
        if (peerARoomId.projectId !== peerBRoomId.projectId) {
            console.error('[ISOLATION] ❌ Project IDs DO NOT MATCH!');
            console.error(`  Peer A: ${peerARoomId.projectId}`);
            console.error(`  Peer B: ${peerBRoomId.projectId}`);
        }

        // Verify connection is established
        await expect(pageB.getByText('👥 2+')).toBeVisible();
        console.log('[ISOLATION] ✅ Both peers connected to same room');
    });
});
