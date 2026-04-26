/**
 * Rate Limiting Middleware Tests
 *
 * Verifies M5: API Rate Limiting implementation
 *
 * @module rateLimit.test
 * @security
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  generateRateLimitHeaders,
  extractClientId,
  rateLimitMiddleware,
  generateRateLimitKey,
  DEFAULT_RATE_LIMIT,
  API_RATE_LIMITS,
} from '@/middleware/rateLimit';

describe('Rate Limiting Middleware (M5)', () => {
  beforeEach(() => {
    // Reset rate limit store between tests would go here
    // For now, we use different client IDs per test
  });

  describe('checkRateLimit', () => {
    it('should allow requests under the limit', () => {
      const result = checkRateLimit('test-client-1', 'default');

      expect(result.allowed).toBe(true);
      expect(result.info.limit).toBe(100);
      expect(result.info.remaining).toBeGreaterThan(0);
    });

    it('should track requests per client', () => {
      const clientId = 'test-client-2';

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        checkRateLimit(clientId, 'default');
      }

      const result = checkRateLimit(clientId, 'default');
      expect(result.info.remaining).toBe(100 - 6); // 6th request
    });

    it('should block requests over the limit', () => {
      const clientId = 'test-client-3';

      // Exhaust the limit
      for (let i = 0; i < 100; i++) {
        checkRateLimit(clientId, 'default');
      }

      const result = checkRateLimit(clientId, 'default');
      expect(result.allowed).toBe(false);
      expect(result.info.remaining).toBe(0);
    });

    it('should have different limits per endpoint', () => {
      const healthLimit = API_RATE_LIMITS.health.maxRequests;
      const syncLimit = API_RATE_LIMITS.sync.maxRequests;

      expect(healthLimit).toBe(10);
      expect(syncLimit).toBe(200);
      expect(syncLimit).toBeGreaterThan(healthLimit);
    });
  });

  describe('generateRateLimitHeaders', () => {
    it('should generate all rate limit headers', () => {
      const info = {
        limit: 100,
        remaining: 50,
        resetTime: Date.now() + 60000,
        windowMs: 60000,
      };

      const headers = generateRateLimitHeaders(info);

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('50');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
      expect(headers['X-RateLimit-Window']).toBe('60000');
    });
  });

  describe('extractClientId', () => {
    it('should extract client ID from header', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-client-id': 'client-123' },
      });

      const clientId = extractClientId(request);
      expect(clientId).toBe('client-123');
    });

    it('should use IP from x-forwarded-for as fallback', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const clientId = extractClientId(request);
      expect(clientId).toBe('192.168.1.1');
    });

    it('should generate client ID from user-agent if no other identifier', () => {
      const request = new Request('http://localhost', {
        headers: {
          'user-agent': 'Mozilla/5.0',
          accept: 'text/html',
        },
      });

      const clientId = extractClientId(request);
      expect(clientId).toContain('client:');
    });
  });

  describe('rateLimitMiddleware', () => {
    it('should allow request and return headers', () => {
      const request = new Request('http://localhost/api/test', {
        headers: { 'x-client-id': 'test-middleware-1' },
      });

      const result = rateLimitMiddleware(request, 'default');

      expect(result.allowed).toBe(true);
      expect(result.headers['X-RateLimit-Limit']).toBeDefined();
      expect(result.response).toBeUndefined();
    });

    it('should return 429 response when limit exceeded', () => {
      const clientId = 'test-middleware-2';
      const request = new Request('http://localhost/api/test', {
        headers: { 'x-client-id': clientId },
      });

      // Exhaust limit
      for (let i = 0; i < 100; i++) {
        rateLimitMiddleware(request, 'default');
      }

      const result = rateLimitMiddleware(request, 'default');

      expect(result.allowed).toBe(false);
      expect(result.response).toBeDefined();
      expect(result.response?.status).toBe(429);
    });
  });

  describe('generateRateLimitKey', () => {
    it('should generate consistent keys', () => {
      const key1 = generateRateLimitKey('client-1', 'sync', 'rl:');
      const key2 = generateRateLimitKey('client-1', 'sync', 'rl:');

      expect(key1).toBe(key2);
      expect(key1).toBe('rl:sync:client-1');
    });

    it('should include endpoint in key', () => {
      const key = generateRateLimitKey('client-1', 'health', 'rl:');
      expect(key).toContain('health');
    });
  });

  describe('exports', () => {
    it('should export DEFAULT_RATE_LIMIT', () => {
      expect(DEFAULT_RATE_LIMIT).toBeDefined();
      expect(DEFAULT_RATE_LIMIT.maxRequests).toBe(100);
      expect(DEFAULT_RATE_LIMIT.windowMs).toBe(60000);
    });

    it('should export API_RATE_LIMITS', () => {
      expect(API_RATE_LIMITS).toBeDefined();
      expect(API_RATE_LIMITS.default).toBeDefined();
      expect(API_RATE_LIMITS.health).toBeDefined();
      expect(API_RATE_LIMITS.sync).toBeDefined();
      expect(API_RATE_LIMITS.auth).toBeDefined();
    });
  });
});
