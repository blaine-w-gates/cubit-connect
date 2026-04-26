/**
 * Structured Logging Utility
 *
 * Production-ready logging with level control and structured output.
 * All debug logging disabled in production builds.
 *
 * @module logger
 * @production
 */

// ============================================================================
// LOG LEVELS
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const CURRENT_LOG_LEVEL: LogLevel =
  process.env.NODE_ENV === 'production' ? 'error' : 'info';

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
};

// ============================================================================
// LOGGER INTERFACE
// ============================================================================

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
}

// ============================================================================
// PRODUCTION LOGGER
// ============================================================================

class ProductionLogger implements Logger {
  debug(): void {
    // Debug logging disabled in production - parameters intentionally ignored
  }

  info(message: string, context?: LogContext): void {
    if (!shouldLog('info')) return;
    console.log(`[INFO] ${message}`, context ? JSON.stringify(context) : '');
  }

  warn(message: string, context?: LogContext): void {
    if (!shouldLog('warn')) return;
  }

  error(message: string, context?: LogContext): void {
    if (!shouldLog('error')) return;
    console.error(`[ERROR] ${message}`, context ? JSON.stringify(context) : '');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const logger: Logger = new ProductionLogger();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a namespaced logger for a specific module
 */
export function createLogger(namespace: string): Logger {
  return {
    debug: (message: string, context?: LogContext) =>
      logger.debug(`[${namespace}] ${message}`, context),
    info: (message: string, context?: LogContext) =>
      logger.info(`[${namespace}] ${message}`, context),
    warn: (message: string, context?: LogContext) =>
      logger.warn(`[${namespace}] ${message}`, context),
    error: (message: string, context?: LogContext) =>
      logger.error(`[${namespace}] ${message}`, context),
  };
}

export default logger;
