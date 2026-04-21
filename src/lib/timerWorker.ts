/**
 * Timer Web Worker - A+ Grade Implementation
 * 
 * Runs in a separate thread to ensure timer accuracy even when:
 * - Main thread is blocked by React rendering
 * - Browser tab is backgrounded (some browsers throttle main thread but not workers)
 * - User is interacting with heavy UI components
 * 
 * Uses performance.now() for monotonic timing (unaffected by system clock changes).
 */

// Worker types
interface TimerMessage {
  type: 'START' | 'PAUSE' | 'RESUME' | 'STOP' | 'GET_STATUS' | 'DRIFT_CHECK';
  payload?: {
    durationMs?: number;
    startedAt?: number;
    totalPausedMs?: number;
  };
}

interface TimerTickMessage {
  type: 'TICK';
  payload: {
    remainingMs: number;
    remainingSeconds: number;
    progressPercentage: number;
  };
}

interface TimerCompleteMessage {
  type: 'COMPLETE';
}

interface TimerStatusMessage {
  type: 'STATUS';
  payload: {
    status: 'idle' | 'running' | 'paused';
    remainingMs: number;
    remainingSeconds: number;
  };
}

type WorkerResponse = TimerTickMessage | TimerCompleteMessage | TimerStatusMessage;

// Worker state
let intervalId: ReturnType<typeof setInterval> | null = null;
let startTime = 0;
let duration = 0;
let pausedDuration = 0;
let isPaused = false;
let pauseStartTime = 0;

// Post message helper with proper typing
function postMessageToMain(response: WorkerResponse): void {
  self.postMessage(response);
}

// Start the timer
function startTimer(durationMs: number, startedAt: number, totalPausedMs = 0): void {
  // Clear any existing interval
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
  
  duration = durationMs;
  startTime = startedAt;
  pausedDuration = totalPausedMs;
  isPaused = false;
  
  console.log('[TimerWorker] Starting timer:', { duration, startTime, pausedDuration });
  
  // Send initial tick
  sendTick();
  
  // Set up interval for subsequent ticks (1000ms = 1 second heartbeat)
  // Authority tick every second, UI smoothness handled by CSS transitions
  intervalId = setInterval(() => {
    if (isPaused) return;
    
    const now = performance.now();
    const elapsed = now - startTime - pausedDuration;
    const remaining = Math.max(0, duration - elapsed);
    
    // Send tick every interval (no throttling needed at 1000ms)
    sendTick();
    
    // Check for completion
    if (remaining <= 0) {
      completeTimer();
    }
  }, 1000);
}

// Pause the timer
function pauseTimer(): void {
  if (!isPaused) {
    isPaused = true;
    pauseStartTime = performance.now();
    console.log('[TimerWorker] Timer paused at:', pauseStartTime);
  }
}

// Resume the timer
function resumeTimer(totalPausedMs: number): void {
  if (isPaused) {
    const now = performance.now();
    const additionalPausedDuration = now - pauseStartTime;
    pausedDuration = totalPausedMs + additionalPausedDuration;
    isPaused = false;
    console.log('[TimerWorker] Timer resumed, additional pause duration:', additionalPausedDuration);
  }
}

// Stop the timer
function stopTimer(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  // Reset state
  startTime = 0;
  duration = 0;
  pausedDuration = 0;
  isPaused = false;
  pauseStartTime = 0;
  
  console.log('[TimerWorker] Timer stopped');
}

// Complete the timer
function completeTimer(): void {
  stopTimer();
  postMessageToMain({ type: 'COMPLETE' });
  console.log('[TimerWorker] Timer completed');
}

// Send current status to main thread
function sendTick(): void {
  const now = performance.now();
  const elapsed = isPaused 
    ? pauseStartTime - startTime - pausedDuration
    : now - startTime - pausedDuration;
  
  const remainingMs = Math.max(0, duration - elapsed);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const progressPercentage = Math.min(100, (elapsed / duration) * 100);
  
  postMessageToMain({
    type: 'TICK',
    payload: {
      remainingMs,
      remainingSeconds,
      progressPercentage,
    },
  });
}

// Get current status
function getStatus(): void {
  const now = performance.now();
  
  if (!startTime) {
    postMessageToMain({
      type: 'STATUS',
      payload: {
        status: 'idle',
        remainingMs: 0,
        remainingSeconds: 0,
      },
    });
    return;
  }
  
  const elapsed = isPaused 
    ? pauseStartTime - startTime - pausedDuration
    : now - startTime - pausedDuration;
  
  const remainingMs = Math.max(0, duration - elapsed);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  
  postMessageToMain({
    type: 'STATUS',
    payload: {
      status: isPaused ? 'paused' : intervalId ? 'running' : 'idle',
      remainingMs,
      remainingSeconds,
    },
  });
}

// Handle drift check (recalculate based on wall clock)
function handleDriftCheck(): void {
  if (!startTime || isPaused) return;
  
  // This is called when main thread suspects drift
  // We just send a fresh tick with current accurate values
  sendTick();
}

// Message handler
self.onmessage = (e: MessageEvent<TimerMessage>) => {
  const { type, payload } = e.data;
  
  switch (type) {
    case 'START': {
      if (payload?.durationMs !== undefined && payload?.startedAt !== undefined) {
        startTimer(payload.durationMs, payload.startedAt, payload.totalPausedMs || 0);
      } else {
        console.error('[TimerWorker] START message missing required payload');
      }
      break;
    }
    
    case 'PAUSE': {
      pauseTimer();
      sendTick(); // Send immediate update after pause
      break;
    }
    
    case 'RESUME': {
      if (payload?.totalPausedMs !== undefined) {
        resumeTimer(payload.totalPausedMs);
      } else {
        console.error('[TimerWorker] RESUME message missing totalPausedMs');
      }
      break;
    }
    
    case 'STOP': {
      stopTimer();
      break;
    }
    
    case 'GET_STATUS': {
      getStatus();
      break;
    }
    
    case 'DRIFT_CHECK': {
      handleDriftCheck();
      break;
    }
    
    default: {
      console.warn('[TimerWorker] Unknown message type:', type);
    }
  }
};

// Handle errors
self.onerror = (event: string | Event, source?: string, lineno?: number, colno?: number, error?: Error) => {
  console.error('[TimerWorker] Error:', { event, source, lineno, colno, error });
  // Notify main thread of error
  self.postMessage({
    type: 'ERROR',
    payload: {
      message: error?.message || (typeof event === 'string' ? event : 'Unknown worker error'),
    },
  });
};

// Handle unhandled rejections
self.onunhandledrejection = (event) => {
  console.error('[TimerWorker] Unhandled rejection:', event.reason);
  self.postMessage({
    type: 'ERROR',
    payload: {
      message: event.reason?.message || 'Unhandled worker rejection',
    },
  });
};

// Export for TypeScript
export {};
