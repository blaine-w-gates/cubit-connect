/**
 * SupabaseSync Lazy Loader
 *
 * Dynamically imports SupabaseSync to enable code splitting.
 * This ensures SupabaseSync and its dependencies are only loaded when needed.
 *
 * @module supabaseSyncLoader
 * @version 2.0.0
 * @production
 */

import type * as Y from 'yjs';
import type {
  SupabaseSyncProd,
  OnStatusChange,
  OnSyncActivity,
  OnPeerPresence,
  OnPeerDisconnect,
  OnPeerEditing,
} from './supabaseSyncProd';

/**
 * Lazy load SupabaseSync class (PRODUCTION VERSION)
 *
 * @returns SupabaseSyncProd class constructor
 */
export async function loadSupabaseSync(): Promise<
  new (
    ydoc: Y.Doc,
    roomIdHash: string,
    onStatusChange: OnStatusChange,
    onSyncActivity?: OnSyncActivity,
    onPeerPresence?: OnPeerPresence,
    onPeerDisconnect?: OnPeerDisconnect,
    onPeerEditing?: OnPeerEditing
  ) => SupabaseSyncProd
> {
  // Dynamic import creates a separate chunk
  const supabaseModule = await import('./supabaseSyncProd');
  return supabaseModule.SupabaseSyncProd;
}

/**
 * Check if SupabaseSync chunk is already loaded
 *
 * @returns true if loaded
 */
export function isSupabaseSyncLoaded(): boolean {
  // Check if module is in webpack/vite module cache
  // @ts-expect-error - Accessing internal module cache
  const modules = import.meta?.glob?.('/src/lib/supabaseSync.ts') || {};
  return Object.keys(modules).length > 0;
}

/**
 * Preload SupabaseSync chunk
 *
 * Useful for prefetching when user hovers over sync button
 */
export function preloadSupabaseSync(): void {
  // Start loading but don't await
  void loadSupabaseSync();
}
