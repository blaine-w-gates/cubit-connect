/**
 * Timer Web Worker - Production Build Version
 *
 * Located in /public to bypass Next.js bundler issues.
 * This ensures 100% production resilience.
 *
 * Uses Date.now() for wall-clock timing to match React thread.
 */

// Environment detection - only log in development
const isDev = typeof self !== 'undefined' && self.location && self.location.hostname === 'localhost';

// Conditional logging helper
function devLog(...args) {
  if (isDev) {
    console.log(...args);
  }
}
function devWarn(...args) {
  if (isDev) {
    console.warn(...args);
  }
}
function devError(...args) {
  if (isDev) {
    console.error(...args);
  }
}

// Constants
const TICK_INTERVAL_MS = 1000; // 1 second timer tick interval

// Worker state
let intervalId = null;
let startTime = 0;
let duration = 0;
let pausedDuration = 0;
let isPaused = false;
let pauseStartTime = 0;

// Post message helper
function postMessageToMain(response) {
  self.postMessage(response);
}

/**
 * Start the timer with specified duration
 * @param {number} durationMs - Timer duration in milliseconds
 * @param {number} startedAt - Timestamp when timer started (Date.now())
 * @param {number} [totalPausedMs=0] - Total time already spent paused
 */
function startTimer(durationMs, startedAt, totalPausedMs = 0) {
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
  intervalId = setInterval(() => {
    if (isPaused) return;
    
    const now = Date.now();
    const elapsed = now - startTime - pausedDuration;
    const remaining = Math.max(0, duration - elapsed);
    
    // Send tick every interval
    sendTick();
    
    // Check for completion
    if (remaining <= 0) {
      completeTimer();
    }
  }, TICK_INTERVAL_MS);
}

/**
 * Pause the currently running timer
 */
function pauseTimer() {
  if (!isPaused) {
    isPaused = true;
    pauseStartTime = Date.now();
    devLog('[TimerWorker] Timer paused at:', pauseStartTime);
  }
}

/**
 * Resume a paused timer
 * @param {number} totalPausedMs - Accumulated paused duration before this resume
 */
function resumeTimer(totalPausedMs) {
  if (isPaused) {
    const now = Date.now();
    const additionalPausedDuration = now - pauseStartTime;
    pausedDuration = totalPausedMs + additionalPausedDuration;
    isPaused = false;
    devLog('[TimerWorker] Timer resumed, additional pause duration:', additionalPausedDuration);
  }
}

/**
 * Stop and reset the timer without marking as complete
 */
function stopTimer() {
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
  
  devLog('[TimerWorker] Timer stopped');
}

/**
 * Mark timer as completed and stop it
 */
function completeTimer() {
  stopTimer();
  postMessageToMain({ type: 'COMPLETE' });
  devLog('[TimerWorker] Timer completed');
}

// Send current status to main thread
function sendTick() {
  console.log('[TimerWorker] sendTick called');
  const now = Date.now();
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
function getStatus() {
  const now = Date.now();
  
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
function handleDriftCheck() {
  if (!startTime || isPaused) return;
  
  // This is called when main thread suspects drift
  // We just send a fresh tick with current accurate values
  sendTick();
}

// Message handler
self.onmessage = (e) => {
  const { type, payload } = e.data;
  
  switch (type) {
    case 'START': {
      if (payload?.durationMs !== undefined && payload?.startedAt !== undefined) {
        startTimer(payload.durationMs, payload.startedAt, payload.totalPausedMs || 0);
      } else {
        devError('[TimerWorker] START message missing required payload');
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
        devError('[TimerWorker] RESUME message missing totalPausedMs');
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
      devWarn('[TimerWorker] Unknown message type:', type);
    }
  }
};

// Handle errors
self.onerror = (event, source, lineno, colno, error) => {
  devError('[TimerWorker] Error:', { event, source, lineno, colno, error });
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
  devError('[TimerWorker] Unhandled rejection:', event.reason);
  self.postMessage({
    type: 'ERROR',
    payload: {
      message: event.reason?.message || 'Unhandled worker rejection',
    },
  });
};
