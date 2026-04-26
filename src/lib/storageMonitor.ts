/**
 * Storage Monitor Utility
 *
 * Monitors IndexedDB storage usage and provides warnings at fixed thresholds.
 * Warns at 50MB, critical alert at 55MB (common browser limit ~60MB).
 *
 * @module storageMonitor
 * @description Storage size monitoring with fixed thresholds
 */

import { createLogger } from '@/lib/logger';

const logger = createLogger('storageMonitor');

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Warning threshold in bytes (50MB)
 */
export const WARNING_THRESHOLD_BYTES = 50 * 1024 * 1024;

/**
 * Critical threshold in bytes (55MB)
 */
export const CRITICAL_THRESHOLD_BYTES = 55 * 1024 * 1024;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Storage status classification
 */
export type StorageStatus = 'ok' | 'warning' | 'critical' | 'unknown';

/**
 * Storage information returned by monitor
 */
export interface StorageInfo {
  usage: number;
  quota: number;
  status: StorageStatus;
  percentUsed: number;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get current storage usage and quota
 *
 * Uses navigator.storage.estimate() API. Returns null if unavailable
 * (e.g., non-secure context or unsupported browser).
 *
 * @returns Storage estimate or null if unavailable
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return null;
  }

  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch (error) {
    // INTENTIONALLY FALLBACK: Storage estimation unavailable
    // Non-secure contexts or permission denials - app continues without monitoring
    logger.warn('Storage estimation failed', { error });
    return null;
  }
}

/**
 * Calculate storage status based on fixed thresholds
 *
 * Uses absolute byte thresholds (not percentages) for consistent UX:
 * - ok: below 50MB
 * - warning: 50MB - 55MB
 * - critical: above 55MB
 *
 * @param usageBytes Current storage usage in bytes
 * @returns Storage status classification
 */
export function getStorageStatus(usageBytes: number): StorageStatus {
  if (usageBytes >= CRITICAL_THRESHOLD_BYTES) {
    return 'critical';
  }
  if (usageBytes >= WARNING_THRESHOLD_BYTES) {
    return 'warning';
  }
  return 'ok';
}

/**
 * Get comprehensive storage information
 *
 * Combines usage estimate with status classification and percentage.
 *
 * @returns Storage info with status, or null if estimation unavailable
 */
export async function getStorageInfo(): Promise<StorageInfo | null> {
  const estimate = await getStorageEstimate();

  if (!estimate) {
    return null;
  }

  const { usage, quota } = estimate;
  const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

  return {
    usage,
    quota,
    status: getStorageStatus(usage),
    percentUsed,
  };
}

/**
 * Check if storage should show warning to user
 *
 * @returns true if at warning or critical threshold
 */
export async function shouldShowStorageWarning(): Promise<boolean> {
  const info = await getStorageInfo();
  if (!info) return false;
  return info.status === 'warning' || info.status === 'critical';
}

/**
 * Check if storage is at critical level
 *
 * @returns true if above 55MB threshold
 */
export async function isStorageCritical(): Promise<boolean> {
  const info = await getStorageInfo();
  if (!info) return false;
  return info.status === 'critical';
}

/**
 * Format bytes to human-readable string
 *
 * @param bytes Number of bytes
 * @returns Formatted string (e.g., "50.5 MB")
 */
export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get user-friendly storage warning message
 *
 * @param info Storage information
 * @returns Appropriate warning message for the status
 */
export function getStorageWarningMessage(info: StorageInfo): string {
  const used = formatStorageSize(info.usage);

  switch (info.status) {
    case 'critical':
      return `Storage critical: ${used} used. Export and clear data soon to prevent data loss.`;
    case 'warning':
      return `Storage nearly full: ${used} used. Consider exporting data.`;
    default:
      return `Storage: ${used} used`;
  }
}

// ============================================================================
// REACT HOOK COMPATIBLE
// ============================================================================

/**
 * Check storage status (synchronous wrapper for async function)
 * Use this for initial checks; prefer getStorageInfo() for full data.
 *
 * @returns Promise resolving to true if warning/critical
 */
export function checkStorageWarning(): Promise<boolean> {
  return shouldShowStorageWarning();
}

// Default export for convenience
const storageMonitor = {
  getStorageEstimate,
  getStorageStatus,
  getStorageInfo,
  shouldShowStorageWarning,
  isStorageCritical,
  formatStorageSize,
  getStorageWarningMessage,
  checkStorageWarning,
  WARNING_THRESHOLD_BYTES,
  CRITICAL_THRESHOLD_BYTES,
};

export default storageMonitor;
