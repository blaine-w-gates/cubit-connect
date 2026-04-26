/**
 * Sync Performance Monitor
 *
 * Tracks performance metrics for sync operations.
 * Provides latency measurements, throughput stats, and SLO tracking.
 *
 * @module syncPerformanceMonitor
 * @production
 */

import { audit } from './auditLogger';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_HISTORY_SIZE = 1000;
const REPORT_INTERVAL_MS = 60000; // 1 minute

// SLO Targets (Service Level Objectives)
export const SLO_TARGETS = {
  connectLatencyMs: 5000,        // 5 seconds
  syncLatencyMs: 1000,           // 1 second
  checkpointSaveMs: 3000,        // 3 seconds
  broadcastLatencyMs: 500,       // 500ms
  availability: 0.995,           // 99.5%
};

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceMetric {
  operation: 'connect' | 'sync' | 'checkpoint' | 'broadcast' | 'fallback';
  latencyMs: number;
  success: boolean;
  timestamp: number;
  roomHash?: string;
  details?: Record<string, unknown>;
}

export interface PerformanceStats {
  operation: string;
  count: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  sloCompliance: number; // 0-1, percentage within SLO target
}

export interface SyncHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  overallSloCompliance: number;
  recentErrors: number;
  lastUpdated: number;
}

// ============================================================================
// PERFORMANCE MONITOR
// ============================================================================

class SyncPerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private reportInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startReporting();
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this.metrics.push(fullMetric);

    // Prevent memory leaks
    if (this.metrics.length > MAX_HISTORY_SIZE) {
      this.metrics = this.metrics.slice(-MAX_HISTORY_SIZE / 2);
    }

    // Audit log for slow operations
    if (metric.latencyMs > this.getSloTarget(metric.operation) * 2) {
      audit.sync('slow_operation', metric.roomHash || 'unknown', false, {
        operation: metric.operation,
        latencyMs: metric.latencyMs,
        sloTarget: this.getSloTarget(metric.operation),
      });
    }
  }

  /**
   * Get SLO target for operation
   */
  private getSloTarget(operation: PerformanceMetric['operation']): number {
    switch (operation) {
      case 'connect':
        return SLO_TARGETS.connectLatencyMs;
      case 'sync':
        return SLO_TARGETS.syncLatencyMs;
      case 'checkpoint':
        return SLO_TARGETS.checkpointSaveMs;
      case 'broadcast':
        return SLO_TARGETS.broadcastLatencyMs;
      default:
        return 5000;
    }
  }

  /**
   * Get statistics for an operation
   */
  getStats(operation: PerformanceMetric['operation'], timeWindowMs = 60000): PerformanceStats {
    const cutoff = Date.now() - timeWindowMs;
    const relevant = this.metrics.filter(
      (m) => m.operation === operation && m.timestamp > cutoff
    );

    if (relevant.length === 0) {
      return {
        operation,
        count: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        errorRate: 0,
        sloCompliance: 1,
      };
    }

    const latencies = relevant.map((m) => m.latencyMs).sort((a, b) => a - b);
    const sloTarget = this.getSloTarget(operation);

    const sum = latencies.reduce((a, b) => a + b, 0);
    const avg = sum / latencies.length;

    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    const withinSlo = relevant.filter((m) => m.latencyMs <= sloTarget).length;

    return {
      operation,
      count: relevant.length,
      avgLatencyMs: Math.round(avg),
      p50LatencyMs: latencies[p50Index] || 0,
      p95LatencyMs: latencies[p95Index] || 0,
      p99LatencyMs: latencies[p99Index] || 0,
      errorRate: relevant.filter((m) => !m.success).length / relevant.length,
      sloCompliance: withinSlo / relevant.length,
    };
  }

  /**
   * Get all stats
   */
  getAllStats(timeWindowMs = 60000): PerformanceStats[] {
    const operations: PerformanceMetric['operation'][] = [
      'connect',
      'sync',
      'checkpoint',
      'broadcast',
      'fallback',
    ];

    return operations.map((op) => this.getStats(op, timeWindowMs));
  }

  /**
   * Get sync health status
   */
  getHealth(): SyncHealth {
    const allStats = this.getAllStats(300000); // 5 minute window

    const totalOperations = allStats.reduce((sum, s) => sum + s.count, 0);
    const totalErrors = allStats.reduce(
      (sum, s) => sum + s.count * s.errorRate,
      0
    );

    const avgSloCompliance =
      allStats.reduce((sum, s) => sum + s.sloCompliance, 0) /
        allStats.length || 1;

    let status: SyncHealth['status'] = 'healthy';
    if (avgSloCompliance < 0.9) {
      status = 'degraded';
    }
    if (avgSloCompliance < 0.8 || (totalOperations > 0 && totalErrors / totalOperations > 0.1)) {
      status = 'unhealthy';
    }

    return {
      status,
      overallSloCompliance: avgSloCompliance,
      recentErrors: Math.round(totalErrors),
      lastUpdated: Date.now(),
    };
  }

  /**
   * Start periodic reporting
   */
  private startReporting(): void {
    if (typeof window === 'undefined') return;

    this.reportInterval = setInterval(() => {
      this.reportMetrics();
    }, REPORT_INTERVAL_MS);
  }

  /**
   * Report metrics to console/telemetry
   */
  private reportMetrics(): void {
    const stats = this.getAllStats(60000);
    const health = this.getHealth();

    stats.forEach((s) => {
      if (s.count > 0) {
          `  ${s.operation}: ${s.count} ops, avg=${s.avgLatencyMs}ms, ` +
            `p95=${s.p95LatencyMs}ms, errors=${(s.errorRate * 100).toFixed(1)}%, ` +
            `slo=${(s.sloCompliance * 100).toFixed(1)}%`
        );
      }
    });


    // Audit log if degraded
    if (health.status !== 'healthy') {
      audit.transport('performance_degraded', false, {
        status: health.status,
        sloCompliance: health.overallSloCompliance,
        recentErrors: health.recentErrors,
      });
    }
  }

  /**
   * Stop reporting
   */
  destroy(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Get raw metrics (for debugging)
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let monitor: SyncPerformanceMonitor | null = null;

export function getSyncPerformanceMonitor(): SyncPerformanceMonitor {
  if (!monitor) {
    monitor = new SyncPerformanceMonitor();
  }
  return monitor;
}

export function destroySyncPerformanceMonitor(): void {
  if (monitor) {
    monitor.destroy();
    monitor = null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function recordSyncLatency(
  operation: PerformanceMetric['operation'],
  latencyMs: number,
  success: boolean,
  roomHash?: string,
  details?: Record<string, unknown>
): void {
  getSyncPerformanceMonitor().recordMetric({
    operation,
    latencyMs,
    success,
    roomHash,
    details,
  });
}

export function measureAsync<T>(
  operation: PerformanceMetric['operation'],
  fn: () => Promise<T>,
  roomHash?: string
): Promise<T> {
  const start = performance.now();

  return fn()
    .then((result) => {
      const latency = performance.now() - start;
      recordSyncLatency(operation, latency, true, roomHash);
      return result;
    })
    .catch((error) => {
      const latency = performance.now() - start;
      recordSyncLatency(operation, latency, false, roomHash, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
}

// ============================================================================
// DEVTOOLS
// ============================================================================

if (typeof window !== 'undefined') {
  // @ts-expect-error - DevTools
  window.__SYNC_PERFORMANCE__ = {
    getMonitor: getSyncPerformanceMonitor,
    record: recordSyncLatency,
    measure: measureAsync,
    SLO_TARGETS,
  };
}
