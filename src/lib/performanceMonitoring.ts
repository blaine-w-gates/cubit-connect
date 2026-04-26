/**
 * Real User Monitoring (RUM)
 *
 * Performance metrics collection for sync operations.
 * Tracks latency, throughput, and user experience.
 *
 * @module performanceMonitoring
 * @version 1.0.0
 */

import { emitTelemetry } from './featureFlags';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Performance metric
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: number;
  tags: Record<string, string>;
}

/**
 * SLO (Service Level Objective)
 */
export interface SLO {
  name: string;
  target: number; // Target value (e.g., 99.9 for availability)
  window: '1h' | '24h' | '7d' | '30d';
  metric: string;
  comparison: '>' | '<' | '>=' | '<=';
}

/**
 * SLA (Service Level Agreement) - External commitment
 */
export interface SLA {
  name: string;
  slo: SLO;
  penalties?: string; // Description of penalties
  credits?: number; // Service credits percentage
}

/**
 * Performance snapshot
 */
export interface PerformanceSnapshot {
  timestamp: number;
  metrics: PerformanceMetric[];
  sloStatus: Array<{ slo: SLO; current: number; status: 'passing' | 'at_risk' | 'breached' }>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Define SLOs for Cubit Connect
export const DEFAULT_SLOS: SLO[] = [
  {
    name: 'sync_availability',
    target: 99.9,
    window: '24h',
    metric: 'availability_percentage',
    comparison: '>=',
  },
  {
    name: 'sync_latency_p95',
    target: 2000, // 2 seconds
    window: '1h',
    metric: 'sync_latency_ms',
    comparison: '<=',
  },
  {
    name: 'error_rate',
    target: 0.1, // 0.1%
    window: '1h',
    metric: 'error_rate_percentage',
    comparison: '<=',
  },
  {
    name: 'fallback_rate',
    target: 5, // 5%
    window: '24h',
    metric: 'fallback_rate_percentage',
    comparison: '<=',
  },
];

// ============================================================================
// PERFORMANCE MONITOR
// ============================================================================

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private slos: SLO[] = [...DEFAULT_SLOS];
  private metricBuffer: PerformanceMetric[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startFlushTimer();
    this.startWebVitalsCollection();
  }

  /**
   * Record a metric
   */
  record(name: string, value: number, unit: PerformanceMetric['unit'], tags: Record<string, string> = {}): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
    };

    this.metricBuffer.push(metric);

    // Emit telemetry for critical metrics
    if (name.includes('error') || name.includes('latency') && value > 5000) {
      emitTelemetry('error_boundary_triggered', {
        context: {
          performanceAlert: true,
          metric,
        },
      });
    }

    // Console in development
    if (process.env.NODE_ENV === 'development') {
    }
  }

  /**
   * Record sync operation timing
   */
  recordSyncOperation(operation: 'connect' | 'disconnect' | 'broadcast' | 'checkpoint', durationMs: number, success: boolean): void {
    this.record(`sync_${operation}_duration`, durationMs, 'ms', {
      success: String(success),
      operation,
    });
  }

  /**
   * Record transport fallback
   */
  recordFallback(from: string, to: string, reason: string): void {
    this.record('transport_fallback', 1, 'count', {
      from,
      to,
      reason,
    });
  }

  /**
   * Record rate limit event
   */
  recordRateLimit(userId: string, action: string): void {
    this.record('rate_limit_violation', 1, 'count', {
      userId: userId.slice(0, 8),
      action,
    });
  }

  /**
   * Get current SLO status
   */
  getSLOStatus(): Array<{ slo: SLO; current: number; status: 'passing' | 'at_risk' | 'breached' }> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    return this.slos.map((slo) => {
      const windowStart = slo.window === '1h' ? oneHourAgo : oneDayAgo;
      const relevantMetrics = this.metrics.filter((m) => m.name === slo.metric && m.timestamp >= windowStart);

      let current = 0;

      if (slo.metric === 'availability_percentage') {
        // Calculate availability from success/failure counts
        const total = relevantMetrics.length;
        const successful = relevantMetrics.filter((m) => m.tags.success === 'true').length;
        current = total > 0 ? (successful / total) * 100 : 100;
      } else if (slo.metric === 'sync_latency_ms') {
        // Calculate P95 latency
        const sorted = relevantMetrics.map((m) => m.value).sort((a, b) => a - b);
        const p95Index = Math.floor(sorted.length * 0.95);
        current = sorted[p95Index] || 0;
      } else if (slo.metric === 'error_rate_percentage') {
        // Calculate error rate
        const total = relevantMetrics.length;
        const errors = relevantMetrics.filter((m) => m.tags.success === 'false').length;
        current = total > 0 ? (errors / total) * 100 : 0;
      } else if (slo.metric === 'fallback_rate_percentage') {
        // Calculate fallback rate
        const total = this.metrics.filter((m) => m.name.startsWith('sync_')).length;
        const fallbacks = relevantMetrics.filter((m) => m.name === 'transport_fallback').length;
        current = total > 0 ? (fallbacks / total) * 100 : 0;
      }

      // Determine status
      let status: 'passing' | 'at_risk' | 'breached';
      const threshold = slo.target * 0.9; // 10% buffer for at_risk

      if (slo.comparison === '>=') {
        status = current >= slo.target ? 'passing' : current >= threshold ? 'at_risk' : 'breached';
      } else {
        status = current <= slo.target ? 'passing' : current <= slo.target * 1.1 ? 'at_risk' : 'breached';
      }

      return { slo, current, status };
    });
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (typeof window === 'undefined') return;

    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000); // Flush every 30 seconds
  }

  /**
   * Start web vitals collection
   */
  private startWebVitalsCollection(): void {
    if (typeof window === 'undefined') return;

    // Collect Core Web Vitals when available
    if ('web-vitals' in window) {
      // Would use web-vitals library here
    }

    // Basic performance metrics
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (nav) {
          this.record('page_load_time', nav.loadEventEnd - nav.startTime, 'ms', {});
          this.record('dom_content_loaded', nav.domContentLoadedEventEnd - nav.startTime, 'ms', {});
        }
      }, 0);
    });
  }

  /**
   * Flush metrics to storage
   */
  private flush(): void {
    if (this.metricBuffer.length === 0) return;

    // Add to permanent storage
    this.metrics.push(...this.metricBuffer);

    // Keep only last 1000 metrics (prevent memory leak)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Store in localStorage for persistence
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('performance_metrics', JSON.stringify(this.metrics.slice(-100)));
      } catch {
        // INTENTIONALLY IGNORING: Performance metrics persistence is best-effort
        // Storage quota exceeded is not critical for core functionality
      }
    }

    // Clear buffer
    this.metricBuffer = [];
  }

  /**
   * Get metric history
   */
  getMetrics(name?: string, limit = 100): PerformanceMetric[] {
    let result = [...this.metrics, ...this.metricBuffer];

    if (name) {
      result = result.filter((m) => m.name === name);
    }

    return result.slice(-limit);
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalMetrics: number;
    sloStatus: Array<{ slo: SLO; current: number; status: 'passing' | 'at_risk' | 'breached' }>;
    recentLatency: { avg: number; p95: number };
  } {
    const latencies = this.getMetrics('sync_connect_duration', 100);
    const values = latencies.map((m) => m.value);

    return {
      totalMetrics: this.metrics.length + this.metricBuffer.length,
      sloStatus: this.getSLOStatus(),
      recentLatency: {
        avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
        p95: values.length > 0 ? values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)] || 0 : 0,
      },
    };
  }

  /**
   * Destroy monitor
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let monitorInstance: PerformanceMonitor | null = null;

/**
 * Get or create performance monitor
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!monitorInstance) {
    monitorInstance = new PerformanceMonitor();
  }
  return monitorInstance;
}

/**
 * Destroy performance monitor (for testing)
 */
export function destroyPerformanceMonitor(): void {
  monitorInstance?.destroy();
  monitorInstance = null;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const perf = {
  record: (name: string, value: number, unit: PerformanceMetric['unit'], tags?: Record<string, string>) =>
    getPerformanceMonitor().record(name, value, unit, tags),
  recordSync: (operation: 'connect' | 'disconnect' | 'broadcast' | 'checkpoint', durationMs: number, success: boolean) =>
    getPerformanceMonitor().recordSyncOperation(operation, durationMs, success),
  recordFallback: (from: string, to: string, reason: string) =>
    getPerformanceMonitor().recordFallback(from, to, reason),
  getSLOStatus: () => getPerformanceMonitor().getSLOStatus(),
  getSummary: () => getPerformanceMonitor().getSummary(),
};

// ============================================================================
// GLOBAL ACCESS
// ============================================================================

declare global {
  interface Window {
    __PERFORMANCE_MONITOR__?: PerformanceMonitor;
    __PERFORMANCE_SLO_STATUS__?: () => Array<{
      slo: SLO;
      current: number;
      status: 'passing' | 'at_risk' | 'breached';
    }>;
    __PERFORMANCE_SUMMARY__?: () => {
      totalMetrics: number;
      sloStatus: Array<{ slo: SLO; current: number; status: 'passing' | 'at_risk' | 'breached' }>;
      recentLatency: { avg: number; p95: number };
    };
  }
}

if (typeof window !== 'undefined') {
  window.__PERFORMANCE_MONITOR__ = getPerformanceMonitor();
  window.__PERFORMANCE_SLO_STATUS__ = () => getPerformanceMonitor().getSLOStatus();
  window.__PERFORMANCE_SUMMARY__ = () => getPerformanceMonitor().getSummary();
}

// Types are already exported at top of file
