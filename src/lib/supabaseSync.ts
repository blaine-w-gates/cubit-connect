/**
 * SupabaseSync - Drop-in Replacement for NetworkSync
 *
 * Re-exports SupabaseSyncProd as the production implementation.
 * This provides the full Supabase Realtime sync functionality.
 *
 * @module supabaseSync
 * @version 2.0.0
 * @production
 */

export { SupabaseSyncProd as SupabaseSync } from './supabaseSyncProd';
export type { SyncStatus, OnStatusChange, OnSyncActivity, OnPeerPresence, OnPeerDisconnect, OnPeerEditing } from './supabaseSyncProd';

// For backward compatibility, also export as default
export { SupabaseSyncProd as default } from './supabaseSyncProd';

// Re-export the interface for type checking
export interface SupabaseSyncInterface {
  connect(derivedKey: CryptoKey): Promise<void>;
  disconnect(): void;
  broadcastUpdate(update: Uint8Array): Promise<void>;
  broadcastCheckpoint(fullUpdate: Uint8Array): Promise<void>;
  flush(): Promise<void>;
  flushQueuedUpdates(): void;
  sendDisconnectSignal(): Promise<void>;
  requestCache(): void;
}
