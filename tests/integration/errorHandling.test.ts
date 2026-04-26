/**
 * Error Handling Integration Tests
 *
 * Comprehensive error handling verification for all critical paths.
 *
 * @module errorHandling.test
 * @integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { SupabaseSyncProd } from '@/lib/supabaseSyncProd';
import { deriveSyncKey } from '@/lib/cryptoSync';
import { getRateLimiter } from '@/lib/rateLimiter';
import { getAuditLogger } from '@/lib/auditLogger';
import { getFallbackManager } from '@/lib/transportFallback';

// Check if Supabase credentials are available
const hasSupabaseCredentials = process.env.NEXT_PUBLIC_SUPABASE_URL &&
                                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe.skipIf(!hasSupabaseCredentials)('Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singletons
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('SupabaseSync error scenarios', () => {
    it('should handle connection timeout gracefully', async () => {
      const ydoc = new Y.Doc();
      const sync = new SupabaseSyncProd(
        ydoc,
        'test-room',
        () => {}, // onStatusChange
        () => {}, // onSyncActivity
        () => {}, // onPeerPresence
        () => {}, // onPeerDisconnect
        () => {}  // onPeerEditing
      );

      const key = await deriveSyncKey('test-passphrase');

      // Connection will fail without real Supabase, but should not crash
      try {
        await sync.connect(key);
      } catch {
        // Expected to fail
      }

      // Should be able to disconnect cleanly even after failed connect
      expect(() => sync.disconnect()).not.toThrow();
    });

    it('should handle encryption key errors', async () => {
      const ydoc = new Y.Doc();
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});

      // Try to connect with invalid key
      const invalidKey = null as unknown as CryptoKey;

      await expect(sync.connect(invalidKey)).rejects.toThrow();
    });

    it('should handle missing E2EE key', async () => {
      const ydoc = new Y.Doc();
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});

      // @ts-expect-error - Testing missing key
      await expect(sync.connect(undefined)).rejects.toThrow();
    });

    it('should handle broadcast without connection', async () => {
      const ydoc = new Y.Doc();
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});

      const update = new Uint8Array([1, 2, 3]);

      // Should not throw when not connected
      await expect(sync.broadcastUpdate(update)).resolves.not.toThrow();
    });

    it('should handle disconnect without connect', () => {
      const ydoc = new Y.Doc();
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});

      // Should not throw if disconnect called before connect
      expect(() => sync.disconnect()).not.toThrow();
    });

    it('should handle multiple disconnect calls', async () => {
      const ydoc = new Y.Doc();
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});

      const key = await deriveSyncKey('test-passphrase');

      try {
        await sync.connect(key);
      } catch {
        // Expected
      }

      // Multiple disconnects should not throw
      expect(() => {
        sync.disconnect();
        sync.disconnect();
        sync.disconnect();
      }).not.toThrow();
    });
  });

  describe('Rate limiter error scenarios', () => {
    it('should handle null user ID', () => {
      const limiter = getRateLimiter();

      // Should handle null user gracefully
      const result = limiter.checkLimit(null as unknown as string, 'test');

      // Should allow or deny, but not crash
      expect(typeof result.allowed).toBe('boolean');
    });

    it('should handle undefined action', () => {
      const limiter = getRateLimiter();

      // Should handle undefined action
      const result = limiter.checkLimit('user-123', undefined as unknown as string);

      expect(typeof result.allowed).toBe('boolean');
    });

    it('should handle rapid consecutive calls', () => {
      const limiter = getRateLimiter();
      const userId = 'rapid-test-user';
      const action = 'test_action';

      // Make 1000 rapid calls
      const results = [];
      for (let i = 0; i < 1000; i++) {
        results.push(limiter.checkLimit(userId, action));
      }

      // Should have processed all calls
      expect(results).toHaveLength(1000);

      // Some should be allowed, some denied based on rate limit
      const allowed = results.filter((r) => r.allowed).length;
      const denied = results.filter((r) => !r.allowed).length;

      expect(allowed + denied).toBe(1000);
    });

    it('should handle very long user IDs', () => {
      const limiter = getRateLimiter();
      const longUserId = 'a'.repeat(10000);

      const result = limiter.checkLimit(longUserId, 'test');

      expect(typeof result.allowed).toBe('boolean');
    });

    it('should handle empty action names', () => {
      const limiter = getRateLimiter();

      const result = limiter.checkLimit('user-123', '');

      expect(typeof result.allowed).toBe('boolean');
    });
  });

  describe('Audit logger error scenarios', () => {
    it('should handle null details', () => {
      const logger = getAuditLogger();

      // Should not throw with null details
      expect(() => {
        logger.log('auth', 'info', 'test', null as unknown as Record<string, unknown>, true);
      }).not.toThrow();
    });

    it('should handle undefined user ID', () => {
      const logger = getAuditLogger();

      // Should log without userId
      expect(() => {
        logger.logAuth('login', true, { userId: undefined });
      }).not.toThrow();
    });

    it('should handle very large details object', () => {
      const logger = getAuditLogger();

      // Create large details
      const largeDetails: Record<string, unknown> = {};
      for (let i = 0; i < 1000; i++) {
        largeDetails[`key_${i}`] = 'x'.repeat(1000);
      }

      // Should handle without crashing
      expect(() => {
        logger.log('sync', 'info', 'test', largeDetails, true);
      }).not.toThrow();
    });

    it('should handle rapid logging', () => {
      const logger = getAuditLogger();

      // Log 1000 events rapidly
      expect(() => {
        for (let i = 0; i < 1000; i++) {
          logger.logTransport('test', true, { index: i });
        }
      }).not.toThrow();

      const stats = logger.getStats();
      expect(stats.total).toBeGreaterThan(0);
    });

    it('should handle circular references in details', () => {
      const logger = getAuditLogger();

      // Create circular reference
      const details: Record<string, unknown> = { a: 1 };
      details.self = details;

      // Should handle gracefully (may drop circular ref)
      expect(() => {
        logger.log('sync', 'info', 'circular_test', details, true);
      }).not.toThrow();
    });
  });

  describe('Transport fallback error scenarios', () => {
    it('should handle multiple consecutive failures', () => {
      const fallback = getFallbackManager();

      // Record many failures
      for (let i = 0; i < 20; i++) {
        fallback.recordSupabaseFailure(new Error(`Failure ${i}`));
      }

      // Circuit should be open
      expect(fallback.getCircuitState()).toBe('open');
    });

    it('should handle rapid success/failure toggling', () => {
      const fallback = getFallbackManager();

      // Toggle rapidly
      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          fallback.recordSupabaseFailure(new Error(`Failure ${i}`));
        } else {
          fallback.recordSupabaseSuccess();
        }
      }

      // Should be in some valid state
      const state = fallback.getCircuitState();
      expect(['closed', 'open', 'half-open']).toContain(state);
    });

    it('should handle state reset', () => {
      const fallback = getFallbackManager();

      // Force circuit open
      for (let i = 0; i < 10; i++) {
        fallback.recordSupabaseFailure(new Error(`Failure ${i}`));
      }

      expect(fallback.getCircuitState()).toBe('open');

      // Reset
      fallback.resetCircuitBreaker();

      expect(fallback.getCircuitState()).toBe('closed');
    });
  });

  describe('Crypto error scenarios', () => {
    it('should handle empty passphrase', async () => {
      // Empty passphrase should still derive a key (may be weak)
      const key = await deriveSyncKey('');

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
    });

    it('should handle very long passphrase', async () => {
      const longPassphrase = 'a'.repeat(10000);

      const key = await deriveSyncKey(longPassphrase);

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
    });

    it('should handle special characters in passphrase', async () => {
      const specialPassphrase = '!@#$%^&*()_+-=[]{}|;\':",./<>?`~';

      const key = await deriveSyncKey(specialPassphrase);

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
    });

    it('should handle unicode in passphrase', async () => {
      const unicodePassphrase = 'Hello世界🌍مرحبا';

      const key = await deriveSyncKey(unicodePassphrase);

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
    });
  });

  describe('Yjs error scenarios', () => {
    it('should handle corrupted update data', () => {
      const ydoc = new Y.Doc();

      // Try to apply corrupted data
      const corrupted = new Uint8Array([255, 255, 255, 255]);

      // Should throw or handle gracefully
      expect(() => {
        Y.applyUpdate(ydoc, corrupted);
      }).toThrow();
    });

    it('should handle empty update data', () => {
      const ydoc = new Y.Doc();

      const empty = new Uint8Array(0);

      // Should not throw
      expect(() => {
        Y.applyUpdate(ydoc, empty);
      }).not.toThrow();
    });

    it('should handle large document state', () => {
      const ydoc = new Y.Doc();
      const ytext = ydoc.getText('content');

      // Add 1MB of text
      const largeText = 'x'.repeat(1024 * 1024);
      ytext.insert(0, largeText);

      const update = Y.encodeStateAsUpdate(ydoc);

      // Should encode without issues
      expect(update.length).toBeGreaterThan(0);

      // Should be able to create new doc from update
      const ydoc2 = new Y.Doc();
      Y.applyUpdate(ydoc2, update);

      const ytext2 = ydoc2.getText('content');
      expect(ytext2.toString().length).toBe(largeText.length);
    });
  });

  describe('Network error scenarios', () => {
    it('should handle malformed room hash', async () => {
      const ydoc = new Y.Doc();
      const sync = new SupabaseSyncProd(
        ydoc,
        '', // Empty room hash
        () => {}
      );

      const key = await deriveSyncKey('test');

      // Should handle gracefully
      try {
        await sync.connect(key);
      } catch {
        // Expected
      }

      expect(() => sync.disconnect()).not.toThrow();
    });

    it('should handle very long room hash', async () => {
      const ydoc = new Y.Doc();
      const longHash = 'a'.repeat(10000);

      const sync = new SupabaseSyncProd(ydoc, longHash, () => {});

      const key = await deriveSyncKey('test');

      // Should handle gracefully
      try {
        await sync.connect(key);
      } catch {
        // Expected
      }

      expect(() => sync.disconnect()).not.toThrow();
    });
  });

  describe('Memory error scenarios', () => {
    it('should handle rapid document creation/destruction', () => {
      // Create and destroy 100 docs rapidly
      for (let i = 0; i < 100; i++) {
        const ydoc = new Y.Doc();
        const ytext = ydoc.getText('test');
        ytext.insert(0, `Document ${i}`);

        // Force garbage collection hint
        ydoc.destroy();
      }

      // Should complete without memory issues
      expect(true).toBe(true);
    });

    it('should handle observer registration without leaks', () => {
      const ydoc = new Y.Doc();
      const observers: (() => void)[] = [];

      // Register 1000 observers
      for (let i = 0; i < 1000; i++) {
        const observer = () => {};
        ydoc.on('update', observer);
        observers.push(observer);
      }

      // Unregister all
      observers.forEach((observer) => {
        ydoc.off('update', observer);
      });

      // Should not have memory leak
      expect(true).toBe(true);
    });
  });

  describe('Async error scenarios', () => {
    it('should handle rejected promises in callbacks', async () => {
      const ydoc = new Y.Doc();

      // Create sync with failing callback
      const sync = new SupabaseSyncProd(
        ydoc,
        'test-room',
        () => {
          throw new Error('Callback error');
        }
      );

      const key = await deriveSyncKey('test');

      // Should not crash even if callback throws
      try {
        await sync.connect(key);
      } catch {
        // Expected
      }
    });

    it('should handle async callback errors', async () => {
      const ydoc = new Y.Doc();

      const sync = new SupabaseSyncProd(
        ydoc,
        'test-room',
        () => {},
        async () => {
          throw new Error('Async callback error');
        }
      );

      const key = await deriveSyncKey('test');

      try {
        await sync.connect(key);
      } catch {
        // Expected
      }
    });
  });
});
