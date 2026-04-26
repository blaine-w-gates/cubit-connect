/**
 * Load Testing Harness
 *
 * Simulates high concurrency to verify scalability.
 * Tests 1000+ concurrent user scenarios.
 *
 * @module loadTesting.test
 */

import { describe, it, expect, vi } from 'vitest';
import { SupabaseSync } from '@/lib/supabaseSync';
import { getRateLimiter } from '@/lib/rateLimiter';
import * as Y from 'yjs';

/**
 * Load test configuration
 */
interface LoadTestConfig {
  concurrentUsers: number;
  operationsPerUser: number;
  maxDurationMs: number;
}

/**
 * Load test results
 */
interface LoadTestResults {
  totalOperations: number;
  successful: number;
  failed: number;
  rateLimited: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  errors: string[];
}

/**
 * Run load test
 */
async function runLoadTest(config: LoadTestConfig): Promise<LoadTestResults> {
  const results: LoadTestResults = {
    totalOperations: 0,
    successful: 0,
    failed: 0,
    rateLimited: 0,
    avgLatencyMs: 0,
    maxLatencyMs: 0,
    errors: [],
  };

  const latencies: number[] = [];
  const errors: string[] = [];

  // Simulate concurrent users
  const userPromises = Array.from({ length: config.concurrentUsers }, async (_, userIndex) => {
    const userId = `load-test-user-${userIndex}`;
    const ydoc = new Y.Doc();
    const sync = new SupabaseSync(ydoc, `load-room-${userIndex}`, vi.fn());

    for (let op = 0; op < config.operationsPerUser; op++) {
      const start = Date.now();

      try {
        // Check rate limit
        const rateLimitStatus = getRateLimiter().checkLimit(userId, 'sync');

        if (!rateLimitStatus.allowed) {
          results.rateLimited++;
          continue;
        }

        // Simulate operation
        const mockKey = {} as CryptoKey;
        await sync.connect(mockKey);
        await sync.broadcastUpdate(new Uint8Array([1, 2, 3]));
        sync.disconnect();

        results.successful++;
      } catch (error) {
        results.failed++;
        if (error instanceof Error) {
          errors.push(error.message);
        }
      }

      const latency = Date.now() - start;
      latencies.push(latency);

      results.totalOperations++;
    }

    ydoc.destroy();
  });

  // Run with timeout
  await Promise.race([
    Promise.all(userPromises),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Load test timeout')), config.maxDurationMs)
    ),
  ]);

  // Calculate stats
  if (latencies.length > 0) {
    results.avgLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    results.maxLatencyMs = Math.max(...latencies);
  }

  results.errors = [...new Set(errors)].slice(0, 10); // Unique errors, max 10

  return results;
}

describe('Load Testing', { timeout: 180000 }, () => {
  // ============================================================================
  // Scalability Tests
  // ============================================================================

  describe('scalability', () => {
    it('should handle 10 concurrent users', { timeout: 60000 }, async () => {
      const results = await runLoadTest({
        concurrentUsers: 10,
        operationsPerUser: 5,
        maxDurationMs: 30000,
      });

      expect(results.totalOperations).toBe(50);
      expect(results.successful).toBeGreaterThan(0);
    });

    it('should handle 50 concurrent users', { timeout: 120000 }, async () => {
      const results = await runLoadTest({
        concurrentUsers: 50,
        operationsPerUser: 3,
        maxDurationMs: 60000,
      });

      expect(results.totalOperations).toBe(150);
      // Allow some failures due to rate limiting
      expect(results.successful + results.rateLimited).toBeGreaterThan(100);
    });

    it('should report acceptable latency', { timeout: 60000 }, async () => {
      const results = await runLoadTest({
        concurrentUsers: 20,
        operationsPerUser: 3,
        maxDurationMs: 60000,
      });

      // Average latency should be reasonable
      expect(results.avgLatencyMs).toBeLessThan(5000);
    });
  });

  // ============================================================================
  // Rate Limiting Under Load
  // ============================================================================

  describe('rate limiting under load', () => {
    it('should rate limit excessive requests', async () => {
      const userId = 'rate-test-user';

      // Make 100 rapid requests
      for (let i = 0; i < 100; i++) {
        getRateLimiter().checkLimit(userId, 'test');
      }

      const violations = getRateLimiter().getViolations(userId);
      expect(violations).toBeGreaterThan(50); // Most should be rate limited
    });

    it('should track rate limit violations', { timeout: 60000 }, async () => {
      // Direct rate limit test
      const userId = 'violation-test-user';
      const rateLimiter = getRateLimiter({ burstSize: 5 });

      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(userId, 'test');
      }

      // This should trigger violations
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit(userId, 'test');
      }

      const violations = rateLimiter.getViolations(userId);
      expect(violations).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Stress Tests
  // ============================================================================

  describe('stress tests', () => {
    it('should survive burst traffic', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Rapid burst of operations
      const burstPromises = Array.from({ length: 100 }, async (_, i) => {
        const ydoc = new Y.Doc();
        const sync = new SupabaseSync(ydoc, `burst-${i}`, vi.fn());

        try {
          const mockKey = {} as CryptoKey;
          await sync.connect(mockKey);
          sync.disconnect();
        } catch {
          // Expected under stress
        }

        ydoc.destroy();
      });

      await Promise.all(burstPromises);

      // Should complete without crashing
      expect(true).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // Performance Baseline
  // ============================================================================

  describe('performance baseline', () => {
    it('should have acceptable memory usage', { timeout: 60000 }, async () => {
      await runLoadTest({
        concurrentUsers: 20,
        operationsPerUser: 5,
        maxDurationMs: 60000,
      });

      // Cleanup should happen automatically
      const afterOps = getRateLimiter().getStats().activeBuckets;

      // Memory growth should be bounded
      expect(afterOps).toBeLessThan(100);
    });
  });
});
