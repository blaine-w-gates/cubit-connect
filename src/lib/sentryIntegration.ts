/**
 * Sentry Integration
 *
 * Error tracking and performance monitoring integration.
 * Required for production observability.
 *
 * @module sentryIntegration
 * @version 1.0.0
 */

import { emitTelemetry } from './featureFlags';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Sentry configuration
 */
export interface SentryConfig {
  dsn: string;
  environment: string;
  release: string;
  enabled: boolean;
  sampleRate: number;
  beforeSend?: (event: SentryEvent) => SentryEvent | null;
}

/**
 * Sentry event structure (simplified)
 */
export interface SentryEvent {
  event_id: string;
  timestamp: number;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  message?: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename: string;
          function: string;
          lineno: number;
          colno: number;
        }>;
      };
    }>;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: {
    id?: string;
    email?: string;
  };
  contexts?: Record<string, Record<string, unknown>>;
}

/**
 * Sentry scope
 */
export interface SentryScope {
  setTag(key: string, value: string): void;
  setUser(user: { id?: string; email?: string } | null): void;
  setExtra(key: string, value: unknown): void;
}

// ============================================================================
// MOCK IMPLEMENTATION (Production would use @sentry/browser)
// ============================================================================

class MockSentryClient {
  private config: SentryConfig;
  private scope: SentryScope = {
    setTag: (key: string, value: string) => {
      this.tags[key] = value;
    },
    setUser: (user) => {
      this.user = user;
    },
    setExtra: (key: string, value: unknown) => {
      this.extras[key] = value;
    },
  };
  private tags: Record<string, string> = {};
  private user: { id?: string; email?: string } | null = null;
  private extras: Record<string, unknown> = {};

  constructor(config: SentryConfig) {
    this.config = config;
  }

  captureException(error: Error, hint?: { extra?: Record<string, unknown> }): string {
    if (!this.config.enabled) return '';

    const eventId = `sentry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const event: SentryEvent = {
      event_id: eventId,
      timestamp: Date.now(),
      level: 'error',
      message: error.message,
      exception: {
        values: [
          {
            type: error.name,
            value: error.message,
            stacktrace: {
              frames: this.parseStack(error.stack),
            },
          },
        ],
      },
      tags: { ...this.tags },
      extra: { ...this.extras, ...hint?.extra },
      user: this.user || undefined,
      contexts: {
        sync: {
          transport: this.tags.transport || 'unknown',
          roomIdHash: this.tags.roomIdHash,
        },
      },
    };

    // Apply beforeSend hook
    if (this.config.beforeSend) {
      const modified = this.config.beforeSend(event);
      if (!modified) return ''; // Dropped
    }

    // Send to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[SENTRY]', event);
    }

    // Store locally for debugging
    this.storeEvent(event);

    // Also emit telemetry
    emitTelemetry('error_boundary_triggered', {
      context: {
        sentryEventId: eventId,
        error: error.message,
      },
    });

    return eventId;
  }

  captureMessage(message: string, level: SentryEvent['level'] = 'info'): string {
    if (!this.config.enabled) return '';

    const eventId = `sentry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const event: SentryEvent = {
      event_id: eventId,
      timestamp: Date.now(),
      level,
      message,
      tags: { ...this.tags },
      user: this.user || undefined,
    };

    if (this.config.beforeSend) {
      const modified = this.config.beforeSend(event);
      if (!modified) return '';
    }

    this.storeEvent(event);

    return eventId;
  }

  configureScope(callback: (scope: SentryScope) => void): void {
    callback(this.scope);
  }

  private parseStack(stack?: string): Array<{ filename: string; function: string; lineno: number; colno: number }> {
    if (!stack) return [];

    return stack
      .split('\n')
      .slice(1)
      .map((line) => {
        const match = line.match(/at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)/);
        if (match) {
          return {
            function: match[1],
            filename: match[2],
            lineno: parseInt(match[3], 10),
            colno: parseInt(match[4], 10),
          };
        }
        return {
          function: 'unknown',
          filename: line,
          lineno: 0,
          colno: 0,
        };
      });
  }

  private storeEvent(event: SentryEvent): void {
    if (typeof window === 'undefined') return;

    const stored = JSON.parse(localStorage.getItem('sentry_events') || '[]');
    stored.push(event);

    // Keep last 100 events
    const trimmed = stored.slice(-100);
    localStorage.setItem('sentry_events', JSON.stringify(trimmed));
  }
}

// ============================================================================
// SENTRY MANAGER
// ============================================================================

class SentryManager {
  private client: MockSentryClient | null = null;
  private config: SentryConfig | null = null;
  private realSentry: unknown | null = null;

  /**
   * Initialize Sentry
   */
  init(config: Partial<SentryConfig> = {}): void {
    const defaultConfig: SentryConfig = {
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
      environment: process.env.NODE_ENV || 'development',
      release: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      sampleRate: 1.0,
      ...config,
    };

    this.config = defaultConfig;

    // Always use mock in test environment or when DSN not provided
    if (!defaultConfig.enabled || defaultConfig.environment === 'test') {
      this.client = new MockSentryClient(defaultConfig);
    } else {
      // Try to use real Sentry if DSN is configured (async load)
      this.loadRealSentry(defaultConfig);
    }

    // Global error handler (only if real Sentry not loaded)
    if (typeof window !== 'undefined' && !this.realSentry) {
      window.addEventListener('error', (event) => {
        this.captureException(event.error);
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.captureException(new Error(String(event.reason)));
      });
    }
  }

  /**
   * Load real Sentry SDK (async)
   * NOTE: This only runs in production when NEXT_PUBLIC_SENTRY_DSN is set
   */
  private async loadRealSentry(defaultConfig: SentryConfig): Promise<void> {
    // Skip if in test environment
    if (defaultConfig.environment === 'test') {
      this.client = new MockSentryClient(defaultConfig);
      return;
    }

    try {
      // Dynamic import of @sentry/browser (optional dependency)
      // Only runs when DSN is configured
      const moduleName = '@sentry/browser';
      // @ts-ignore - Module may not be installed
      const Sentry = await import(/* webpackIgnore: true */ moduleName);

      if (Sentry && Sentry.init) {
        this.realSentry = Sentry;
        Sentry.init({
          dsn: defaultConfig.dsn,
          environment: defaultConfig.environment,
          release: defaultConfig.release,
          sampleRate: defaultConfig.sampleRate,
          beforeSend: defaultConfig.beforeSend,
        });
      } else {
        throw new Error('Sentry module loaded but init not found');
      }
    } catch (error) {
      // INTENTIONALLY FALLBACK: Sentry loading failure is non-fatal
      // Mock client maintains API compatibility, app continues without error tracking
      this.client = new MockSentryClient(defaultConfig);
    }
  }

  /**
   * Capture exception
   */
  captureException(error: Error, extra?: Record<string, unknown>): string {
    if (!this.client) {
      return '';
    }

    return this.client.captureException(error, { extra });
  }

  /**
   * Capture message
   */
  captureMessage(message: string, level?: SentryEvent['level']): string {
    if (!this.client) {
      return '';
    }

    return this.client.captureMessage(message, level);
  }

  /**
   * Configure scope
   */
  configureScope(callback: (scope: SentryScope) => void): void {
    if (!this.client) {
      return;
    }

    this.client.configureScope(callback);
  }

  /**
   * Set user context
   */
  setUser(user: { id?: string; email?: string } | null): void {
    this.configureScope((scope) => {
      scope.setUser(user);
    });
  }

  /**
   * Set tag
   */
  setTag(key: string, value: string): void {
    this.configureScope((scope) => {
      scope.setTag(key, value);
    });
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.config?.enabled || false;
  }

  /**
   * Get stored events (for debugging)
   */
  getStoredEvents(): SentryEvent[] {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem('sentry_events') || '[]');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let sentryManagerInstance: SentryManager | null = null;

/**
 * Get or create Sentry manager
 */
export function getSentry(): SentryManager {
  if (!sentryManagerInstance) {
    sentryManagerInstance = new SentryManager();
  }
  return sentryManagerInstance;
}

/**
 * Destroy Sentry manager (for testing)
 */
export function destroySentry(): void {
  sentryManagerInstance = null;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const sentry = {
  init: (config?: Partial<SentryConfig>) => getSentry().init(config),
  captureException: (error: Error, extra?: Record<string, unknown>) =>
    getSentry().captureException(error, extra),
  captureMessage: (message: string, level?: SentryEvent['level']) =>
    getSentry().captureMessage(message, level),
  setUser: (user: { id?: string; email?: string } | null) => getSentry().setUser(user),
  setTag: (key: string, value: string) => getSentry().setTag(key, value),
  configureScope: (callback: (scope: SentryScope) => void) => getSentry().configureScope(callback),
};

// ============================================================================
// GLOBAL ACCESS
// ============================================================================

declare global {
  interface Window {
    __SENTRY__?: SentryManager;
  }
}

if (typeof window !== 'undefined') {
  window.__SENTRY__ = getSentry();
}
