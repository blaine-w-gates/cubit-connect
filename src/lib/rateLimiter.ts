/**
 * Rate Limiter
 *
 * Per-user rate limiting for sync operations.
 * Prevents abuse and ensures fair resource usage.
 *
 * @module rateLimiter
 * @version 1.0.0
 */

import { emitTelemetry } from './featureFlags';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstSize: number;
  windowMs: number;
}

/**
 * Rate limit status
 */
export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

/**
 * User rate limit bucket
 */
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  violations: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: RateLimitConfig = {
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  burstSize: 10,
  windowMs: 60000, // 1 minute
};

const TOKEN_REFILL_RATE = 1; // tokens per second

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

export class RateLimiter {
  private config: RateLimitConfig;
  private buckets: Map<string, RateLimitBucket> = new Map();
  private violationCounts: Map<string, number> = new Map();

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if request is allowed
   */
  checkLimit(userId: string, action: string): RateLimitStatus {
    const now = Date.now();
    const key = `${userId}:${action}`;

    // Get or create bucket
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: this.config.burstSize,
        lastRefill: now,
        violations: 0,
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens
    const timePassed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = Math.floor(timePassed * TOKEN_REFILL_RATE);
    bucket.tokens = Math.min(
      bucket.tokens + tokensToAdd,
      this.config.requestsPerMinute
    );
    bucket.lastRefill = now;

    // Check if allowed
    const allowed = bucket.tokens >= 1;

    if (allowed) {
      bucket.tokens--;
    } else {
      // Track violation
      bucket.violations++;
      const totalViolations = (this.violationCounts.get(userId) || 0) + 1;
      this.violationCounts.set(userId, totalViolations);

      // Emit telemetry for excessive violations
      if (totalViolations > 10) {
        emitTelemetry('error_boundary_triggered', {
          context: {
            error: 'rate_limit_exceeded',
            userId: userId.slice(0, 8),
            action,
            violations: totalViolations,
          },
        });
      }
    }

    // Calculate reset time
    const tokensNeeded = 1 - bucket.tokens;
    const resetTime = now + Math.max(0, tokensNeeded * 1000 / TOKEN_REFILL_RATE);

    return {
      allowed,
      remaining: Math.floor(bucket.tokens),
      resetTime,
      limit: this.config.requestsPerMinute,
    };
  }

  /**
   * Consume one token (throws if not allowed)
   */
  consume(userId: string, action: string): void {
    const status = this.checkLimit(userId, action);

    if (!status.allowed) {
      const error = new Error(
        `Rate limit exceeded. Try again in ${Math.ceil(
          (status.resetTime - Date.now()) / 1000
        )} seconds.`
      );
      error.name = 'RateLimitError';
      throw error;
    }
  }

  /**
   * Get violation count for user
   */
  getViolations(userId: string): number {
    return this.violationCounts.get(userId) || 0;
  }

  /**
   * Reset violations for user
   */
  resetViolations(userId: string): void {
    this.violationCounts.delete(userId);

    // Reset all buckets for this user
    for (const [key, bucket] of this.buckets.entries()) {
      if (key.startsWith(`${userId}:`)) {
        bucket.violations = 0;
        bucket.tokens = this.config.burstSize;
      }
    }
  }

  /**
   * Get limit status without consuming
   */
  getStatus(userId: string, action: string): RateLimitStatus {
    const key = `${userId}:${action}`;
    const bucket = this.buckets.get(key);

    if (!bucket) {
      return {
        allowed: true,
        remaining: this.config.burstSize,
        resetTime: Date.now(),
        limit: this.config.requestsPerMinute,
      };
    }

    return {
      allowed: bucket.tokens >= 1,
      remaining: Math.floor(bucket.tokens),
      resetTime: Date.now() + (1 - bucket.tokens) * 1000 / TOKEN_REFILL_RATE,
      limit: this.config.requestsPerMinute,
    };
  }

  /**
   * Cleanup old buckets (memory management)
   */
  cleanup(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAgeMs) {
        this.buckets.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get stats
   */
  getStats(): {
    activeBuckets: number;
    totalViolations: number;
    config: RateLimitConfig;
  } {
    let totalViolations = 0;
    for (const count of this.violationCounts.values()) {
      totalViolations += count;
    }

    return {
      activeBuckets: this.buckets.size,
      totalViolations,
      config: this.config,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let rateLimiterInstance: RateLimiter | null = null;

/**
 * Get or create rate limiter
 */
export function getRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter(config);
  }
  return rateLimiterInstance;
}

/**
 * Destroy rate limiter (for testing)
 */
export function destroyRateLimiter(): void {
  rateLimiterInstance = null;
}

// ============================================================================
// GLOBAL ACCESS
// ============================================================================

declare global {
  interface Window {
    __RATE_LIMITER__?: RateLimiter;
  }
}

if (typeof window !== 'undefined') {
  window.__RATE_LIMITER__ = getRateLimiter();
}
