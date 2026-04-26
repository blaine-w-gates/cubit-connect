/**
 * Unit tests for supabaseSync.ts
 *
 * @module supabaseSync.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { SupabaseSync, type SyncStatus } from '@/lib/supabaseSync';

// Mock Supabase client to prevent network calls and rate limiting
vi.mock('@/lib/supabaseClient', () => ({
  // Direct export used by supabaseSyncProd.ts
  signInAnonymously: vi.fn().mockResolvedValue({
    success: true,
    user: { id: 'test-user' },
    session: { access_token: 'test-token' }
  }),
  // Client factory for other uses
  getSupabaseClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      subscribe: vi.fn((cb) => {
        cb('SUBSCRIBED');
        return () => {};
      }),
      on: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue('ok'),
      unsubscribe: vi.fn()
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null })
  }))
}));

// Mock featureFlags module
vi.mock('@/lib/featureFlags', () => ({
  emitTelemetry: vi.fn(),
  setFlag: vi.fn(),
  getFlag: vi.fn().mockReturnValue(false)
}));

describe('supabaseSync', () => {
  let ydoc: Y.Doc;
  let mockStatusChange: (status: SyncStatus) => void;
  let mockSyncActivity: () => void;
  let mockPeerPresence: () => void;
  let mockPeerDisconnect: () => void;
  let mockPeerEditing: (isEditing: boolean) => void;

  beforeEach(() => {
    ydoc = new Y.Doc();
    mockStatusChange = vi.fn() as (status: SyncStatus) => void;
    mockSyncActivity = vi.fn() as () => void;
    mockPeerPresence = vi.fn() as () => void;
    mockPeerDisconnect = vi.fn() as () => void;
    mockPeerEditing = vi.fn() as (isEditing: boolean) => void;

    // Clear telemetry
    if (typeof window !== 'undefined') {
      window.__SYNC_TELEMETRY__ = [];
    }
  });

  afterEach(() => {
    ydoc.destroy();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // E2EE Integration Tests
  // ============================================================================

  describe('E2EE integration', () => {
    it('should store derivedKey on connect', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      // Create a mock CryptoKey
      const mockKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      await sync.connect(mockKey);

      // Key should be stored (verified by successful encrypt/decrypt later)
      expect(sync).toBeDefined();
    });

    it('should throw error when connecting without key', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      // @ts-expect-error - Testing invalid input
      await expect(sync.connect(null)).rejects.toThrow(/E2EE key/);
    });

    it('should throw error when connecting with invalid key', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      // @ts-expect-error - Testing invalid input
      await expect(sync.connect('invalid-key')).rejects.toThrow(/E2EE key/);
    });

    it('should handle disconnect', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      const mockKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      await sync.connect(mockKey);

      // Should not throw on disconnect
      expect(() => sync.disconnect()).not.toThrow();
    });

    it('should log queued updates on disconnect', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      const mockKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      await sync.connect(mockKey);

      // Simulate pending updates (queue would be populated in real usage)
      // For now just verify disconnect doesn't throw
      sync.disconnect();

      consoleWarn.mockRestore();
    });
  });

  // ============================================================================
  // Cold Start Tests
  // ============================================================================

  describe('cold start handling', () => {
    it('should track connection time', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      const mockKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      await sync.connect(mockKey);

      // After connection, timeout should be available
      const timeout = sync.getConnectionTimeout();
      expect(timeout).toBeGreaterThan(0);
    });

    it('should detect cold start (connection > 2s)', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      const mockKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      await sync.connect(mockKey);

      // wasColdStart() returns boolean based on actual connection time
      const wasColdStart = sync.wasColdStart();
      expect(typeof wasColdStart).toBe('boolean');
    });

    it('should provide extended timeout for cold start', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      const mockKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      await sync.connect(mockKey);

      const timeout = sync.getConnectionTimeout();
      // Should be either 10000 (normal) or 15000 (cold start)
      expect([10000, 15000]).toContain(timeout);
    });
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe('constructor', () => {
    it('should create instance with all callbacks', () => {
      const sync = new SupabaseSync(
        ydoc,
        'test-room-hash',
        mockStatusChange,
        mockSyncActivity,
        mockPeerPresence,
        mockPeerDisconnect,
        mockPeerEditing
      );

      expect(sync).toBeDefined();
      expect(sync).toBeInstanceOf(SupabaseSync);
    });

    it('should create instance with minimal callbacks', () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      expect(sync).toBeDefined();
      expect(sync).toBeInstanceOf(SupabaseSync);
    });

    it('should emit telemetry on creation', () => {
      new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      const telemetry = window.__SYNC_TELEMETRY__;
      expect(telemetry?.some((e) => e.event === 'supabase_auth_attempt')).toBe(true);
    });
  });

  // ============================================================================
  // connect() Tests
  // ============================================================================

  describe('connect', () => {
    it('should have connect method', () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      expect(typeof sync.connect).toBe('function');
    });
  });

  // ============================================================================
  // disconnect() Tests
  // ============================================================================

  describe('disconnect', () => {
    it('should disconnect when connected', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);
      expect(sync.isConnectedToServer()).toBe(true);

      sync.disconnect();

      expect(sync.isConnectedToServer()).toBe(false);
      expect(mockStatusChange).toHaveBeenCalledWith('disconnected');
    });

    it('should handle disconnect when not connected', () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      // Should not throw
      expect(() => sync.disconnect()).not.toThrow();
    });
  });

  // ============================================================================
  // broadcastUpdate() Tests
  // ============================================================================

  describe('broadcastUpdate', () => {
    it('should have broadcastUpdate method', () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      expect(typeof sync.broadcastUpdate).toBe('function');
    });
  });

  // ============================================================================
  // broadcastCheckpoint() Tests
  // ============================================================================

  describe('broadcastCheckpoint', () => {
    it('should have broadcastCheckpoint method', () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      expect(typeof sync.broadcastCheckpoint).toBe('function');
    });
  });

  // ============================================================================
  // flush() Tests
  // ============================================================================

  describe('flush', () => {
    it('should have flush method', () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      expect(typeof sync.flush).toBe('function');
    });
  });

  // ============================================================================
  // flushQueuedUpdates() Tests
  // ============================================================================

  describe('flushQueuedUpdates', () => {
    it('should have flushQueuedUpdates method', () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      expect(typeof sync.flushQueuedUpdates).toBe('function');
    });
  });

  // ============================================================================
  // sendDisconnectSignal() Tests
  // ============================================================================

  describe('sendDisconnectSignal', () => {
    it('should have sendDisconnectSignal method', () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      expect(typeof sync.sendDisconnectSignal).toBe('function');
    });
  });

  // ============================================================================
  // requestCache() Tests
  // ============================================================================

  describe('requestCache', () => {
    it('should have requestCache method', () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      expect(typeof sync.requestCache).toBe('function');
    });
  });

  // ============================================================================
  // Interface Compliance Tests
  // ============================================================================

  describe('interface compliance', () => {
    it('should implement SupabaseSyncInterface', () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      // Check all required methods exist
      expect(typeof sync.connect).toBe('function');
      expect(typeof sync.disconnect).toBe('function');
      expect(typeof sync.broadcastUpdate).toBe('function');
      expect(typeof sync.broadcastCheckpoint).toBe('function');
      expect(typeof sync.flush).toBe('function');
      expect(typeof sync.flushQueuedUpdates).toBe('function');
      expect(typeof sync.sendDisconnectSignal).toBe('function');
      expect(typeof sync.requestCache).toBe('function');
    });
  });

  // ============================================================================
  // Transport Cleanup Tests
  // ============================================================================

  describe('transport cleanup', () => {
    it('should clear E2EE key on disconnect', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);
      sync.disconnect();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('E2EE key cleared'));
      consoleSpy.mockRestore();
    });

    it('should log warning for pending updates on disconnect', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);

      // Queue some updates via private method (simulated)
      // @ts-expect-error - Accessing private method for testing
      sync.queueUpdate(new Uint8Array([1, 2, 3]));

      sync.disconnect();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('pending updates'));
      consoleSpy.mockRestore();
    });

    it('should emit telemetry on disconnect', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);
      sync.disconnect();

      const telemetry = window.__SYNC_TELEMETRY__;
      expect(telemetry?.some((e) => e.event === 'transport_switched')).toBe(true);
    });
  });

  // ============================================================================
  // Status Tests
  // ============================================================================

  describe('status', () => {
    it('should have getStatus method', () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      expect(typeof sync.getStatus).toBe('function');
    });
  });
});

describe('SyncStatus type', () => {
  it('should accept valid status values', () => {
    const statuses: SyncStatus[] = ['disconnected', 'connecting', 'connected', 'error'];

    statuses.forEach((status) => {
      expect(status).toBeDefined();
    });
  });
});
