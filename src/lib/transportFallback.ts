/**
 * Transport Fallback Manager
 *
 * Automatically falls back to WebSocket transport when Supabase fails.
 * Implements circuit breaker pattern and health monitoring.
 *
 * @module transportFallback
 * @version 1.0.0
 */

import { emitTelemetry } from './featureFlags';
import { sendCriticalAlert, sendWarningAlert } from './alerting';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Transport type
 */
export type TransportType = 'supabase' | 'websocket';

/**
 * Fallback reason
 */
export type FallbackReason =
  | 'connection_failed'
  | 'auth_failed'
  | 'rate_limited'
  | 'timeout'
  | 'circuit_open'
  | 'manual_override';

/**
 * Transport health status
 */
export type TransportHealth = 'healthy' | 'degraded' | 'unhealthy' | 'circuit_open';

/**
 * Fallback event details
 */
export interface FallbackEvent {
  from: TransportType;
  to: TransportType;
  reason: FallbackReason;
  timestamp: number;
  attemptCount: number;
  errorMessage?: string;
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half_open';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

/**
 * Circuit breaker for Supabase transport
 */
class TransportCircuitBreaker {
  private state: CircuitBreakerState = {
    failureCount: 0,
    lastFailureTime: 0,
    state: 'closed',
  };

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    if (this.state.state === 'half_open') {
      this.state.state = 'closed';
      this.state.failureCount = 0;
    } else if (this.state.state === 'closed') {
      this.state.failureCount = 0;
    }
  }

  /**
   * Record a failure
   * @returns true if circuit is now open
   */
  recordFailure(): boolean {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    if (this.state.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
      this.state.state = 'open';
      console.error(`[CIRCUIT BREAKER] OPENED after ${this.state.failureCount} failures`);

      emitTelemetry('error_boundary_triggered', {
        context: {
          error: 'circuit_breaker_opened',
          failureCount: this.state.failureCount,
        },
      });

      return true;
    }

    return false;
  }

  /**
   * Check if operation is allowed
   */
  canExecute(): boolean {
    if (this.state.state === 'closed') {
      return true;
    }

    if (this.state.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.state.lastFailureTime;
      if (timeSinceLastFailure >= CIRCUIT_BREAKER_TIMEOUT) {
        this.state.state = 'half_open';
        return true;
      }
      return false;
    }

    // Half-open: allow one test operation
    return true;
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState['state'] {
    return this.state.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.state.failureCount;
  }

  /**
   * Manual reset (for testing or admin override)
   */
  reset(): void {
    this.state = {
      failureCount: 0,
      lastFailureTime: 0,
      state: 'closed',
    };
  }
}

// ============================================================================
// TRANSPORT FALLBACK MANAGER
// ============================================================================

/**
 * Manages transport fallback and health monitoring
 */
export class TransportFallbackManager {
  private circuitBreaker = new TransportCircuitBreaker();
  private currentTransport: TransportType = 'websocket'; // Default to safe option
  private fallbackHistory: FallbackEvent[] = [];
  private onFallback?: (event: FallbackEvent) => void;
  private healthCheckTimer?: NodeJS.Timeout;

  /**
   * Create fallback manager
   * @param onFallback - Callback when fallback occurs
   */
  constructor(onFallback?: (event: FallbackEvent) => void) {
    this.onFallback = onFallback;
    this.startHealthChecks();
  }

  /**
   * Get current transport type
   */
  getCurrentTransport(): TransportType {
    return this.currentTransport;
  }

  /**
   * Set current transport type (for testing)
   * @internal
   */
  setCurrentTransport(transport: TransportType): void {
    this.currentTransport = transport;
  }

  /**
   * Check if Supabase is available (circuit closed)
   */
  isSupabaseAvailable(): boolean {
    return this.circuitBreaker.canExecute();
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): string {
    return this.circuitBreaker.getState();
  }

  /**
   * Record Supabase success
   */
  recordSupabaseSuccess(): void {
    this.circuitBreaker.recordSuccess();
    if (this.currentTransport !== 'supabase') {
      // Consider switching back to Supabase if it's working
      this.attemptSupabaseRecovery();
    }
  }

  /**
   * Record Supabase failure
   * @param error - Error that occurred
   * @returns true if fallback was triggered
   */
  recordSupabaseFailure(error: Error): boolean {
    const circuitOpened = this.circuitBreaker.recordFailure();

    if (circuitOpened) {
      // Alert that circuit breaker has opened
      sendCriticalAlert('circuit_breaker', 'Circuit breaker opened - Supabase transport disabled', {
        failureCount: this.circuitBreaker.getFailureCount(),
        lastFailureTime: new Date().toISOString(),
        error: error.message,
      });

      if (this.currentTransport === 'supabase') {
        this.triggerFallback('circuit_open', error.message);
        return true;
      }
    }

    return false;
  }

  /**
   * Manually trigger fallback
   * @param reason - Why fallback is being triggered
   */
  manualFallback(reason: FallbackReason): void {
    this.triggerFallback(reason, 'Manual override');
  }

  /**
   * Attempt to switch back to Supabase
   */
  private attemptSupabaseRecovery(): void {
    if (this.circuitBreaker.canExecute()) {

      // Emit telemetry
      emitTelemetry('transport_switched', {
        from: 'websocket',
        to: 'supabase',
        context: { reason: 'recovery_attempt' },
      });

      // Note: Actual switch happens in useAppStore when next connection is made
      // This just signals intent
    }
  }

  private onAlert?: (alert: { type: string; severity: string; message: string; timestamp: number }) => void;

  /**
   * Set alert callback for operations team
   */
  setAlertCallback(callback: (alert: { type: string; severity: string; message: string; timestamp: number }) => void): void {
    this.onAlert = callback;
  }

  /**
   * Send alert to operations team
   */
  private sendAlert(type: string, severity: string, message: string): void {
    const alert = {
      type,
      severity,
      message,
      timestamp: Date.now(),
    };

    // Emit telemetry
    emitTelemetry('error_boundary_triggered', {
      context: {
        alert,
      },
    });

    // Call alert handler if configured
    this.onAlert?.(alert);

    // Console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ALERT] ${severity}: ${type} - ${message}`);
    }
  }

  /**
   * Trigger fallback to WebSocket
   */
  private triggerFallback(reason: FallbackReason, errorMessage: string): void {
    const event: FallbackEvent = {
      from: 'supabase',
      to: 'websocket',
      reason,
      timestamp: Date.now(),
      attemptCount: this.circuitBreaker.getFailureCount(),
      errorMessage,
    };

    this.fallbackHistory.push(event);
    this.currentTransport = 'websocket';

    console.error('[FALLBACK MANAGER] Fallback triggered:', {
      reason,
      errorMessage,
      attemptCount: event.attemptCount,
    });

    // Send alert to operations team via alerting module
    const alertMessage = `Fallback to WebSocket: ${reason} - ${errorMessage}`;
    if (reason === 'circuit_open') {
      sendCriticalAlert('transport_fallback', alertMessage, {
        reason,
        errorMessage,
        attemptCount: event.attemptCount,
        from: 'supabase',
        to: 'websocket',
      });
    } else {
      sendWarningAlert('transport_fallback', alertMessage, {
        reason,
        errorMessage,
        attemptCount: event.attemptCount,
        from: 'supabase',
        to: 'websocket',
      });
    }

    // Emit telemetry
    emitTelemetry('transport_switched', {
      from: 'supabase',
      to: 'websocket',
      context: {
        reason,
        errorMessage,
        attemptCount: event.attemptCount,
      },
    });

    // Notify callback
    this.onFallback?.(event);

    // Reset feature flag (emergency rollback)
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('USE_SUPABASE_SYNC', 'false');
      } catch (e) {
        // INTENTIONALLY LOGGING: Feature flag reset is best-effort emergency rollback
        // If localStorage fails, we've already triggered fallback mode in memory
        console.error('[FALLBACK MANAGER] Failed to reset feature flag:', e);
      }
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (typeof window === 'undefined') return;

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): void {
    const circuitState = this.circuitBreaker.getState();
    const health: TransportHealth =
      circuitState === 'open'
        ? 'circuit_open'
        : this.circuitBreaker.getFailureCount() > 0
          ? 'degraded'
          : 'healthy';

    // Emit health metric
    emitTelemetry('supabase_auth_success', {
      context: {
        healthCheck: true,
        circuitState,
        transport: this.currentTransport,
        health,
      },
    });
  }

  /**
   * Get fallback history
   */
  getFallbackHistory(): FallbackEvent[] {
    return [...this.fallbackHistory];
  }

  /**
   * Reset circuit breaker (for testing or admin recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Destroy manager and cleanup
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let fallbackManagerInstance: TransportFallbackManager | null = null;

/**
 * Get or create fallback manager singleton
 */
export function getFallbackManager(onFallback?: (event: FallbackEvent) => void): TransportFallbackManager {
  if (!fallbackManagerInstance) {
    fallbackManagerInstance = new TransportFallbackManager(onFallback);
  }
  return fallbackManagerInstance;
}

/**
 * Destroy fallback manager (for testing)
 */
export function destroyFallbackManager(): void {
  fallbackManagerInstance?.destroy();
  fallbackManagerInstance = null;
}

// ============================================================================
// GLOBAL ACCESS (DevTools)
// ============================================================================

declare global {
  interface Window {
    __TRANSPORT_FALLBACK_MANAGER__?: TransportFallbackManager;
    __TRANSPORT_FALLBACK_STATE__?: {
      currentTransport: TransportType;
      circuitState: string;
      fallbackCount: number;
    };
  }
}

// Expose for debugging
if (typeof window !== 'undefined') {
  window.__TRANSPORT_FALLBACK_MANAGER__ = getFallbackManager();

  // Reactive state getter
  Object.defineProperty(window, '__TRANSPORT_FALLBACK_STATE__', {
    get: () => {
      const manager = getFallbackManager();
      return {
        currentTransport: manager.getCurrentTransport(),
        circuitState: manager.getCircuitState(),
        fallbackCount: manager.getFallbackHistory().length,
      };
    },
  });
}
