'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function GlobalErrorListener() {
  const addLog = useAppStore((state) => state.addLog);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Caught Global Error:', event.error);
      addLog(`❌ SYSTEM ERROR: ${event.message}`);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Caught Unhandled Rejection:', event.reason);
      const reason = event.reason?.message || event.reason || 'Unknown Async Error';
      addLog(`⚠️ ASYNC FAILURE: ${reason}`);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [addLog]);

  return null;
}
