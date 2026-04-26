/**
 * Status Page Component
 *
 * Real-time sync health status for users and operations.
 * Displays transport status, circuit breaker state, and metrics.
 *
 * @module StatusPage
 */

import React, { useState, useEffect } from 'react';
import { getFallbackManager } from '@/lib/transportFallback';
import { getAuditLogger } from '@/lib/auditLogger';
import { getRateLimiter } from '@/lib/rateLimiter';

interface StatusData {
  transport: string;
  circuitState: string;
  syncHealth: 'healthy' | 'degraded' | 'unhealthy';
  auditStats: { queued: number; total: number };
  rateLimitStats: { activeBuckets: number; totalViolations: number };
  lastUpdated: string;
}

export const StatusPage: React.FC = () => {
  const [status, setStatus] = useState<StatusData>({
    transport: 'websocket',
    circuitState: 'closed',
    syncHealth: 'healthy',
    auditStats: { queued: 0, total: 0 },
    rateLimitStats: { activeBuckets: 0, totalViolations: 0 },
    lastUpdated: new Date().toISOString(),
  });

  useEffect(() => {
    const updateStatus = () => {
      const fallbackManager = getFallbackManager();
      const auditLogger = getAuditLogger();
      const rateLimiter = getRateLimiter();

      setStatus({
        transport: fallbackManager.getCurrentTransport(),
        circuitState: fallbackManager.getCircuitState(),
        syncHealth: fallbackManager.getCircuitState() === 'open' ? 'unhealthy' : 'healthy',
        auditStats: auditLogger.getStats(),
        rateLimitStats: rateLimiter.getStats(),
        lastUpdated: new Date().toISOString(),
      });
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return '#22c55e';
      case 'degraded':
        return '#f59e0b';
      case 'unhealthy':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getCircuitColor = (state: string) => {
    switch (state) {
      case 'closed':
        return '#22c55e';
      case 'half_open':
        return '#f59e0b';
      case 'open':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>🟢 Cubit Connect - Sync Status</h1>
      
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginTop: '20px',
        }}
      >
        {/* Overall Health */}
        <div
          style={{
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: getHealthColor(status.syncHealth) + '20',
            border: `2px solid ${getHealthColor(status.syncHealth)}`,
          }}
        >
          <h3>Overall Health</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: getHealthColor(status.syncHealth) }}>
            {status.syncHealth.toUpperCase()}
          </p>
        </div>

        {/* Transport Status */}
        <div
          style={{
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: '#f3f4f6',
            border: '2px solid #d1d5db',
          }}
        >
          <h3>Active Transport</h3>
          <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{status.transport}</p>
          <small>
            {status.transport === 'supabase' ? 'Using Supabase Realtime' : 'Using WebSocket Fallback'}
          </small>
        </div>

        {/* Circuit Breaker */}
        <div
          style={{
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: getCircuitColor(status.circuitState) + '20',
            border: `2px solid ${getCircuitColor(status.circuitState)}`,
          }}
        >
          <h3>Circuit Breaker</h3>
          <p style={{ fontSize: '20px', fontWeight: 'bold', color: getCircuitColor(status.circuitState) }}>
            {status.circuitState.toUpperCase()}
          </p>
          <small>
            {status.circuitState === 'open' && 'Automatic recovery in progress...'}
            {status.circuitState === 'half_open' && 'Testing Supabase connectivity...'}
            {status.circuitState === 'closed' && 'All systems operational'}
          </small>
        </div>

        {/* Audit Stats */}
        <div
          style={{
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: '#f3f4f6',
            border: '2px solid #d1d5db',
          }}
        >
          <h3>Audit Log</h3>
          <p>Queued: {status.auditStats.queued}</p>
          <p>Total Events: {status.auditStats.total}</p>
        </div>

        {/* Rate Limit Stats */}
        <div
          style={{
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: '#f3f4f6',
            border: '2px solid #d1d5db',
          }}
        >
          <h3>Rate Limiting</h3>
          <p>Active Users: {status.rateLimitStats.activeBuckets}</p>
          <p>Violations: {status.rateLimitStats.totalViolations}</p>
        </div>
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#6b7280' }}>
        Last updated: {status.lastUpdated}
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
        <h4>🔍 DevTools Access</h4>
        <p>Open browser console and use:</p>
        <code style={{ display: 'block', padding: '10px', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>
          window.__TRANSPORT_FALLBACK_STATE__<br />
          window.__AUDIT_STATS__()<br />
          window.__RATE_LIMITER__.getStats()
        </code>
      </div>
    </div>
  );
};

export default StatusPage;
