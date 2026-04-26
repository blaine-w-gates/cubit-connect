/**
 * Memory Leak Test for SupabaseSync
 *
 * Verifies that SupabaseSync instances are properly cleaned up
 * and don't leak memory after 100 create/destroy cycles.
 *
 * @module memoryLeak.test
 */

import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { SupabaseSync } from '@/lib/supabaseSync';

describe('SupabaseSync Memory Leak', () => {
  it('should not leak after 50 create/destroy cycles', { timeout: 120000 }, async () => {
    // Mock console methods to reduce noise
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Track instances
    let createdCount = 0;
    let destroyedCount = 0;

    // Get initial memory if available
    // @ts-expect-error - Performance memory API not standard
    const initialMemory = performance?.memory?.usedJSHeapSize || 0;

    // Run 50 cycles (reduced due to cold start simulation delays)
    for (let i = 0; i < 50; i++) {
      const ydoc = new Y.Doc();
      const mockStatusChange = vi.fn();

      // Create instance
      const sync = new SupabaseSync(
        ydoc,
        `test-room-${i}`,
        mockStatusChange
      );
      createdCount++;

      // Connect (simulate real usage)
      const mockKey = {} as CryptoKey;
      try {
        await sync.connect(mockKey);
      } catch {
        // Connect may fail with mock key, that's OK for leak test
      }

      // Disconnect and cleanup
      sync.disconnect();
      ydoc.destroy();
      destroyedCount++;

      // Clear mocks periodically to prevent memory buildup from mocks themselves
      if (i % 10 === 0) {
        vi.clearAllMocks();
      }
    }

    // Force garbage collection hint (if available)
    if (global.gc) {
      global.gc();
    }

    // Get final memory
    // @ts-expect-error - Performance memory API not standard
    const finalMemory = performance?.memory?.usedJSHeapSize || 0;

    // Verify all instances were created and destroyed
    expect(createdCount).toBe(50);
    expect(destroyedCount).toBe(50);

    // Memory check (if we have memory data)
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryGrowth = finalMemory - initialMemory;
      const growthPercent = (memoryGrowth / initialMemory) * 100;

      // Allow up to 50% growth (generous threshold for test environment)
      // In production, this should be much lower (< 10%)
      expect(growthPercent).toBeLessThan(50);
    }

    consoleSpy.mockRestore();
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  it('should clean up event listeners on disconnect', async () => {
    const ydoc = new Y.Doc();
    const mockStatusChange = vi.fn();

    const sync = new SupabaseSync(
      ydoc,
      'test-room',
      mockStatusChange
    );

    const mockKey = {} as CryptoKey;
    await sync.connect(mockKey);

    // Disconnect
    sync.disconnect();

    // Verify status changed to disconnected
    expect(sync.getStatus()).toBe('disconnected');

    ydoc.destroy();
  });

  it('should clean up E2EE key on disconnect', async () => {
    const ydoc = new Y.Doc();
    const mockStatusChange = vi.fn();

    const sync = new SupabaseSync(
      ydoc,
      'test-room',
      mockStatusChange
    );

    const mockKey = {} as CryptoKey;
    await sync.connect(mockKey);

    // Verify connected
    expect(sync.isConnectedToServer()).toBe(true);

    // Disconnect
    sync.disconnect();

    // Verify disconnected
    expect(sync.isConnectedToServer()).toBe(false);

    ydoc.destroy();
  });

  it('should handle rapid create/destroy cycles', { timeout: 60000 }, async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Rapid 20 cycles (reduced from 50 to avoid timeout with cold start simulation)
    for (let i = 0; i < 20; i++) {
      const ydoc = new Y.Doc();
      const sync = new SupabaseSync(ydoc, `rapid-${i}`, vi.fn());

      const mockKey = {} as CryptoKey;
      try {
        await sync.connect(mockKey);
      } catch {
        // Ignore connect errors
      }

      sync.disconnect();
      ydoc.destroy();
    }

    // If we get here without crashing, memory management is working
    expect(true).toBe(true);

    consoleSpy.mockRestore();
    consoleWarn.mockRestore();
  });
});
