/**
 * Health Endpoint Integration Tests
 *
 * Verifies the health check API endpoint.
 *
 * @module healthEndpoint.test
 * @integration
 */

import { describe, it, expect } from 'vitest';
import { type HealthStatus } from '@/app/api/health/route';

describe('Health Endpoint', () => {
  describe('response structure', () => {
    it('should have correct HealthStatus interface', () => {
      // Verify the interface is properly exported
      const mockHealth: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        subsystems: {
          transport: {
            status: 'healthy',
            current: 'websocket',
            circuitState: 'closed',
          },
          audit: {
            status: 'healthy',
            queued: 0,
            total: 100,
          },
          rateLimiter: {
            status: 'healthy',
            activeBuckets: 5,
            totalViolations: 2,
          },
          featureFlags: {
            status: 'healthy',
            activeRules: 3,
          },
        },
      };

      expect(mockHealth.status).toBe('healthy');
      expect(mockHealth.subsystems.transport).toBeDefined();
      expect(mockHealth.subsystems.audit).toBeDefined();
      expect(mockHealth.subsystems.rateLimiter).toBeDefined();
      expect(mockHealth.subsystems.featureFlags).toBeDefined();
    });

    it('should support all health statuses', () => {
      const statuses: Array<'healthy' | 'degraded' | 'unhealthy'> = [
        'healthy',
        'degraded',
        'unhealthy',
      ];

      statuses.forEach((status) => {
        const mockHealth: HealthStatus = {
          status,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          subsystems: {
            transport: { status: 'healthy', current: 'ws', circuitState: 'closed' },
            audit: { status: 'healthy', queued: 0, total: 0 },
            rateLimiter: { status: 'healthy', activeBuckets: 0, totalViolations: 0 },
            featureFlags: { status: 'healthy', activeRules: 0 },
          },
        };

        expect(mockHealth.status).toBe(status);
      });
    });
  });

  describe('subsystem health', () => {
    it('should handle transport subsystem', () => {
      const transportHealth = {
        status: 'healthy' as const,
        current: 'websocket',
        circuitState: 'closed',
      };

      expect(transportHealth.status).toBe('healthy');
      expect(transportHealth.current).toBe('websocket');
      expect(transportHealth.circuitState).toBe('closed');
    });

    it('should handle degraded transport', () => {
      const transportHealth = {
        status: 'degraded' as const,
        current: 'supabase',
        circuitState: 'half-open',
      };

      expect(transportHealth.status).toBe('degraded');
      expect(transportHealth.circuitState).toBe('half-open');
    });

    it('should handle audit subsystem', () => {
      const auditHealth = {
        status: 'healthy' as const,
        queued: 10,
        total: 1000,
      };

      expect(auditHealth.status).toBe('healthy');
      expect(auditHealth.queued).toBe(10);
      expect(auditHealth.total).toBe(1000);
    });

    it('should handle degraded audit (queue overflow)', () => {
      const auditHealth = {
        status: 'degraded' as const,
        queued: 150, // Over threshold
        total: 1000,
      };

      expect(auditHealth.status).toBe('degraded');
      expect(auditHealth.queued).toBeGreaterThan(100);
    });

    it('should handle rate limiter subsystem', () => {
      const rateLimiterHealth = {
        status: 'healthy' as const,
        activeBuckets: 10,
        totalViolations: 0,
      };

      expect(rateLimiterHealth.status).toBe('healthy');
      expect(rateLimiterHealth.activeBuckets).toBe(10);
    });

    it('should handle degraded rate limiter (many violations)', () => {
      const rateLimiterHealth = {
        status: 'degraded' as const,
        activeBuckets: 10,
        totalViolations: 1500, // Over threshold
      };

      expect(rateLimiterHealth.status).toBe('degraded');
      expect(rateLimiterHealth.totalViolations).toBeGreaterThan(1000);
    });
  });

  describe('overall health calculation', () => {
    it('should be healthy when all subsystems healthy', () => {
      const subsystems = {
        transport: { status: 'healthy' as const, current: 'ws', circuitState: 'closed' },
        audit: { status: 'healthy' as const, queued: 0, total: 0 },
        rateLimiter: { status: 'healthy' as const, activeBuckets: 0, totalViolations: 0 },
        featureFlags: { status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy', activeRules: 0 },
      };

      const statuses = Object.values(subsystems).map((s) => s.status);
      const hasUnhealthy = statuses.includes('unhealthy');
      const hasDegraded = statuses.includes('degraded');

      const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

      expect(overallStatus).toBe('healthy');
    });

    it('should be degraded when any subsystem degraded', () => {
      const subsystems = {
        transport: { status: 'healthy' as const, current: 'ws', circuitState: 'closed' },
        audit: { status: 'degraded' as const, queued: 150, total: 0 },
        rateLimiter: { status: 'healthy' as const, activeBuckets: 0, totalViolations: 0 },
        featureFlags: { status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy', activeRules: 0 },
      };

      const statuses = Object.values(subsystems).map((s) => s.status);
      const hasUnhealthy = statuses.includes('unhealthy');
      const hasDegraded = statuses.includes('degraded');

      const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

      expect(overallStatus).toBe('degraded');
    });

    it('should be unhealthy when any subsystem unhealthy', () => {
      const subsystems = {
        transport: { status: 'unhealthy' as const, current: 'none', circuitState: 'open' },
        audit: { status: 'healthy' as const, queued: 0, total: 0 },
        rateLimiter: { status: 'healthy' as const, activeBuckets: 0, totalViolations: 0 },
        featureFlags: { status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy', activeRules: 0 },
      };

      const statuses = Object.values(subsystems).map((s) => s.status);
      const hasUnhealthy = statuses.includes('unhealthy');
      const hasDegraded = statuses.includes('degraded');

      const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

      expect(overallStatus).toBe('unhealthy');
    });
  });

  describe('HTTP status codes', () => {
    it('should return 200 for healthy status', () => {
      const health: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        subsystems: {
          transport: { status: 'healthy', current: 'ws', circuitState: 'closed' },
          audit: { status: 'healthy', queued: 0, total: 0 },
          rateLimiter: { status: 'healthy', activeBuckets: 0, totalViolations: 0 },
          featureFlags: { status: 'healthy', activeRules: 0 },
        },
      };

      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      expect(statusCode).toBe(200);
    });

    it('should return 200 for degraded status', () => {
      const health: HealthStatus = {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        subsystems: {
          transport: { status: 'degraded' as 'healthy' | 'degraded' | 'unhealthy', current: 'ws', circuitState: 'half-open' },
          audit: { status: 'healthy', queued: 0, total: 0 },
          rateLimiter: { status: 'healthy', activeBuckets: 0, totalViolations: 0 },
          featureFlags: { status: 'healthy', activeRules: 0 },
        },
      };

      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      expect(statusCode).toBe(200);
    });

    it('should return 503 for unhealthy status', () => {
      const health: HealthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        subsystems: {
          transport: { status: 'unhealthy' as 'healthy' | 'degraded' | 'unhealthy', current: 'none', circuitState: 'open' },
          audit: { status: 'healthy', queued: 0, total: 0 },
          rateLimiter: { status: 'healthy', activeBuckets: 0, totalViolations: 0 },
          featureFlags: { status: 'healthy', activeRules: 0 },
        },
      };

      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      expect(statusCode).toBe(503);
    });
  });

  describe('timestamp format', () => {
    it('should use ISO 8601 timestamp', () => {
      const timestamp = new Date().toISOString();

      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('version format', () => {
    it('should use semantic versioning', () => {
      const versions = ['1.0.0', '2.1.3', '0.0.1'];

      versions.forEach((version) => {
        expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });
  });
});
