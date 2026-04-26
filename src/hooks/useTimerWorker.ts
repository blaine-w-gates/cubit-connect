/**
 * useTimerWorker Hook - Clean Implementation
 *
 * Manages Web Worker lifecycle with main-thread fallback.
 * Uses Zustand getState() to avoid stale closures.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';

type WorkerResponse =
  | { type: 'TICK'; payload: { remainingSeconds: number } }
  | { type: 'COMPLETE'; payload?: undefined }
  | { type: 'STATUS'; payload: { remainingSeconds: number } }
  | { type: 'ERROR'; payload: { message: string } };

interface UseTimerWorkerReturn {
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  hasWorker: boolean;
  isReady: boolean;
}

export function useTimerWorker(options: { onComplete?: () => void } = {}): UseTimerWorkerReturn {
  const { onComplete } = options;

  // Refs for stable values
  const workerRef = useRef<Worker | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const [hasWorker, setHasWorker] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Keep onComplete ref in sync
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Initialize worker
  useEffect(() => {
    // Terminate any existing worker from HMR reload
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    const rafId = requestAnimationFrame(() => {
      if (typeof window === 'undefined') {
        setIsReady(true);
        return;
      }

      try {
        workerRef.current = new Worker('/timerWorker.js');
        // Stop any timer from previous session
        workerRef.current.postMessage({ type: 'STOP' });
        setHasWorker(true);
        setIsReady(true);
      } catch {
        // INTENTIONALLY HANDLING: Worker creation failure falls back to setInterval
        // Show user warning and continue with less accurate timing
        setHasWorker(false);
        setIsReady(true);
        toast.warning('Timer using fallback mode', {
          description: 'Timer accuracy may be reduced if tab is throttled.',
          duration: 5000,
        });
      }
    });

    // Cleanup on unmount/HMR
    return () => {
      cancelAnimationFrame(rafId);
      workerRef.current?.terminate();
      workerRef.current = null;
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, []);

  // Handle worker messages
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    const handleMessage = (e: MessageEvent<WorkerResponse>) => {
      const { type, payload } = e.data;
      const store = useAppStore.getState();

      switch (type) {
        case 'TICK':
        case 'STATUS':
          if (payload) store.tickTimer(payload.remainingSeconds);
          break;
        case 'COMPLETE':
          store.completeTimer();
          onCompleteRef.current?.();
          break;
        case 'ERROR':
          console.error('[TimerWorker] Error:', payload.message);
          break;
      }
    };

    worker.addEventListener('message', handleMessage);
    return () => worker.removeEventListener('message', handleMessage);
  }, [hasWorker]);

  // Fallback timer
  const startFallback = useCallback((durationMs: number, startedAt: number, totalPausedMs = 0) => {
    if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);

    fallbackIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt - totalPausedMs;
      const remainingMs = Math.max(0, durationMs - elapsed);
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      useAppStore.getState().tickTimer(remainingSeconds);

      if (remainingMs <= 0) {
        clearInterval(fallbackIntervalRef.current!);
        fallbackIntervalRef.current = null;
        useAppStore.getState().completeTimer();
        onCompleteRef.current?.();
      }
    }, 1000);
  }, []);

  // Timer actions - all use getState() for fresh data
  const startTimer = useCallback(() => {
    const session = useAppStore.getState().activeTimerSession;
    if (!session) return;

    const { durationMs, startedAt, totalPausedMs } = session;

    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'START',
        payload: { durationMs, startedAt, totalPausedMs },
      });
    } else {
      startFallback(durationMs, startedAt, totalPausedMs);
    }
  }, [startFallback]);

  const pauseTimer = useCallback(() => {
    workerRef.current?.postMessage({ type: 'PAUSE' });
    if (!workerRef.current && fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    useAppStore.getState().pauseTimer();
  }, []);

  const resumeTimer = useCallback(() => {
    const session = useAppStore.getState().activeTimerSession;
    if (!session) return;

    const { durationMs, startedAt, totalPausedMs } = session;

    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'RESUME',
        payload: { totalPausedMs },
      });
    } else {
      startFallback(durationMs, startedAt, totalPausedMs);
    }
  }, [startFallback]);

  const stopTimer = useCallback(() => {
    workerRef.current?.postMessage({ type: 'STOP' });
    if (!workerRef.current && fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    useAppStore.getState().stopTimer();
  }, []);

  // Auto-start when ready
  useEffect(() => {
    if (!isReady) return;
    const session = useAppStore.getState().activeTimerSession;
    if (session?.status !== 'running') return;

    const { durationMs, startedAt, totalPausedMs } = session;

    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'START',
        payload: { durationMs, startedAt, totalPausedMs },
      });
    } else {
      startFallback(durationMs, startedAt, totalPausedMs);
    }
  }, [isReady, startFallback]);

  return {
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    hasWorker,
    isReady,
  };
}
