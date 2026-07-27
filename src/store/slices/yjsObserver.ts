/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Yjs Observer — Extracts CRDT state into Zustand on Yjs document updates.
 *
 * Handles:
 * - Outbound broadcast (live diffs + idle checkpoints)
 * - Inbound catch-up render throttle (debounced Zustand updates)
 * - Structural sharing via micro-caches and dirty tracking
 *
 * Extracted from useAppStore.ts as part of store decomposition (#25).
 */

import * as Y from 'yjs';
import type { TaskItem, TodoProject } from '@/services/storage';
import { yjsContext } from '@/lib/yjsContext';
import {
  extractTodoProjectFromYMap,
  extractTaskItemFromYMap,
  sortYMapList,
} from '@/lib/yjsHelpers';
import {
  markObserverRegistered,
  markObserverRegisteredInStateMachine,
  recordZustandUpdate,
  getInstanceId,
} from '@/lib/syncDiagnostics';

/**
 * Ensures the Yjs observer is registered on the current yjsContext.ydoc instance.
 * Idempotent — only registers if the observer's ydoc ID doesn't match the current ydoc.
 * Replaces the 4 duplicated 3-line patterns in useAppStore.ts.
 */
export function ensureObserverRegistered(
  set: (partial: any) => void,
  get: () => any,
  idleCheckpointDelay: number
) {
  const currentYdocId = getInstanceId(yjsContext.ydoc);
  const observerId = (yjsContext.ydoc as { __observerId?: string }).__observerId;

  if (observerId !== currentYdocId) {
    registerYjsObserver(set, get, idleCheckpointDelay);
    (yjsContext.ydoc as { __observerId?: string }).__observerId = currentYdocId;
  }
}

/**
 * Shared Yjs→Zustand sync logic.
 *
 * Takes already-extracted project/task arrays (allowing the observer to pass
 * cache-optimized values), sorts projects, resolves the active project,
 * extracts document metadata (transcript, projectType, etc.), and calls set().
 *
 * Used by both the observer's debounced handler and syncFromYjs.
 *
 * NOTE: This function does NOT do caching/dirty tracking itself. The observer
 * applies micro-caches + dirty tracking BEFORE calling this function, achieving
 * O(1) for unchanged items. syncFromYjsDirect calls this with fresh extractions
 * (O(n) on every call) — do NOT add caching here, as syncFromYjs is called
 * manually (not from an observer context with dirty tracking).
 */
export function syncYjsToZustand(
  set: (partial: any) => void,
  get: () => any,
  sharedProjects: TodoProject[],
  sharedTasks: TaskItem[],
  useRaf: boolean = false
) {
  const updatedProjects = sortYMapList(sharedProjects);

  const currentActiveId = get().activeProjectId;
  const actProj = updatedProjects.find(p => p.id === currentActiveId) || updatedProjects[0];

  // --- Document State Render Engine ---
  let transcript = get().transcript;
  const textFromCRDT = yjsContext.yTranscript.toString();
  transcript = textFromCRDT === "" ? null : textFromCRDT;

  let projectType = get().projectType;
  if (yjsContext.yMetaMap.has('projectType')) projectType = yjsContext.yMetaMap.get('projectType');

  let projectTitle = get().projectTitle;
  if (yjsContext.yMetaMap.has('projectTitle')) projectTitle = yjsContext.yMetaMap.get('projectTitle');

  let scoutResults = get().scoutResults;
  if (yjsContext.yMetaMap.has('scoutResults')) {
    const raw = yjsContext.yMetaMap.get('scoutResults');
    if (raw) {
      if (JSON.stringify(scoutResults) !== raw) {
        try { scoutResults = JSON.parse(raw); } catch {
          // INTENTIONALLY IGNORING: Corrupted Yjs metadata - keep existing state
        }
      }
    }
  }

  let scoutHistory = get().scoutHistory;
  if (yjsContext.yMetaMap.has('scoutHistory')) {
    const raw = yjsContext.yMetaMap.get('scoutHistory');
    if (raw) {
      if (JSON.stringify(scoutHistory) !== raw) {
        try { scoutHistory = JSON.parse(raw); } catch {
          // INTENTIONALLY IGNORING: Corrupted Yjs metadata - keep existing state
        }
      }
    }
  }

  const stateUpdate = {
    todoProjects: updatedProjects,
    tasks: sharedTasks,
    activeProjectId: actProj?.id || null,
    todoRows: actProj ? actProj.todoRows : [],
    priorityDials: actProj ? actProj.priorityDials : { left: '', right: '', focusedSide: 'none' },
    transcript,
    projectType,
    projectTitle,
    scoutResults,
    scoutHistory,
  };

  if (useRaf) {
    requestAnimationFrame(() => {
      set(stateUpdate);
      recordZustandUpdate(yjsContext.ydoc);
    });
  } else {
    set(stateUpdate);
    recordZustandUpdate(yjsContext.ydoc);
  }
}

/**
 * Convenience wrapper for syncFromYjs — extracts without caching, then syncs.
 */
export function syncFromYjsDirect(set: (partial: any) => void, get: () => any) {
  const rawYProjects = Array.from(yjsContext.yProjectsMap.values()).filter(p => !p.get('isDeleted'));
  const rawYTasks = Array.from(yjsContext.yTasksMap.values()).filter(t => !t.get('isDeleted'));

  const sharedProjects = rawYProjects.map(yProj => extractTodoProjectFromYMap(yProj));
  const sharedTasks = rawYTasks.map(yTask => extractTaskItemFromYMap(yTask));

  syncYjsToZustand(set, get, sharedProjects, sharedTasks, false);
}

/**
 * Register the main Yjs update observer on the current yjsContext.ydoc instance.
 * This handles both outbound broadcast (for local changes) and inbound UI updates (for network changes).
 * Must be called whenever a new yjsContext.ydoc is created (in resetYDoc) to ensure the observer is on the correct instance.
 */
export function registerYjsObserver(
  set: (partial: any) => void,
  get: () => any,
  idleCheckpointDelay: number
) {
  // Track observer registration
  markObserverRegistered(yjsContext.ydoc, 'registerYjsObserver');
  markObserverRegisteredInStateMachine();

  // ---------------------------------------------------------------------------
  // ⚛️ THE REACT OBSERVER PATTERN (One-Way Data Flow & Structural Sharing)
  // ---------------------------------------------------------------------------

  // MICRO-CACHES: These ensure we only generate new Object references
  // if the underlying Y.Map JSON actually changed. This is our "React Re-Render Armor".
  // NOTE: These are LOCAL to registerYjsObserver, recreated per observer instance.
  const observerTaskCache = new Map<string, { json: string, parsed: TaskItem }>();
  const observerProjectCache = new Map<string, { json: string, parsed: TodoProject }>();

  // DIRTY TRACKER: O(1) change detection without modifying mutation sites.
  // Yjs observeDeep tells us exactly which projects/tasks changed.
  const dirtyProjectIds = new Set<string>();
  const dirtyTaskIds = new Set<string>();

  // Listen for deep changes in projects
  yjsContext.yProjectsMap.observeDeep((events) => {
    events.forEach(event => {
      // If a child changed, the project ID is the first key in the path
      if (event.path.length > 0) dirtyProjectIds.add(event.path[0] as string);
      // If a project was added/removed from the root map
      else if (event.target === yjsContext.yProjectsMap && 'keysChanged' in event) {
        (event.keysChanged as Set<string>).forEach((key: string) => dirtyProjectIds.add(key));
      }
    });
  });

  // Listen for deep changes in tasks
  yjsContext.yTasksMap.observeDeep((events) => {
    events.forEach(event => {
      // If a child changed, the task ID is the first key in the path
      if (event.path.length > 0) dirtyTaskIds.add(event.path[0] as string);
      // If a task was added/removed from the root map
      else if (event.target === yjsContext.yTasksMap && 'keysChanged' in event) {
        (event.keysChanged as Set<string>).forEach((key: string) => dirtyTaskIds.add(key));
      }
    });
  });

  yjsContext.ydoc.on('update', (update: Uint8Array, origin: any) => {
    // THE ECHO STORM PREVENTION (Outbound Broadcast)
    if (origin !== 'network' && yjsContext.syncManager) {
      set({ hasUnsyncedChanges: true });
      // BAND 1: Instantly broadcast tiny live diffs
      yjsContext.syncManager.broadcastUpdate(update);

      // BAND 2: The Deep Idle Checkpoint (30 seconds)
      // Reset the inactivity timer every time the user types.
      if (yjsContext.idleCheckpointTimer) clearTimeout(yjsContext.idleCheckpointTimer);
      yjsContext.idleCheckpointTimer = setTimeout(() => {
        const fullState = Y.encodeStateAsUpdate(yjsContext.ydoc);
        yjsContext.syncManager?.broadcastCheckpoint(fullState);
      }, idleCheckpointDelay);
    }

    // --- THE CATCH-UP RENDER THROTTLE ---
    // When the WebSocket sends 1 Checkpoint + 100 Live Diffs, this event fires 101 times in 10ms.
    // If we call set() every time, React freezes. We debounce the actual Zustand update.
    if ((window as any)._crdtRenderDebounce) {
      clearTimeout((window as any)._crdtRenderDebounce);
    }

    (window as any)._crdtRenderDebounce = setTimeout(() => {
      // 1. Extract raw lists but filter out tombstones immediately
      const rawYProjects = Array.from(yjsContext.yProjectsMap.values()).filter(p => !p.get('isDeleted'));
      const rawYTasks = Array.from(yjsContext.yTasksMap.values()).filter(t => !t.get('isDeleted'));

      // 2. Map through cache for Structural Sharing with O(1) dirty check early bail
      const sharedProjects = rawYProjects.map(yProj => {
        const id = yProj.get('id');
        const cached = observerProjectCache.get(id);
        // O(1) early bail: if not dirty and cache exists, skip expensive extraction
        if (!dirtyProjectIds.has(id) && cached) return cached.parsed;
        // Slow path: extract and cache
        const parsed = extractTodoProjectFromYMap(yProj);
        const json = JSON.stringify(parsed);
        observerProjectCache.set(id, { json, parsed });
        return parsed;
      });
      // Clear dirty tracker after processing
      dirtyProjectIds.clear();

      // 2b. Map through cache for Structural Sharing with O(1) dirty check early bail
      const sharedTasks = rawYTasks.map(yTask => {
        const id = yTask.get('id');
        const cached = observerTaskCache.get(id);
        // O(1) early bail: if not dirty and cache exists, skip expensive extraction
        if (!dirtyTaskIds.has(id) && cached) return cached.parsed;
        // Slow path: extract and cache
        const parsed = extractTaskItemFromYMap(yTask);
        const json = JSON.stringify(parsed);
        observerTaskCache.set(id, { json, parsed });
        return parsed;
      });
      // Clear dirty tracker after processing
      dirtyTaskIds.clear();

      // 3. Sync to Zustand (with requestAnimationFrame for batched renders)
      syncYjsToZustand(set, get, sharedProjects, sharedTasks, true);
    }, 100);
  });
}
