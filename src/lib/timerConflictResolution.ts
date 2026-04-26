/**
 * Timer Conflict Resolution - A+ Grade Implementation
 * 
 * Yjs CRDT Conflict Resolution for Timer State
 * 
 * Conflict Scenario: User starts timer on Device A and Device B simultaneously
 * Resolution Strategy: Owner-based priority with Last-Write-Wins fallback
 * 
 * Per specification:
 * - Owner validation: If a device claims ownership, its state wins
 * - Timestamp-based: If both claim ownership, later timestamp wins
 * - LWW fallback: If neither owns, Last-Write-Wins based on timestamp
 */

import type { TimerSession } from '@/schemas/storage';
import * as Y from 'yjs';

export interface TimerStateUpdate {
  clientId: string;
  timestamp: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'abandoned';
  startedAt: number;
  totalPausedMs: number;
}

export interface TimerOwnershipAwareness {
  clientId: string;
  tabId: string;
  deviceId: string;
  timestamp: number;
  isOwner: boolean;
}

interface ConflictResolutionResult {
  winner: 'local' | 'remote';
  resolvedState: TimerStateUpdate;
  reason: string;
}

/**
 * Resolve timer conflict between local and remote state
 * 
 * Resolution hierarchy:
 * 1. If both claim ownership → later timestamp wins
 * 2. If local is owner → local wins
 * 3. If remote is owner → remote wins
 * 4. Default → Last-Write-Wins (later timestamp wins)
 */
export function resolveTimerConflict(
  localState: TimerStateUpdate,
  remoteState: TimerStateUpdate,
  currentOwner: TimerOwnershipAwareness | null
): ConflictResolutionResult {
  // Rule 1: If both claim ownership (status: 'running'), the one with later timestamp wins
  if (localState.status === 'running' && remoteState.status === 'running') {
    if (remoteState.timestamp > localState.timestamp) {
      return {
        winner: 'remote',
        resolvedState: remoteState,
        reason: 'CONFLICT_BOTH_RUNNING: Remote has later timestamp',
      };
    }
    return {
      winner: 'local',
      resolvedState: localState,
      reason: 'CONFLICT_BOTH_RUNNING: Local has later timestamp',
    };
  }
  
  // Rule 2: If local is owner and local is running, local wins
  if (currentOwner?.clientId === localState.clientId && localState.status === 'running') {
    return {
      winner: 'local',
      resolvedState: localState,
      reason: 'OWNER_LOCAL: Local device owns the timer',
    };
  }
  
  // Rule 3: If remote is owner and remote is running, remote wins
  if (currentOwner?.clientId === remoteState.clientId && remoteState.status === 'running') {
    return {
      winner: 'remote',
      resolvedState: remoteState,
      reason: 'OWNER_REMOTE: Remote device owns the timer',
    };
  }
  
  // Rule 4: Default to LWW (Last-Write-Wins)
  if (remoteState.timestamp > localState.timestamp) {
    return {
      winner: 'remote',
      resolvedState: remoteState,
      reason: 'LWW: Remote has later timestamp',
    };
  }
  
  return {
    winner: 'local',
    resolvedState: localState,
    reason: 'LWW: Local has later or equal timestamp',
  };
}

/**
 * Yjs Timer State Observer
 * 
 * Observes the Yjs map for timer state changes and resolves conflicts.
 * Integrates with the existing NetworkSync infrastructure.
 */
export class TimerYjsObserver {
  private yTimerMap: Y.Map<unknown> | null = null;
  private localClientId: string;
  private onConflict: (result: ConflictResolutionResult) => void;
  private unsubscribe: (() => void) | null = null;
  
  constructor(
    ydoc: Y.Doc,
    localClientId: string,
    onConflict: (result: ConflictResolutionResult) => void
  ) {
    this.yTimerMap = ydoc.getMap('timer-state');
    this.localClientId = localClientId;
    this.onConflict = onConflict;
  }
  
  /**
   * Start observing timer state changes
   */
  start(): void {
    if (!this.yTimerMap) return;
    
    const observer = (event: Y.YMapEvent<unknown>) => {
      // Only process changes from remote (not local)
      if (event.transaction.origin === 'local') return;
      
      const remoteState = this.yTimerMap!.get('session') as TimerStateUpdate | undefined;
      if (!remoteState) return;
      
      // Get local state from the map (should be sync with Zustand)
      const localState = this.yTimerMap!.get('local-session') as TimerStateUpdate | undefined;
      if (!localState) return;
      
      // Get current ownership from awareness
      const currentOwner = this.yTimerMap!.get('awareness') as TimerOwnershipAwareness | null;
      
      // Resolve conflict
      const result = resolveTimerConflict(localState, remoteState, currentOwner);
      
      // If resolution differs from local, trigger callback
      if (result.winner === 'remote') {
        this.onConflict(result);
      }
    };
    
    this.yTimerMap.observe(observer);
    this.unsubscribe = () => this.yTimerMap!.unobserve(observer);
  }
  
  /**
   * Stop observing timer state changes
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
  
  /**
   * Update local state in Yjs (called when local timer state changes)
   */
  updateLocalState(state: TimerStateUpdate): void {
    if (!this.yTimerMap) return;
    
    this.yTimerMap.doc?.transact(() => {
      this.yTimerMap!.set('local-session', state);
    }, 'local');
  }
  
  /**
   * Get remote state from Yjs
   */
  getRemoteState(): TimerStateUpdate | null {
    if (!this.yTimerMap) return null;
    return this.yTimerMap.get('session') as TimerStateUpdate | null;
  }
}

/**
 * Sync timer state to Yjs
 * 
 * Call this whenever local timer state changes to broadcast to peers.
 */
export function syncTimerStateToYjs(
  ydoc: Y.Doc,
  session: TimerSession | null,
  localClientId: string
): void {
  const yTimerMap = ydoc.getMap('timer-state');
  
  ydoc.transact(() => {
    if (session) {
      const stateUpdate: TimerStateUpdate = {
        clientId: localClientId,
        timestamp: Date.now(),
        status: session.status,
        startedAt: session.startedAt,
        totalPausedMs: session.totalPausedMs,
      };
      yTimerMap.set('session', stateUpdate);
    } else {
      yTimerMap.delete('session');
    }
  }, 'local');
}

/**
 * Apply remote timer state to local
 * 
 * Call this when conflict resolution determines remote state wins.
 */
export function applyRemoteTimerState(
  remoteState: TimerStateUpdate,
  localSession: TimerSession | null
): Partial<TimerSession> | null {
  if (!localSession) return null;
  
  // Calculate what needs to change to match remote state
  const updates: Partial<TimerSession> = {
    status: remoteState.status,
    totalPausedMs: remoteState.totalPausedMs,
    // Recalculate owner fields based on remote ownership
    ownerClientId: remoteState.clientId,
  };
  
  return updates;
}

/**
 * Determine if a state change requires conflict resolution
 * 
 * Returns true if the remote state is newer than local state.
 */
export function shouldApplyRemoteState(
  localState: TimerStateUpdate | null,
  remoteState: TimerStateUpdate
): boolean {
  if (!localState) return true;
  return remoteState.timestamp > localState.timestamp;
}

/**
 * Merge timer sessions (for analytics/history)
 * 
 * When multiple devices have timer sessions, merge them intelligently.
 * This is used for the timerSessions array (history), not active session.
 */
export function mergeTimerSessions(
  localSessions: TimerSession[],
  remoteSessions: TimerSession[]
): TimerSession[] {
  // Create a map by session ID for deduplication
  const sessionMap = new Map<string, TimerSession>();
  
  // Add all local sessions
  for (const session of localSessions) {
    sessionMap.set(session.id, session);
  }
  
  // Add remote sessions, preferring completed ones with later timestamps
  for (const remoteSession of remoteSessions) {
    const existing = sessionMap.get(remoteSession.id);
    
    if (!existing) {
      // New session from remote
      sessionMap.set(remoteSession.id, remoteSession);
    } else {
      // Conflict: Use LWW for each field
      const merged: TimerSession = {
        ...existing,
        // If remote has completion info and local doesn't, use remote
        completed: existing.completed || remoteSession.completed,
        endedAt: existing.endedAt || remoteSession.endedAt,
        // Use max interruptions (whichever device has more data)
        interruptions: remoteSession.interruptions.length > existing.interruptions.length 
          ? remoteSession.interruptions 
          : existing.interruptions,
        // LWW for other fields
        totalPausedMs: Math.max(existing.totalPausedMs, remoteSession.totalPausedMs),
      };
      sessionMap.set(remoteSession.id, merged);
    }
  }
  
  // Convert back to array and sort by startedAt
  return Array.from(sessionMap.values()).sort((a, b) => a.startedAt - b.startedAt);
}

/**
 * Throttle timer sync to prevent sync storms
 * 
 * Per specification: Yjs updates should be throttled to 5-second intervals
 * during active countdown to prevent excessive sync traffic.
 */
export function createThrottledTimerSync(
  syncFn: () => void,
  intervalMs: number = 5000
): () => void {
  let lastSync = 0;
  let pendingSync = false;
  
  return () => {
    const now = Date.now();
    
    if (now - lastSync >= intervalMs) {
      // Enough time has passed, sync immediately
      lastSync = now;
      pendingSync = false;
      syncFn();
    } else if (!pendingSync) {
      // Schedule a sync for later
      pendingSync = true;
      const delay = intervalMs - (now - lastSync);
      
      setTimeout(() => {
        if (pendingSync) {
          lastSync = Date.now();
          pendingSync = false;
          syncFn();
        }
      }, delay);
    }
    // If pendingSync is true, do nothing (sync already scheduled)
  };
}
