/**
 * Unit tests for transportFallback.ts
 *
 * @module transportFallback.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TransportFallbackManager,
  getFallbackManager,
  destroyFallbackManager,
  type FallbackEvent,
} from '@/lib/transportFallback';

describe('transportFallback', () => {
  let manager: TransportFallbackManager;
  let mockOnFallback: (event: FallbackEvent) => void;

  beforeEach(() => {
    destroyFallbackManager();
    mockOnFallback = vi.fn();
    manager = new TransportFallbackManager(mockOnFallback);

    // Clear telemetry
    if (typeof window !== 'undefined') {
      window.__SYNC_TELEMETRY__ = [];
    }
  });

  afterEach(() => {
    manager.destroy();
    destroyFallbackManager();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Circuit Breaker Tests
  // ============================================================================

  describe('circuit breaker', () => {
    it('should start with closed circuit', () => {
      expect(manager.getCircuitState()).toBe('closed');
      expect(manager.isSupabaseAvailable()).toBe(true);
    });

    it('should track failures', () => {
      manager.recordSupabaseFailure(new Error('Test error'));
      expect(manager.getCircuitState()).toBe('closed'); // Still closed after 1 failure
    });

    it('should open circuit after 5 failures', () => {
      // Set transport to supabase for fallback to trigger
      manager.setCurrentTransport('supabase');

      // Record 5 failures
      for (let i = 0; i < 5; i++) {
        const triggered = manager.recordSupabaseFailure(new Error(`Error ${i}`));
        if (i < 4) {
          expect(triggered).toBe(false);
        } else {
          expect(triggered).toBe(true); // 5th failure triggers fallback
        }
      }

      expect(manager.getCircuitState()).toBe('open');
      expect(manager.isSupabaseAvailable()).toBe(false);
    });

    it('should block operations when circuit is open', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        manager.recordSupabaseFailure(new Error(`Error ${i}`));
      }

      expect(manager.isSupabaseAvailable()).toBe(false);
    });

    it('should reset circuit breaker', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        manager.recordSupabaseFailure(new Error(`Error ${i}`));
      }

      expect(manager.getCircuitState()).toBe('open');

      manager.resetCircuitBreaker();

      expect(manager.getCircuitState()).toBe('closed');
      expect(manager.isSupabaseAvailable()).toBe(true);
    });

    it('should record success and reset failure count', () => {
      manager.recordSupabaseFailure(new Error('Test error'));
      manager.recordSupabaseSuccess();

      // After success, we should still be able to use Supabase
      expect(manager.isSupabaseAvailable()).toBe(true);
    });
  });

  // ============================================================================
  // Fallback Tests
  // ============================================================================

  describe('fallback', () => {
    it('should start with websocket as default transport', () => {
      expect(manager.getCurrentTransport()).toBe('websocket');
    });

    it('should trigger fallback when circuit opens', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Set transport to supabase first
      manager.setCurrentTransport('supabase');

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        manager.recordSupabaseFailure(new Error(`Error ${i}`));
      }

      expect(manager.getCurrentTransport()).toBe('websocket');
      expect(mockOnFallback).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should track fallback history', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Set transport to supabase first
      manager.setCurrentTransport('supabase');

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        manager.recordSupabaseFailure(new Error(`Error ${i}`));
      }

      const history = manager.getFallbackHistory();
      expect(history.length).toBe(1);
      expect(history[0].from).toBe('supabase');
      expect(history[0].to).toBe('websocket');
      expect(history[0].reason).toBe('circuit_open');

      consoleSpy.mockRestore();
    });

    it('should support manual fallback', () => {
      manager.manualFallback('manual_override');

      const history = manager.getFallbackHistory();
      expect(history.length).toBe(1);
      expect(history[0].reason).toBe('manual_override');
      expect(mockOnFallback).toHaveBeenCalled();
    });

    it('should emit telemetry on fallback', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Set transport to supabase first
      manager.setCurrentTransport('supabase');

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        manager.recordSupabaseFailure(new Error(`Error ${i}`));
      }

      const telemetry = window.__SYNC_TELEMETRY__;
      expect(telemetry?.some((e) => e.event === 'transport_switched')).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should reset feature flag on fallback', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');

      // Set transport to supabase first
      manager.setCurrentTransport('supabase');

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        manager.recordSupabaseFailure(new Error(`Error ${i}`));
      }

      expect(localStorageSpy).toHaveBeenCalledWith('USE_SUPABASE_SYNC', 'false');

      consoleSpy.mockRestore();
      localStorageSpy.mockRestore();
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getFallbackManager();
      const instance2 = getFallbackManager();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', () => {
      const instance1 = getFallbackManager();
      destroyFallbackManager();
      const instance2 = getFallbackManager();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ============================================================================
  // DevTools Integration Tests
  // ============================================================================

  describe('devtools integration', () => {
    it('should expose manager on window', () => {
      expect(window.__TRANSPORT_FALLBACK_MANAGER__).toBeDefined();
    });

    it('should expose reactive state on window', () => {
      const state = window.__TRANSPORT_FALLBACK_STATE__;
      expect(state).toBeDefined();
      expect(state?.currentTransport).toBeDefined();
      expect(state?.circuitState).toBeDefined();
      expect(state?.fallbackCount).toBeDefined();
    });
  });
});
