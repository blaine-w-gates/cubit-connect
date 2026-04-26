/**
 * Vitest Setup File for Unit Tests
 *
 * Global mocks and configuration for all unit tests.
 * This file runs before each test file to ensure consistent mocking.
 *
 * @module vitestSetup
 * @version 1.0.0
 */

import { vi, afterEach } from 'vitest';

// ============================================================================
// GLOBAL SUPABASE MOCK
// ============================================================================

/**
 * Mock Supabase client for all unit tests
 * Prevents actual network calls during testing
 */
vi.mock('@/lib/supabaseClient', () => ({
  signInAnonymously: vi.fn().mockResolvedValue({
    success: true,
    user: {
      id: 'test-user-id-12345',
      email: null,
      anonymous: true,
    },
    session: {
      access_token: 'mock-jwt-token-for-testing',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
    },
    error: null,
  }),

  getSupabaseClient: vi.fn(() => ({
    channel: vi.fn((_name: string) => ({
      subscribe: vi.fn((callback) => {
        if (callback) callback('SUBSCRIBED');
        return () => {};
      }),
      on: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue({ error: null }),
      unsubscribe: vi.fn().mockResolvedValue({ error: null }),
    })),

    rpc: vi.fn((fn: string) => {
      if (fn === 'get_latest_checkpoint') {
        return Promise.resolve({
          data: {
            id: 'mock-checkpoint-id',
            room_hash: 'test-room',
            client_id: 'test-client',
            checkpoint_data: new Uint8Array([1, 2, 3]),
            sequence_number: 1,
            created_at: new Date().toISOString(),
          },
          error: null,
        });
      }

      if (fn === 'get_next_checkpoint_sequence') {
        return Promise.resolve({ data: 1, error: null });
      }

      if (fn === 'cleanup_old_checkpoints') {
        return Promise.resolve({ data: 0, error: null });
      }

      return Promise.resolve({ data: null, error: null });
    }),

    from: vi.fn(() => ({
      insert: vi.fn((data: unknown) => {
        const mockId = (i: number) => `mock-id-${i}`;
        if (Array.isArray(data)) {
          return Promise.resolve({
            data: data.map((item, i) => ({ ...(item as object), id: mockId(i) })),
            error: null,
          });
        }
        return Promise.resolve({
          data: { ...(data as object), id: mockId(0) },
          error: null,
        });
      }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),

    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-token',
            user: { id: 'test-user' },
          },
        },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  })),
}));

// ============================================================================
// GLOBAL FEATUREFLAGS MOCK
// ============================================================================

/**
 * Mock featureFlags module to prevent real telemetry
 */
vi.mock('@/lib/featureFlags', () => ({
  emitTelemetry: vi.fn(),
  setFlag: vi.fn(),
  getFlag: vi.fn().mockReturnValue(false),
  getAllFlags: vi.fn().mockReturnValue({}),
  resetFlags: vi.fn(),
  resetDebounceState: vi.fn(),
  isDebouncing: vi.fn().mockReturnValue(false),
  recordToggle: vi.fn(),
  setUseSupabaseSync: vi.fn(),
  getUseSupabaseSync: vi.fn().mockReturnValue(true),
}));

// ============================================================================
// GLOBAL WINDOW MOCKS
// ============================================================================

/**
 * Initialize global test utilities on window
 */
if (typeof window !== 'undefined') {
  // Telemetry array for test verification
  (window as unknown as { __SYNC_TELEMETRY__: unknown[] }).__SYNC_TELEMETRY__ = [];
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Clean up after each test
 */
afterEach(() => {
  // Clear all mock call histories
  vi.clearAllMocks();
});

// Log test mode for debugging
console.log('[VITEST SETUP] Unit test environment initialized with mocks');
