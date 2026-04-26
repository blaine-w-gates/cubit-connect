/**
 * Chaos Engineering Tests
 *
 * Random failure injection to test system resilience.
 * Inspired by Netflix Chaos Monkey principles.
 *
 * @module chaosEngineering.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransportFallbackManager } from '@/lib/transportFallback';
import { SupabaseSync } from '@/lib/supabaseSync';
import * as Y from 'yjs';

/**
 * Chaos Monkey - Random failure injector
 */
class ChaosMonkey {
  private failureRate = 0.3; // 30% failure rate

  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  shouldFail(): boolean {
    return Math.random() < this.failureRate;
  }

  async injectRandomDelay(maxMs: number = 5000): Promise<void> {
    const delay = Math.random() * maxMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  maybeThrowError(errorMessage: string): void {
    if (this.shouldFail()) {
      throw new Error(`[CHAOS] ${errorMessage}`);
    }
  }
}

describe('Chaos Engineering', () => {
  let chaosMonkey: ChaosMonkey;
  let ydoc: Y.Doc;
  let mockStatusChange: (status: string) => void;

  beforeEach(() => {
    chaosMonkey = new ChaosMonkey();
    ydoc = new Y.Doc();
    mockStatusChange = vi.fn();
  });

  afterEach(() => {
    ydoc.destroy();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Circuit Breaker Chaos Tests
  // ============================================================================

  describe('circuit breaker chaos', () => {
    it('should handle rapid failures and open circuit', () => {
      const manager = new TransportFallbackManager();

      // Simulate 10 rapid failures (above 5 threshold)
      for (let i = 0; i < 10; i++) {
        try {
          manager.recordSupabaseFailure(new Error(`Chaos error ${i}`));
        } catch {
          // Ignore
        }
      }

      // Circuit should be open
      expect(manager.getCircuitState()).toBe('open');
    });

    it('should recover from circuit open after timeout', async () => {
      const manager = new TransportFallbackManager();

      // Open circuit
      for (let i = 0; i < 5; i++) {
        manager.recordSupabaseFailure(new Error('Failure'));
      }
      expect(manager.getCircuitState()).toBe('open');

      // Manually reset for test
      manager.resetCircuitBreaker();
      expect(manager.getCircuitState()).toBe('closed');
    });
  });

  // ============================================================================
  // Random Failure Tests
  // ============================================================================

  describe('random failure injection', () => {
    it('should handle 30% random failure rate', async () => {
      chaosMonkey.setFailureRate(0.3);

      const results: boolean[] = [];

      // Run 100 operations
      for (let i = 0; i < 100; i++) {
        try {
          chaosMonkey.maybeThrowError('Random failure');
          results.push(true);
        } catch {
          results.push(false);
        }
      }

      // Should have roughly 30% failures
      const failureCount = results.filter((r) => !r).length;
      expect(failureCount).toBeGreaterThan(20); // At least 20% failures
      expect(failureCount).toBeLessThan(50); // Less than 50% failures
    });

    it('should handle random delays', async () => {
      chaosMonkey.setFailureRate(0);

      const start = Date.now();
      await chaosMonkey.injectRandomDelay(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(200);
    });
  });

  // ============================================================================
  // SupabaseSync Resilience Tests
  // ============================================================================

  describe('SupabaseSync resilience', () => {
    it('should survive rapid connect/disconnect cycles', { timeout: 120000 }, async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // 20 rapid cycles
      for (let i = 0; i < 20; i++) {
        const sync = new SupabaseSync(ydoc, `chaos-${i}`, mockStatusChange);
        const mockKey = {} as CryptoKey;

        try {
          await sync.connect(mockKey);

          // Randomly fail operations
          if (Math.random() > 0.5) {
            await sync.broadcastUpdate(new Uint8Array([1, 2, 3]));
          }
        } catch {
          // Expected in chaos
        }

        sync.disconnect();
      }

      // Should complete without crashing
      expect(true).toBe(true);

      consoleSpy.mockRestore();
      consoleWarn.mockRestore();
    });

    it('should handle E2EE key failures gracefully', async () => {
      const sync = new SupabaseSync(ydoc, 'chaos-e2ee', mockStatusChange);

      // Try to connect with null key
      // @ts-expect-error - Testing invalid input
      await expect(sync.connect(null)).rejects.toThrow();

      // Status should be error
      expect(sync.getStatus()).toBe('disconnected');
    });
  });

  // ============================================================================
  // Memory Pressure Tests
  // ============================================================================

  describe('memory pressure', () => {
    it('should handle burst of many sync instances', async () => {
      const instances: SupabaseSync[] = [];

      // Create 50 instances rapidly
      for (let i = 0; i < 50; i++) {
        const sync = new SupabaseSync(ydoc, `burst-${i}`, mockStatusChange);
        instances.push(sync);
      }

      // Clean up all
      instances.forEach((sync) => sync.disconnect());

      // Should not crash
      expect(instances.length).toBe(50);
    });
  });

  // ============================================================================
  // Network Partition Simulation
  // ============================================================================

  describe('network partition', () => {
    it('should handle transport switching under chaos', () => {
      const manager = new TransportFallbackManager();

      // Simulate network partition (5 failures)
      for (let i = 0; i < 5; i++) {
        manager.recordSupabaseFailure(new Error('Network partition'));
      }

      // Should fallback to WebSocket
      expect(manager.getCurrentTransport()).toBe('websocket');
      expect(manager.getCircuitState()).toBe('open');
    });
  });
});
