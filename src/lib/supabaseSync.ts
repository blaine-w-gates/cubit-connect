/**
 * SupabaseSync - Drop-in Replacement for NetworkSync
 *
 * Skeleton implementation matching NetworkSync interface for Phase 1.
 * Methods exist but are no-ops (ready for Phase 2 implementation).
 *
 * @module supabaseSync
 * @version 1.0.0
 * @experimental
 */

import * as Y from 'yjs';
import { emitTelemetry } from './featureFlags';
import { encryptUpdate, decryptUpdate } from './cryptoSync';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Standard connection timeout (10 seconds)
 */
const CONNECTION_TIMEOUT = 10000;

/**
 * Extended timeout for cold start (15 seconds)
 * Supabase Realtime can take 3-5s to cold start
 */
const COLD_START_TIMEOUT = 15000;

/**
 * Cold start detection threshold (2 seconds)
 * If connection takes longer than this, consider it a cold start
 */
const COLD_START_THRESHOLD = 2000;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Sync status type - mirrors NetworkSync status
 */
export type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Callback for sync status changes
 */
export type OnStatusChange = (status: SyncStatus) => void;

/**
 * Callback for sync activity (checkpoints received)
 */
export type OnSyncActivity = () => void;

/**
 * Callback for peer presence detection
 */
export type OnPeerPresence = () => void;

/**
 * Callback for peer disconnect
 */
export type OnPeerDisconnect = () => void;

/**
 * Callback for peer editing state
 */
export type OnPeerEditing = (isEditing: boolean) => void;

/**
 * SupabaseSync interface matching NetworkSync
 */
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

// ============================================================================
// SUPABASE SYNC CLASS
// ============================================================================

/**
 * SupabaseSync - Drop-in replacement for NetworkSync
 *
 * @experimental This is a skeleton implementation for Phase 1.
 * Methods exist but do not yet perform actual sync operations.
 */
export class SupabaseSync implements SupabaseSyncInterface {
  private ydoc: Y.Doc;
  private roomIdHash: string;
  private onStatusChange: OnStatusChange;
  private onSyncActivity?: OnSyncActivity;
  private onPeerPresence?: OnPeerPresence;
  private onPeerDisconnect?: OnPeerDisconnect;
  private onPeerEditing?: OnPeerEditing;
  private status: SyncStatus = 'disconnected';
  private isConnected = false;
  private derivedKey: CryptoKey | null = null;
  private pendingUpdateQueue: Uint8Array[] = [];
  private connectionStartTime = 0;
  private isColdStart = false;

  /**
   * Create a new SupabaseSync instance
   *
   * @param ydoc - Yjs document instance
   * @param roomIdHash - Hash of room passphrase
   * @param onStatusChange - Callback for connection status changes
   * @param onSyncActivity - Callback when checkpoint received
   * @param onPeerPresence - Callback when peer detected
   * @param onPeerDisconnect - Callback when peer disconnects
   * @param onPeerEditing - Callback when peer editing state changes
   */
  constructor(
    ydoc: Y.Doc,
    roomIdHash: string,
    onStatusChange: OnStatusChange,
    onSyncActivity?: OnSyncActivity,
    onPeerPresence?: OnPeerPresence,
    onPeerDisconnect?: OnPeerDisconnect,
    onPeerEditing?: OnPeerEditing
  ) {
    this.ydoc = ydoc;
    this.roomIdHash = roomIdHash;
    this.onStatusChange = onStatusChange;
    this.onSyncActivity = onSyncActivity;
    this.onPeerPresence = onPeerPresence;
    this.onPeerDisconnect = onPeerDisconnect;
    this.onPeerEditing = onPeerEditing;

    console.warn('[SUPABASE SYNC] Experimental: This is a skeleton implementation');

    emitTelemetry('supabase_auth_attempt', {
      context: { phase: 'skeleton', roomIdHash: roomIdHash.slice(0, 8) },
    });
  }

  /**
   * Connect to Supabase Realtime
   *
   * Phase 1: Foundation - E2EE wired, cold start handling
   *
   * @param derivedKey - E2EE derived key from passphrase (REQUIRED)
   * @throws Error if derivedKey is invalid
   */
  async connect(derivedKey: CryptoKey): Promise<void> {

    // Validate E2EE key
    if (!derivedKey || typeof derivedKey !== 'object') {
      throw new Error('[SUPABASE SYNC] E2EE key is required for secure connection');
    }

    // Store key for encryption/decryption
    this.derivedKey = derivedKey;

    // Record connection start time for cold start detection
    this.connectionStartTime = Date.now();
    this.setStatus('connecting');

    try {
      // Phase 1: Skeleton implementation
      // Phase 2: Will implement actual Supabase Realtime connection with timeout


      // Simulate connection delay for testing cold start detection
      await this.simulateConnectionDelay();

      // Check if this was a cold start
      const connectionTime = Date.now() - this.connectionStartTime;
      this.isColdStart = connectionTime > COLD_START_THRESHOLD;

      if (this.isColdStart) {
      }

      this.isConnected = true;
      this.setStatus('connected');

      emitTelemetry('supabase_auth_success', {
        attempt: 1,
        context: {
          phase: 'skeleton',
          method: 'connect',
          coldStart: this.isColdStart,
          connectionTime,
        },
      });
    } catch (error) {
      // INTENTIONALLY PROPAGATING: Connection failure must be handled upstream
      // Log, update status, and re-throw for UI to display error
      console.error('[SUPABASE SYNC] Connect failed:', error);
      this.setStatus('error');
      throw error;
    }
  }

  /**
   * Simulate connection delay (for Phase 1 testing)
   * In Phase 2, this will be actual Supabase connection with timeout
   */
  private async simulateConnectionDelay(): Promise<void> {
    // Simulate variable connection time (0-3s for testing cold start)
    const delay = Math.random() * 3000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Get connection timeout based on cold start status
   */
  getConnectionTimeout(): number {
    return this.isColdStart ? COLD_START_TIMEOUT : CONNECTION_TIMEOUT;
  }

  /**
   * Check if last connection was a cold start
   */
  wasColdStart(): boolean {
    return this.isColdStart;
  }

  /**
   * Encrypt data using E2EE key
   *
   * @param data - Raw Uint8Array to encrypt
   * @returns Encrypted data with IV prefix
   * @throws Error if no E2EE key available
   */
  private async encryptData(data: Uint8Array): Promise<Uint8Array> {
    if (!this.derivedKey) {
      throw new Error('[SUPABASE SYNC] Cannot encrypt: No E2EE key available');
    }
    return encryptUpdate(data, this.derivedKey);
  }

  /**
   * Decrypt data using E2EE key
   *
   * @param payload - Encrypted data with IV prefix
   * @returns Decrypted raw Uint8Array
   * @throws Error if no E2EE key available or decryption fails
   */
  private async decryptData(payload: Uint8Array): Promise<Uint8Array> {
    if (!this.derivedKey) {
      throw new Error('[SUPABASE SYNC] Cannot decrypt: No E2EE key available');
    }
    return decryptUpdate(payload, this.derivedKey);
  }

  /**
   * Queue an update for later transmission
   *
   * @param update - Yjs update to queue
   */
  private queueUpdate(update: Uint8Array): void {
    this.pendingUpdateQueue.push(update);
  }

  /**
   * Get and clear pending update queue
   *
   * @returns Array of queued updates
   */
  private getQueuedUpdates(): Uint8Array[] {
    const queue = [...this.pendingUpdateQueue];
    this.pendingUpdateQueue = [];
    return queue;
  }

  /**
   * Disconnect from Supabase Realtime
   *
   * Phase 1: Foundation - E2EE key cleared, queue flushed
   */
  disconnect(): void {
    console.log('[SUPABASE SYNC] E2EE key cleared');

    // Clear sensitive data
    this.derivedKey = null;

    // Flush any pending updates (would send in Phase 2)
    const queuedCount = this.pendingUpdateQueue.length;
    if (queuedCount > 0) {
      console.warn(`[SUPABASE SYNC] ${queuedCount} pending updates dropped`);
      this.pendingUpdateQueue = [];
    }

    this.isConnected = false;
    this.setStatus('disconnected');


    emitTelemetry('transport_switched', {
      from: 'supabase',
      to: 'disconnected',
    });
  }

  /**
   * Broadcast a Yjs update to peers
   *
   * Phase 1: Skeleton - logs only
   *
   * @param update - Yjs update to broadcast
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async broadcastUpdate(update: Uint8Array): Promise<void> {
    if (!this.isConnected) {
      console.warn('[SUPABASE SYNC] broadcastUpdate: not connected');
      return;
    }

    console.log('[SUPABASE SYNC] broadcastUpdate called');

    // Phase 1: No actual broadcast yet
    // Phase 2: Will implement Supabase Realtime broadcast
  }

  /**
   * Broadcast a full checkpoint to peers
   *
   * Phase 1: Skeleton - logs only
   *
   * @param fullUpdate - Full Yjs state update
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async broadcastCheckpoint(fullUpdate: Uint8Array): Promise<void> {

    if (!this.isConnected) {
      return;
    }

    // Phase 1: No actual checkpoint broadcast yet
    // Phase 2: Will implement Supabase Realtime checkpoint broadcast

    // Notify that "checkpoint was received" (for UI updates)
    this.onSyncActivity?.();
  }

  /**
   * Flush queued updates
   *
   * Phase 1: Skeleton - logs only
   */
  async flush(): Promise<void> {

    if (!this.isConnected) {
      return;
    }

    // Phase 1: No actual flush yet
    // Phase 2: Will implement queued update flushing
  }

  /**
   * Flush queued updates synchronously
   *
   * Phase 1: Skeleton - logs only
   */
  flushQueuedUpdates(): void {
    console.log('[SUPABASE SYNC] flushQueuedUpdates called');

    if (!this.isConnected) {
      return;
    }

    // Phase 1: No actual flush yet
    // Phase 2: Will implement queued update flushing
  }

  /**
   * Send disconnect signal to peers
   *
   * Phase 1: Skeleton - logs only
   */
  async sendDisconnectSignal(): Promise<void> {
    console.log('[SUPABASE SYNC] sendDisconnectSignal called');

    if (!this.isConnected) {
      return;
    }

    // Phase 1: No actual signal sent yet
    // Phase 2: Will implement disconnect signal via Supabase
  }

  /**
   * Request cache from server (catch-up for late joiners)
   *
   * Phase 1: Skeleton - logs only
   */
  requestCache(): void {
    console.log('[SUPABASE SYNC] requestCache called');

    if (!this.isConnected) {
      console.warn('[SUPABASE SYNC] requestCache: not connected');
      return;
    }

    // Phase 1: No actual cache request yet
    // Phase 2: Will implement cache request from Supabase

    // Simulate cache response for Phase 1 testing
    this.onSyncActivity?.();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Update connection status
   *
   * @param status - New status
   */
  private setStatus(status: SyncStatus): void {
    if (this.status === status) return;

    this.status = status;
    this.onStatusChange(status);

  }

  /**
   * Get current connection status
   *
   * @returns Current status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Check if connected
   *
   * @returns true if connected
   */
  isConnectedToServer(): boolean {
    return this.isConnected;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Default export
export default SupabaseSync;
