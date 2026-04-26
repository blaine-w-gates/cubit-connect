/**
 * Unit tests for sentryIntegration.ts
 *
 * @module sentryIntegration.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSentry, destroySentry, sentry } from '@/lib/sentryIntegration';

describe('sentryIntegration', () => {
  beforeEach(() => {
    destroySentry();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sentry_events');
    }
  });

  afterEach(() => {
    destroySentry();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('initialization', () => {
    it('should initialize sentry', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      sentry.init({
        dsn: 'test-dsn',
        enabled: true,
        environment: 'test',
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SENTRY'));
      expect(getSentry().isEnabled()).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should not capture when disabled', () => {
      sentry.init({ enabled: false });

      const eventId = sentry.captureException(new Error('Test error'));
      expect(eventId).toBe('');
    });
  });

  // ============================================================================
  // Exception Capture Tests
  // ============================================================================

  describe('exception capture', () => {
    it('should capture exception', () => {
      sentry.init({ enabled: true, dsn: 'test' });

      const error = new Error('Test error');
      const eventId = sentry.captureException(error);

      expect(eventId).toContain('sentry_');
    });

    it('should capture exception with extra data', () => {
      sentry.init({ enabled: true, dsn: 'test' });

      const error = new Error('Sync failed');
      sentry.captureException(error, { roomIdHash: 'abc123', transport: 'supabase' });

      const events = getSentry().getStoredEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].extra?.roomIdHash).toBe('abc123');
    });

    it('should store exception with stack trace', () => {
      sentry.init({ enabled: true, dsn: 'test' });

      const error = new Error('Test with stack');
      sentry.captureException(error);

      const events = getSentry().getStoredEvents();
      expect(events[0].exception?.values[0].stacktrace).toBeDefined();
    });
  });

  // ============================================================================
  // Message Capture Tests
  // ============================================================================

  describe('message capture', () => {
    it('should capture message', () => {
      sentry.init({ enabled: true, dsn: 'test' });

      const eventId = sentry.captureMessage('Test message', 'info');

      expect(eventId).toContain('sentry_');
    });

    it('should capture different levels', () => {
      sentry.init({ enabled: true, dsn: 'test' });

      sentry.captureMessage('Info message', 'info');
      sentry.captureMessage('Warning message', 'warning');
      sentry.captureMessage('Error message', 'error');

      const events = getSentry().getStoredEvents();
      expect(events.length).toBe(3);
    });
  });

  // ============================================================================
  // Scope Tests
  // ============================================================================

  describe('scope configuration', () => {
    it('should set user', () => {
      sentry.init({ enabled: true, dsn: 'test' });

      sentry.setUser({ id: 'user-123', email: 'test@example.com' });
      sentry.captureMessage('User action');

      const events = getSentry().getStoredEvents();
      expect(events[0].user?.id).toBe('user-123');
    });

    it('should set tags', () => {
      sentry.init({ enabled: true, dsn: 'test' });

      sentry.setTag('transport', 'supabase');
      sentry.setTag('roomIdHash', 'abc123');
      sentry.captureMessage('Tagged event');

      const events = getSentry().getStoredEvents();
      expect(events[0].tags?.transport).toBe('supabase');
    });

    it('should clear user', () => {
      sentry.init({ enabled: true, dsn: 'test' });

      sentry.setUser({ id: 'user-123' });
      sentry.setUser(null);
      sentry.captureMessage('Anonymous action');

      const events = getSentry().getStoredEvents();
      expect(events[0].user).toBeUndefined();
    });
  });

  // ============================================================================
  // Storage Tests
  // ============================================================================

  describe('event storage', () => {
    it('should limit stored events to 100', () => {
      sentry.init({ enabled: true, dsn: 'test' });

      // Capture 110 events
      for (let i = 0; i < 110; i++) {
        sentry.captureMessage(`Message ${i}`);
      }

      const events = getSentry().getStoredEvents();
      expect(events.length).toBe(100);
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = getSentry();
      const instance2 = getSentry();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', () => {
      const instance1 = getSentry();
      destroySentry();
      const instance2 = getSentry();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ============================================================================
  // DevTools Tests
  // ============================================================================

  describe('devtools integration', () => {
    it('should expose sentry on window', () => {
      expect(window.__SENTRY__).toBeDefined();
    });
  });
});
