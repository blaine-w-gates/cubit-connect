/**
 * Storage Monitor Tests
 *
 * @module storageMonitor.test
 * @description Tests for storage monitoring utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getStorageStatus,
  formatStorageSize,
  getStorageWarningMessage,
  WARNING_THRESHOLD_BYTES,
  CRITICAL_THRESHOLD_BYTES,
  type StorageInfo,
} from '@/lib/storageMonitor';

describe('storageMonitor', () => {
  describe('getStorageStatus', () => {
    it('should return ok when below 50MB', () => {
      const usage = 40 * 1024 * 1024; // 40MB
      expect(getStorageStatus(usage)).toBe('ok');
    });

    it('should return warning at exactly 50MB', () => {
      expect(getStorageStatus(WARNING_THRESHOLD_BYTES)).toBe('warning');
    });

    it('should return warning between 50MB and 55MB', () => {
      const usage = 52 * 1024 * 1024; // 52MB
      expect(getStorageStatus(usage)).toBe('warning');
    });

    it('should return critical at exactly 55MB', () => {
      expect(getStorageStatus(CRITICAL_THRESHOLD_BYTES)).toBe('critical');
    });

    it('should return critical above 55MB', () => {
      const usage = 60 * 1024 * 1024; // 60MB
      expect(getStorageStatus(usage)).toBe('critical');
    });

    it('should handle zero bytes', () => {
      expect(getStorageStatus(0)).toBe('ok');
    });
  });

  describe('formatStorageSize', () => {
    it('should format bytes', () => {
      expect(formatStorageSize(512)).toBe('512 B');
    });

    it('should format kilobytes', () => {
      expect(formatStorageSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatStorageSize(50 * 1024 * 1024)).toBe('50.0 MB');
    });

    it('should format with one decimal place', () => {
      expect(formatStorageSize(52.5 * 1024 * 1024)).toBe('52.5 MB');
    });
  });

  describe('getStorageWarningMessage', () => {
    it('should return critical message for critical status', () => {
      const info: StorageInfo = {
        usage: 56 * 1024 * 1024,
        quota: 60 * 1024 * 1024,
        status: 'critical',
        percentUsed: 93.3,
      };
      const message = getStorageWarningMessage(info);
      expect(message).toContain('critical');
      expect(message).toContain('56.0 MB');
    });

    it('should return warning message for warning status', () => {
      const info: StorageInfo = {
        usage: 52 * 1024 * 1024,
        quota: 60 * 1024 * 1024,
        status: 'warning',
        percentUsed: 86.7,
      };
      const message = getStorageWarningMessage(info);
      expect(message).toContain('nearly full');
      expect(message).toContain('52.0 MB');
    });

    it('should return ok message for ok status', () => {
      const info: StorageInfo = {
        usage: 30 * 1024 * 1024,
        quota: 60 * 1024 * 1024,
        status: 'ok',
        percentUsed: 50,
      };
      const message = getStorageWarningMessage(info);
      expect(message).toContain('Storage:');
      expect(message).toContain('30.0 MB');
    });
  });

  describe('thresholds', () => {
    it('should have 50MB warning threshold', () => {
      expect(WARNING_THRESHOLD_BYTES).toBe(50 * 1024 * 1024);
    });

    it('should have 55MB critical threshold', () => {
      expect(CRITICAL_THRESHOLD_BYTES).toBe(55 * 1024 * 1024);
    });
  });
});
