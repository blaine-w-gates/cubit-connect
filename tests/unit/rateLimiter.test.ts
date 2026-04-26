/**
 * Unit tests for rateLimiter.ts
 *
 * @module rateLimiter.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RateLimiter, getRateLimiter, destroyRateLimiter } from '@/lib/rateLimiter';

describe('rateLimiter', () => {
  beforeEach(() => {
    destroyRateLimiter();
  });

  afterEach(() => {
    destroyRateLimiter();
  });

  // ============================================================================
  // Basic Limit Tests
  // ============================================================================

  describe('basic limiting', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter({ burstSize: 5 });

      for (let i = 0; i < 5; i++) {
        const status = limiter.checkLimit('user-1', 'sync');
        expect(status.allowed).toBe(true);
      }
    });

    it('should block requests over limit', () => {
      const limiter = new RateLimiter({ burstSize: 2 });

      limiter.checkLimit('user-1', 'sync');
      limiter.checkLimit('user-1', 'sync');
      const status = limiter.checkLimit('user-1', 'sync');

      expect(status.allowed).toBe(false);
    });

    it('should track remaining tokens', () => {
      const limiter = new RateLimiter({ burstSize: 5 });

      limiter.checkLimit('user-1', 'sync');
      limiter.checkLimit('user-1', 'sync');

      const status = limiter.getStatus('user-1', 'sync');
      expect(status.remaining).toBe(3);
    });
  });

  // ============================================================================
  // Per-User Isolation Tests
  // ============================================================================

  describe('user isolation', () => {
    it('should track limits per user', () => {
      const limiter = new RateLimiter({ burstSize: 2 });

      // User 1 uses both tokens
      limiter.checkLimit('user-1', 'sync');
      limiter.checkLimit('user-1', 'sync');

      // User 2 should still have tokens
      const status = limiter.checkLimit('user-2', 'sync');
      expect(status.allowed).toBe(true);
    });

    it('should track limits per action', () => {
      const limiter = new RateLimiter({ burstSize: 2 });

      limiter.checkLimit('user-1', 'sync');
      limiter.checkLimit('user-1', 'sync');

      // Different action should have separate limit
      const status = limiter.checkLimit('user-1', 'auth');
      expect(status.allowed).toBe(true);
    });
  });

  // ============================================================================
  // Violation Tracking Tests
  // ============================================================================

  describe('violation tracking', () => {
    it('should track violations per user', () => {
      const limiter = new RateLimiter({ burstSize: 1 });

      limiter.checkLimit('user-1', 'sync');
      limiter.checkLimit('user-1', 'sync'); // Violation
      limiter.checkLimit('user-1', 'sync'); // Violation

      expect(limiter.getViolations('user-1')).toBe(2);
    });

    it('should reset violations', () => {
      const limiter = new RateLimiter({ burstSize: 1 });

      limiter.checkLimit('user-1', 'sync');
      limiter.checkLimit('user-1', 'sync'); // Violation

      limiter.resetViolations('user-1');

      expect(limiter.getViolations('user-1')).toBe(0);
    });
  });

  // ============================================================================
  // Consume Tests
  // ============================================================================

  describe('consume method', () => {
    it('should consume when allowed', () => {
      const limiter = new RateLimiter({ burstSize: 5 });

      expect(() => limiter.consume('user-1', 'sync')).not.toThrow();
    });

    it('should throw when not allowed', () => {
      const limiter = new RateLimiter({ burstSize: 1 });

      limiter.consume('user-1', 'sync');

      expect(() => limiter.consume('user-1', 'sync')).toThrow('Rate limit exceeded');
    });
  });

  // ============================================================================
  // Cleanup Tests
  // ============================================================================

  describe('cleanup', () => {
    it('should cleanup old buckets', async () => {
      const limiter = new RateLimiter({ burstSize: 5 });

      limiter.checkLimit('user-1', 'sync');
      limiter.checkLimit('user-2', 'sync');

      // Wait a tiny bit to ensure age
      await new Promise((resolve) => setTimeout(resolve, 10));

      const cleaned = limiter.cleanup(5); // Cleanup items older than 5ms
      expect(cleaned).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // Stats Tests
  // ============================================================================

  describe('statistics', () => {
    it('should return stats', () => {
      const limiter = new RateLimiter({ burstSize: 10 });

      limiter.checkLimit('user-1', 'sync');
      limiter.checkLimit('user-2', 'sync');

      const stats = limiter.getStats();
      expect(stats.activeBuckets).toBe(2);
      expect(stats.config.burstSize).toBe(10);
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = getRateLimiter();
      const instance2 = getRateLimiter();

      expect(instance1).toBe(instance2);
    });
  });
});
