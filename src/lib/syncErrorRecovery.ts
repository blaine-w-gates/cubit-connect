/**
 * Sync Error Recovery
 *
 * Provides error handling and automatic rollback capabilities
 * for the Supabase migration.
 *
 * @module syncErrorRecovery
 * @version 1.0.0
 */

import { emitTelemetry } from './featureFlags';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'warning' | 'error' | 'critical';

/**
 * Error context for telemetry
 */
export interface ErrorContext {
  phase: string;
  operation: string;
  attempt?: number;
  [key: string]: unknown;
}

/**
 * Handle Supabase sync errors
 *
 * @param error - The error that occurred
 * @param severity - Error severity level
 * @param context - Additional context
 * @returns true if error was handled, false if should propagate
 */
export function handleSyncError(
  error: unknown,
  severity: ErrorSeverity,
  context: ErrorContext
): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log error with context
  console.error(`[SYNC ERROR] [${severity.toUpperCase()}] ${context.phase} - ${context.operation}:`, {
    message: errorMessage,
    context,
    stack: errorStack,
  });

  // Emit telemetry
  emitTelemetry('error_boundary_triggered', {
    context: {
      severity,
      phase: context.phase,
      operation: context.operation,
      error: errorMessage,
      attempt: context.attempt,
    },
  });

  // Handle based on severity
  switch (severity) {
    case 'warning':
      // Log and continue
      return true;

    case 'error':
      // Log and attempt recovery
      return attemptRecovery(errorMessage, context);

    case 'critical':
      // Log and trigger rollback
      triggerRollback(errorMessage, context);
      return true;

    default:
      return false;
  }
}

/**
 * Attempt to recover from an error
 *
 * @param errorMessage - Error message
 * @param context - Error context
 * @returns true if recovery successful
 */
function attemptRecovery(errorMessage: string, context: ErrorContext): boolean {

  // Specific recovery strategies
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    // Rate limits auto-retry with backoff
    return true;
  }

  if (errorMessage.includes('timeout')) {
    // Timeouts may resolve on retry
    return true;
  }

  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    // Network errors may be transient
    return true;
  }

  // Unknown errors - trigger rollback
  triggerRollback(errorMessage, context);
  return false;
}

/**
 * Trigger automatic rollback to legacy transport
 *
 * @param errorMessage - Error that triggered rollback
 * @param context - Error context
 */
function triggerRollback(errorMessage: string, context: ErrorContext): void {
  console.error('[SYNC ROLLBACK] Critical error - rolling back to WebSocket transport');
  console.error('[SYNC ROLLBACK] Error:', errorMessage);
  console.error('[SYNC ROLLBACK] Context:', context);

  // Emit rollback telemetry
  emitTelemetry('error_boundary_triggered', {
    context: {
      severity: 'critical',
      action: 'rollback_triggered',
      phase: context.phase,
      operation: context.operation,
      error: errorMessage,
    },
  });

  // Auto-rollback: Reset feature flag
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('USE_SUPABASE_SYNC', 'false');

      // Show user notification (if UI is available)
      // eslint-disable-next-line no-alert
      if (typeof alert !== 'undefined') {
        alert('Sync error occurred. Falling back to standard mode. Please reload the page.');
      }
    } catch (e) {
      // INTENTIONALLY LOGGING: Feature flag reset is best-effort
      // If localStorage is full/corrupted, we've already logged the error
      console.error('[SYNC ROLLBACK] Failed to reset feature flag:', e);
    }
  }
}

/**
 * Wrap async function with error handling
 *
 * @param fn - Function to wrap
 * @param severity - Error severity
 * @param context - Error context
 * @returns Wrapped function
 */
export function withErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  severity: ErrorSeverity,
  context: ErrorContext
): (...args: Args) => Promise<T | null> {
  return async (...args: Args): Promise<T | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      // INTENTIONALLY HANDLING: Centralized error processing
      // Logs to audit, sends alerts if critical, returns null for graceful degradation
      handleSyncError(error, severity, context);
      return null;
    }
  };
}

/**
 * Check if error is retryable
 *
 * @param error - Error to check
 * @returns true if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // Retryable errors
  const retryablePatterns = [
    'timeout',
    'network',
    'fetch',
    '429',
    'rate limit',
    'temporarily unavailable',
    'econnreset',
    'etimedout',
    'econnrefused',
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Get user-friendly error message
 *
 * @param error - Error to format
 * @returns User-friendly message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred. Please try again.';
  }

  const message = error.message.toLowerCase();

  if (message.includes('timeout')) {
    return 'Connection timed out. Please check your internet connection and try again.';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your internet connection.';
  }

  if (message.includes('429') || message.includes('rate limit')) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  if (message.includes('unauthorized') || message.includes('auth')) {
    return 'Authentication failed. Please reload the page and try again.';
  }

  return 'Sync error occurred. The app has been reset to safe mode. Please reload the page.';
}
