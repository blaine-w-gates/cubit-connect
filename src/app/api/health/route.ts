/**
 * Health Check API Endpoint
 *
 * Provides comprehensive health status for load balancers and monitoring.
 * Returns JSON with all subsystem statuses.
 *
 * @module api/health/route
 * @production
 */

import { NextResponse } from 'next/server';
import { getFallbackManager } from '@/lib/transportFallback';
import { getAuditLogger } from '@/lib/auditLogger';
import { getRateLimiter } from '@/lib/rateLimiter';
import { getTargetingEngine } from '@/lib/featureFlagTargeting';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  subsystems: {
    transport: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      current: string;
      circuitState: string;
    };
    audit: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      queued: number;
      total: number;
    };
    rateLimiter: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      activeBuckets: number;
      totalViolations: number;
    };
    featureFlags: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      activeRules: number;
    };
  };
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const timestamp = new Date().toISOString();
  const version = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

  try {
    // Get subsystem statuses
    const fallbackManager = getFallbackManager();
    const auditLogger = getAuditLogger();
    const rateLimiter = getRateLimiter();
    const targetingEngine = getTargetingEngine();

    const circuitState = fallbackManager.getCircuitState();
    const auditStats = auditLogger.getStats();
    const rateStats = rateLimiter.getStats();

    // Determine overall health
    const transportHealth = circuitState === 'open' ? 'unhealthy' : 'healthy';
    const auditHealth = auditStats.queued > 100 ? 'degraded' : 'healthy';
    const rateHealth = rateStats.totalViolations > 1000 ? 'degraded' : 'healthy';

    // Overall status is worst of subsystems
    const statuses = [transportHealth, auditHealth, rateHealth];
    const overallStatus = statuses.includes('unhealthy')
      ? 'unhealthy'
      : statuses.includes('degraded')
        ? 'degraded'
        : 'healthy';

    const health: HealthStatus = {
      status: overallStatus,
      timestamp,
      version,
      subsystems: {
        transport: {
          status: transportHealth,
          current: fallbackManager.getCurrentTransport(),
          circuitState,
        },
        audit: {
          status: auditHealth,
          queued: auditStats.queued,
          total: auditStats.total,
        },
        rateLimiter: {
          status: rateHealth,
          activeBuckets: rateStats.activeBuckets,
          totalViolations: rateStats.totalViolations,
        },
        featureFlags: {
          status: 'healthy',
          activeRules: targetingEngine.getStats().totalFlags,
        },
      },
    };

    // Return appropriate HTTP status
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    // INTENTIONALLY HANDLING: Health check should always return a response, even on error
    // Return 503 Service Unavailable to indicate unhealthy state
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp,
        version,
        subsystems: {
          transport: { status: 'unhealthy', current: 'unknown', circuitState: 'unknown' },
          audit: { status: 'unhealthy', queued: 0, total: 0 },
          rateLimiter: { status: 'unhealthy', activeBuckets: 0, totalViolations: 0 },
          featureFlags: { status: 'unhealthy' as const, activeRules: 0 },
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      } as HealthStatus,
      { status: 503 }
    );
  }
}

// Also support HEAD for load balancer health checks
export async function HEAD(): Promise<NextResponse> {
  const fallbackManager = getFallbackManager();
  const circuitState = fallbackManager.getCircuitState();

  const isHealthy = circuitState !== 'open';
  const statusCode = isHealthy ? 200 : 503;

  return new NextResponse(null, { status: statusCode });
}
