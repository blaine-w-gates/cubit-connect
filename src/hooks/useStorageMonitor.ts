/**
 * useStorageMonitor Hook
 *
 * React hook for monitoring IndexedDB storage usage.
 * Provides reactive storage status with automatic polling.
 * Pauses polling when tab is hidden to conserve battery.
 *
 * @module useStorageMonitor
 * @hook
 * @example
 * ```tsx
 * const { status, usage, formattedUsage, checkNow } = useStorageMonitor();
 * if (status === 'critical') {
 *   return <StorageWarningBanner />;
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getStorageInfo,
  formatStorageSize,
  type StorageStatus,
  type StorageInfo,
} from '@/lib/storageMonitor';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useStorageMonitor');

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Polling interval when tab is visible (30 seconds)
 * Pauses completely when hidden (battery optimization)
 */
const POLLING_INTERVAL_MS = 30000;

// ============================================================================
// HOOK INTERFACE
// ============================================================================

/**
 * Return type for useStorageMonitor hook
 */
export interface UseStorageMonitorReturn {
  /** Current storage status */
  status: StorageStatus;
  /** Raw usage in bytes */
  usage: number;
  /** Human-readable usage string */
  formattedUsage: string;
  /** Whether currently checking storage */
  isChecking: boolean;
  /** Force immediate storage check */
  checkNow: () => Promise<void>;
  /** Last error if check failed */
  error: Error | null;
  /** Full storage info if available */
  info: StorageInfo | null;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * React hook for monitoring IndexedDB storage usage
 *
 * Features:
 * - Automatic polling every 30s (visible) or 5min (background)
 * - Pauses completely when tab hidden (battery optimization)
 * - Manual refresh capability via checkNow()
 * - Error handling with graceful degradation
 *
 * @returns Storage monitoring state and controls
 */
export function useStorageMonitor(): UseStorageMonitorReturn {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastStatusRef = useRef<StorageStatus | null>(null);

  /**
   * Perform storage check
   * Updates state with latest info or error
   */
  const checkStorage = useCallback(async () => {
    // Skip if already checking
    if (isChecking) return;

    setIsChecking(true);
    setError(null);

    try {
      const storageInfo = await getStorageInfo();

      if (storageInfo) {
        setInfo(storageInfo);
        lastStatusRef.current = storageInfo.status;
      } else {
        // INTENTIONALLY FALLBACK: Storage API unavailable - set unknown state
        // This allows UI to hide gracefully rather than show loading/error
        setInfo({
          usage: 0,
          quota: 0,
          status: 'unknown',
          percentUsed: 0,
        });
      }
    } catch (err) {
      // INTENTIONALLY LOGGING: Storage check failures need visibility
      // but shouldn't crash the component
      logger.error('Storage check failed', { error: err });
      setError(err instanceof Error ? err : new Error('Storage check failed'));
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  /**
   * Public checkNow function - forces immediate check
   */
  const checkNow = useCallback(async () => {
    await checkStorage();
  }, [checkStorage]);

  // Initial check and polling setup
  useEffect(() => {
    // Initial check
    checkStorage();

    let intervalId: NodeJS.Timeout | null = null;

    /**
     * Setup polling based on visibility state
     */
    const setupPolling = () => {
      // Clear existing interval
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      // Only poll when visible (battery optimization)
      if (document.visibilityState === 'visible') {
        intervalId = setInterval(checkStorage, POLLING_INTERVAL_MS);
      }
      // When hidden, we don't poll - saving battery
      // Check will resume when tab becomes visible again
    };

    // Setup initial polling
    setupPolling();

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible - check immediately and start polling
        checkStorage();
        setupPolling();
      } else {
        // Tab hidden - stop polling
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [checkStorage]);

  // Computed values
  const status = info?.status ?? 'unknown';
  const usage = info?.usage ?? 0;
  const formattedUsage = formatStorageSize(usage);

  return {
    status,
    usage,
    formattedUsage,
    isChecking,
    checkNow,
    error,
    info,
  };
}

// Default export for convenience
export default useStorageMonitor;
