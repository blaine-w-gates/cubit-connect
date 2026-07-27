/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { storageService, TaskItem, CubitStep, TodoProject } from '@/services/storage';
import { GeminiEvents, GeminiService } from '@/services/gemini';
import { cryptoUtils } from '@/lib/crypto';
import { createTimerSlice, type TimerSliceState } from './slices/timerSlice';
import { createUISlice, type UISliceState } from './slices/uiSlice';
import { createAuthSlice, type AuthSliceState } from './slices/authSlice';
import { createTaskSlice, type TaskSliceState } from './slices/taskSlice';
import { createProjectMetaSlice, type ProjectMetaSliceState } from './slices/projectMetaSlice';
import { createLogSlice, type LogSliceState, type LogEntry } from './slices/logSlice';
import * as Y from 'yjs';
import {
  markObserverRegistered,
  markSyncAttached as markNetworkSyncAttached,
  transitionToPhase,
  markObserverRegisteredInStateMachine,
  enableDiagnostics,
  getInstanceId,
  assertInvariant,
  recordZustandUpdate,
} from '@/lib/syncDiagnostics';
import {
  yjsContext,
  getYDoc,
  resetYjsContext,
} from '@/lib/yjsContext';
// Re-export getYDoc for backwards compatibility (SyncDebugOverlay imports from useAppStore)
export { getYDoc };
import {
  bindTodoProjectToYMap,
  extractTodoProjectFromYMap,
  bindTaskItemToYMap,
  extractTaskItemFromYMap,
  sortYMapList,
  generateOrderKey,
  applyUpdateToYText,
} from '../lib/yjsHelpers';
import { getUseSupabaseSync } from '@/lib/featureFlags';
import { loadSupabaseSync } from '@/lib/supabaseSyncLoader';
import { getCleanupJobSystem } from '@/lib/cleanupJobs';
import { getDeviceId, getUnoWorkspaceId, type WorkspaceType } from '@/lib/identity';

// Initialize cleanup jobs system (auto-starts registered jobs)
getCleanupJobSystem();

// --- Yjs Context ---
// Mutable Yjs document state is now managed by yjsContext.ts.
// Use yjsContext.ydoc, yjsContext.yProjectsMap, etc.
// resetYDoc is replaced by resetYjsContext(syncFromYjsCallback).

// Wrapper to maintain the resetYDoc call site API
async function resetYDoc(): Promise<Y.Doc> {
  return resetYjsContext(() => useAppStore.getState().syncFromYjs());
}
// -------------------------

/**
 * Register the main Yjs update observer on the current yjsContext.ydoc instance.
 * This handles both outbound broadcast (for local changes) and inbound UI updates (for network changes).
 * Must be called whenever a new yjsContext.ydoc is created (in resetYDoc) to ensure the observer is on the correct instance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function registerYjsObserver(set: any, get: any) {
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
    // IMMEDIATE FIRST LOG - before ANY other logic
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    
    // CRITICAL DEBUG: Log ALL origins to see if network updates trigger this
    if (origin === 'network') {
    }
    
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
      }, IDLE_CHECKPOINT_DELAY);
    }

    // --- THE CATCH-UP RENDER THROTTLE ---
    // When the WebSocket sends 1 Checkpoint + 100 Live Diffs, this event fires 101 times in 10ms.
    // If we call set() every time, React freezes. We debounce the actual Zustand update.
    if ((window as any)._crdtRenderDebounce) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clearTimeout((window as any)._crdtRenderDebounce);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      requestAnimationFrame(() => {
        set({
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
        });
        
        // Track that Zustand state was updated from Yjs
        recordZustandUpdate(yjsContext.ydoc);
      });
    }, 100);
  });
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}

export interface ProjectState extends AuthSliceState, TaskSliceState, UISliceState, TimerSliceState, ProjectMetaSliceState, LogSliceState {
  apiKey: string;
  setApiKey: (key: string) => void;
  isHydrated: boolean;
  tasks: TaskItem[];

  // Store-level actions (tightly coupled to observer/sync internals)
  syncFromYjs: () => void;
  loadProject: () => Promise<void>;
  resetProject: () => Promise<void>;
  exportAndClearData: () => Promise<void>;
  fullLogout: () => Promise<void>;

  // --- Workspace State (ADR-001) ---
  activeWorkspaceType: WorkspaceType;
  activeWorkspaceId: string;
  deviceId: string;
  switchWorkspace: (workspaceType: WorkspaceType, workspaceId?: string) => Promise<void>;

  // --- Network Sync Actions & State ---
  syncStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  roomFingerprint: string | null;
  lastSyncedAt: number | null;
  hasUnsyncedChanges: boolean;
  hasPeers: boolean;
  lastPeerSeenAt: number;
  connectToSyncServer: (passphrase: string) => Promise<void>;
  disconnectSyncServer: () => void;
  flushSyncNow: () => Promise<void>;
}

export type { LogEntry };



const STORAGE_KEY_API = 'cubit_api_key';

// MIGRATION MUTEX: Prevents React.StrictMode from double-booting legacy JSON into Yjs
let isMigrating = false;

// yjsContext.syncManager and yjsContext.idleCheckpointTimer are now in yjsContext
let loadProjectInFlight: Promise<void> | null = null;
let peerEditingTimer: NodeJS.Timeout | null = null;
let connectToSyncServerInFlight = false;

// Test environment detection - reduce checkpoint timer for faster e2e tests and local dev
const isTestEnvironment = typeof window !== 'undefined' && (
  (window as any).__PLAYWRIGHT__ || 
  window.location.hostname === 'localhost'
);
const IDLE_CHECKPOINT_DELAY = isTestEnvironment ? 500 : 30000; // 500ms in tests/local dev, 30s in production

export const useAppStore = create<ProjectState>((set, get) => ({
  // Initial State
  apiKey:
    typeof window !== 'undefined'
      ? cryptoUtils.decrypt(localStorage.getItem(STORAGE_KEY_API) || '')
      : '',
  setApiKey: (key: string) => {
    const safeKey = cryptoUtils.cleanInput(key);
    const encrypted = cryptoUtils.encrypt(safeKey);
    localStorage.setItem(STORAGE_KEY_API, encrypted);
    GeminiService.resetState();
    set({ apiKey: safeKey });
  },
  isHydrated: false,
  tasks: [],

  // --- Project Meta Slice (extracted to projectMetaSlice.ts) ---
  ...createProjectMetaSlice(set, get),

  // --- UI Slice (extracted to uiSlice.ts) ---
  ...createUISlice(set),

  hasPeers: false,
  lastPeerSeenAt: 0,

  // --- Task Slice (extracted to taskSlice.ts) ---
  ...createTaskSlice(set, get),

  // --- Auth Slice (extracted to authSlice.ts) ---
  ...createAuthSlice(set, get),

  // --- Workspace State (ADR-001) ---
  activeWorkspaceType: (typeof window !== 'undefined' ? localStorage.getItem('active_workspace_type') as WorkspaceType : null) || 'personalUno',
  activeWorkspaceId: (typeof window !== 'undefined' ? localStorage.getItem('active_workspace_id') : null) || (typeof window !== 'undefined' ? getUnoWorkspaceId() : ''),
  deviceId: typeof window !== 'undefined' ? getDeviceId() : '',

  switchWorkspace: async (workspaceType: WorkspaceType, workspaceId?: string) => {
    const wsId = workspaceId || (workspaceType === 'personalUno' ? getUnoWorkspaceId() : '');
    if (!wsId) {
      return;
    }

    // 1. If switching TO personalUno, disconnect sync (uno data never leaves browser)
    if (workspaceType === 'personalUno' && yjsContext.syncManager) {
      if (yjsContext.idleCheckpointTimer) { clearTimeout(yjsContext.idleCheckpointTimer); yjsContext.idleCheckpointTimer = null; }
      yjsContext.syncManager.disconnect();
      yjsContext.syncManager = null;
      set({ syncStatus: 'disconnected', roomFingerprint: null });
    }

    // 2. Create a fresh Y.Doc so no data from the old workspace leaks
    await resetYDoc();
    isMigrating = false;
    loadProjectInFlight = null;

    // 3. Flip workspace pointers and mark un-hydrated so loadProject re-runs
    set({
      activeWorkspaceType: workspaceType,
      activeWorkspaceId: wsId,
      isHydrated: false,
    });

    // 4. Reload from the target namespace's IndexedDB
    const { loadProject } = get();
    await loadProject();
  },

  // --- Network Sync Actions & State ---
  syncStatus: 'disconnected',
  roomFingerprint: null,
  lastSyncedAt: null,
  hasUnsyncedChanges: false,

  // --- Network Sync Actions ---
  connectToSyncServer: async (passphrase: string) => {
    // RE-ENTRY GUARD: Prevent concurrent connectToSyncServer calls
    if (connectToSyncServerInFlight) {
      return;
    }
    connectToSyncServerInFlight = true;

    const { isHydrated } = get();
    if (!isHydrated) {
      connectToSyncServerInFlight = false;
      return;
    }

    set({ syncStatus: 'connecting', roomFingerprint: null });
    transitionToPhase('initializing');

    try {
      if (yjsContext.syncManager) {
        yjsContext.syncManager.disconnect();
        yjsContext.syncManager = null;
      }
      if (yjsContext.idleCheckpointTimer) {
        clearTimeout(yjsContext.idleCheckpointTimer);
        yjsContext.idleCheckpointTimer = null;
      }

      const { deriveRoomId, deriveSyncKey } = await import('@/lib/cryptoSync');
      const roomIdHash = await deriveRoomId(passphrase);
      const syncKey = await deriveSyncKey(passphrase);

      const roomFingerprint = roomIdHash.slice(0, 4).toUpperCase();
      set({ roomFingerprint });

      // ADR-001: Switch to personalMulti workspace scoped by this room.
      // Skip reset if we're reconnecting to the same room (preserves offline edits).
      const currentWsType = get().activeWorkspaceType;
      const currentWsId = get().activeWorkspaceId;
      const isSameRoom = currentWsType === 'personalMulti' && currentWsId === roomIdHash;
      

      // Track if we already reset in this call to prevent double-reset
      let didResetInThisCall = false;

      if (!isSameRoom) {
        await resetYDoc();
        didResetInThisCall = true;
        isMigrating = false;
        loadProjectInFlight = null;

        set({
          activeWorkspaceType: 'personalMulti',
          activeWorkspaceId: roomIdHash,
          isHydrated: false,
        });

        const { loadProject } = get();
        transitionToPhase('loadProject_start', { ydocId: getInstanceId(yjsContext.ydoc) });
        await loadProject();
        transitionToPhase('loadProject_complete', { ydocId: getInstanceId(yjsContext.ydoc) });
      } else {
      }

      // CRITICAL: Check if yjsContext.ydoc is destroyed/missing and recreate it
      // This can happen when reconnecting to same room after disconnect
      // BUT: Skip if we already reset in this call (prevents double-reset bug)
      const currentYdocId = getInstanceId(yjsContext.ydoc);
      if (!currentYdocId && !didResetInThisCall) {
        await resetYDoc();
      } else if (!currentYdocId && didResetInThisCall) {
      }

      // Yjs observer should be registered by loadProject() when it runs after resetYDoc()
      // But if loadProject didn't run or skipped registration, register it now
      const finalYdocId = getInstanceId(yjsContext.ydoc);
      const observerYdocId = (yjsContext.ydoc as { __observerId?: string }).__observerId;

      if (observerYdocId !== finalYdocId) {
        registerYjsObserver(set, get);
        (yjsContext.ydoc as { __observerId?: string }).__observerId = finalYdocId;
      }

      // CRITICAL INVARIANT: Observer must be registered before sync manager creation
      const finalObserverYdocId = (yjsContext.ydoc as { __observerId?: string }).__observerId;
      const actualYdocId = getInstanceId(yjsContext.ydoc);
      
      assertInvariant(
        'Observer registered on current yjsContext.ydoc before sync creation',
        actualYdocId,
        finalObserverYdocId,
        { 
          currentYdocId: actualYdocId, 
          observerYdocId: finalObserverYdocId,
          phase: 'pre-sync',
        }
      );

      // Check feature flag for transport selection
      const useSupabase = getUseSupabaseSync();

      if (useSupabase) {
        // Use SupabaseSync (experimental) - LAZY LOADED

        try {
          // Dynamically import SupabaseSync (code splitting)
          const SupabaseSyncClass = await loadSupabaseSync();

          yjsContext.syncManager = new SupabaseSyncClass(
            yjsContext.ydoc,
            roomIdHash,
            (status) => {
              set({ syncStatus: status });
              if (status !== 'connected') set({ hasPeers: false });
            },
            () => {
              // CRITICAL FIX: Force immediate state sync when checkpoint arrives
              const { syncFromYjs } = get();
              syncFromYjs();
              set({ lastSyncedAt: Date.now(), hasUnsyncedChanges: false });
            },
            () => {
              // Peer Presence pulse
              set({ hasPeers: true, lastPeerSeenAt: Date.now() });
            },
            () => {
              // Explicit Peer Disconnect
              set({ hasPeers: false });
            },
            (isEditing) => {
              // --- TURN-BASED LOCKING (STRICT MODE) ---
              if (isEditing) {
                set({ peerIsEditing: true });
                if (peerEditingTimer) clearTimeout(peerEditingTimer);
                peerEditingTimer = setTimeout(() => {
                  set({ peerIsEditing: false });
                  peerEditingTimer = null;
                }, 3000); // 3-Second Turn Reservation
              }
            }
          );
        } catch (loadError) {
          // SupabaseSync load failed - log error and abort connection
          console.error('[SYNC DEBUG] Failed to load SupabaseSync:', loadError);

          // Emit telemetry
          const { emitTelemetry } = await import('@/lib/featureFlags');
          emitTelemetry('error_boundary_triggered', {
            context: {
              error: 'supabase_load_failed',
              message: loadError instanceof Error ? loadError.message : String(loadError),
            },
          });

          connectToSyncServerInFlight = false;
          set({ syncStatus: 'error' });
          return;
        }
      } else {
        // Supabase sync disabled via feature flag
        connectToSyncServerInFlight = false;
        return;
      }

      // Mark this yjsContext.ydoc as having sync attached for diagnostics
      markNetworkSyncAttached(yjsContext.ydoc, 'supabase-sync-' + Date.now());

      // Presence Watchdog: Revert to "Alone" if no pulse for 12 seconds
      if ((window as any)._presenceWatchdog) clearInterval((window as any)._presenceWatchdog);
      (window as any)._presenceWatchdog = setInterval(() => {
        const { lastPeerSeenAt, hasPeers } = get();
        if (hasPeers && Date.now() - lastPeerSeenAt > 12000) {
          set({ hasPeers: false });
        }
      }, 3000);

      try {
        await yjsContext.syncManager.connect(syncKey);
        transitionToPhase('sync_connecting', { ydocId: getInstanceId(yjsContext.ydoc), roomHash: roomIdHash });
      } catch (connectError) {
        // Connection failed - log and abort
        console.error('[SYNC DEBUG] Connection failed:', connectError);
        
        if (useSupabase && yjsContext.syncManager) {
          // Emit telemetry for connection failure
          const { emitTelemetry } = await import('@/lib/featureFlags');
          emitTelemetry('transport_switched', {
            from: 'supabase',
            to: 'offline',
            context: { reason: 'supabase_connection_failed' },
          });

          // Clean up failed Supabase connection
          yjsContext.syncManager.disconnect();

          connectToSyncServerInFlight = false;
          set({ syncStatus: 'error' });
          return;
        } else {
          // Not Supabase or no yjsContext.syncManager, rethrow
          throw connectError;
        }
      }

      if (!(window as any)._unloadListenerBound) {
        (window as any)._unloadListenerBound = true;
        window.addEventListener('beforeunload', () => {
          yjsContext.syncManager?.sendDisconnectSignal();
        });
      }

      set({ lastSyncedAt: Date.now(), hasUnsyncedChanges: false });
      transitionToPhase('live', { ydocId: getInstanceId(yjsContext.ydoc), roomHash: roomIdHash });
    } catch (err) {
      // INTENTIONALLY HANDLING: E2EE connection failure reported to user
      // Error state set for UI to display, connection flag cleared
      console.error("Failed to connect to E2EE Relay:", err);
      transitionToPhase('error', { ydocId: getInstanceId(yjsContext.ydoc), error: String(err) });
      set({ syncStatus: 'error', roomFingerprint: null });
    } finally {
      connectToSyncServerInFlight = false;
    }
  },

  disconnectSyncServer: () => {
    if (yjsContext.idleCheckpointTimer) {
      clearTimeout(yjsContext.idleCheckpointTimer);
      yjsContext.idleCheckpointTimer = null;
    }
    if (yjsContext.syncManager) {
      yjsContext.syncManager.disconnect();
      yjsContext.syncManager = null;
    }
    if ((window as any)._presenceWatchdog) {
      clearInterval((window as any)._presenceWatchdog);
      (window as any)._presenceWatchdog = null;
    }
    // Stay in personalMulti (offline); data persists in IDB namespace.
    // User can manually switch back to personalUno via WorkspaceSelector.
    set({ syncStatus: 'disconnected', roomFingerprint: null, hasPeers: false });
  },

  flushSyncNow: async () => {
    if (!yjsContext.syncManager) return;
    const fullState = Y.encodeStateAsUpdate(yjsContext.ydoc);
    await yjsContext.syncManager.broadcastCheckpoint(fullState);
    set({ lastSyncedAt: Date.now(), hasUnsyncedChanges: false });
  },

  // --- Log Slice (extracted to logSlice.ts) ---
  ...createLogSlice(set, get),

  // --- Today Page / Pomodoro Timer (extracted to timerSlice) ---
  ...createTimerSlice(set, get),

  // setVideoHandleState moved to uiSlice.ts

  loadProject: async () => {
    // CRITICAL: Always ensure observer is registered on the current yjsContext.ydoc instance
    // This must happen BEFORE any early returns to prevent observer loss on reconnection
    const currentYdocId = getInstanceId(yjsContext.ydoc);
    const observerId = (yjsContext.ydoc as { __observerId?: string }).__observerId;
    
    if (observerId !== currentYdocId) {
      registerYjsObserver(set, get);
      (yjsContext.ydoc as { __observerId?: string }).__observerId = currentYdocId;
    }

    // BUG-3 fix: single-flight lock avoids race when loadProject is called twice
    // before hydration state flips true.
    if (loadProjectInFlight) {
      await loadProjectInFlight;
      return;
    }

    loadProjectInFlight = (async () => {
    
    // Note: Observer registration moved to BEFORE loadProjectInFlight check
    // to ensure it's always registered regardless of hydration state
    if (get().isHydrated) {
      return;
    }

    // Run one-time migration from legacy key to personalUno namespace
    await storageService.migrateIfNeeded();

    const { activeWorkspaceType, activeWorkspaceId } = get();
    const data = await storageService.getProject(activeWorkspaceType, activeWorkspaceId);

    // --- MIGRATION LAYER ---
    // Detects legacy string[] sub_steps and converts to CubitStep[] objects
    const migratedTasks = data.tasks.map((task: unknown) => {
      const t = task as TaskItem; // Assume current structure but verify

      // Safety check: Does it have sub_steps?
      if (t.sub_steps && Array.isArray(t.sub_steps) && t.sub_steps.length > 0) {
        // Heuristic: Is the first item a simple string? (Level 2 Migration)
        // We cast to 'any' purely for the check because Typescript expects strict CubitStep[]
        if (typeof (t.sub_steps[0] as unknown) === 'string') {
          const legacySteps = t.sub_steps as unknown as string[];
          const newSubSteps: CubitStep[] = legacySteps.map((text: string) => ({
            id: crypto.randomUUID(),
            text: text,
            sub_steps: [],
          }));
          return { ...t, sub_steps: newSubSteps };
        }

        // Level 3 Migration: Check if sub_steps have sub_steps that are strings
        const updatedSubSteps = t.sub_steps.map((subStep: CubitStep) => {
          if (subStep.sub_steps && subStep.sub_steps.length > 0) {
            const firstChild = subStep.sub_steps[0] as unknown;
            if (typeof firstChild === 'string') {
              // Convert ["Micro A", "Micro B"] -> [{id, text, sub_steps: []}, ...]
              const legacyMicro = subStep.sub_steps as unknown as string[];
              const newMicroSteps: CubitStep[] = legacyMicro.map((text: string) => ({
                id: crypto.randomUUID(),
                text: text,
                sub_steps: [],
              }));
              return { ...subStep, sub_steps: newMicroSteps };
            }
          }
          return subStep;
        });
        return { ...t, sub_steps: updatedSubSteps };
      }
      return t; // Return as-is if already migrated or empty
    });
    // -----------------------

    // --- BOOK TABS MIGRATION ---
    // If old flat todoRows exist but no todoProjects, wrap them into a default project
    let todoProjects = data.todoProjects || [];
    let activeProjectId = data.activeProjectId || null;

    if (
      todoProjects.length === 0 &&
      data.todoRows &&
      data.todoRows.length > 0 &&
      yjsContext.yProjectsMap.size === 0  // CRITICAL FIX: Don't migrate if network data already exists
    ) {
      const defaultProject: TodoProject = {
        id: crypto.randomUUID(),
        name: 'My First Project',
        color: '#22D3EE',
        todoRows: data.todoRows,
        priorityDials: data.priorityDials || { left: '', right: '', focusedSide: 'none' as const },
        createdAt: Date.now(),
        workspaceType: activeWorkspaceType,
        workspaceId: activeWorkspaceId,
        ownerId: get().deviceId,
        alarms: [],
      };
      todoProjects = [defaultProject];
      activeProjectId = defaultProject.id;
    }

    // If no projects exist at all, create an empty default
    // CRITICAL FIX: Check if yjsContext.ydoc already has network-synced projects before creating default
    // This prevents loadProject from overwriting network data that arrived during initialization
    if (todoProjects.length === 0 && yjsContext.yProjectsMap.size === 0) {
      const emptyProject: TodoProject = {
        id: crypto.randomUUID(),
        name: 'My First Project',
        color: '#22D3EE',
        todoRows: [],
        priorityDials: { left: '', right: '', focusedSide: 'none' as const },
        createdAt: Date.now(),
        workspaceType: activeWorkspaceType,
        workspaceId: activeWorkspaceId,
        ownerId: get().deviceId,
        alarms: [],
      };
      todoProjects = [emptyProject];
      activeProjectId = emptyProject.id;
    }

    // Ensure activeProjectId points to a valid project
    if (!activeProjectId || !todoProjects.find((p) => p.id === activeProjectId)) {
      activeProjectId = todoProjects[0]?.id || null;
    }

    // -----------------------

    // ==========================================
    // 🧬 THE GENESIS BOOT & YJS SYNCHRONIZATION 
    // ==========================================
    if (data.yjsState && data.yjsState instanceof Uint8Array) {
      // 1. BINARY PERSISTENCE: The Highest Authority
      // If we have a binary history, we decode it. It overwrites ALL legacy JSON logic.
      Y.applyUpdate(yjsContext.ydoc, data.yjsState);

      // 🔴 BUG FIX: Filter out Yjs 'isDeleted' tombstones during first-boot structural hydration!
      // Previously, we mapped ALL history, meaning ghosts would render until the first CRDT update wiped them out all at once.
      todoProjects = Array.from(yjsContext.yProjectsMap.values())
        .filter(p => !p.get('isDeleted'))
        .map(extractTodoProjectFromYMap);
        
      migratedTasks.length = 0; // Clear legacy, Yjs is truth
      migratedTasks.push(...Array.from(yjsContext.yTasksMap.values())
        .filter(t => !t.get('isDeleted'))
        .map(extractTaskItemFromYMap));

    } else if (!isMigrating) {
      // 2. THE GENESIS BOOT (Legacy JSON -> Yjs)
      isMigrating = true;

      yjsContext.ydoc.transact(() => {
        // Map legacy Tasks
        migratedTasks.forEach((task) => {
          yjsContext.yTasksMap.set(task.id, bindTaskItemToYMap(task as TaskItem));
        });

        // Map legacy Projects
        todoProjects.forEach((proj, i) => {
          const orderKey = proj.orderKey || generateOrderKey(i === 0 ? undefined : (todoProjects[i - 1].orderKey || undefined));
          const yProj = bindTodoProjectToYMap({ ...proj, orderKey });
          yjsContext.yProjectsMap.set(proj.id, yProj);
        });

        // Map primitive scalar Document State over to the CRDT
        if (data.projectType) yjsContext.yMetaMap.set('projectType', data.projectType);
        if (data.projectTitle) yjsContext.yMetaMap.set('projectTitle', data.projectTitle);
        if (data.scoutResults && data.scoutResults.length > 0) yjsContext.yMetaMap.set('scoutResults', JSON.stringify(data.scoutResults));
        if (data.scoutHistory && data.scoutHistory.length > 0) yjsContext.yMetaMap.set('scoutHistory', JSON.stringify(data.scoutHistory));
        if (data.transcript) applyUpdateToYText(yjsContext.yTranscript, data.transcript);
      });
      
      // Immediate genesis checkpoint broadcast for test environments
      // This ensures Device B can sync immediately without waiting for idle timer
      if (isTestEnvironment && yjsContext.syncManager) {
        const genesisState = Y.encodeStateAsUpdate(yjsContext.ydoc);
        yjsContext.syncManager.broadcastCheckpoint(genesisState);
      }
    }

    // --- Scalar Document State Hydration ---
    if (yjsContext.yMetaMap.has('projectType')) data.projectType = yjsContext.yMetaMap.get('projectType');
    if (yjsContext.yMetaMap.has('projectTitle')) data.projectTitle = yjsContext.yMetaMap.get('projectTitle');
    if (yjsContext.yMetaMap.has('scoutResults')) {
      try { data.scoutResults = JSON.parse(yjsContext.yMetaMap.get('scoutResults')); } catch {
        // INTENTIONALLY IGNORING: Export with corrupted scoutResults continues
      }
    }
    if (yjsContext.yMetaMap.has('scoutHistory')) {
      try { data.scoutHistory = JSON.parse(yjsContext.yMetaMap.get('scoutHistory')); } catch {
        // INTENTIONALLY IGNORING: Export with corrupted scoutHistory continues
      }
    }
    const safeTranscript = yjsContext.yTranscript.toString();
    if (safeTranscript !== "") data.transcript = safeTranscript;

    // CRITICAL FIX: If yjsContext.ydoc has network-synced projects, extract them instead of using stale local vars
    // This prevents loadProject from overwriting data that arrived during initialization
    const hasNetworkProjects = yjsContext.yProjectsMap.size > 0;
    if (hasNetworkProjects) {
      todoProjects = sortYMapList(
        Array.from(yjsContext.yProjectsMap.values())
          .filter(p => !p.get('isDeleted'))
          .map(extractTodoProjectFromYMap)
      );
      if (!activeProjectId || !todoProjects.find(p => p.id === activeProjectId)) {
        activeProjectId = todoProjects[0]?.id || null;
      }
    }
    const finalActiveProject = todoProjects.find(p => p.id === activeProjectId) || todoProjects[0];

    set({
      tasks: migratedTasks as TaskItem[],
      transcript: data.transcript || null,
      scoutResults: data.scoutResults || [],
      projectType: data.projectType || 'video',
      projectTitle: data.projectTitle || 'New Project',
      scoutTopic: data.scoutTopic || '',
      scoutPlatform: data.scoutPlatform || 'instagram',
      scoutHistory: data.scoutHistory || [],
      todoProjects,
      activeProjectId,
      todoRows: finalActiveProject?.todoRows || [],
      priorityDials: finalActiveProject?.priorityDials || { left: '', right: '', focusedSide: 'none' },
      // Seed the counter so new projects always have unique names & colors.
      nextProjectNumber: todoProjects.length + 1,
      // Today Page timer state (P1-T2) - load from storage or use defaults
      todayPreferences: data.todayPreferences || {
        defaultDuration: 25,
        autoStart: false,
        soundEnabled: true,
        soundVolume: 1,
        notificationEnabled: true,
        vibrationEnabled: true,
        showRowTomatoButtons: true,
      },
      // Check if timer session expired while away and update sessions/history
      ...(() => {
        const session = data.activeTimerSession;
        const existingSessions = data.timerSessions || [];

        // If no active session or already completed, no changes needed
        if (!session || session.status === 'completed') {
          return {
            timerSessions: existingSessions,
            activeTimerSession: session || null,
          };
        }

        const elapsed = Date.now() - session.startedAt - (session.totalPausedMs || 0);

        // Session expired while away - add to history and clear active
        if (elapsed >= session.durationMs) {
          const completedSession = {
            ...session,
            status: 'completed' as const,
            endedAt: session.startedAt + session.durationMs,
          };
          return {
            timerSessions: [...existingSessions, completedSession],
            activeTimerSession: null, // Clear active session since it's now in history
          };
        }

        // Session still valid, keep as-is
        return {
          timerSessions: existingSessions,
          activeTimerSession: session,
        };
      })(),
      todayTaskId: data.todayTaskId || null,
      todayTaskDialSource: data.todayTaskDialSource || null,
      // If there's an active timer session, restore remaining time
      timerStatus: (() => {
        const session = data.activeTimerSession;
        if (!session || session.status === 'completed') return 'idle';

        // Check if expired (consistent with activeTimerSession logic above)
        const elapsed = Date.now() - session.startedAt - (session.totalPausedMs || 0);
        if (elapsed >= session.durationMs) return 'completed'; // Expired sessions shown as completed

        // Valid active session - restore as paused (safe default)
        return session.status === 'running' ? 'paused' :
          (session.status === 'abandoned' ? 'idle' : (session.status || 'idle'));
      })(),
      timerRemainingSeconds: (() => {
        const session = data.activeTimerSession;
        // No active session, completed, or expired - return default duration
        if (!session || session.status === 'completed') {
          return (data.todayPreferences?.defaultDuration || 25) * 60;
        }

        // Check if expired (consistent with activeTimerSession logic above)
        const elapsed = Date.now() - session.startedAt - (session.totalPausedMs || 0);
        if (elapsed >= session.durationMs) return 0; // Expired sessions show 0 seconds

        // Valid active session - calculate remaining time
        return Math.max(0, Math.ceil((session.durationMs - elapsed) / 1000));
      })(),
      isHydrated: true, // ✅ Hydration Complete
    });

    // Ensure observer is registered (already done at function start, but double-check)
    const finalYdocId = getInstanceId(yjsContext.ydoc);
    const finalObserverId = (yjsContext.ydoc as { __observerId?: string }).__observerId;
    if (finalObserverId !== finalYdocId) {
      registerYjsObserver(set, get);
      (yjsContext.ydoc as { __observerId?: string }).__observerId = finalYdocId;
    }

    })();

    try {
      await loadProjectInFlight;
    } finally {
      loadProjectInFlight = null;
    }
  }, // Close the loadProject function

  // --- Project meta actions moved to projectMetaSlice.ts ---

  resetProject: async () => {
    const { activeWorkspaceType, activeWorkspaceId, deviceId: currentDeviceId } = get();
    await storageService.clearProject(activeWorkspaceType, activeWorkspaceId);

    // CRITICAL: Ensure observer is registered on current yjsContext.ydoc before modifying state
    // This prevents observer loss when resetProject is called during test setup
    const currentYdocId = getInstanceId(yjsContext.ydoc);
    const observerId = (yjsContext.ydoc as { __observerId?: string }).__observerId;

    if (observerId !== currentYdocId) {
      registerYjsObserver(set, get);
      (yjsContext.ydoc as { __observerId?: string }).__observerId = currentYdocId;
    }

    yjsContext.ydoc.transact(() => {
      yjsContext.yMetaMap.clear();
      yjsContext.yTranscript.delete(0, yjsContext.yTranscript.length);

      Array.from(yjsContext.yTasksMap.values()).forEach(t => t.set('isDeleted', true));
      Array.from(yjsContext.yProjectsMap.values()).forEach(p => p.set('isDeleted', true));
    });

    const defaultProject: TodoProject = {
      id: crypto.randomUUID(),
      name: 'My First Project',
      color: '#22D3EE',
      todoRows: [],
      priorityDials: { left: '', right: '', focusedSide: 'none' as const },
      createdAt: Date.now(),
      workspaceType: activeWorkspaceType,
      workspaceId: activeWorkspaceId,
      ownerId: currentDeviceId,
      alarms: [],
    };
    set({
      tasks: [],
      transcript: null,
      scoutResults: [],
      scoutHistory: [],
      hasVideoHandle: false,
      projectType: 'video',
      projectTitle: 'New Project',
      logs: [],
      isProcessing: false,
      activeProcessingId: null,
      scoutTopic: '',
      scoutPlatform: 'instagram',
      inputMode: 'video',
      todoProjects: [defaultProject],
      activeProjectId: defaultProject.id,
      todoRows: [],
      priorityDials: { left: '', right: '', focusedSide: 'none' as const },
      activeMode: null,
      processingRowId: null,
      nextProjectNumber: 2, // "My First Project" was #1
    });
  },

  exportAndClearData: async () => {
    const { todoProjects, resetProject } = get();
    const { downloadAllProjectsMarkdown } = await import('@/utils/exportUtils');
    downloadAllProjectsMarkdown(todoProjects, 'cubit-backup');
    await resetProject();
  },

  fullLogout: async () => {
    // The "Logout Nuke" Data Vector Fix: 
    // We MUST sever the network connection BEFORE destroying local CRDT states 
    // to prevent broadcasting an encrypted tombstone massacre to the P2P cloud.
    if (yjsContext.syncManager) {
      yjsContext.syncManager.disconnect();
      yjsContext.syncManager = null;
    }
    if (yjsContext.idleCheckpointTimer) {
      clearTimeout(yjsContext.idleCheckpointTimer);
      yjsContext.idleCheckpointTimer = null;
    }

    const { activeWorkspaceType, activeWorkspaceId } = get();
    await storageService.clearProject(activeWorkspaceType, activeWorkspaceId);
    localStorage.removeItem(STORAGE_KEY_API);

    // Hard physics wipe: Instead of mathematically manipulating yjsContext.ydoc, 
    // we forcibly nuke the memory thread to guarantee Zero Knowledge deletion.
    window.location.reload();
  },

  // importTasks moved to taskSlice.ts
  // setProcessing, activeProcessingId, peerIsEditing, _syncToggle moved to uiSlice.ts

  /**
   * Syncs Zustand state from Yjs document.
   * Called when network updates are received to ensure UI reflects CRDT state.
   */
  syncFromYjs: () => {
    // Extract current state from Yjs (same logic as debounced handler in loadProject)
    const rawYProjects = Array.from(yjsContext.yProjectsMap.values()).filter(p => !p.get('isDeleted'));
    const rawYTasks = Array.from(yjsContext.yTasksMap.values()).filter(t => !t.get('isDeleted'));
    
    // Map through cache for Structural Sharing (simple version without cache for now)
    const sharedProjects = rawYProjects.map(yProj => extractTodoProjectFromYMap(yProj));
    const sharedTasks = rawYTasks.map(yTask => extractTaskItemFromYMap(yTask));

    const updatedProjects = sortYMapList(sharedProjects);
    const currentActiveId = get().activeProjectId;
    const actProj = updatedProjects.find(p => p.id === currentActiveId) || updatedProjects[0];

    // Document State Render Engine
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
        try { scoutResults = JSON.parse(raw); } catch {
          // INTENTIONALLY IGNORING: Corrupted sync data - keep existing local state
        }
      }
    }

    let scoutHistory = get().scoutHistory;
    if (yjsContext.yMetaMap.has('scoutHistory')) {
      const raw = yjsContext.yMetaMap.get('scoutHistory');
      if (raw) {
        try { scoutHistory = JSON.parse(raw); } catch {
          // INTENTIONALLY IGNORING: Corrupted sync data - keep existing local state
        }
      }
    }

    set({
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
    });
    
    // Track that Zustand state was synced from Yjs
    recordZustandUpdate(yjsContext.ydoc);
    
  },

  // isSettingsOpen, isSyncModalOpen moved to uiSlice.ts

  // --- Log actions moved to logSlice.ts ---

  // --- Timer actions moved to timerSlice.ts ---
  // --- Alarm actions moved to taskSlice.ts ---
}));

// Test Hook for Playwright + Diagnostics
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__STORE__ = useAppStore;
  
  // Enable sync diagnostics in development
  enableDiagnostics();
}

// ---------------------------------------------------------------------------
// 💾 AUTO-SAVE SUBSCRIPTION (Debounced)
// ---------------------------------------------------------------------------
let saveTimeout: NodeJS.Timeout;

useAppStore.subscribe((state) => {
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(async () => {
    if (state.isHydrated) {
      try {
        const yjsState = Y.encodeStateAsUpdate(yjsContext.ydoc);

        await storageService.saveProject({
          tasks: state.tasks,
          transcript: state.transcript || undefined,
          scoutResults: state.scoutResults,
          projectType: state.projectType,
          projectTitle: state.projectTitle,
          scoutTopic: state.scoutTopic,
          scoutPlatform: state.scoutPlatform,
          scoutHistory: state.scoutHistory,
          inputMode: state.inputMode,
          todoProjects: state.todoProjects,
          activeProjectId: state.activeProjectId || undefined,
          yjsState,
          workspaceType: state.activeWorkspaceType,
          workspaceId: state.activeWorkspaceId,
          // Today Page timer state (P1-T2)
          timerSessions: state.timerSessions,
          todayPreferences: state.todayPreferences,
          activeTimerSession: state.activeTimerSession,
          todayTaskId: state.todayTaskId,
          todayTaskDialSource: state.todayTaskDialSource,
        });
      } catch (err) {
        // INTENTIONALLY LOGGING: Auto-save failure shouldn't crash app
        // Data remains in memory; will retry on next debounced call
        console.error('Auto-Save Failed:', err);
      }
    }
  }, 500);
});
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  GeminiEvents.addEventListener('gemini-log', ((event: CustomEvent) => {
    const { message, type } = event.detail;
    const prefix = type === 'warning' ? '⚠️ ' : type === 'error' ? '🔴 ' : '';
    useAppStore.getState().addLog(`${prefix}${message}`);
  }) as EventListener);

  (window as any).__STORE__ = useAppStore;
}
