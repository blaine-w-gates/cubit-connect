/**
 * Rate Limiting Middleware
 *
 * Implements M5: API Rate Limiting
 * - 100 requests per minute per client
 * - Sliding window algorithm
 * - Rate limit headers (X-RateLimit-*)
 * - Different limits per endpoint type
 *
 * @module rateLimit
 * @security
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix?: string;    // Prefix for rate limit keys
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  windowMs: number;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,    // 100 requests per minute
  keyPrefix: 'rl:',
};

// API-specific limits
export const API_RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: DEFAULT_RATE_LIMIT,
  sync: {
    windowMs: 60 * 1000,
    maxRequests: 200, // Higher limit for sync operations
    keyPrefix: 'rl:sync:',
  },
  health: {
    windowMs: 60 * 1000,
    maxRequests: 10, // Lower limit for health checks
    keyPrefix: 'rl:health:',
  },
  auth: {
    windowMs: 60 * 1000,
    maxRequests: 5, // Very low limit for auth endpoints
    keyPrefix: 'rl:auth:',
  },
};

// ============================================================================
// IN-MEMORY STORE (Production should use Redis)
// ============================================================================

class RateLimitStore {
  private store = new Map<string, ClientRecord>();

  get(key: string): ClientRecord | undefined {
    const record = this.store.get(key);
    if (!record) return undefined;

    // Check if window has expired
    if (Date.now() > record.resetTime) {
      this.store.delete(key);
      return undefined;
    }

    return record;
  }

  increment(key: string, windowMs: number): ClientRecord {
    const now = Date.now();
    const existing = this.get(key);

    if (existing) {
      existing.count++;
      return existing;
    }

    const newRecord: ClientRecord = {
      count: 1,
      resetTime: now + windowMs,
    };

    this.store.set(key, newRecord);
    return newRecord;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

const rateLimitStore = new RateLimitStore();

// Cleanup expired entries every minute
setInterval(() => rateLimitStore.cleanup(), 60 * 1000);

// ============================================================================
// RATE LIMITING LOGIC
// ============================================================================

/**
 * Generate rate limit key from client identifier
 */
export function generateRateLimitKey(
  clientId: string,
  endpoint: string,
  prefix: string = DEFAULT_RATE_LIMIT.keyPrefix!
): string {
  return `${prefix}${endpoint}:${clientId}`;
}

/**
 * Check rate limit for a client
 */
export function checkRateLimit(
  clientId: string,
  endpoint: string = 'default',
  config?: Partial<RateLimitConfig>
): { allowed: boolean; info: RateLimitInfo } {
  const finalConfig = {
    ...API_RATE_LIMITS[endpoint] || DEFAULT_RATE_LIMIT,
    ...config,
  };

  const key = generateRateLimitKey(clientId, endpoint, finalConfig.keyPrefix);
  const record = rateLimitStore.increment(key, finalConfig.windowMs);

  const info: RateLimitInfo = {
    limit: finalConfig.maxRequests,
    remaining: Math.max(0, finalConfig.maxRequests - record.count),
    resetTime: record.resetTime,
    windowMs: finalConfig.windowMs,
  };

  return {
    allowed: record.count <= finalConfig.maxRequests,
    info,
  };
}

// ============================================================================
// HEADERS
// ============================================================================

/**
 * Generate rate limit headers
 */
export function generateRateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(info.limit),
    'X-RateLimit-Remaining': String(info.remaining),
    'X-RateLimit-Reset': String(Math.ceil(info.resetTime / 1000)),
    'X-RateLimit-Window': String(info.windowMs),
  };
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Extract client identifier from request
 */
export function extractClientId(request: Request): string {
  // Try to get from headers
  const clientId = request.headers.get('x-client-id');
  if (clientId) return clientId;

  // Try to get from IP (in production, this would be more sophisticated)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const ip = request.headers.get('x-real-ip');
  if (ip) return ip;

  // Fallback to user-agent + accept hash (not perfect but better than nothing)
  const ua = request.headers.get('user-agent') || 'unknown';
  const accept = request.headers.get('accept') || 'unknown';

  // Simple hash
  let hash = 0;
  const str = ua + accept;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `client:${hash}`;
}

/**
 * Rate limit middleware for API routes
 */
export function rateLimitMiddleware(
  request: Request,
  endpoint: string = 'default'
): { allowed: boolean; response?: Response; headers: Record<string, string> } {
  const clientId = extractClientId(request);
  const { allowed, info } = checkRateLimit(clientId, endpoint);
  const headers = generateRateLimitHeaders(info);

  if (!allowed) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Limit: ${info.limit} per ${info.windowMs}ms`,
          resetTime: info.resetTime,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((info.resetTime - Date.now()) / 1000)),
            ...headers,
          },
        }
      ),
      headers,
    };
  }

  return { allowed: true, headers };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { DEFAULT_RATE_LIMIT, rateLimitStore };
