/**
 * Unit tests for supabaseClient.ts
 *
 * Note: These tests verify the public API and resilience logic.
 * Full integration tests require actual Supabase connection.
 *
 * @module supabaseClient.test
 */

import { describe, it, expect, vi } from 'vitest';

// Test the module can be imported
import {
  MAX_RETRY_ATTEMPTS,
  BASE_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  AUTH_TIMEOUT_MS,
} from '@/lib/supabaseClient';

describe('supabaseClient constants', () => {
  it('should export correct retry constants', () => {
    expect(MAX_RETRY_ATTEMPTS).toBe(3);
    expect(BASE_RETRY_DELAY_MS).toBe(1000);
    expect(MAX_RETRY_DELAY_MS).toBe(5000);
    expect(AUTH_TIMEOUT_MS).toBe(10000);
  });
});

describe('supabaseClient SSR safety', () => {
  it('should handle missing window gracefully', async () => {
    const originalWindow = global.window;

    // Simulate SSR
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Import functions after removing window
    const { signInAnonymously } = await import('@/lib/supabaseClient');

    const result = await signInAnonymously();

    expect(result.success).toBe(false);
    expect(result.error).toContain('SSR');

    // Restore window
    global.window = originalWindow;
  });

  it('should return null session during SSR', async () => {
    const originalWindow = global.window;

    // Simulate SSR
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    const { getCurrentSession } = await import('@/lib/supabaseClient');

    const session = await getCurrentSession();

    expect(session).toBeNull();

    // Restore window
    global.window = originalWindow;
  });
});

describe('supabaseClient environment validation', () => {
  it('should throw on missing environment variables', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Remove env vars
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Clear module cache to force re-import
    vi.resetModules();

    try {
      // This should fail when trying to create client
      const { getSupabaseClient } = await import('@/lib/supabaseClient');
      getSupabaseClient();
      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      expect((error as Error).message).toContain('SUPABASE_URL');
    }

    // Restore env vars
    if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });
});
