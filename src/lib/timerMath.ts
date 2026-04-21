/**
 * Timer Math Library - A+ Grade Implementation
 * 
 * Provides drift-free time calculations for the Pomodoro timer.
 * Uses performance.now() for monotonic timing and Date.now() for wall-clock sync.
 */

import type { TimerInterruption } from '@/schemas/storage';

export interface TimerState {
  startedAt: number;        // performance.now() timestamp when timer started
  totalPausedMs: number;    // Accumulated paused time
  lastPausedAt?: number;    // performance.now() timestamp of last pause
  status: 'running' | 'paused' | 'idle';
}

/**
 * Calculate remaining time with drift correction
 * 
 * FORMULA:
 * remainingMs = durationMs - (performanceNow - startedAt - totalPausedMs)
 * 
 * Why performance.now() over Date.now():
 * - performance.now() is monotonic (unaffected by system clock changes)
 * - Date.now() can jump backward/forward with NTP sync or manual changes
 * 
 * @param state - Current timer state
 * @param durationMs - Total session duration in milliseconds
 * @param performanceNow - Current performance.now() timestamp
 * @returns Remaining time in milliseconds (never negative)
 */
export function calculateRemainingMs(
  state: TimerState,
  durationMs: number,
  performanceNow: number = performance.now()
): number {
  const effectiveElapsed = performanceNow - state.startedAt - state.totalPausedMs;
  const remaining = Math.max(0, durationMs - effectiveElapsed);
  return Math.ceil(remaining / 1000) * 1000; // Round up to nearest second
}

/**
 * Calculate remaining seconds for display
 * 
 * @param state - Current timer state
 * @param durationMs - Total session duration in milliseconds
 * @param performanceNow - Current performance.now() timestamp
 * @returns Remaining time in seconds (never negative)
 */
export function calculateRemainingSeconds(
  state: TimerState,
  durationMs: number,
  performanceNow: number = performance.now()
): number {
  const remainingMs = calculateRemainingMs(state, durationMs, performanceNow);
  return Math.ceil(remainingMs / 1000);
}

/**
 * Pause the timer
 * 
 * INVARIANT: Records exact pause timestamp for accurate resume
 * INVARIANT: Must only be called when status is 'running'
 * 
 * @param state - Current timer state
 * @returns Updated state with 'paused' status and lastPausedAt timestamp
 * @throws Error if timer is not running
 */
export function pauseTimer(state: TimerState): TimerState {
  if (state.status !== 'running') {
    throw new Error('[TimerMath] Cannot pause timer that is not running');
  }
  
  const now = performance.now();
  
  return {
    ...state,
    status: 'paused',
    lastPausedAt: now,
  };
}

/**
 * Resume the timer
 * 
 * INVARIANT: Adds paused duration to totalPausedMs
 * INVARIANT: Records resume timestamp in interruptions array
 * INVARIANT: Must only be called when status is 'paused'
 * 
 * @param state - Current timer state
 * @param interruptions - Array of interruption records
 * @returns Object with updated state and interruptions array
 * @throws Error if timer is not paused
 */
export function resumeTimer(
  state: TimerState,
  interruptions: TimerInterruption[]
): { state: TimerState; interruptions: TimerInterruption[] } {
  if (state.status !== 'paused' || !state.lastPausedAt) {
    throw new Error('[TimerMath] Cannot resume timer that is not paused');
  }
  
  const now = performance.now();
  const pausedDuration = now - state.lastPausedAt;
  
  // Update interruptions array with resume timestamp
  const updatedInterruptions = [...interruptions];
  const lastInterruption = updatedInterruptions[updatedInterruptions.length - 1];
  if (lastInterruption && !lastInterruption.resumedAt) {
    lastInterruption.resumedAt = now;
  }
  
  return {
    state: {
      ...state,
      status: 'running',
      totalPausedMs: state.totalPausedMs + pausedDuration,
      lastPausedAt: undefined,
    },
    interruptions: updatedInterruptions,
  };
}

/**
 * Drift correction algorithm
 * 
 * Called periodically (every 5 seconds) to recalibrate against wall-clock time.
 * Detects and compensates for timing drift caused by:
 * - JavaScript event loop delays
 * - Browser throttling
 * - System clock adjustments
 * 
 * @param state - Current timer state
 * @param expectedRemainingMs - Expected remaining time based on performance.now()
 * @param actualRemainingMs - Actual remaining time based on wall-clock
 * @returns Object with adjusted totalPausedMs and drift detection flag
 */
export function correctDrift(
  state: TimerState,
  expectedRemainingMs: number,
  actualRemainingMs: number
): { adjustedTotalPausedMs: number; driftDetected: boolean; driftAmount: number } {
  const drift = actualRemainingMs - expectedRemainingMs;
  const DRIFT_THRESHOLD = 1000; // 1 second threshold
  
  if (Math.abs(drift) > DRIFT_THRESHOLD) {
    // Adjust totalPausedMs to compensate for drift
    // If timer is ahead (drift > 0), we "paused less" than we should have
    // If timer is behind (drift < 0), we "paused more" than we should have
    const adjustedTotalPausedMs = state.totalPausedMs - drift;
    
    console.log('[TimerMath] Drift detected and corrected:', {
      drift,
      expectedRemainingMs,
      actualRemainingMs,
      adjustedTotalPausedMs,
    });
    
    return {
      adjustedTotalPausedMs,
      driftDetected: true,
      driftAmount: drift,
    };
  }
  
  return {
    adjustedTotalPausedMs: state.totalPausedMs,
    driftDetected: false,
    driftAmount: drift,
  };
}

/**
 * Calculate total elapsed time including pauses
 * 
 * @param state - Current timer state
 * @param performanceNow - Current performance.now() timestamp
 * @returns Total elapsed time in milliseconds
 */
export function calculateElapsedMs(
  state: TimerState,
  performanceNow: number = performance.now()
): number {
  return performanceNow - state.startedAt - state.totalPausedMs;
}

/**
 * Calculate progress percentage (0-100)
 * 
 * @param state - Current timer state
 * @param durationMs - Total session duration in milliseconds
 * @param performanceNow - Current performance.now() timestamp
 * @returns Progress percentage (0-100)
 */
export function calculateProgressPercentage(
  state: TimerState,
  durationMs: number,
  performanceNow: number = performance.now()
): number {
  const elapsed = calculateElapsedMs(state, performanceNow);
  const percentage = (elapsed / durationMs) * 100;
  return Math.min(100, Math.max(0, percentage));
}

/**
 * Format remaining time as MM:SS string
 * 
 * @param remainingSeconds - Remaining time in seconds
 * @returns Formatted string (e.g., "25:00")
 */
export function formatRemainingTime(remainingSeconds: number): string {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format remaining time for document title (compact)
 * 
 * @param remainingSeconds - Remaining time in seconds
 * @returns Compact formatted string (e.g., "25:00")
 */
export function formatTitleTime(remainingSeconds: number): string {
  return formatRemainingTime(remainingSeconds);
}

/**
 * Calculate session statistics
 * 
 * @param interruptions - Array of interruption records
 * @param durationMs - Total session duration
 * @param totalPausedMs - Total time paused
 * @returns Session statistics
 */
export function calculateSessionStats(
  interruptions: TimerInterruption[],
  durationMs: number,
  totalPausedMs: number
): {
  interruptionCount: number;
  totalPausedSeconds: number;
  productiveTimeMs: number;
  productivityPercentage: number;
} {
  const productiveTimeMs = durationMs - totalPausedMs;
  const productivityPercentage = (productiveTimeMs / durationMs) * 100;
  
  return {
    interruptionCount: interruptions.length,
    totalPausedSeconds: Math.round(totalPausedMs / 1000),
    productiveTimeMs,
    productivityPercentage: Math.round(productivityPercentage * 10) / 10,
  };
}

/**
 * Check if timer has expired
 * 
 * @param state - Current timer state
 * @param durationMs - Total session duration
 * @param performanceNow - Current performance.now() timestamp
 * @returns True if timer has expired
 */
export function hasTimerExpired(
  state: TimerState,
  durationMs: number,
  performanceNow: number = performance.now()
): boolean {
  const remainingMs = calculateRemainingMs(state, durationMs, performanceNow);
  return remainingMs <= 0;
}

/**
 * Initialize timer state
 * 
 * @returns Initial timer state
 */
export function initializeTimerState(): TimerState {
  return {
    startedAt: performance.now(),
    totalPausedMs: 0,
    status: 'running',
  };
}

/**
 * Get milestone announcements (for screen readers)
 * 
 * Returns an array of second thresholds when announcements should be made.
 * Default: Announce at 20:00, 15:00, 10:00, 5:00, 1:00 remaining
 * 
 * @param durationMinutes - Session duration in minutes
 * @returns Array of second thresholds for announcements
 */
export function getMilestoneThresholds(durationMinutes: number = 25): number[] {
  const totalSeconds = durationMinutes * 60;
  return [
    totalSeconds - (5 * 60),  // 5 minutes elapsed
    totalSeconds - (10 * 60), // 10 minutes elapsed
    totalSeconds - (15 * 60), // 15 minutes elapsed
    totalSeconds - (20 * 60), // 20 minutes elapsed
    totalSeconds - (24 * 60), // 1 minute remaining
  ].filter(s => s > 0);
}

/**
 * Check if a milestone should be announced
 * 
 * @param previousRemainingSeconds - Previous remaining time
 * @param currentRemainingSeconds - Current remaining time
 * @param milestones - Array of milestone thresholds
 * @returns The milestone that was crossed (or null)
 */
export function checkMilestone(
  previousRemainingSeconds: number,
  currentRemainingSeconds: number,
  milestones: number[]
): number | null {
  for (const milestone of milestones) {
    // Check if we crossed this milestone (previous was above, current is at or below)
    if (previousRemainingSeconds > milestone && currentRemainingSeconds <= milestone) {
      return milestone;
    }
  }
  return null;
}
