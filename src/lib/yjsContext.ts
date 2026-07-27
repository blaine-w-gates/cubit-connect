/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * YjsContext — Mutable holder for Yjs document state.
 *
 * Replaces the module-level `let` variables in useAppStore.ts with a shared
 * mutable object. This allows extracted slices to always reference the current
 * Yjs document instance, even after resetYDoc() swaps it.
 *
 * Part of store decomposition (#25).
 */

import * as Y from 'yjs';
import {
  registerYDocInstance,
  markInstanceDestroyed,
  transitionToPhase,
  getInstanceId,
  getInstance,
} from '@/lib/syncDiagnostics';
import { generateUniqueClientId } from '@/lib/yjsClientId';
import type { SupabaseSyncProd } from '@/lib/supabaseSyncProd';

// Type aliases for Yjs maps to avoid explicit any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YAnyMap = Y.Map<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YAnyMeta = any;

const ydocOptions: { gc: boolean; clientID?: number } = {
  gc: false,
  clientID: generateUniqueClientId(),
};

/**
 * The shared mutable Yjs context.
 *
 * All slices and the main store reference `yjsContext.ydoc`, `yjsContext.yProjectsMap`, etc.
 * When `resetYjsContext()` is called, all properties are updated in place,
 * so every consumer automatically sees the new Yjs document.
 */
export const yjsContext = {
  ydoc: new Y.Doc(ydocOptions),
  yProjectsMap: null as unknown as YAnyMap,
  yTasksMap: null as unknown as YAnyMap,
  yMetaMap: null as unknown as YAnyMeta,
  yTranscript: null as unknown as Y.Text,
  syncManager: null as SupabaseSyncProd | null,
  idleCheckpointTimer: null as NodeJS.Timeout | null,
};

// Initialize the map references on the initial ydoc
yjsContext.yProjectsMap = yjsContext.ydoc.getMap<YAnyMap>('projects');
yjsContext.yTasksMap = yjsContext.ydoc.getMap<YAnyMap>('tasks');
yjsContext.yMetaMap = yjsContext.ydoc.getMap<YAnyMeta>('meta');
yjsContext.yTranscript = yjsContext.ydoc.getText('transcript');

// Register the initial ydoc instance for diagnostics
registerYDocInstance(yjsContext.ydoc, 'module_init');

/**
 * Get the current Y.Doc instance.
 * Exported so Playwright tests can reach the active doc.
 */
export function getYDoc(): Y.Doc {
  return yjsContext.ydoc;
}

/**
 * Callback type for syncing Zustand state from Yjs before destroying the doc.
 */
type SyncFromYjsCallback = () => void;

/**
 * Destroy the current Y.Doc and create a fresh one.
 * Called during workspace switching to guarantee data isolation.
 *
 * CRITICAL: Also resets NetworkSync so it uses the new ydoc reference.
 *
 * @param syncFromYjs - Callback to sync Zustand state before destroying ydoc
 * @returns The new Y.Doc instance
 */
export async function resetYjsContext(syncFromYjs: SyncFromYjsCallback): Promise<Y.Doc> {
  const oldId = getInstanceId(yjsContext.ydoc);

  // CRITICAL FIX: Check for pending updates before destroying
  if (oldId) {
    const instance = getInstance(oldId);
    if (instance && instance.updatesReceived > instance.updatesApplied) {
      // Pending updates exist — flush via syncFromYjs below
    }
  }

  // CRITICAL FIX: Disconnect sync manager BEFORE syncing/destroying ydoc
  if (yjsContext.syncManager) {
    await yjsContext.syncManager.disconnect();
    yjsContext.syncManager = null;

    // AFTER flush, sync any newly-applied data to Zustand
    syncFromYjs();
  } else if (oldId) {
    // Sync manager is null but ydoc might still have unapplied updates
    const instance = getInstance(oldId);
    if (instance && instance.updatesReceived > 0 && instance.updatesApplied === 0) {
      syncFromYjs();
    }
  }

  if (yjsContext.idleCheckpointTimer) {
    clearTimeout(yjsContext.idleCheckpointTimer);
    yjsContext.idleCheckpointTimer = null;
  }

  markInstanceDestroyed(yjsContext.ydoc, 'resetYDoc');
  yjsContext.ydoc.destroy();

  // Create new Y.Doc with unique ClientID
  const newYdocOptions: { gc: boolean; clientID?: number } = {
    gc: false,
    clientID: generateUniqueClientId(),
  };

  yjsContext.ydoc = new Y.Doc(newYdocOptions);
  const newId = registerYDocInstance(yjsContext.ydoc, 'resetYDoc');

  transitionToPhase('ydoc_reset', { ydocId: newId });

  // Reset the observer tracking on the new ydoc
  (yjsContext.ydoc as { __observerId?: string }).__observerId = undefined;

  // Re-initialize map references on the new ydoc
  yjsContext.yProjectsMap = yjsContext.ydoc.getMap<YAnyMap>('projects');
  yjsContext.yTasksMap = yjsContext.ydoc.getMap<YAnyMap>('tasks');
  yjsContext.yMetaMap = yjsContext.ydoc.getMap<YAnyMeta>('meta');
  yjsContext.yTranscript = yjsContext.ydoc.getText('transcript');

  return yjsContext.ydoc;
}
