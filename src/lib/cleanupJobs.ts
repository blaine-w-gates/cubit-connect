/**
 * Cleanup Jobs System
 *
 * Manages periodic cleanup tasks for the application.
 * Includes audit log retention, checkpoint cleanup, and rate limiter cleanup.
 *
 * @module cleanupJobs
 * @production
 */

import { getAuditLogger } from './auditLogger';
import { getRateLimiter } from './rateLimiter';
import { getCheckpointService } from './checkpointService';
import { audit } from './auditLogger';

// ============================================================================
// TYPES
// ============================================================================

export interface CleanupJob {
  name: string;
  intervalMs: number;
  lastRun: number | null;
  enabled: boolean;
  run: () => Promise<CleanupResult>;
}

export interface CleanupResult {
  jobName: string;
  success: boolean;
  itemsProcessed: number;
  durationMs: number;
  error?: string;
}

export interface CleanupStats {
  jobsRun: number;
  totalItemsProcessed: number;
  errors: number;
  lastRun: number;
}

// ============================================================================
// CLEANUP JOBS
// ============================================================================

class CleanupJobSystem {
  private jobs: Map<string, CleanupJob> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private stats: CleanupStats = {
    jobsRun: 0,
    totalItemsProcessed: 0,
    errors: 0,
    lastRun: 0,
  };

  constructor() {
    this.registerDefaultJobs();
  }

  /**
   * Register default cleanup jobs
   */
  private registerDefaultJobs(): void {
    // Audit log retention cleanup (runs every hour)
    this.registerJob({
      name: 'audit-log-retention',
      intervalMs: 60 * 60 * 1000,
      lastRun: null,
      enabled: true,
      run: async () => {
        const auditLogger = getAuditLogger();
        const stats = auditLogger.getStats();

        // Flush any pending audit logs
        await auditLogger.flush();

        return {
          jobName: 'audit-log-retention',
          success: true,
          itemsProcessed: stats.total,
          durationMs: 0,
        };
      },
    });

    // Rate limiter cleanup (runs every 5 minutes)
    this.registerJob({
      name: 'rate-limiter-cleanup',
      intervalMs: 5 * 60 * 1000,
      lastRun: null,
      enabled: true,
      run: async () => {
        const rateLimiter = getRateLimiter();
        const start = Date.now();

        // Cleanup buckets older than 1 hour
        const cleaned = rateLimiter.cleanup(60 * 60 * 1000);

        const duration = Date.now() - start;

        return {
          jobName: 'rate-limiter-cleanup',
          success: true,
          itemsProcessed: cleaned,
          durationMs: duration,
        };
      },
    });

    // Checkpoint cleanup (runs daily)
    this.registerJob({
      name: 'checkpoint-cleanup',
      intervalMs: 24 * 60 * 60 * 1000,
      lastRun: null,
      enabled: true,
      run: async () => {
        const checkpointService = getCheckpointService();
        const start = Date.now();

        const deleted = await checkpointService.cleanupOldCheckpoints();

        const duration = Date.now() - start;

        return {
          jobName: 'checkpoint-cleanup',
          success: true,
          itemsProcessed: deleted,
          durationMs: duration,
        };
      },
    });

    // Memory usage check (runs every 10 minutes)
    this.registerJob({
      name: 'memory-check',
      intervalMs: 10 * 60 * 1000,
      lastRun: null,
      enabled: true,
      run: async () => {
        // @ts-expect-error - performance.memory is Chrome-only API
        if (typeof window === 'undefined' || !window.performance?.memory) {
          return {
            jobName: 'memory-check',
            success: true,
            itemsProcessed: 0,
            durationMs: 0,
          };
        }

        // @ts-expect-error - performance.memory is Chrome-only API
        const memory = window.performance.memory as {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        };

        const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

        // Alert if memory usage > 80%
        if (usedPercent > 80) {
          audit.transport('memory_warning', false, {
            usedPercent: usedPercent.toFixed(2),
            usedMB: (memory.usedJSHeapSize / (1024 * 1024)).toFixed(2),
            totalMB: (memory.totalJSHeapSize / (1024 * 1024)).toFixed(2),
          });
        }

        return {
          jobName: 'memory-check',
          success: true,
          itemsProcessed: 0,
          durationMs: 0,
        };
      },
    });
  }

  /**
   * Register a cleanup job
   */
  registerJob(job: CleanupJob): void {
    this.jobs.set(job.name, job);

    // Auto-start if enabled
    if (job.enabled) {
      this.startJob(job.name);
    }
  }

  /**
   * Start a job
   */
  startJob(jobName: string): void {
    const job = this.jobs.get(jobName);
    if (!job) {
      console.error(`[CLEANUP] Job not found: ${jobName}`);
      return;
    }

    // Stop existing interval if any
    this.stopJob(jobName);

    // Start new interval
    const interval = setInterval(async () => {
      await this.executeJob(jobName);
    }, job.intervalMs);

    this.intervals.set(jobName, interval);
    job.enabled = true;

  }

  /**
   * Stop a job
   */
  stopJob(jobName: string): void {
    const interval = this.intervals.get(jobName);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(jobName);
    }

    const job = this.jobs.get(jobName);
    if (job) {
      job.enabled = false;
    }

  }

  /**
   * Execute a job immediately
   */
  async executeJob(jobName: string): Promise<CleanupResult> {
    const job = this.jobs.get(jobName);
    if (!job) {
      return {
        jobName,
        success: false,
        itemsProcessed: 0,
        durationMs: 0,
        error: 'Job not found',
      };
    }

    const start = Date.now();

    try {
      const result = await job.run();
      job.lastRun = Date.now();

      // Update stats
      this.stats.jobsRun++;
      this.stats.totalItemsProcessed += result.itemsProcessed;
      this.stats.lastRun = Date.now();

        `[CLEANUP] Job ${jobName} completed: ${result.itemsProcessed} items in ${result.durationMs}ms`
      );

      return result;
    } catch (error) {
      // INTENTIONALLY HANDLING: Cleanup job failure tracked but doesn't crash system
      // Error is logged, stats updated, and failure result returned for monitoring
      this.stats.errors++;

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[CLEANUP] Job ${jobName} failed:`, errorMessage);

      audit.transport('cleanup_job_failed', false, {
        jobName,
        error: errorMessage,
      });

      return {
        jobName,
        success: false,
        itemsProcessed: 0,
        durationMs: Date.now() - start,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute all jobs immediately
   */
  async executeAllJobs(): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];

    for (const jobName of this.jobs.keys()) {
      const result = await this.executeJob(jobName);
      results.push(result);
    }

    return results;
  }

  /**
   * Get job status
   */
  getJobStatus(jobName: string): CleanupJob | undefined {
    return this.jobs.get(jobName);
  }

  /**
   * Get all job statuses
   */
  getAllJobs(): CleanupJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get cleanup stats
   */
  getStats(): CleanupStats {
    return { ...this.stats };
  }

  /**
   * Stop all jobs
   */
  destroy(): void {
    for (const jobName of this.intervals.keys()) {
      this.stopJob(jobName);
    }
    this.jobs.clear();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let cleanupSystem: CleanupJobSystem | null = null;

export function getCleanupJobSystem(): CleanupJobSystem {
  if (!cleanupSystem) {
    cleanupSystem = new CleanupJobSystem();
  }
  return cleanupSystem;
}

export function destroyCleanupJobSystem(): void {
  if (cleanupSystem) {
    cleanupSystem.destroy();
    cleanupSystem = null;
  }
}

// ============================================================================
// DEVTOOLS
// ============================================================================

if (typeof window !== 'undefined') {
  // @ts-expect-error - DevTools
  window.__CLEANUP_JOBS__ = {
    getSystem: getCleanupJobSystem,
    executeJob: (name: string) => getCleanupJobSystem().executeJob(name),
    executeAll: () => getCleanupJobSystem().executeAllJobs(),
    getStats: () => getCleanupJobSystem().getStats(),
  };
}
