/**
 * Unit tests for syncErrorRecovery.ts
 *
 * @module syncErrorRecovery.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleSyncError,
  isRetryableError,
  getUserFriendlyErrorMessage,
  withErrorHandling,
} from '@/lib/syncErrorRecovery';

describe('syncErrorRecovery', () => {
  beforeEach(() => {
    // Clear telemetry
    if (typeof window !== 'undefined') {
      window.__SYNC_TELEMETRY__ = [];
    }
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // handleSyncError Tests
  // ============================================================================

  describe('handleSyncError', () => {
    it('should handle warning severity', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = handleSyncError(
        new Error('Minor issue'),
        'warning',
        { phase: 'test', operation: 'testOp' }
      );

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle error severity', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = handleSyncError(
        new Error('Network timeout'),
        'error',
        { phase: 'auth', operation: 'signIn' }
      );

      expect(result).toBe(true);

      consoleSpy.mockRestore();
      consoleLog.mockRestore();
    });

    it('should emit telemetry for all errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handleSyncError(new Error('Test error'), 'warning', {
        phase: 'test',
        operation: 'testOp',
      });

      const telemetry = window.__SYNC_TELEMETRY__;
      expect(telemetry?.some((e) => e.event === 'error_boundary_triggered')).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle critical severity with rollback', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});

      // Mock alert
      global.alert = vi.fn();

      const result = handleSyncError(
        new Error('Critical failure'),
        'critical',
        { phase: 'auth', operation: 'connect' }
      );

      expect(result).toBe(true);

      consoleSpy.mockRestore();
      localStorageSpy.mockRestore();
    });
  });

  // ============================================================================
  // isRetryableError Tests
  // ============================================================================

  describe('isRetryableError', () => {
    it('should identify timeout as retryable', () => {
      expect(isRetryableError(new Error('Request timeout'))).toBe(true);
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    });

    it('should identify network errors as retryable', () => {
      expect(isRetryableError(new Error('Network error'))).toBe(true);
      expect(isRetryableError(new Error('Failed to fetch'))).toBe(true);
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
    });

    it('should identify rate limit as retryable', () => {
      expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
      expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
    });

    it('should not identify non-retryable errors', () => {
      expect(isRetryableError(new Error('Invalid API key'))).toBe(false);
      expect(isRetryableError(new Error('Not found'))).toBe(false);
    });

    it('should handle non-Error objects', () => {
      expect(isRetryableError('string error')).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  // ============================================================================
  // getUserFriendlyErrorMessage Tests
  // ============================================================================

  describe('getUserFriendlyErrorMessage', () => {
    it('should format timeout errors', () => {
      const msg = getUserFriendlyErrorMessage(new Error('Timeout'));
      expect(msg).toContain('timed out');
    });

    it('should format network errors', () => {
      const msg = getUserFriendlyErrorMessage(new Error('Network error'));
      expect(msg).toContain('Network error');
    });

    it('should format rate limit errors', () => {
      const msg = getUserFriendlyErrorMessage(new Error('429 rate limit'));
      expect(msg).toContain('Too many requests');
    });

    it('should format auth errors', () => {
      const msg = getUserFriendlyErrorMessage(new Error('Unauthorized'));
      expect(msg).toContain('Authentication failed');
    });

    it('should provide default message for unknown errors', () => {
      const msg = getUserFriendlyErrorMessage(new Error('Something weird'));
      expect(msg.length).toBeGreaterThan(0);
    });

    it('should handle non-Error objects', () => {
      const msg = getUserFriendlyErrorMessage('string');
      expect(msg).toContain('unexpected error');
    });
  });

  // ============================================================================
  // withErrorHandling Tests
  // ============================================================================

  describe('withErrorHandling', () => {
    it('should return result on success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const wrapped = withErrorHandling(fn, 'warning', { phase: 'test', operation: 'test' });

      const result = await wrapped();

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });

    it('should return null on error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fn = vi.fn().mockRejectedValue(new Error('Failed'));
      const wrapped = withErrorHandling(fn, 'warning', { phase: 'test', operation: 'test' });

      const result = await wrapped();

      expect(result).toBeNull();
      expect(fn).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should pass arguments to wrapped function', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const wrapped = withErrorHandling(fn, 'warning', { phase: 'test', operation: 'test' });

      await wrapped('arg1', 123, true);

      expect(fn).toHaveBeenCalledWith('arg1', 123, true);
    });
  });
});
