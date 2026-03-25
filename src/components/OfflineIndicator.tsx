'use client';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function OfflineIndicator() {
  const isOnline = useNetworkStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-red-600 dark:bg-red-900 text-white text-xs sm:text-sm font-semibold py-1.5 px-4 flex items-center justify-center gap-2 shadow-md"
        >
          <WifiOff className="w-4 h-4" />
          You are currently offline. Changes are saved locally and will sync when you reconnect.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
