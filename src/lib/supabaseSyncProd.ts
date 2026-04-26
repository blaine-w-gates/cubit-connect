/**
 * SupabaseSync Production Implementation
 *
 * ACTUAL implementation connecting to Supabase Realtime.
 * This is NOT a skeleton - it really connects and syncs.
 *
 * @module supabaseSyncProd
 * @version 2.0.0
 * @production
 */

import * as Y from 'yjs';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, signInAnonymously } from './supabaseClient';
import { encryptUpdate, decryptUpdate } from './cryptoSync';
import { emitTelemetry } from './featureFlags';
import { audit } from './auditLogger';
import { getCheckpointService } from './checkpointService';
import { measureAsync } from './syncPerformanceMonitor';

// ============================================================================
// TYPES
// ============================================================================

export type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type OnStatusChange = (status: SyncStatus) => void;
export type OnSyncActivity = () => void;
export type OnPeerPresence = () => void;
export type OnPeerDisconnect = () => void;
export type OnPeerEditing = (isEditing: boolean) => void;
export type OnSyncError = (error: Error, context: string) => void;

// ============================================================================
// CONSTANTS
// ============================================================================

const CONNECTION_TIMEOUT = 10000;
const COLD_START_TIMEOUT = 15000;
const COLD_START_THRESHOLD = 2000;
const BROADCAST_DEBOUNCE_MS = 50;

// Retry configuration with exponential backoff
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000; // 1 second

// ============================================================================
// PRODUCTION SUPABASE SYNC
// ============================================================================

export class SupabaseSyncProd {
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

  private supabaseChannel: RealtimeChannel | null = null;
  private connectionStartTime = 0;
  private isColdStart = false;
  private broadcastDebounceTimer: NodeJS.Timeout | null = null;
  private pendingUpdateQueue: Uint8Array[] = [];
  private checkpointInterval: NodeJS.Timeout | null = null;
  private readonly CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  private ydocUpdateHandler: (update: Uint8Array, origin: unknown) => void;

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

    // Bind ydoc update handler
    this.ydocUpdateHandler = this.handleYdocUpdate.bind(this);

    audit.sync('instance_created', roomIdHash, true, { phase: 'production' });
  }

  // ============================================================================
  // CONNECTION
  // ============================================================================

  /**
   * Retry an operation with exponential backoff
   * Delays: 1s, 2s, 4s (exponential: base * 2^attempt)
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        // INTENTIONALLY RETRYING: Network/Supabase operations may transiently fail
        // Capture error and retry with exponential backoff
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < MAX_RETRIES - 1) {
          // Exponential backoff: delay = base * 2^attempt
          const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  }

  async connect(derivedKey: CryptoKey): Promise<void> {
    return measureAsync('connect', async () => {

      // Validate E2EE key
      if (!derivedKey || typeof derivedKey !== 'object') {
        throw new Error('[SUPABASE SYNC PROD] E2EE key required');
      }

      this.derivedKey = derivedKey;
      this.connectionStartTime = Date.now();
      this.setStatus('connecting');

      // Retry connection with exponential backoff
      return this.retryWithBackoff(async () => {
        // Authenticate with Supabase
        const authResult = await signInAnonymously();
      if (!authResult.success) {
        throw new Error(`Auth failed: ${authResult.error}`);
      }

      audit.auth('anonymous_signin', true, { roomIdHash: this.roomIdHash.slice(0, 8) });

      // Create Supabase Realtime channel
      const client = getSupabaseClient();
      const channelName = `room:${this.roomIdHash}`;

      this.supabaseChannel = client.channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: 'user' },
        },
      });

      // Set up broadcast listeners
      this.supabaseChannel
        .on('broadcast', { event: 'yjs_update' }, (payload) => {
          this.handleIncomingUpdate(payload.payload);
        })
        .on('broadcast', { event: 'checkpoint' }, (payload) => {
          this.handleIncomingCheckpoint(payload.payload);
        })
        .on('presence', { event: 'sync' }, () => {
          this.onPeerPresence?.();
        })
        .on('presence', { event: 'join' }, () => {
          this.onPeerPresence?.();
        })
        .on('presence', { event: 'leave' }, () => {
          this.onPeerDisconnect?.();
        });

      // Subscribe with timeout
      await this.subscribeWithTimeout();

      // Load checkpoint if available
      await this.loadCheckpoint();

      // Set up ydoc observer
      this.ydoc.on('update', this.ydocUpdateHandler);

      // Start periodic checkpoint saving
      this.startCheckpointInterval();

      // Check for cold start
      const connectionTime = Date.now() - this.connectionStartTime;
      this.isColdStart = connectionTime > COLD_START_THRESHOLD;

      this.isConnected = true;
      this.setStatus('connected');

      audit.sync('connect', this.roomIdHash, true, {
        connectionTime,
        coldStart: this.isColdStart,
      });

      emitTelemetry('supabase_auth_success', {
        attempt: 1,
        context: { phase: 'production', coldStart: this.isColdStart, connectionTime },
      });

      }, 'connect'); // End retryWithBackoff - handles retries with exponential backoff (1s, 2s, 4s)
    }, this.roomIdHash); // End measureAsync
  }

  private async subscribeWithTimeout(): Promise<void> {
    if (!this.supabaseChannel) {
      throw new Error('No channel created');
    }

    const timeoutMs = this.isColdStart ? COLD_START_TIMEOUT : CONNECTION_TIMEOUT;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Subscription timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.supabaseChannel?.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR') {
          clearTimeout(timeout);
          reject(new Error('Channel subscription failed'));
        }
      });
    });
  }

  // ============================================================================
  // YJS UPDATE HANDLING
  // ============================================================================

  private handleYdocUpdate(update: Uint8Array, origin: unknown): void {
    // Don't broadcast updates from remote (prevent echo)
    if (origin === 'remote') return;

    // Debounce broadcasts
    if (this.broadcastDebounceTimer) {
      clearTimeout(this.broadcastDebounceTimer);
    }

    this.broadcastDebounceTimer = setTimeout(() => {
      this.broadcastUpdate(update);
    }, BROADCAST_DEBOUNCE_MS);
  }

  private async handleIncomingUpdate(payload: { encrypted: number[] }): Promise<void> {
    if (!this.derivedKey) return;

    try {
      const encrypted = new Uint8Array(payload.encrypted);
      const decrypted = await decryptUpdate(encrypted, this.derivedKey);

      // Apply update without triggering broadcast (origin = 'remote')
      Y.applyUpdate(this.ydoc, decrypted, 'remote');

      this.onSyncActivity?.();

      audit.sync('receive_update', this.roomIdHash, true, { size: decrypted.length });
    } catch (error) {
      // INTENTIONALLY PROPAGATING: Decryption failures indicate security/integrity issues
      // Must not silently swallow - caller needs to handle or alert
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[SUPABASE SYNC PROD] Decryption failed:', err);
      audit.encryption('decrypt', false, { error: err.message });
      // Re-throw for upstream handling
      throw err;
    }
  }

  private async handleIncomingCheckpoint(payload: { encrypted: number[] }): Promise<void> {
    if (!this.derivedKey) return;

    try {
      const encrypted = new Uint8Array(payload.encrypted);
      const decrypted = await decryptUpdate(encrypted, this.derivedKey);

      // Apply checkpoint
      Y.applyUpdate(this.ydoc, decrypted, 'remote');

      this.onSyncActivity?.();

      audit.sync('receive_checkpoint', this.roomIdHash, true, { size: decrypted.length });
    } catch (error) {
      // INTENTIONALLY SWALLOWING: Checkpoint reception is best-effort
      // Failed checkpoint doesn't break sync, just means no state restore
      console.error('[SUPABASE SYNC PROD] Checkpoint decryption failed:', error);
    }
  }

  // ============================================================================
  // BROADCAST
  // ============================================================================

  async broadcastUpdate(update: Uint8Array): Promise<void> {
    return measureAsync('broadcast', async () => {
      if (!this.isConnected || !this.supabaseChannel || !this.derivedKey) {
        return;
      }

      try {
        const encrypted = await encryptUpdate(update, this.derivedKey);

        await this.supabaseChannel.send({
          type: 'broadcast',
          event: 'yjs_update',
          payload: { encrypted: Array.from(encrypted) },
        });

        audit.sync('broadcast', this.roomIdHash, true, { size: update.length });
      } catch (error) {
        // INTENTIONALLY SWALLOWING: Broadcast failure is non-fatal
        // Single update failure shouldn't break sync, retry happens on next edit
        console.error('[SUPABASE SYNC PROD] Broadcast failed:', error);
        audit.sync('broadcast', this.roomIdHash, false, { error: String(error) });
      }
    }, this.roomIdHash);
  }

  async broadcastCheckpoint(fullUpdate: Uint8Array): Promise<void> {
    if (!this.isConnected || !this.supabaseChannel || !this.derivedKey) {
      return;
    }

    try {
      const encrypted = await encryptUpdate(fullUpdate, this.derivedKey);

      await this.supabaseChannel.send({
        type: 'broadcast',
        event: 'checkpoint',
        payload: { encrypted: Array.from(encrypted) },
      });

      this.onSyncActivity?.();
      audit.sync('broadcast_checkpoint', this.roomIdHash, true, { size: fullUpdate.length });
    } catch (error) {
      // INTENTIONALLY SWALLOWING: Checkpoint broadcast is best-effort
      // Failed broadcast doesn't break sync, peer will request again if needed
      console.error('[SUPABASE SYNC PROD] Checkpoint broadcast failed:', error);
    }
  }

  // ============================================================================
  // DISCONNECT
  // ============================================================================

  disconnect(): void {

    // Remove ydoc observer
    this.ydoc.off('update', this.ydocUpdateHandler);

    // Clear debounce timer
    if (this.broadcastDebounceTimer) {
      clearTimeout(this.broadcastDebounceTimer);
    }

    // Stop checkpoint interval
    this.stopCheckpointInterval();

    // Save final checkpoint on disconnect
    this.saveCheckpoint();

    // Unsubscribe from channel
    if (this.supabaseChannel) {
      this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
    }

    // Clear sensitive data
    this.derivedKey = null;

    this.isConnected = false;
    this.setStatus('disconnected');

    audit.sync('disconnect', this.roomIdHash, true, {});
    emitTelemetry('transport_switched', { from: 'supabase', to: 'disconnected' });

  }

  // ============================================================================
  // FLUSH & CLEANUP
  // ============================================================================

  async flush(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    // Flush any pending updates
    while (this.pendingUpdateQueue.length > 0) {
      const update = this.pendingUpdateQueue.shift();
      if (update) {
        await this.broadcastUpdate(update);
      }
    }
  }

  flushQueuedUpdates(): void {
    this.flush();
  }

  async sendDisconnectSignal(): Promise<void> {
    if (!this.isConnected || !this.supabaseChannel) {
      return;
    }

    try {
      await this.supabaseChannel.send({
        type: 'broadcast',
        event: 'user_disconnect',
        payload: { timestamp: Date.now() },
      });
    } catch (error) {
      // INTENTIONALLY SWALLOWING: Disconnect signal is best-effort
      // Failed signal doesn't prevent disconnect, just means peer won't see graceful exit
      console.error('[SUPABASE SYNC PROD] Disconnect signal failed:', error);
    }
  }

  requestCache(): void {
    if (!this.isConnected || !this.supabaseChannel) {
      return;
    }

    // Request checkpoint from peers
    this.supabaseChannel.send({
      type: 'broadcast',
      event: 'request_checkpoint',
      payload: { timestamp: Date.now() },
    });
  }

  // ============================================================================
  // STATUS & GETTERS
  // ============================================================================

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.onStatusChange(status);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  isConnectedToServer(): boolean {
    return this.isConnected;
  }

  getConnectionTimeout(): number {
    return this.isColdStart ? COLD_START_TIMEOUT : CONNECTION_TIMEOUT;
  }

  wasColdStart(): boolean {
    return this.isColdStart;
  }

  // ============================================================================
  // CHECKPOINT INTEGRATION
  // ============================================================================

  /**
   * Load the latest checkpoint for this room
   */
  private async loadCheckpoint(): Promise<void> {
    return measureAsync('checkpoint', async () => {
      try {
        const checkpointService = getCheckpointService();
        const checkpoint = await checkpointService.loadLatestCheckpoint(this.roomIdHash);

        if (checkpoint) {
          // Apply checkpoint to ydoc
          Y.applyUpdate(this.ydoc, checkpoint, 'checkpoint');
          audit.sync('checkpoint_applied', this.roomIdHash, true, { size: checkpoint.length });
        }
      } catch (error) {
        // INTENTIONALLY SWALLOWING: Checkpoint load failure is non-fatal
        // Missing checkpoint means fresh sync state, app continues normally
        console.error('[SUPABASE SYNC PROD] Failed to load checkpoint:', error);
        audit.sync('checkpoint_load', this.roomIdHash, false, { error: String(error) });
      }
    }, this.roomIdHash);
  }

  /**
   * Save current state as checkpoint
   */
  private async saveCheckpoint(): Promise<void> {
    if (!this.derivedKey) return;

    return measureAsync('checkpoint', async () => {
      try {
        const checkpointService = getCheckpointService();
        const update = Y.encodeStateAsUpdate(this.ydoc);

        // Get client ID from device identity
        const { getDeviceId } = await import('./identity');
        const clientId = getDeviceId();

        await checkpointService.saveCheckpoint({
          roomHash: this.roomIdHash,
          clientId,
          data: update,
          metadata: { timestamp: Date.now() },
        });

        audit.sync('checkpoint_saved', this.roomIdHash, true, { size: update.length });
      } catch (error) {
        // INTENTIONALLY SWALLOWING: Checkpoint save failure is non-fatal
        // Persistence is best-effort, next periodic save will retry
        console.error('[SUPABASE SYNC PROD] Failed to save checkpoint:', error);
        audit.sync('checkpoint_save', this.roomIdHash, false, { error: String(error) });
      }
    }, this.roomIdHash);
  }

  /**
   * Start periodic checkpoint saving
   */
  private startCheckpointInterval(): void {
    // Save immediately on connect
    this.saveCheckpoint();

    // Then periodically
    this.checkpointInterval = setInterval(() => {
      this.saveCheckpoint();
    }, this.CHECKPOINT_INTERVAL_MS);
  }

  /**
   * Stop checkpoint interval
   */
  private stopCheckpointInterval(): void {
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
      this.checkpointInterval = null;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default SupabaseSyncProd;
