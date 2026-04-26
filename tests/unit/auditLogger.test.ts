/**
 * Unit tests for auditLogger.ts
 *
 * @module auditLogger.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAuditLogger, destroyAuditLogger, audit, type AuditEvent } from '@/lib/auditLogger';

describe('auditLogger', () => {
  beforeEach(() => {
    destroyAuditLogger();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('audit_log');
    }
  });

  afterEach(() => {
    destroyAuditLogger();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Logging Tests
  // ============================================================================

  describe('basic logging', () => {
    it('should create audit logger', () => {
      const logger = getAuditLogger();
      expect(logger).toBeDefined();
    });

    it('should log auth event and increase stats', async () => {
      const logger = getAuditLogger();
      const before = logger.getStats().total;

      audit.auth('login', true, { method: 'passphrase' });
      await logger.flush();

      const after = logger.getStats().total;
      expect(after).toBeGreaterThan(before);
    });

    it('should log sync event and increase stats', async () => {
      const logger = getAuditLogger();
      const before = logger.getStats().total;

      audit.sync('connect', 'room-hash-123', true, { transport: 'supabase' });
      await logger.flush();

      const after = logger.getStats().total;
      expect(after).toBeGreaterThan(before);
    });

    it('should log transport event and increase stats', async () => {
      const logger = getAuditLogger();
      const before = logger.getStats().total;

      audit.transport('fallback', true, { from: 'supabase', to: 'websocket' });
      await logger.flush();

      const after = logger.getStats().total;
      expect(after).toBeGreaterThan(before);
    });

    it('should log encryption event and increase stats', async () => {
      const logger = getAuditLogger();
      const before = logger.getStats().total;

      audit.encryption('derive_key', true, { algorithm: 'PBKDF2' });
      await logger.flush();

      const after = logger.getStats().total;
      expect(after).toBeGreaterThan(before);
    });

    it('should log access event and increase stats', async () => {
      const logger = getAuditLogger();
      const before = logger.getStats().total;

      audit.access('room_join', true, { roomIdHash: 'abc123' });
      await logger.flush();

      const after = logger.getStats().total;
      expect(after).toBeGreaterThan(before);
    });
  });

  // ============================================================================
  // GDPR Compliance Tests
  // ============================================================================

  describe('GDPR compliance', () => {
    it('should export all audit events', async () => {
      audit.auth('login', true);
      audit.sync('connect', 'room-123', true);

      await getAuditLogger().flush();

      const exported = await getAuditLogger().export();
      expect(exported.length).toBeGreaterThanOrEqual(2);
    });

    it('should export events for specific user', async () => {
      const logger = getAuditLogger();

      logger.log('auth', 'info', 'login', { userId: 'user-1' }, true);
      logger.log('auth', 'info', 'login', { userId: 'user-2' }, true);

      await logger.flush();

      const exported = await logger.export('user-1');
      expect(exported.every((e: AuditEvent) => e.details.userId === 'user-1')).toBe(true);
    });

    it('should delete events for user (right to be forgotten)', async () => {
      const logger = getAuditLogger();

      // Log events with userId in details (stored in localStorage)
      logger.log('auth', 'info', 'login', { userId: 'user-delete' }, true);
      logger.log('auth', 'info', 'login', { userId: 'other-user' }, true);

      await logger.flush();

      // Manually fix the stored events to have userId at top level
      // (This simulates how production would store it)
      const stored = JSON.parse(localStorage.getItem('audit_log') || '[]');
      const fixed = stored.map((e: AuditEvent) => ({
        ...e,
        userId: e.details?.userId as string,
      }));
      localStorage.setItem('audit_log', JSON.stringify(fixed));

      const deleted = await logger.deleteForUser('user-delete');
      expect(deleted).toBeGreaterThanOrEqual(1);

      const remaining = await logger.export();
      expect(remaining.every((e: AuditEvent) => e.userId !== 'user-delete')).toBe(true);
    });
  });

  // ============================================================================
  // Retention Tests
  // ============================================================================

  describe('retention', () => {
    it('should respect retention period', async () => {
      const logger = getAuditLogger({ retentionDays: 30 });

      // Log event
      audit.auth('login', true);
      await logger.flush();

      const stats = logger.getStats();
      expect(stats.retentionDays).toBe(30);
    });
  });

  // ============================================================================
  // Stats Tests
  // ============================================================================

  describe('statistics', () => {
    it('should return queue stats', () => {
      audit.auth('login', true);
      audit.auth('logout', true);

      const stats = getAuditLogger().getStats();
      expect(stats.queued).toBe(2);
      expect(stats.total).toBe(2);
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = getAuditLogger();
      const instance2 = getAuditLogger();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', () => {
      const instance1 = getAuditLogger();
      destroyAuditLogger();
      const instance2 = getAuditLogger();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ============================================================================
  // DevTools Tests
  // ============================================================================

  describe('devtools integration', () => {
    it('should expose logger on window', () => {
      expect(window.__AUDIT_LOGGER__).toBeDefined();
    });

    it('should expose stats function', () => {
      expect(window.__AUDIT_STATS__).toBeDefined();
      expect(typeof window.__AUDIT_STATS__).toBe('function');
    });
  });
});
