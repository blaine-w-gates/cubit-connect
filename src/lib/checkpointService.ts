/**
 * Checkpoint Service
 *
 * Manages Yjs document checkpoint persistence to Supabase.
 * Handles compression, encryption integration, and cleanup.
 *
 * @module checkpointService
 * @production
 */

import { getSupabaseClient } from './supabaseClient';
import { audit } from './auditLogger';

// ============================================================================
// CONSTANTS
// ============================================================================

const COMPRESSION_THRESHOLD_BYTES = 100 * 1024; // 100KB
const MAX_CHECKPOINT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// ============================================================================
// TYPES
// ============================================================================

export interface CheckpointData {
  roomHash: string;
  clientId: string;
  data: Uint8Array;
  sequenceNumber?: number;
  metadata?: Record<string, unknown>;
}

export interface StoredCheckpoint {
  id: string;
  clientId: string;
  sequenceNumber: number;
  createdAt: string;
  isCompressed: boolean;
  originalSize: number | null;
}

// ============================================================================
// COMPRESSION UTILITIES
// ============================================================================

/**
 * Compress data using CompressionStream API
 */
async function compress(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    // Fallback: return uncompressed
    return data;
  }

  try {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    // @ts-expect-error - CompressionStream API type mismatch
    writer.write(data);
    writer.close();

    const reader = stream.readable.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Concatenate chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  } catch (error) {
    // INTENTIONALLY FALLBACK: Compression failure should not block save
    // Returning uncompressed data allows checkpoint to still be saved
    console.warn('[CHECKPOINT] Compression failed, using uncompressed:', error);
    return data;
  }
}

/**
 * Decompress data using DecompressionStream API
 */
async function decompress(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    return data;
  }

  try {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    // @ts-expect-error - DecompressionStream API type mismatch
    writer.write(data);
    writer.close();

    const reader = stream.readable.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  } catch (error) {
    // INTENTIONALLY FALLBACK: Decompression failure should not crash app
    // Returning as-is allows graceful degradation, data may be viewable
    console.warn('[CHECKPOINT] Decompression failed, returning as-is:', error);
    return data;
  }
}

// ============================================================================
// CHECKPOINT SERVICE
// ============================================================================

export class CheckpointService {
  private clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  /**
   * Save a checkpoint to Supabase
   */
  async saveCheckpoint(checkpoint: CheckpointData): Promise<StoredCheckpoint | null> {
    try {
      // Validate size
      if (checkpoint.data.length > MAX_CHECKPOINT_SIZE_BYTES) {
        throw new Error(
          `Checkpoint too large: ${checkpoint.data.length} bytes (max: ${MAX_CHECKPOINT_SIZE_BYTES})`
        );
      }

      // Compress if over threshold
      const originalSize = checkpoint.data.length;
      const shouldCompress = originalSize > COMPRESSION_THRESHOLD_BYTES;
      const dataToStore = shouldCompress ? await compress(checkpoint.data) : checkpoint.data;

      const client = getSupabaseClient();

      // Get next sequence number if not provided
      const sequenceNumber = checkpoint.sequenceNumber ?? (await this.getNextSequence(checkpoint.roomHash));

      // Convert Uint8Array to PostgreSQL hex format for BYTEA column
      // PostgREST expects \x-prefixed hex string for BYTEA, not base64
      const hexData = '\\x' + (typeof Buffer !== 'undefined'
        ? Buffer.from(dataToStore).toString('hex')
        : Array.from(dataToStore).map(b => b.toString(16).padStart(2, '0')).join(''));

      // Insert checkpoint
      const { data, error } = await client
        .from('yjs_checkpoints')
        .insert({
          room_hash: checkpoint.roomHash,
          client_id: checkpoint.clientId || this.clientId,
          checkpoint_data: hexData,
          sequence_number: sequenceNumber,
          is_compressed: shouldCompress,
          original_size: shouldCompress ? originalSize : null,
          metadata: checkpoint.metadata || {},
        })
        .select('id, client_id, sequence_number, created_at, is_compressed, original_size')
        .single();

      if (error) {
        console.error('[CHECKPOINT] Save failed:', error);
        audit.sync('checkpoint_save', checkpoint.roomHash, false, { error: error.message });
        return null;
      }

      audit.sync('checkpoint_save', checkpoint.roomHash, true, {
        sequenceNumber,
        size: originalSize,
        compressed: shouldCompress,
      });

      return {
        id: data.id,
        clientId: data.client_id,
        sequenceNumber: data.sequence_number,
        createdAt: data.created_at,
        isCompressed: data.is_compressed,
        originalSize: data.original_size,
      };
    } catch (error) {
      // INTENTIONALLY RETURNING NULL: Checkpoint save is best-effort persistence
      // Network/DB failures should not crash the application
      // Caller checks return value and can implement retry logic
      console.error('[CHECKPOINT] Save error:', error);
      audit.sync('checkpoint_save', checkpoint.roomHash, false, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Load the latest checkpoint for a room
   */
  async loadLatestCheckpoint(roomHash: string): Promise<Uint8Array | null> {
    try {
      const client = getSupabaseClient();

      // Use direct query instead of RPC for better BYTEA handling
      const { data, error } = await client
        .from('yjs_checkpoints')
        .select('id, client_id, checkpoint_data, sequence_number, created_at, is_compressed, original_size')
        .eq('room_hash', roomHash)
        .order('sequence_number', { ascending: false })
        .limit(1);

      if (error) {
        console.error('[CHECKPOINT] Load failed:', error);
        audit.sync('checkpoint_load', roomHash, false, { error: error.message });
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const checkpoint = data[0];
      let checkpointData: Uint8Array;

      // Supabase/PostgREST returns BYTEA as hex string with \x prefix, or base64
      const rawData = checkpoint.checkpoint_data;
      if (typeof rawData === 'string') {
        if (rawData.startsWith('\\x')) {
          // PostgreSQL bytea hex format from PostgREST
          const hexStr = rawData.slice(2);
          if (typeof Buffer !== 'undefined') {
            checkpointData = new Uint8Array(Buffer.from(hexStr, 'hex'));
          } else {
            const bytes = new Uint8Array(hexStr.length / 2);
            for (let i = 0; i < hexStr.length; i += 2) {
              bytes[i / 2] = parseInt(hexStr.substr(i, 2), 16);
            }
            checkpointData = bytes;
          }
        } else if (typeof Buffer !== 'undefined') {
          // Base64-encoded string
          checkpointData = new Uint8Array(Buffer.from(rawData, 'base64'));
        } else {
          const binaryString = atob(rawData);
          checkpointData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            checkpointData[i] = binaryString.charCodeAt(i);
          }
        }
      } else if (rawData instanceof ArrayBuffer) {
        checkpointData = new Uint8Array(rawData);
      } else if (rawData instanceof Uint8Array) {
        checkpointData = rawData;
      } else if (rawData && typeof rawData === 'object' && 'data' in rawData) {
        // Handle { type: 'Buffer', data: number[] } format
        checkpointData = new Uint8Array((rawData as { data: number[] }).data);
      } else {
        checkpointData = new Uint8Array(rawData as ArrayBuffer);
      }

      // Decompress if needed
      if (checkpoint.is_compressed) {
        checkpointData = await decompress(checkpointData);
      }

      audit.sync('checkpoint_load', roomHash, true, {
        sequenceNumber: checkpoint.sequence_number,
        size: checkpointData.length,
      });

      return checkpointData;
    } catch (error) {
      // INTENTIONALLY RETURNING NULL: Checkpoint load failures are non-fatal
      // Missing checkpoint means fresh start, app continues normally
      console.error('[CHECKPOINT] Load error:', error);
      audit.sync('checkpoint_load', roomHash, false, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get next sequence number for a room
   */
  private async getNextSequence(roomHash: string): Promise<number> {
    try {
      const client = getSupabaseClient();

      const { data, error } = await client.rpc('get_next_checkpoint_sequence', {
        p_room_hash: roomHash,
      });

      if (error) {
        console.error('[CHECKPOINT] Sequence fetch failed:', error);
        return 1; // Fallback
      }

      return data || 1;
    } catch {
      // INTENTIONALLY SWALLOWING: Sequence number is a best-effort optimization
      // Fallback to 1 - collisions will be resolved by conflict resolution
      return 1;
    }
  }

  /**
   * List checkpoints for a room
   */
  async listCheckpoints(roomHash: string, limit: number = 10): Promise<StoredCheckpoint[]> {
    try {
      const client = getSupabaseClient();

      const { data, error } = await client
        .from('yjs_checkpoints')
        .select('id, client_id, sequence_number, created_at, is_compressed, original_size')
        .eq('room_hash', roomHash)
        .order('sequence_number', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[CHECKPOINT] List failed:', error);
        return [];
      }

      return data.map((row) => ({
        id: row.id,
        clientId: row.client_id,
        sequenceNumber: row.sequence_number,
        createdAt: row.created_at,
        isCompressed: row.is_compressed,
        originalSize: row.original_size,
      }));
    } catch (error) {
      // INTENTIONALLY HANDLING: List failures should return empty array, not crash
      // UI will show "no checkpoints" which is acceptable UX
      console.error('[CHECKPOINT] List error:', error);
      return [];
    }
  }

  /**
   * Delete old checkpoints (cleanup)
   */
  async cleanupOldCheckpoints(): Promise<number> {
    try {
      const client = getSupabaseClient();

      const { data, error } = await client.rpc('cleanup_old_checkpoints');

      if (error) {
        console.error('[CHECKPOINT] Cleanup failed:', error);
        return 0;
      }

      const deletedCount = data || 0;
      if (deletedCount > 0) {
        audit.sync('checkpoint_cleanup', 'global', true, { deletedCount });
      }

      return deletedCount;
    } catch (error) {
      // INTENTIONALLY HANDLING: Cleanup failures should not prevent app operation
      // Return 0 - cleanup will be attempted again on next schedule
      console.error('[CHECKPOINT] Cleanup error:', error);
      return 0;
    }
  }

  /**
   * Get statistics
   */
  async getStats(roomHash?: string): Promise<{
    totalCheckpoints: number;
    totalSize: number;
    compressedCount: number;
  }> {
    try {
      const client = getSupabaseClient();

      let query = client.from('yjs_checkpoints').select('is_compressed, original_size');

      if (roomHash) {
        query = query.eq('room_hash', roomHash);
      }

      const { data, error } = await query;

      if (error || !data) {
        return { totalCheckpoints: 0, totalSize: 0, compressedCount: 0 };
      }

      return {
        totalCheckpoints: data.length,
        totalSize: data.reduce((sum, row) => sum + (row.original_size || 0), 0),
        compressedCount: data.filter((row) => row.is_compressed).length,
      };
    } catch {
      // INTENTIONALLY SWALLOWING: Stats are for display only, zero values acceptable
      return { totalCheckpoints: 0, totalSize: 0, compressedCount: 0 };
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

let checkpointService: CheckpointService | null = null;

export function getCheckpointService(clientId?: string): CheckpointService {
  if (!checkpointService) {
    if (!clientId) {
      // Generate temporary client ID
      clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    checkpointService = new CheckpointService(clientId);
  }
  return checkpointService;
}

export function destroyCheckpointService(): void {
  checkpointService = null;
}

// ============================================================================
// DEVTOOLS
// ============================================================================

if (typeof window !== 'undefined') {
  // @ts-expect-error - DevTools
  window.__CHECKPOINT_SERVICE__ = {
    getService: getCheckpointService,
    destroy: destroyCheckpointService,
  };
}
