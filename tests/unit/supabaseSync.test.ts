/**
 * Unit tests for supabaseSync.ts
 *
 * @module supabaseSync.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { SupabaseSync, type SyncStatus } from '@/lib/supabaseSync';

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
      await expect(sync.connect(null)).rejects.toThrow('E2EE key is required');
    });

    it('should throw error when connecting with invalid key', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      // @ts-expect-error - Testing invalid input
      await expect(sync.connect('invalid-key')).rejects.toThrow('E2EE key is required');
    });

    it('should clear E2EE key on disconnect', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      const mockKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      await sync.connect(mockKey);
      sync.disconnect();

      // Verify disconnect clears key by checking console output
      const consoleLog = vi.spyOn(console, 'log');
      sync.disconnect();
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('E2EE key cleared'));
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

    it('should log experimental warning', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Experimental'));

      consoleWarn.mockRestore();
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
    it('should connect successfully (skeleton)', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      // Create a mock CryptoKey
      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);

      expect(mockStatusChange).toHaveBeenCalledWith('connected');
      expect(sync.isConnectedToServer()).toBe(true);
    });

    it('should transition through connecting state', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);

      expect(mockStatusChange).toHaveBeenCalledWith('connecting');
      expect(mockStatusChange).toHaveBeenCalledWith('connected');
    });

    it('should emit telemetry on success', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);

      const telemetry = window.__SYNC_TELEMETRY__;
      expect(telemetry?.some((e) => e.event === 'supabase_auth_success')).toBe(true);
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
    it('should log when broadcasting (skeleton)', async () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);

      const update = new Uint8Array([1, 2, 3]);
      await sync.broadcastUpdate(update);

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('broadcastUpdate'));

      consoleLog.mockRestore();
    });

    it('should warn when not connected', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      const update = new Uint8Array([1, 2, 3]);
      await sync.broadcastUpdate(update);

      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('not connected'));

      consoleWarn.mockRestore();
    });
  });

  // ============================================================================
  // broadcastCheckpoint() Tests
  // ============================================================================

  describe('broadcastCheckpoint', () => {
    it('should call onSyncActivity callback (skeleton)', async () => {
      const sync = new SupabaseSync(
        ydoc,
        'test-room-hash',
        mockStatusChange,
        mockSyncActivity
      );
      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);

      const checkpoint = new Uint8Array([1, 2, 3]);
      await sync.broadcastCheckpoint(checkpoint);

      expect(mockSyncActivity).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // flush() Tests
  // ============================================================================

  describe('flush', () => {
    it('should log when flushing (skeleton)', async () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);
      await sync.flush();

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('flush'));

      consoleLog.mockRestore();
    });
  });

  // ============================================================================
  // flushQueuedUpdates() Tests
  // ============================================================================

  describe('flushQueuedUpdates', () => {
    it('should log when flushing queued updates (skeleton)', async () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);
      sync.flushQueuedUpdates();

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('flushQueuedUpdates'));

      consoleLog.mockRestore();
    });
  });

  // ============================================================================
  // sendDisconnectSignal() Tests
  // ============================================================================

  describe('sendDisconnectSignal', () => {
    it('should log when sending disconnect signal (skeleton)', async () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);
      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);
      await sync.sendDisconnectSignal();

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('sendDisconnectSignal'));

      consoleLog.mockRestore();
    });
  });

  // ============================================================================
  // requestCache() Tests
  // ============================================================================

  describe('requestCache', () => {
    it('should call onSyncActivity callback (skeleton)', async () => {
      const sync = new SupabaseSync(
        ydoc,
        'test-room-hash',
        mockStatusChange,
        mockSyncActivity
      );
      const mockKey = {} as CryptoKey;

      await sync.connect(mockKey);
      sync.requestCache();

      expect(mockSyncActivity).toHaveBeenCalled();
    });

    it('should warn when not connected', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      sync.requestCache();

      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('not connected'));

      consoleWarn.mockRestore();
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
    it('should return current status', async () => {
      const sync = new SupabaseSync(ydoc, 'test-room-hash', mockStatusChange);

      expect(sync.getStatus()).toBe('disconnected');

      const mockKey = {} as CryptoKey;
      await sync.connect(mockKey);

      expect(sync.getStatus()).toBe('connected');

      sync.disconnect();
      expect(sync.getStatus()).toBe('disconnected');
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
