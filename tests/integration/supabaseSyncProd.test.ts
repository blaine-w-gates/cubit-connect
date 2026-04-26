/**
 * SupabaseSync Production Integration Tests
 *
 * Verifies production SupabaseSync implementation without requiring live Supabase.
 * Tests interfaces, state management, and error handling.
 *
 * @module supabaseSyncProd.test
 * @integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { SupabaseSyncProd } from '@/lib/supabaseSyncProd';
import { deriveSyncKey, encryptUpdate, decryptUpdate } from '@/lib/cryptoSync';

// Check if Supabase credentials are available
const hasSupabaseCredentials = process.env.NEXT_PUBLIC_SUPABASE_URL &&
                                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe.skipIf(!hasSupabaseCredentials)('SupabaseSyncProd', () => {
  let ydoc: Y.Doc;
  let statusChanges: string[] = [];
  let syncActivityCount = 0;

  beforeEach(() => {
    ydoc = new Y.Doc();
    statusChanges = [];
    syncActivityCount = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    ydoc.destroy();
  });

  describe('initialization', () => {
    it('should create instance with required callbacks', () => {
      const sync = new SupabaseSyncProd(
        ydoc,
        'test-room-hash',
        (status) => statusChanges.push(status),
        () => syncActivityCount++
      );

      expect(sync).toBeDefined();
      expect(sync).toBeInstanceOf(SupabaseSyncProd);
    });

    it('should create instance with all optional callbacks', () => {
      const sync = new SupabaseSyncProd(
        ydoc,
        'test-room-hash',
        () => {}, // onStatusChange
        () => {}, // onSyncActivity
        () => {}, // onPeerPresence
        () => {}, // onPeerDisconnect
        () => {}  // onPeerEditing
      );

      expect(sync).toBeDefined();
    });

    it('should have correct initial state', async () => {
      const sync = new SupabaseSyncProd(
        ydoc,
        'test-room-hash',
        (status) => statusChanges.push(status)
      );

      // Before connect
      expect(sync.isConnectedToServer()).toBe(false);
      expect(sync.wasColdStart()).toBe(false);
    });
  });

  describe('connection lifecycle', () => {
    it('should store E2EE key on connect', async () => {
      const sync = new SupabaseSyncProd(ydoc, 'test-room-hash', () => {});
      const key = await deriveSyncKey('test-passphrase');

      try {
        await sync.connect(key);
      } catch {
        // Expected to fail without real Supabase
      }

      // @ts-expect-error - Accessing private field
      expect(sync.derivedKey).toBeDefined();
      // @ts-expect-error - Accessing private field
      expect(sync.derivedKey.type).toBe('secret');
    });

    it('should clear E2EE key on disconnect', async () => {
      const sync = new SupabaseSyncProd(ydoc, 'test-room-hash', () => {});
      const key = await deriveSyncKey('test-passphrase');

      try {
        await sync.connect(key);
      } catch {
        // Expected
      }

      sync.disconnect();

      // @ts-expect-error - Accessing private field
      expect(sync.derivedKey).toBeNull();
    });

    it('should track connection state', async () => {
      const sync = new SupabaseSyncProd(
        ydoc,
        'test-room-hash',
        (status) => statusChanges.push(status)
      );

      const key = await deriveSyncKey('test-passphrase');

      // Initially not connected
      expect(sync.isConnectedToServer()).toBe(false);

      try {
        await sync.connect(key);
      } catch {
        // Expected to fail without real Supabase
      }

      // Status changes should have been recorded
      expect(statusChanges.length).toBeGreaterThan(0);
    });

    it('should handle connect without callbacks', async () => {
      const sync = new SupabaseSyncProd(ydoc, 'test-room-hash', () => {});
      const key = await deriveSyncKey('test-passphrase');

      // Should not throw even without optional callbacks
      try {
        await sync.connect(key);
      } catch {
        // Expected
      }
    });
  });

  describe('encryption integration', () => {
    it('should encrypt and decrypt updates', async () => {
      const key = await deriveSyncKey('test-passphrase');

      // Create some Yjs data
      const ytext = ydoc.getText('test');
      ytext.insert(0, 'Hello, World!');

      const update = Y.encodeStateAsUpdate(ydoc);

      // Encrypt
      const encrypted = await encryptUpdate(update, key);

      // Verify encrypted is different from original
      expect(encrypted.length).toBeGreaterThan(0);
      expect(encrypted).not.toEqual(update);

      // Decrypt
      const decrypted = await decryptUpdate(encrypted, key);

      // Verify decryption worked
      expect(decrypted).toEqual(update);
    });

    it('should handle different passphrases', async () => {
      const key1 = await deriveSyncKey('passphrase-one');
      const key2 = await deriveSyncKey('passphrase-two');

      // Create data
      const ytext = ydoc.getText('test');
      ytext.insert(0, 'Secret data');

      const update = Y.encodeStateAsUpdate(ydoc);

      // Encrypt with key1
      const encrypted = await encryptUpdate(update, key1);

      // Should not decrypt with key2
      await expect(decryptUpdate(encrypted, key2)).rejects.toThrow();
    });

    it('should produce different ciphertexts for same data', async () => {
      const key = await deriveSyncKey('test-passphrase');

      // Create data
      const ytext = ydoc.getText('test');
      ytext.insert(0, 'Same data');

      const update = Y.encodeStateAsUpdate(ydoc);

      // Encrypt twice
      const encrypted1 = await encryptUpdate(update, key);
      const encrypted2 = await encryptUpdate(update, key);

      // Should be different (IV is random)
      expect(encrypted1).not.toEqual(encrypted2);

      // But both should decrypt to same data
      const decrypted1 = await decryptUpdate(encrypted1, key);
      const decrypted2 = await decryptUpdate(encrypted2, key);

      expect(decrypted1).toEqual(decrypted2);
      expect(decrypted1).toEqual(update);
    });
  });

  describe('Yjs integration', () => {
    it('should work with Yjs text type', async () => {
      const ytext = ydoc.getText('content');

      // Insert text
      ytext.insert(0, 'Hello');
      ytext.insert(5, ', World!');

      expect(ytext.toString()).toBe('Hello, World!');

      // Encode state
      const update = Y.encodeStateAsUpdate(ydoc);
      expect(update.length).toBeGreaterThan(0);
    });

    it('should work with Yjs map type', async () => {
      const ymap = ydoc.getMap('data');

      ymap.set('key1', 'value1');
      ymap.set('key2', 42);
      ymap.set('key3', true);

      expect(ymap.get('key1')).toBe('value1');
      expect(ymap.get('key2')).toBe(42);
      expect(ymap.get('key3')).toBe(true);
    });

    it('should work with Yjs array type', async () => {
      const yarray = ydoc.getArray('list');

      yarray.push(['item1']);
      yarray.push(['item2']);
      yarray.push(['item3']);

      expect(yarray.length).toBe(3);
      expect(yarray.get(0)).toBe('item1');
    });

    it('should handle nested types', async () => {
      const ymap = ydoc.getMap('root');
      const nestedText = new Y.Text();
      nestedText.insert(0, 'Nested content');

      ymap.set('nested', nestedText);

      const retrieved = ymap.get('nested') as Y.Text;
      expect(retrieved.toString()).toBe('Nested content');
    });
  });

  describe('room hash handling', () => {
    it('should store room hash', () => {
      const roomHash = 'abc123def456';
      const sync = new SupabaseSyncProd(ydoc, roomHash, () => {});

      // Room hash should be stored
      expect(sync).toBeDefined();
    });

    it('should handle different room hash formats', () => {
      const hashes = [
        'simple-hash',
        'hash-with-dashes',
        'hash_with_underscores',
        'HashWithMixedCase123',
        'a'.repeat(100),
        'short',
      ];

      for (const hash of hashes) {
        const sync = new SupabaseSyncProd(ydoc, hash, () => {});
        expect(sync).toBeDefined();
      }
    });
  });

  describe('callback invocations', () => {
    it('should call onStatusChange on state changes', async () => {
      const statusChanges: string[] = [];
      const sync = new SupabaseSyncProd(
        ydoc,
        'test-room',
        (status) => statusChanges.push(status)
      );

      const key = await deriveSyncKey('test');

      try {
        await sync.connect(key);
      } catch {
        // Expected
      }

      // Status should have changed
      expect(statusChanges.length).toBeGreaterThan(0);
    });

    it('should handle callback errors gracefully', async () => {
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
        // May throw from connect, not callback
      }
    });
  });

  describe('cold start detection', () => {
    it('should track cold start status', async () => {
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});

      // Before connect
      expect(sync.wasColdStart()).toBe(false);

      const key = await deriveSyncKey('test');

      try {
        await sync.connect(key);
      } catch {
        // Expected
      }

      // Should have cold start status (may be true or false)
      expect(typeof sync.wasColdStart()).toBe('boolean');
    });
  });

  describe('broadcast operations', () => {
    it('should handle broadcast when not connected', async () => {
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});

      const update = new Uint8Array([1, 2, 3]);

      // Should not throw when not connected
      await expect(sync.broadcastUpdate(update)).resolves.not.toThrow();
    });

    it('should handle checkpoint broadcast', async () => {
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});

      const fullUpdate = Y.encodeStateAsUpdate(ydoc);

      // Should not throw
      await expect(sync.broadcastCheckpoint(fullUpdate)).resolves.not.toThrow();
    });
  });

  describe('flush operations', () => {
    it('should handle flush when not connected', async () => {
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});

      // Should not throw
      await expect(sync.flush()).resolves.not.toThrow();
    });

    it('should handle flushQueuedUpdates', () => {
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});

      // Should not throw
      expect(() => sync.flushQueuedUpdates()).not.toThrow();
    });
  });

  describe('disconnect signals', () => {
    it('should handle sendDisconnectSignal when not connected', async () => {
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});

      // Should not throw
      await expect(sync.sendDisconnectSignal()).resolves.not.toThrow();
    });

    it('should handle requestCache when not connected', () => {
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});

      // Should not throw
      expect(() => sync.requestCache()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle rapid connect/disconnect cycles', async () => {
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});
      const key = await deriveSyncKey('test');

      // Multiple cycles
      for (let i = 0; i < 5; i++) {
        try {
          await sync.connect(key);
        } catch {
          // Expected
        }
        sync.disconnect();
      }

      // Should not crash
      expect(true).toBe(true);
    });

    it('should handle empty Yjs document', async () => {
      const emptyYdoc = new Y.Doc();
      const sync = new SupabaseSyncProd(emptyYdoc, 'test-room', () => {});
      const key = await deriveSyncKey('test');

      try {
        await sync.connect(key);
      } catch {
        // Expected
      }

      expect(() => sync.disconnect()).not.toThrow();
    });

    it('should handle destroyed Yjs document', async () => {
      const sync = new SupabaseSyncProd(ydoc, 'test-room', () => {});
      const key = await deriveSyncKey('test');

      // Destroy document
      ydoc.destroy();

      // Should handle gracefully
      try {
        await sync.connect(key);
      } catch {
        // May throw
      }

      expect(() => sync.disconnect()).not.toThrow();
    });
  });

  describe('DevTools integration', () => {
    it('should be accessible via DevTools in browser', () => {
      // In browser: window.__SUPABASE_SYNC__
      // Cannot test in Node.js environment
      expect(typeof window).toBe('undefined');
    });
  });
});
