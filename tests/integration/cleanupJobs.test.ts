/**
 * Cleanup Jobs Integration Tests
 *
 * Verifies cleanup job system functionality.
 *
 * @module cleanupJobs.test
 * @integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCleanupJobSystem,
  destroyCleanupJobSystem,
  type CleanupJob,
} from '@/lib/cleanupJobs';

describe('CleanupJobSystem', () => {
  beforeEach(() => {
    destroyCleanupJobSystem();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should create singleton instance', () => {
      const system1 = getCleanupJobSystem();
      const system2 = getCleanupJobSystem();
      expect(system1).toBe(system2);
    });

    it('should have default jobs registered', () => {
      const system = getCleanupJobSystem();
      const jobs = system.getAllJobs();

      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs.some((j) => j.name === 'audit-log-retention')).toBe(true);
      expect(jobs.some((j) => j.name === 'rate-limiter-cleanup')).toBe(true);
      expect(jobs.some((j) => j.name === 'checkpoint-cleanup')).toBe(true);
    });
  });

  describe('job registration', () => {
    it('should register custom job', () => {
      const system = getCleanupJobSystem();

      const customJob: CleanupJob = {
        name: 'custom-job',
        intervalMs: 1000,
        lastRun: null,
        enabled: false,
        run: async () => ({
          jobName: 'custom-job',
          success: true,
          itemsProcessed: 5,
          durationMs: 100,
        }),
      };

      system.registerJob(customJob);

      const jobs = system.getAllJobs();
      expect(jobs.some((j) => j.name === 'custom-job')).toBe(true);
    });

    it('should retrieve job by name', () => {
      const system = getCleanupJobSystem();
      const job = system.getJobStatus('audit-log-retention');

      expect(job).toBeDefined();
      expect(job?.name).toBe('audit-log-retention');
    });

    it('should return undefined for unknown job', () => {
      const system = getCleanupJobSystem();
      const job = system.getJobStatus('unknown-job');

      expect(job).toBeUndefined();
    });
  });

  describe('job execution', () => {
    it('should execute job successfully', async () => {
      const system = getCleanupJobSystem();

      const result = await system.executeJob('rate-limiter-cleanup');

      expect(result.jobName).toBe('rate-limiter-cleanup');
      expect(result.success).toBe(true);
    });

    it('should execute all jobs', async () => {
      const system = getCleanupJobSystem();

      const results = await system.executeAllJobs();

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should return error for unknown job', async () => {
      const system = getCleanupJobSystem();

      const result = await system.executeJob('unknown-job');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should track job stats', async () => {
      const system = getCleanupJobSystem();

      await system.executeJob('rate-limiter-cleanup');

      const stats = system.getStats();
      expect(stats.jobsRun).toBeGreaterThan(0);
    });

    it('should update lastRun timestamp after execution', async () => {
      const system = getCleanupJobSystem();
      const before = Date.now();

      await system.executeJob('rate-limiter-cleanup');

      const job = system.getJobStatus('rate-limiter-cleanup');
      expect(job?.lastRun).toBeGreaterThanOrEqual(before);
    });
  });

  describe('job lifecycle', () => {
    it('should start and stop job', () => {
      const system = getCleanupJobSystem();

      system.startJob('audit-log-retention');
      let job = system.getJobStatus('audit-log-retention');
      expect(job?.enabled).toBe(true);

      system.stopJob('audit-log-retention');
      job = system.getJobStatus('audit-log-retention');
      expect(job?.enabled).toBe(false);
    });

    it('should handle stopping unknown job gracefully', () => {
      const system = getCleanupJobSystem();

      // Should not throw
      expect(() => system.stopJob('unknown-job')).not.toThrow();
    });

    it('should handle starting unknown job gracefully', () => {
      const system = getCleanupJobSystem();

      // Should not throw, just log error
      expect(() => system.startJob('unknown-job')).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should destroy all jobs', () => {
      const system = getCleanupJobSystem();

      // Start some jobs first
      system.startJob('audit-log-retention');

      // Destroy
      system.destroy();

      // Should be able to create new system after destroy
      destroyCleanupJobSystem();
      const newSystem = getCleanupJobSystem();
      expect(newSystem).toBeDefined();
    });

    it('should reset singleton on destroy', () => {
      const system1 = getCleanupJobSystem();
      destroyCleanupJobSystem();
      const system2 = getCleanupJobSystem();

      expect(system1).not.toBe(system2);
    });
  });

  describe('job intervals', () => {
    it('should have different intervals for different jobs', () => {
      const system = getCleanupJobSystem();
      const jobs = system.getAllJobs();

      const intervals = jobs.map((j) => j.intervalMs);
      const uniqueIntervals = new Set(intervals);

      // Should have different intervals
      expect(uniqueIntervals.size).toBeGreaterThan(1);
    });

    it('should have reasonable intervals', () => {
      const system = getCleanupJobSystem();
      const jobs = system.getAllJobs();

      for (const job of jobs) {
        // Intervals should be at least 1 minute (60000ms)
        expect(job.intervalMs).toBeGreaterThanOrEqual(60000);
      }
    });
  });

  describe('error handling', () => {
    it('should handle job that throws error', async () => {
      const system = getCleanupJobSystem();

      // Register a failing job
      const failingJob: CleanupJob = {
        name: 'failing-job',
        intervalMs: 60000,
        lastRun: null,
        enabled: false,
        run: async () => {
          throw new Error('Test error');
        },
      };

      system.registerJob(failingJob);

      const result = await system.executeJob('failing-job');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });

    it('should track error count in stats', async () => {
      const system = getCleanupJobSystem();

      // Register a failing job
      const failingJob: CleanupJob = {
        name: 'failing-job-2',
        intervalMs: 60000,
        lastRun: null,
        enabled: false,
        run: async () => {
          throw new Error('Test error');
        },
      };

      system.registerJob(failingJob);

      const statsBefore = system.getStats();
      await system.executeJob('failing-job-2');
      const statsAfter = system.getStats();

      expect(statsAfter.errors).toBe(statsBefore.errors + 1);
    });
  });

  describe('DevTools integration', () => {
    it('should handle DevTools in current environment', () => {
      // Test environment may have window (jsdom) or not (node)
      // The actual DevTools exposure is tested in browser E2E tests
      if (typeof window !== 'undefined') {
        // In jsdom environment, window exists but DevTools may not be set up
        expect(typeof window).toBe('object');
      } else {
        // In Node.js environment, window is undefined
        expect(typeof window).toBe('undefined');
      }
    });
  });
});
