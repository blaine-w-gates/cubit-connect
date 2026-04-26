/**
 * Mock Supabase Client for Unit Tests
 *
 * Prevents actual network calls to Supabase during unit testing.
 * This mock provides type-safe implementations of all Supabase methods
 * used in the production codebase.
 *
 * @module supabaseClientMock
 * @version 1.0.0
 */

import { vi } from 'vitest';

// ============================================================================
// AUTHENTICATION MOCK
// ============================================================================

/**
 * Mock signInAnonymously - returns successful auth response
 * Matches return type from actual supabaseClient.ts
 */
export const signInAnonymously = vi.fn().mockResolvedValue({
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
});

// Error case variant for testing failure modes
export const signInAnonymouslyError = vi.fn().mockResolvedValue({
  success: false,
  user: null,
  session: null,
  error: {
    message: 'Request rate limit reached',
    status: 429,
  },
});

// ============================================================================
// SUPABASE CLIENT MOCK
// ============================================================================

/**
 * Mock channel for Realtime subscriptions
 */
const createMockChannel = (_channelName: string) => ({
  subscribe: vi.fn((callback) => {
    // Simulate successful subscription
    if (callback) callback('SUBSCRIBED');
    return () => {}; // Unsubscribe function
  }),
  on: vi.fn().mockReturnThis(), // Chainable
  send: vi.fn().mockResolvedValue({
    error: null,
  }),
  unsubscribe: vi.fn().mockResolvedValue({
    error: null,
  }),
  status: 'SUBSCRIBED',
});

/**
 * Mock Supabase client instance
 * Provides all methods used in production code
 */
const mockSupabaseClient = {
  // Realtime channels
  channel: vi.fn((name: string) => createMockChannel(name)),

  // RPC for checkpoint functions
  rpc: vi.fn((fn: string, params?: Record<string, unknown>) => {
    // Mock different RPC functions
    if (fn === 'get_latest_checkpoint') {
      return Promise.resolve({
        data: {
          id: 'mock-checkpoint-id',
          room_hash: params?.p_room_hash || 'test-room',
          client_id: 'test-client',
          checkpoint_data: new Uint8Array([1, 2, 3]),
          sequence_number: 1,
          created_at: new Date().toISOString(),
        },
        error: null,
      });
    }

    if (fn === 'get_next_checkpoint_sequence') {
      return Promise.resolve({
        data: 1, // Mock sequence starts at 1
        error: null,
      });
    }

    if (fn === 'cleanup_old_checkpoints') {
      return Promise.resolve({
        data: 0, // No old checkpoints cleaned in tests
        error: null,
      });
    }

    // Generic RPC response
    return Promise.resolve({ data: null, error: null });
  }),

  // Database operations
  from: vi.fn((_table: string) => ({
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
    limit: vi.fn().mockResolvedValue({
      data: [],
      error: null,
    }),
  })),

  // Auth state (if needed)
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
    onAuthStateChange: vi.fn(() => {
      // Return unsubscribe function
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    }),
  },
};

/**
 * Mock getSupabaseClient factory function
 * Returns the mock Supabase client instance
 */
export const getSupabaseClient = vi.fn(() => mockSupabaseClient);

// ============================================================================
// ERROR SIMULATION HELPERS
// ============================================================================

/**
 * Helper to simulate network errors in tests
 * Usage: simulateNetworkError(signInAnonymously)
 */
export const simulateNetworkError = (mockFn: typeof signInAnonymously) => {
  mockFn.mockRejectedValueOnce(new Error('Network request failed'));
};

/**
 * Helper to simulate rate limit errors
 * Usage: simulateRateLimitError(signInAnonymously)
 */
export const simulateRateLimitError = (mockFn: typeof signInAnonymously) => {
  mockFn.mockResolvedValueOnce({
    success: false,
    user: null,
    session: null,
    error: {
      message: 'Request rate limit reached',
      status: 429,
    },
  });
};

/**
 * Reset all mocks to default state
 * Call in beforeEach to ensure clean state
 */
export const resetSupabaseMocks = () => {
  signInAnonymously.mockClear();
  getSupabaseClient.mockClear();
};

// ============================================================================
// DEFAULT EXPORT FOR COMPATIBILITY
// ============================================================================

const supabaseClientMock = {
  signInAnonymously,
  getSupabaseClient,
  simulateNetworkError,
  simulateRateLimitError,
  resetSupabaseMocks,
};

export default supabaseClientMock;
