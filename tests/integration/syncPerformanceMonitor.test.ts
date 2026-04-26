/**
 * Sync Performance Monitor Integration Tests
 *
 * Verifies performance monitoring functionality.
 *
 * @module syncPerformanceMonitor.test
 * @integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSyncPerformanceMonitor,
  destroySyncPerformanceMonitor,
  recordSyncLatency,
  measureAsync,
  SLO_TARGETS,
} from '@/lib/syncPerformanceMonitor';

describe('SyncPerformanceMonitor', () => {
  beforeEach(() => {
    destroySyncPerformanceMonitor();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should create singleton monitor', () => {
      const monitor1 = getSyncPerformanceMonitor();
      const monitor2 = getSyncPerformanceMonitor();
      expect(monitor1).toBe(monitor2);
    });

    it('should start with empty metrics', () => {
      const monitor = getSyncPerformanceMonitor();
      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(0);
    });
  });

  describe('metric recording', () => {
    it('should record sync latency metric', () => {
      const monitor = getSyncPerformanceMonitor();

      monitor.recordMetric({
        operation: 'connect',
        latencyMs: 100,
        success: true,
        roomHash: 'room-test',
      });

      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operation).toBe('connect');
      expect(metrics[0].latencyMs).toBe(100);
      expect(metrics[0].success).toBe(true);
    });

    it('should record multiple metrics', () => {
      const monitor = getSyncPerformanceMonitor();

      monitor.recordMetric({ operation: 'connect', latencyMs: 100, success: true });
      monitor.recordMetric({ operation: 'sync', latencyMs: 50, success: true });
      monitor.recordMetric({ operation: 'broadcast', latencyMs: 20, success: true });

      expect(monitor.getMetrics()).toHaveLength(3);
    });

    it('should include timestamp', () => {
      const monitor = getSyncPerformanceMonitor();
      const before = Date.now();

      monitor.recordMetric({ operation: 'connect', latencyMs: 100, success: true });

      const after = Date.now();
      const metric = monitor.getMetrics()[0];

      expect(metric.timestamp).toBeGreaterThanOrEqual(before);
      expect(metric.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('statistics calculation', () => {
    it('should calculate stats for connect operation', () => {
      const monitor = getSyncPerformanceMonitor();

      // Record 10 connect operations
      for (let i = 1; i <= 10; i++) {
        monitor.recordMetric({
          operation: 'connect',
          latencyMs: i * 10, // 10, 20, 30, ..., 100
          success: true,
        });
      }

      const stats = monitor.getStats('connect');

      expect(stats.operation).toBe('connect');
      expect(stats.count).toBe(10);
      expect(stats.avgLatencyMs).toBe(55); // Average of 10-100
      expect(stats.p50LatencyMs).toBe(60); // floor(10 * 0.5) = 5, latencies[5] = 60
      expect(stats.p95LatencyMs).toBe(100); // floor(10 * 0.95) = 9, latencies[9] = 100
    });

    it('should return zero stats when no metrics', () => {
      const monitor = getSyncPerformanceMonitor();
      const stats = monitor.getStats('connect');

      expect(stats.count).toBe(0);
      expect(stats.avgLatencyMs).toBe(0);
      expect(stats.sloCompliance).toBe(1); // 100% when no data
    });

    it('should calculate error rate', () => {
      const monitor = getSyncPerformanceMonitor();

      monitor.recordMetric({ operation: 'sync', latencyMs: 100, success: true });
      monitor.recordMetric({ operation: 'sync', latencyMs: 100, success: false });
      monitor.recordMetric({ operation: 'sync', latencyMs: 100, success: true });
      monitor.recordMetric({ operation: 'sync', latencyMs: 100, success: false });

      const stats = monitor.getStats('sync');
      expect(stats.errorRate).toBe(0.5); // 2/4 failed
    });

    it('should calculate SLO compliance', () => {
      const monitor = getSyncPerformanceMonitor();
      const sloTarget = SLO_TARGETS.connectLatencyMs;

      // Record metrics: half under SLO, half over
      monitor.recordMetric({ operation: 'connect', latencyMs: sloTarget - 100, success: true });
      monitor.recordMetric({ operation: 'connect', latencyMs: sloTarget - 50, success: true });
      monitor.recordMetric({ operation: 'connect', latencyMs: sloTarget + 100, success: true });
      monitor.recordMetric({ operation: 'connect', latencyMs: sloTarget + 500, success: true });

      const stats = monitor.getStats('connect');
      expect(stats.sloCompliance).toBe(0.5); // 2/4 within SLO
    });
  });

  describe('all stats', () => {
    it('should return stats for all operations', () => {
      const monitor = getSyncPerformanceMonitor();

      monitor.recordMetric({ operation: 'connect', latencyMs: 100, success: true });
      monitor.recordMetric({ operation: 'sync', latencyMs: 50, success: true });
      monitor.recordMetric({ operation: 'checkpoint', latencyMs: 200, success: true });
      monitor.recordMetric({ operation: 'broadcast', latencyMs: 20, success: true });

      const allStats = monitor.getAllStats();

      expect(allStats).toHaveLength(5); // All operation types
      expect(allStats.some((s) => s.operation === 'connect')).toBe(true);
      expect(allStats.some((s) => s.operation === 'sync')).toBe(true);
      expect(allStats.some((s) => s.operation === 'checkpoint')).toBe(true);
      expect(allStats.some((s) => s.operation === 'broadcast')).toBe(true);
    });
  });

  describe('health status', () => {
    it('should return healthy when all metrics good', () => {
      const monitor = getSyncPerformanceMonitor();

      // Record good metrics
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric({
          operation: 'sync',
          latencyMs: 100, // Under SLO
          success: true,
        });
      }

      const health = monitor.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.overallSloCompliance).toBeGreaterThan(0.9);
    });

    it('should return degraded when SLO compliance drops', () => {
      const monitor = getSyncPerformanceMonitor();

      // Record slow metrics
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric({
          operation: 'sync',
          latencyMs: 5000, // Way over SLO
          success: true,
        });
      }

      const health = monitor.getHealth();
      expect(health.status).toBe('degraded');
    });

    it('should track recent errors', () => {
      const monitor = getSyncPerformanceMonitor();

      monitor.recordMetric({ operation: 'sync', latencyMs: 100, success: false });
      monitor.recordMetric({ operation: 'sync', latencyMs: 100, success: false });
      monitor.recordMetric({ operation: 'sync', latencyMs: 100, success: true });

      const health = monitor.getHealth();
      expect(health.recentErrors).toBeGreaterThan(0);
    });
  });

  describe('convenience functions', () => {
    it('should record via recordSyncLatency', () => {
      recordSyncLatency('connect', 150, true, 'room-123');

      const monitor = getSyncPerformanceMonitor();
      const metrics = monitor.getMetrics();

      expect(metrics).toHaveLength(1);
      expect(metrics[0].operation).toBe('connect');
      expect(metrics[0].latencyMs).toBe(150);
    });

    it('should measure async function', async () => {
      const mockAsyncFn = () => Promise.resolve('result');

      const result = await measureAsync('sync', mockAsyncFn);

      expect(result).toBe('result');

      const monitor = getSyncPerformanceMonitor();
      const metrics = monitor.getMetrics();

      expect(metrics).toHaveLength(1);
      expect(metrics[0].operation).toBe('sync');
      expect(metrics[0].success).toBe(true);
    });

    it('should measure failed async function', async () => {
      const mockAsyncFn = () => Promise.reject(new Error('Test error'));

      await expect(measureAsync('sync', mockAsyncFn)).rejects.toThrow('Test error');

      const monitor = getSyncPerformanceMonitor();
      const metrics = monitor.getMetrics();

      expect(metrics).toHaveLength(1);
      expect(metrics[0].success).toBe(false);
    });
  });

  describe('memory management', () => {
    it('should limit metric history size', () => {
      const monitor = getSyncPerformanceMonitor();

      // Record 1500 metrics (over the 1000 limit)
      for (let i = 0; i < 1500; i++) {
        monitor.recordMetric({
          operation: 'sync',
          latencyMs: i,
          success: true,
        });
      }

      // Should be trimmed to ~500 (half of max)
      expect(monitor.getMetrics().length).toBeLessThan(1000);
    });
  });

  describe('cleanup', () => {
    it('should clear all metrics', () => {
      const monitor = getSyncPerformanceMonitor();

      monitor.recordMetric({ operation: 'sync', latencyMs: 100, success: true });
      expect(monitor.getMetrics()).toHaveLength(1);

      monitor.clear();
      expect(monitor.getMetrics()).toHaveLength(0);
    });

    it('should destroy without error', () => {
      const monitor = getSyncPerformanceMonitor();
      monitor.destroy();
      // Should not throw
    });
  });

  describe('SLO targets', () => {
    it('should have defined SLO targets', () => {
      expect(SLO_TARGETS.connectLatencyMs).toBeDefined();
      expect(SLO_TARGETS.syncLatencyMs).toBeDefined();
      expect(SLO_TARGETS.checkpointSaveMs).toBeDefined();
      expect(SLO_TARGETS.broadcastLatencyMs).toBeDefined();
      expect(SLO_TARGETS.availability).toBeDefined();

      expect(SLO_TARGETS.connectLatencyMs).toBeGreaterThan(0);
      expect(SLO_TARGETS.availability).toBeGreaterThan(0);
      expect(SLO_TARGETS.availability).toBeLessThanOrEqual(1);
    });
  });
});
