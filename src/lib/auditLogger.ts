/**
 * Audit Logger
 *
 * Comprehensive audit logging for all sync operations.
 * Required for SOC2 compliance and security monitoring.
 *
 * @module auditLogger
 * @version 1.0.0
 */

import { emitTelemetry } from './featureFlags';
import { getSupabaseClient } from './supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Audit event severity
 */
export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Audit event category
 */
export type AuditCategory =
  | 'auth'
  | 'sync'
  | 'transport'
  | 'encryption'
  | 'access'
  | 'admin';

/**
 * Audit event structure
 */
export interface AuditEvent {
  id: string;
  timestamp: number;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;
  userId?: string;
  roomIdHash?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

/**
 * Audit log configuration
 */
export interface AuditConfig {
  enabled: boolean;
  retentionDays: number;
  batchSize: number;
  flushIntervalMs: number;
  endpoint?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: AuditConfig = {
  enabled: true,
  retentionDays: 90,
  batchSize: 100,
  flushIntervalMs: 5000,
};

const MAX_QUEUE_SIZE = 1000;

// ============================================================================
// AUDIT LOGGER CLASS
// ============================================================================

class AuditLogger {
  private config: AuditConfig;
  private eventQueue: AuditEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private eventCount = 0;

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.enabled) {
      this.startFlushTimer();
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (typeof window === 'undefined') return;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  /**
   * Log an audit event
   */
  log(
    category: AuditCategory,
    severity: AuditSeverity,
    action: string,
    details: Record<string, unknown> = {},
    success = true,
    errorMessage?: string
  ): void {
    if (!this.config.enabled) return;

    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      category,
      severity,
      action,
      details,
      success,
      errorMessage,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    };

    // Add to queue
    this.eventQueue.push(event);
    this.eventCount++;

    // Emit telemetry for critical events
    if (severity === 'critical' || severity === 'error') {
      emitTelemetry('error_boundary_triggered', {
        context: {
          auditEvent: event,
        },
      });
    }

    // Flush if queue is full
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }

    // Prevent memory leaks
    if (this.eventQueue.length > MAX_QUEUE_SIZE) {
      this.eventQueue = this.eventQueue.slice(-MAX_QUEUE_SIZE / 2);
    }

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
    }
  }

  /**
   * Log authentication event
   */
  logAuth(action: string, success: boolean, details?: Record<string, unknown>): void {
    this.log('auth', success ? 'info' : 'error', action, details, success);
  }

  /**
   * Log sync operation
   */
  logSync(action: string, roomIdHash: string, success: boolean, details?: Record<string, unknown>): void {
    this.log('sync', success ? 'info' : 'error', action, { roomIdHash: roomIdHash.slice(0, 8), ...details }, success);
  }

  /**
   * Log transport event
   */
  logTransport(action: string, success: boolean, details?: Record<string, unknown>): void {
    this.log('transport', success ? 'info' : 'warning', action, details, success);
  }

  /**
   * Log encryption event
   */
  logEncryption(action: string, success: boolean, details?: Record<string, unknown>): void {
    this.log('encryption', success ? 'info' : 'critical', action, details, success);
  }

  /**
   * Log access control event
   */
  logAccess(action: string, success: boolean, details?: Record<string, unknown>): void {
    this.log('access', success ? 'info' : 'warning', action, details, success);
  }

  /**
   * Flush events to storage (Supabase database + localStorage backup)
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Send to Supabase database (production)
      try {
        const client = getSupabaseClient();
        const records = eventsToFlush.map((event) => ({
          user_id: event.userId,
          action: event.action,
          category: event.category,
          success: event.success,
          details: event.details,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          timestamp: new Date(event.timestamp).toISOString(),
          room_id_hash: event.roomIdHash,
          client_id: undefined, // Would need to pass this in
        }));

        const { error } = await client.from('audit_logs').insert(records);
        if (error) {
          console.error('[AUDIT] Supabase insert failed:', error);
          // Fall back to localStorage
          this.storeInLocalStorage(eventsToFlush);
        }
      } catch (supabaseError) {
        // INTENTIONALLY HANDLING: Supabase unavailable, fall back to localStorage
        // This is graceful degradation - audit continues working locally
        this.storeInLocalStorage(eventsToFlush);
      }

      // Also store in localStorage as backup
      this.storeInLocalStorage(eventsToFlush);

      // Send to custom endpoint if configured
      if (this.config.endpoint) {
        await fetch(this.config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventsToFlush),
        });
      }
    } catch (error) {
      // INTENTIONALLY RECOVERING: Audit flush failure re-queues events
      // Events are not lost, will retry on next flush cycle
      console.error('[AUDIT] Flush failed:', error);
      // Re-queue events
      this.eventQueue.unshift(...eventsToFlush);
    }
  }

  /**
   * Store events in localStorage as backup
   */
  private storeInLocalStorage(events: AuditEvent[]): void {
    if (typeof window === 'undefined') return;

    const existing = JSON.parse(localStorage.getItem('audit_log') || '[]');
    const combined = [...existing, ...events];

    // Retention: keep only last N days
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
    const filtered = combined.filter((e: AuditEvent) => e.timestamp > cutoff);

    // Limit size
    const trimmed = filtered.slice(-1000);
    localStorage.setItem('audit_log', JSON.stringify(trimmed));
  }

  /**
   * Get audit log statistics
   */
  getStats(): { queued: number; total: number; retentionDays: number } {
    return {
      queued: this.eventQueue.length,
      total: this.eventCount,
      retentionDays: this.config.retentionDays,
    };
  }

  /**
   * Export audit log (GDPR compliance)
   */
  async export(userId?: string): Promise<AuditEvent[]> {
    if (typeof window === 'undefined') return [];

    const stored = JSON.parse(localStorage.getItem('audit_log') || '[]');

    if (userId) {
      return stored.filter((e: AuditEvent) => e.userId === userId);
    }

    return stored;
  }

  /**
   * Delete audit events for user (GDPR right to be forgotten)
   */
  async deleteForUser(userId: string): Promise<number> {
    if (typeof window === 'undefined') return 0;

    const stored = JSON.parse(localStorage.getItem('audit_log') || '[]');
    const filtered = stored.filter((e: AuditEvent) => e.userId !== userId);
    const deleted = stored.length - filtered.length;

    localStorage.setItem('audit_log', JSON.stringify(filtered));

    this.log('admin', 'info', 'gdpr_delete', { userId: userId.slice(0, 8), deletedCount: deleted }, true);

    return deleted;
  }

  /**
   * Destroy logger and cleanup
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let auditLoggerInstance: AuditLogger | null = null;

/**
 * Get or create audit logger singleton
 */
export function getAuditLogger(config?: Partial<AuditConfig>): AuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger(config);
  }
  return auditLoggerInstance;
}

/**
 * Destroy audit logger (for testing)
 */
export function destroyAuditLogger(): void {
  auditLoggerInstance?.destroy();
  auditLoggerInstance = null;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const audit = {
  auth: (action: string, success: boolean, details?: Record<string, unknown>) =>
    getAuditLogger().logAuth(action, success, details),
  sync: (action: string, roomIdHash: string, success: boolean, details?: Record<string, unknown>) =>
    getAuditLogger().logSync(action, roomIdHash, success, details),
  transport: (action: string, success: boolean, details?: Record<string, unknown>) =>
    getAuditLogger().logTransport(action, success, details),
  encryption: (action: string, success: boolean, details?: Record<string, unknown>) =>
    getAuditLogger().logEncryption(action, success, details),
  access: (action: string, success: boolean, details?: Record<string, unknown>) =>
    getAuditLogger().logAccess(action, success, details),
};

// ============================================================================
// GLOBAL ACCESS
// ============================================================================

declare global {
  interface Window {
    __AUDIT_LOGGER__?: AuditLogger;
    __AUDIT_STATS__?: () => { queued: number; total: number; retentionDays: number };
  }
}

if (typeof window !== 'undefined') {
  window.__AUDIT_LOGGER__ = getAuditLogger();
  window.__AUDIT_STATS__ = () => getAuditLogger().getStats();
}
