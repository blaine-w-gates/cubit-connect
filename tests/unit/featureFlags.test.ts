/**
 * Unit tests for featureFlags.ts
 *
 * @module featureFlags.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getUseSupabaseSync,
  setUseSupabaseSync,
  toggleUseSupabaseSync,
  resetUseSupabaseSync,
  onFeatureFlagChange,
  emitTelemetry,
  resetDebounceState,
  USE_SUPABASE_SYNC_KEY,
  DEFAULT_USE_SUPABASE_SYNC,
} from '@/lib/featureFlags';

describe('featureFlags', () => {
  // Setup and teardown
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Reset debounce state
    resetDebounceState();

    // Reset telemetry
    if (typeof window !== 'undefined') {
      window.__SYNC_TELEMETRY__ = [];
    }
  });

  afterEach(() => {
    // Clean up
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // getUseSupabaseSync Tests
  // ============================================================================

  describe('getUseSupabaseSync', () => {
    it('should return default value (false) when localStorage is empty', () => {
      const value = getUseSupabaseSync();
      expect(value).toBe(false);
    });

    it('should return value from localStorage when set', () => {
      localStorage.setItem(USE_SUPABASE_SYNC_KEY, 'true');
      const value = getUseSupabaseSync();
      expect(value).toBe(true);
    });

    it('should handle string "false" in localStorage', () => {
      localStorage.setItem(USE_SUPABASE_SYNC_KEY, 'false');
      const value = getUseSupabaseSync();
      expect(value).toBe(false);
    });

    it('should handle string "true" in localStorage', () => {
      localStorage.setItem(USE_SUPABASE_SYNC_KEY, 'true');
      const value = getUseSupabaseSync();
      expect(value).toBe(true);
    });

    it('should return default when localStorage has invalid value', () => {
      localStorage.setItem(USE_SUPABASE_SYNC_KEY, 'invalid');
      const value = getUseSupabaseSync();
      // Invalid values should be falsy
      expect(value).toBeFalsy();
    });
  });

  // ============================================================================
  // setUseSupabaseSync Tests
  // ============================================================================

  describe('setUseSupabaseSync', () => {
    it('should persist value to localStorage', () => {
      const result = setUseSupabaseSync(true);
      expect(result).toBe(true);
      expect(localStorage.getItem(USE_SUPABASE_SYNC_KEY)).toBe('true');
    });

    it('should return false when localStorage is not available', () => {
      // Mock localStorage to throw
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage disabled');
      });

      const result = setUseSupabaseSync(true);
      expect(result).toBe(false);

      mockSetItem.mockRestore();
    });

    it('should emit telemetry event', () => {
      setUseSupabaseSync(true);

      const telemetry = window.__SYNC_TELEMETRY__;
      expect(telemetry).toBeDefined();
      expect(telemetry!.length).toBeGreaterThan(0);
      expect(telemetry!.some((e) => e.event === 'flag_toggled')).toBe(true);
    });

    it('should update window global', () => {
      setUseSupabaseSync(true);
      expect(window.__USE_SUPABASE_SYNC__).toBe(true);
    });

    it('should dispatch custom event', () => {
      const listener = vi.fn();
      window.addEventListener('sync:featureFlagChange', listener);

      setUseSupabaseSync(true);

      expect(listener).toHaveBeenCalled();

      window.removeEventListener('sync:featureFlagChange', listener);
    });
  });

  // ============================================================================
  // toggleUseSupabaseSync Tests
  // ============================================================================

  describe('toggleUseSupabaseSync', () => {
    beforeEach(() => {
      resetDebounceState();
    });

    it('should toggle from false to true', () => {
      localStorage.setItem(USE_SUPABASE_SYNC_KEY, 'false');
      const result = toggleUseSupabaseSync();
      expect(result).toBe(true);
      expect(getUseSupabaseSync()).toBe(true);
    });

    it('should toggle from true to false', () => {
      localStorage.setItem(USE_SUPABASE_SYNC_KEY, 'true');
      const result = toggleUseSupabaseSync();
      expect(result).toBe(false);
      expect(getUseSupabaseSync()).toBe(false);
    });

    it('should toggle from default (false) to true', () => {
      const result = toggleUseSupabaseSync();
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // resetUseSupabaseSync Tests
  // ============================================================================

  describe('resetUseSupabaseSync', () => {
    beforeEach(() => {
      resetDebounceState();
    });

    it('should reset to default value (false)', () => {
      setUseSupabaseSync(true);
      expect(getUseSupabaseSync()).toBe(true);

      resetDebounceState(); // Reset before reset call
      resetUseSupabaseSync();
      expect(getUseSupabaseSync()).toBe(false);
    });
  });

  // ============================================================================
  // onFeatureFlagChange Tests
  // ============================================================================

  describe('onFeatureFlagChange', () => {
    beforeEach(() => {
      resetDebounceState();
    });

    it('should call callback when flag changes', () => {
      const callback = vi.fn();
      const unsubscribe = onFeatureFlagChange(callback);

      setUseSupabaseSync(true);

      expect(callback).toHaveBeenCalledWith(true, false, 'local');

      unsubscribe();
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = onFeatureFlagChange(callback);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('should not call callback after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = onFeatureFlagChange(callback);

      unsubscribe();

      setUseSupabaseSync(true);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // emitTelemetry Tests
  // ============================================================================

  describe('emitTelemetry', () => {
    it('should emit telemetry event', () => {
      emitTelemetry('flag_toggled', { value: true });

      const telemetry = window.__SYNC_TELEMETRY__;
      expect(telemetry).toBeDefined();
      expect(telemetry!.length).toBe(1);
      expect(telemetry![0].event).toBe('flag_toggled');
      expect(telemetry![0].value).toBe(true);
    });

    it('should include timestamp in event', () => {
      const before = Date.now();
      emitTelemetry('supabase_auth_success');
      const after = Date.now();

      const telemetry = window.__SYNC_TELEMETRY__;
      expect(telemetry![0].timestamp).toBeGreaterThanOrEqual(before);
      expect(telemetry![0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should limit telemetry to 100 events', () => {
      // Emit 110 events
      for (let i = 0; i < 110; i++) {
        emitTelemetry('supabase_auth_attempt', { attempt: i });
      }

      const telemetry = window.__SYNC_TELEMETRY__;
      expect(telemetry!.length).toBe(100);
      // Should keep most recent (attempt is passed as part of data object)
      expect(telemetry![telemetry!.length - 1].attempt).toBe(109);
    });
  });

  // ============================================================================
  // Cross-Tab Synchronization Tests
  // ============================================================================

  describe('cross-tab synchronization', () => {
    it('should sync across tabs via storage event', () => {
      const callback = vi.fn();
      const unsubscribe = onFeatureFlagChange(callback);

      // Simulate storage event from another tab
      const storageEvent = new StorageEvent('storage', {
        key: USE_SUPABASE_SYNC_KEY,
        newValue: 'true',
        oldValue: 'false',
      });

      window.dispatchEvent(storageEvent);

      expect(callback).toHaveBeenCalledWith(true, false, 'cross-tab');

      unsubscribe();
    });
  });

  // ============================================================================
  // SSR Safety Tests
  // ============================================================================

  describe('SSR safety', () => {
    it('should handle server-side rendering gracefully', () => {
      // Save original window
      const originalWindow = global.window;

      // @ts-expect-error - Simulating SSR by removing window
      global.window = undefined;

      // Should return default without error
      const value = getUseSupabaseSync();
      expect(value).toBe(DEFAULT_USE_SUPABASE_SYNC);

      // Restore window
      global.window = originalWindow;
    });
  });

  // ============================================================================
  // Debouncing Tests
  // ============================================================================

  describe('debouncing', () => {
    beforeEach(() => {
      resetDebounceState();
    });

    it('should block rapid toggles within 300ms', async () => {
      const result1 = setUseSupabaseSync(true);
      expect(result1).toBe(true);

      // Immediate second toggle should be blocked
      const result2 = setUseSupabaseSync(false);
      expect(result2).toBe(false);

      // Wait for debounce to clear
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    it('should allow toggle after 300ms debounce period', async () => {
      const result1 = setUseSupabaseSync(true);
      expect(result1).toBe(true);

      // Wait 350ms
      await new Promise((resolve) => setTimeout(resolve, 350));

      // Now toggle should work
      const result2 = setUseSupabaseSync(false);
      expect(result2).toBe(true);
    });

    it('should allow rapid toggles with force parameter', () => {
      const result1 = setUseSupabaseSync(true, true);
      expect(result1).toBe(true);

      // Immediate second toggle with force should work
      const result2 = setUseSupabaseSync(false, true);
      expect(result2).toBe(true);
    });

    it('should emit warning when toggle is debounced', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      setUseSupabaseSync(true);
      setUseSupabaseSync(false);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('debounced'));

      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // Data Loss Prevention Tests
  // ============================================================================

  describe('data loss prevention', () => {
    beforeEach(() => {
      // Clear unsaved changes flag and reset debounce
      window.__SYNC_HAS_UNSAVED_CHANGES__ = false;
      resetDebounceState();
    });

    it('should block toggle when unsaved changes exist', () => {
      window.__SYNC_HAS_UNSAVED_CHANGES__ = true;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = setUseSupabaseSync(true);

      expect(result).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should allow toggle with force parameter despite unsaved changes', () => {
      window.__SYNC_HAS_UNSAVED_CHANGES__ = true;

      const result = setUseSupabaseSync(true, true);

      expect(result).toBe(true);
      expect(getUseSupabaseSync()).toBe(true);
    });

    it('should allow toggle when no unsaved changes', () => {
      window.__SYNC_HAS_UNSAVED_CHANGES__ = false;

      const result = setUseSupabaseSync(true);

      expect(result).toBe(true);
      expect(getUseSupabaseSync()).toBe(true);
    });

    it('should emit telemetry when blocked', () => {
      window.__SYNC_HAS_UNSAVED_CHANGES__ = true;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setUseSupabaseSync(true);

      const telemetry = window.__SYNC_TELEMETRY__;
      expect(telemetry?.some((e) => e.context?.error === 'toggle_blocked_unsaved_changes')).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should return current value when toggle blocked', () => {
      window.__SYNC_HAS_UNSAVED_CHANGES__ = true;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const before = getUseSupabaseSync();
      const after = toggleUseSupabaseSync();

      expect(after).toBe(before);

      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // LocalStorage Unavailable Tests
  // ============================================================================

  describe('localStorage unavailable', () => {
    it('should return default when localStorage is disabled', () => {
      // Mock localStorage to be unavailable
      const originalLocalStorage = global.localStorage;
      // @ts-expect-error - Simulating disabled localStorage
      global.localStorage = null;

      const value = getUseSupabaseSync();
      expect(value).toBe(DEFAULT_USE_SUPABASE_SYNC);

      // Restore
      global.localStorage = originalLocalStorage;
    });

    it('should return false from setUseSupabaseSync when localStorage is disabled', () => {
      // Save original localStorage
      const originalLocalStorage = global.localStorage;

      // Mock localStorage to throw on setItem
      global.localStorage = {
        setItem: vi.fn(() => {
          throw new Error('localStorage disabled');
        }),
        getItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };

      const result = setUseSupabaseSync(true);
      expect(result).toBe(false);

      // Restore
      global.localStorage = originalLocalStorage;
    });
  });
});
