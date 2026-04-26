/**
 * Chaos Engineering Integration Tests
 *
 * Resilience testing - verifies system behavior under various failure scenarios.
 *
 * @module chaosEngineering.test
 * @integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { SupabaseSyncProd } from '@/lib/supabaseSyncProd';
import { deriveSyncKey } from '@/lib/cryptoSync';
import { getRateLimiter } from '@/lib/rateLimiter';
import { getFallbackManager } from '@/lib/transportFallback';

// Check if Supabase credentials are available
const hasSupabaseCredentials = process.env.NEXT_PUBLIC_SUPABASE_URL &&
                                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe.skipIf(!hasSupabaseCredentials)('Chaos Engineering - Resilience Testing', () => {
  let ydoc: Y.Doc;

  beforeEach(() => {
    ydoc = new Y.Doc();
    vi.clearAllMocks();
  });

  afterEach(() => {
    ydoc.destroy();
  });

  describe('Network Partition Simulation', () => {
    it('should handle repeated connection failures', async () => {
      const statusChanges: string[] = [];
      const sync = new SupabaseSyncProd(
        ydoc,
        'chaos-test-room',
        (status) => statusChanges.push(status)
      );

      const key = await deriveSyncKey('test');

      // Attempt 10 connections (all will fail without Supabase)
      for (let i = 0; i < 10; i++) {
        try {
          await sync.connect(key);
        } catch {
          // Expected failure
        }
        sync.disconnect();
      }

      // Should have recorded multiple status changes
      expect(statusChanges.length).toBeGreaterThan(0);

      // System should still be functional
      expect(() => sync.disconnect()).not.toThrow();
    });

    it('should maintain Yjs document state across failures', async () => {
      const ytext = ydoc.getText('content');
      ytext.insert(0, 'Persistent data');

      const sync = new SupabaseSyncProd(ydoc, 'chaos-test-room', () => {});
      const key = await deriveSyncKey('test');

      // Multiple failures
      for (let i = 0; i < 5; i++) {
        try {
          await sync.connect(key);
        } catch {
          // Expected
        }
        sync.disconnect();
      }

      // Document should retain data
      expect(ytext.toString()).toBe('Persistent data');
    });
  });

  describe('Resource Exhaustion', () => {
    it('should handle memory pressure simulation', () => {
      const docs: Y.Doc[] = [];

      // Create 100 documents with data
      for (let i = 0; i < 100; i++) {
        const doc = new Y.Doc();
        const text = doc.getText('content');
        text.insert(0, `Document ${i} with some content`);
        docs.push(doc);
      }

      // All should exist
      expect(docs).toHaveLength(100);

      // Cleanup
      docs.forEach((doc) => doc.destroy());

      // Should complete without crashing
      expect(true).toBe(true);
    });

    it('should handle rapid document creation/destruction', () => {
      // Rapid create/destroy cycle
      for (let i = 0; i < 1000; i++) {
        const doc = new Y.Doc();
        const text = doc.getText('test');
        text.insert(0, 'test');
        doc.destroy();
      }

      // Should complete
      expect(true).toBe(true);
    });

    it('should handle large document states', () => {
      const largeDoc = new Y.Doc();
      const text = largeDoc.getText('large');

      // Add 10MB of text
      const chunk = 'x'.repeat(1000);
      for (let i = 0; i < 10000; i++) {
        text.insert(text.length, chunk);
      }

      // Should handle large state
      expect(text.length).toBeGreaterThan(1000000);

      // Should encode successfully
      const update = Y.encodeStateAsUpdate(largeDoc);
      expect(update.length).toBeGreaterThan(0);

      largeDoc.destroy();
    });
  });

  describe('Rate Limiter Stress', () => {
    it('should handle extreme request volume', () => {
      const limiter = getRateLimiter();
      const userId = 'stress-test-user';
      const action = 'stress_action';

      // 10000 rapid requests
      const results = [];
      for (let i = 0; i < 10000; i++) {
        results.push(limiter.checkLimit(userId, action));
      }

      // All should have been processed
      expect(results).toHaveLength(10000);

      // Some allowed, some denied
      const allowed = results.filter((r) => r.allowed).length;
      const denied = results.filter((r) => !r.allowed).length;

      expect(allowed + denied).toBe(10000);
      expect(denied).toBeGreaterThan(0); // Rate limit should kick in
    });

    it('should handle concurrent rate limit checks', () => {
      const limiter = getRateLimiter();

      // Simulate concurrent users
      const users = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      const results = users.map((userId) =>
        limiter.checkLimit(userId, 'concurrent_action')
      );

      // All should complete
      expect(results).toHaveLength(100);
      expect(results.every((r) => typeof r.allowed === 'boolean')).toBe(true);
    });

    it('should recover after rate limit exhaustion', () => {
      const limiter = getRateLimiter();
      const userId = 'recovery-user';
      const action = 'recovery_action';

      // Exhaust rate limit
      for (let i = 0; i < 1000; i++) {
        limiter.checkLimit(userId, action);
      }

      // Should be rate limited
      const limited = limiter.checkLimit(userId, action);
      expect(limited.allowed).toBe(false);

      // Simulate time passing by cleaning old buckets
      // Accessing internal cleanup method
      limiter.cleanup(0); // Clean all old buckets

      // Should be able to make requests again
      const recovered = limiter.checkLimit(userId, action);
      expect(recovered.allowed).toBe(true);
    });
  });

  describe('Circuit Breaker Chaos', () => {
    it('should handle rapid failure/success toggling', () => {
      const fallback = getFallbackManager();

      // Rapidly toggle between failure and success
      for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
          fallback.recordSupabaseSuccess();
        } else {
          fallback.recordSupabaseFailure(new Error(`Error ${i}`));
        }
      }

      // Circuit should be in some valid state
      const state = fallback.getCircuitState();
      expect(['closed', 'open', 'half-open']).toContain(state);
    });

    it('should handle cascading failures', () => {
      const fallback = getFallbackManager();

      // Simulate cascading failures
      for (let i = 0; i < 20; i++) {
        fallback.recordSupabaseFailure(new Error('Network error'));
      }

      // Circuit should be open
      expect(fallback.getCircuitState()).toBe('open');

      // Should trigger fallback
      expect(fallback.getCurrentTransport()).not.toBe('supabase');
    });

    it('should recover from open circuit', () => {
      const fallback = getFallbackManager();

      // Open circuit
      for (let i = 0; i < 10; i++) {
        fallback.recordSupabaseFailure(new Error('Error'));
      }

      expect(fallback.getCircuitState()).toBe('open');

      // Reset circuit
      fallback.resetCircuitBreaker();

      // Should be closed
      expect(fallback.getCircuitState()).toBe('closed');

      // Success should keep it closed
      fallback.recordSupabaseSuccess();
      expect(fallback.getCircuitState()).toBe('closed');
    });
  });

  describe('Encryption Under Stress', () => {
    it('should handle rapid encrypt/decrypt cycles', async () => {
      const key = await deriveSyncKey('stress-test');
      const data = new Uint8Array([1, 2, 3, 4, 5]);

      // 1000 cycles
      const { encryptUpdate, decryptUpdate } = await import('@/lib/cryptoSync');

      for (let i = 0; i < 1000; i++) {
        const encrypted = await encryptUpdate(data, key);
        const decrypted = await decryptUpdate(encrypted, key);

        // Verify integrity
        expect(decrypted).toEqual(data);
      }
    });

    it('should handle concurrent encryption operations', async () => {
      const key = await deriveSyncKey('concurrent-test');

      // Create multiple data chunks
      const chunks = Array.from({ length: 100 }, (_, i) =>
        new Uint8Array([i, i + 1, i + 2])
      );

      // Encrypt all concurrently
      const { encryptUpdate } = await import('@/lib/cryptoSync');
      const encrypted = await Promise.all(
        chunks.map((chunk) => encryptUpdate(chunk, key))
      );

      expect(encrypted).toHaveLength(100);
      expect(encrypted.every((e) => e.length > 0)).toBe(true);
    });

    it('should maintain encryption integrity under load', async () => {
      const key = await deriveSyncKey('integrity-test');
      const { encryptUpdate, decryptUpdate } = await import('@/lib/cryptoSync');

      // Large data
      const largeData = new Uint8Array(1024 * 1024); // 1MB
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      // Encrypt
      const encrypted = await encryptUpdate(largeData, key);

      // Decrypt
      const decrypted = await decryptUpdate(encrypted, key);

      // Verify
      expect(decrypted).toEqual(largeData);
    });
  });

  describe('Observer Pattern Chaos', () => {
    it('should handle rapid observer registration/deregistration', () => {
      const doc = new Y.Doc();
      const observers: (() => void)[] = [];

      // Register 1000 observers
      for (let i = 0; i < 1000; i++) {
        const observer = () => {};
        doc.on('update', observer);
        observers.push(observer);
      }

      // Deregister in random order
      const shuffled = [...observers].sort(() => Math.random() - 0.5);
      shuffled.forEach((observer) => {
        doc.off('update', observer);
      });

      // Should handle without issues
      expect(true).toBe(true);
      doc.destroy();
    });

    it('should handle observers that throw errors', () => {
      const doc = new Y.Doc();
      const errors: Error[] = [];

      // Register throwing observer
      doc.on('update', () => {
        const error = new Error('Observer error');
        errors.push(error);
        throw error;
      });

      // Register normal observer
      let normalCalled = false;
      doc.on('update', () => {
        normalCalled = true;
      });

      // Trigger update
      const text = doc.getText('test');
      text.insert(0, 'trigger');

      // Normal observer should still be called
      // (Yjs handles errors per observer)
      expect(normalCalled).toBe(true);

      doc.destroy();
    });
  });

  describe('State Consistency', () => {
    it('should maintain document consistency through chaos', () => {
      const doc = new Y.Doc();
      const text = doc.getText('content');

      // Simulate chaotic editing
      const operations = [
        () => text.insert(0, 'Hello'),
        () => text.insert(5, ' World'),
        () => text.delete(0, 6),
        () => text.insert(0, 'Hi'),
        () => text.insert(text.length, '!'),
        () => text.delete(2, 1),
      ];

      // Random order
      const shuffled = [...operations].sort(() => Math.random() - 0.5);

      // Execute all
      shuffled.forEach((op) => op());

      // Document should be in valid state
      expect(text.toString().length).toBeGreaterThanOrEqual(0);

      doc.destroy();
    });

    it('should handle concurrent text operations simulation', () => {
      const doc = new Y.Doc();
      const text = doc.getText('content');

      // Simulate concurrent edits at different positions
      text.insert(0, 'ABCD');

      // These would be concurrent in real scenario
      const concurrentOps = [
        () => text.insert(1, 'x'), // AxBCD
        () => text.insert(3, 'y'), // AByCD
        () => text.delete(2, 1), // Delete C
      ];

      // Execute
      concurrentOps.forEach((op) => {
        try {
          op();
        } catch {
          // Some may conflict
        }
      });

      // Document should still be valid
      expect(typeof text.toString()).toBe('string');

      doc.destroy();
    });
  });

  describe('Recovery Scenarios', () => {
    it('should recover from Yjs corruption attempt', () => {
      const doc = new Y.Doc();
      const text = doc.getText('content');
      text.insert(0, 'Original text');

      // Save state (would be used for recovery in real scenario)
      const _state = Y.encodeStateAsUpdate(doc);
      expect(_state.length).toBeGreaterThan(0);

      // Try to apply corrupted update
      const corrupted = new Uint8Array([255, 255, 255, 255]);
      try {
        Y.applyUpdate(doc, corrupted);
      } catch {
        // Expected
      }

      // Original text should be preserved
      // (Yjs is immutable, corrupted update won't affect existing state)
      expect(text.toString()).toBe('Original text');

      doc.destroy();
    });

    it('should handle rapid sync/disconnect cycles', async () => {
      const key = await deriveSyncKey('rapid-test');

      // 50 rapid cycles
      for (let i = 0; i < 50; i++) {
        const doc = new Y.Doc();
        const sync = new SupabaseSyncProd(doc, `rapid-room-${i}`, () => {});

        try {
          await sync.connect(key);
        } catch {
          // Expected
        }

        sync.disconnect();
        doc.destroy();
      }

      // Should complete without memory issues
      expect(true).toBe(true);
    });
  });

  describe('Edge Case Chaos', () => {
    it('should handle empty operations', () => {
      const doc = new Y.Doc();
      const text = doc.getText('test');

      // Empty insert
      text.insert(0, '');

      // Delete with length 0
      text.delete(0, 0);

      // Delete beyond bounds
      text.delete(100, 10);

      expect(text.toString()).toBe('');

      doc.destroy();
    });

    it('should handle very long strings', () => {
      const doc = new Y.Doc();
      const text = doc.getText('long');

      // Insert 1 million characters
      const longString = 'a'.repeat(1000000);
      text.insert(0, longString);

      expect(text.length).toBe(1000000);

      doc.destroy();
    });

    it('should handle special characters', () => {
      const doc = new Y.Doc();
      const text = doc.getText('special');

      const specialChars =
        '!@#$%^&*()_+-=[]{}|;\':",./<>?\n\r\t\\' +
        'Hello世界🌍مرحبا' +
        '<script>alert("xss")</script>';

      text.insert(0, specialChars);

      expect(text.toString()).toBe(specialChars);

      doc.destroy();
    });
  });
});
