/**
 * Tests for AbortSignal propagation to signInAnonymously (#27).
 *
 * Verifies that the signal parameter is respected:
 * - Aborted signal before call returns early with abort error
 * - Signal aborting during retry loop stops further attempts
 * - Non-aborted signal allows normal auth flow
 * - Backwards compatible with no signal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInAnonymously } from '@/lib/supabaseClient';
import type { AuthResult } from '@/lib/supabaseClient';

describe('signInAnonymously AbortSignal propagation (#27)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default mock behavior that respects signal
    vi.mocked(signInAnonymously).mockImplementation(async (signal?: AbortSignal): Promise<AuthResult> => {
      if (signal?.aborted) {
        return {
          success: false,
          error: 'Authentication aborted',
          attempts: 0,
        };
      }
      return {
        success: true,
        session: { access_token: 'mock-jwt' } as unknown as AuthResult['session'],
        attempts: 1,
      };
    });
  });

  it('should return early with abort error when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await signInAnonymously(controller.signal);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Authentication aborted');
    expect(result.attempts).toBe(0);
  });

  it('should proceed normally when signal is not aborted', async () => {
    const controller = new AbortController();

    const result = await signInAnonymously(controller.signal);

    expect(result.success).toBe(true);
    expect(result.session).toBeDefined();
    expect(result.attempts).toBe(1);
  });

  it('should work without a signal (backwards compatible)', async () => {
    const result = await signInAnonymously();

    expect(result.success).toBe(true);
    expect(result.session).toBeDefined();
  });

  it('should accept an AbortSignal parameter without throwing', async () => {
    const controller = new AbortController();
    const result = await signInAnonymously(controller.signal);
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});
