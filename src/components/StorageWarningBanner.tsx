/**
 * Storage Warning Banner Component
 *
 * Persistent visual indicator for storage status.
 * Shows at top of page when storage is warning or critical.
 * Pauses all checks when tab is hidden (battery optimization).
 *
 * @module StorageWarningBanner
 * @component
 * @example
 * ```tsx
 * // In root layout - visible on all pages
 * <StorageWarningBanner />
 * ```
 */

'use client';

import { useStorageMonitor } from '@/hooks/useStorageMonitor';
import { AlertCircle, HardDrive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';

/**
 * Storage warning banner component
 *
 * Displays persistent banner at top of viewport when:
 * - Storage is warning (50-55MB): Amber banner
 * - Storage is critical (>55MB): Red banner with action button
 *
 * @returns React component or null if status is ok/unknown
 */
export default function StorageWarningBanner() {
  const { status, formattedUsage } = useStorageMonitor();
  const setIsSettingsOpen = useAppStore((state) => state.setIsSettingsOpen);

  // Don't render for ok or unknown status
  if (status === 'ok' || status === 'unknown') {
    return null;
  }

  const isCritical = status === 'critical';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`sticky top-0 z-50 w-full py-2 px-4 ${
          isCritical
            ? 'bg-red-600 dark:bg-red-900 text-white'
            : 'bg-amber-500 dark:bg-amber-700 text-white'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCritical ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <HardDrive className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">
              {isCritical
                ? `Storage Critical: ${formattedUsage} used`
                : `Storage Nearly Full: ${formattedUsage} used`}
            </span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`text-sm font-semibold px-3 py-1 rounded transition-colors ${
              isCritical
                ? 'bg-white text-red-600 hover:bg-red-50'
                : 'bg-white text-amber-600 hover:bg-amber-50'
            }`}
          >
            {isCritical ? 'Export Now' : 'Manage Storage'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
