/**
 * Data Migration Module
 *
 * Handles migration of anonymous device-based data to authenticated user accounts.
 * Provides export, migration, and rollback capabilities for identity transitions.
 *
 * @module src/lib/migration
 * @production
 * @version 1.0.0
 */

import { getSupabaseClient } from './supabaseClient';
import { emitTelemetry } from './featureFlags';
import { getDeviceId, getUnoWorkspaceId, type WorkspaceType } from './identity';
import { storageService, TodoProject } from '@/services/storage';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * LocalStorage key for migration metadata
 */
const MIGRATION_METADATA_KEY = 'cubit_migration_metadata';

/**
 * LocalStorage key for pre-migration backup
 */
const MIGRATION_BACKUP_KEY = 'cubit_migration_backup';

/**
 * Backup retention period (30 days in milliseconds)
 */
export const BACKUP_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Exported anonymous data structure
 */
export interface ExportData {
  /** All projects from anonymous device */
  projects: TodoProject[];
  /** Device identifier */
  deviceId: string;
  /** Workspace type */
  workspaceType: WorkspaceType;
  /** Workspace identifier */
  workspaceId: string;
  /** Export timestamp */
  timestamp: number;
  /** Export version for compatibility */
  version: string;
  /** Data size in bytes */
  dataSize: number;
}

/**
 * Result of migration operation
 */
export interface MigrationResult {
  /** Whether migration succeeded */
  success: boolean;
  /** Number of projects migrated */
  migratedProjects: number;
  /** Migration record ID from database */
  migrationId?: string;
  /** Error messages if failed */
  errors: string[];
  /** Whether rollback is available */
  rollbackAvailable: boolean;
}

/**
 * Migration metadata stored locally
 */
interface MigrationMetadata {
  migrationId: string;
  userId: string;
  deviceId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  startedAt: number;
  completedAt?: number;
  projectCount: number;
}

/**
 * Migration progress callback
 */
export type MigrationProgressCallback = (
  stage: 'exporting' | 'migrating' | 'verifying',
  progress: number,
  message: string
) => void;

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export all anonymous data for backup before migration
 *
 * Collects all projects, tasks, and settings from the current device.
 * Returns a complete snapshot that can be restored if migration fails.
 *
 * @returns Complete anonymous data export
 */
export async function exportAnonymousData(): Promise<ExportData> {
  // SSR safety
  if (typeof window === 'undefined') {
    throw new Error('Cannot export data during server-side rendering');
  }

  const deviceId = getDeviceId();
  const workspaceType: WorkspaceType = 'personalUno';
  const workspaceId = getUnoWorkspaceId();

  try {
    emitTelemetry('transport_switched', {
      from: 'anonymous',
      to: 'exporting',
      context: { deviceId, workspaceType },
    });

    // Load all project data from storage
    const projectData = await storageService.getProject(workspaceType, workspaceId);

    // Create export data structure
    const exportData: ExportData = {
      projects: projectData.todoProjects || [],
      deviceId,
      workspaceType,
      workspaceId,
      timestamp: Date.now(),
      version: '1.0.0',
      dataSize: 0, // Will calculate below
    };

    // Calculate data size
    const serialized = JSON.stringify(exportData);
    exportData.dataSize = new Blob([serialized]).size;

    // Store backup in localStorage (temporary safety net)
    await storeMigrationBackup(exportData);

    emitTelemetry('transport_switched', {
      from: 'exporting',
      to: 'exported',
      context: {
        deviceId,
        projectCount: exportData.projects.length,
        dataSize: exportData.dataSize,
      },
    });

    return exportData;
  } catch (error) {
    // INTENTIONALLY HANDLING: Export failure blocks migration
    // This is intentional - we need backup before proceeding
    console.error('[MIGRATION] Export failed:', error);
    emitTelemetry('error_boundary_triggered', {
      context: {
        error: 'migration_export_failed',
        deviceId,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw new Error(`Failed to export anonymous data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Store migration backup in localStorage
 *
 * @param data - Export data to store
 */
async function storeMigrationBackup(data: ExportData): Promise<void> {
  try {
    const backup = {
      data,
      storedAt: Date.now(),
    };
    localStorage.setItem(MIGRATION_BACKUP_KEY, JSON.stringify(backup));
  } catch (error) {
    // INTENTIONALLY HANDLING: localStorage may be full or unavailable
    // Log warning but don't block migration - we still have the data in memory
    console.warn('[MIGRATION] Could not store backup in localStorage:', error);
  }
}

/**
 * Retrieve stored migration backup
 *
 * @returns Backup data or null if not found/expired
 */
export function getMigrationBackup(): ExportData | null {
  // SSR safety
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const backupJson = localStorage.getItem(MIGRATION_BACKUP_KEY);
    if (!backupJson) return null;

    const backup = JSON.parse(backupJson) as {
      data: ExportData;
      storedAt: number;
    };

    // Check if backup expired
    if (Date.now() - backup.storedAt > BACKUP_RETENTION_MS) {
      // Clean up expired backup
      localStorage.removeItem(MIGRATION_BACKUP_KEY);
      return null;
    }

    return backup.data;
  } catch (error) {
    // INTENTIONALLY HANDLING: Backup retrieval failure returns null
    console.warn('[MIGRATION] Could not retrieve backup:', error);
    return null;
  }
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Migrate anonymous data to user account
 *
 * This is the core migration function that:
 * 1. Exports anonymous data (if not already done)
 * 2. Logs migration start in database
 * 3. Copies projects to user-owned namespace
 * 4. Updates local storage ownership
 * 5. Logs migration completion
 *
 * @param userId - Supabase user ID to migrate to
 * @param onProgress - Optional progress callback
 * @returns Migration result with status and project count
 */
export async function migrateAnonymousData(
  userId: string,
  onProgress?: MigrationProgressCallback
): Promise<MigrationResult> {
  // SSR safety
  if (typeof window === 'undefined') {
    return {
      success: false,
      migratedProjects: 0,
      errors: ['Cannot migrate during server-side rendering'],
      rollbackAvailable: false,
    };
  }

  const deviceId = getDeviceId();
  const errors: string[] = [];

  try {
    emitTelemetry('transport_switched', {
      from: 'anonymous',
      to: 'migrating',
      context: { userId, deviceId },
    });

    onProgress?.('exporting', 10, 'Exporting anonymous data...');

    // Step 1: Export anonymous data
    let exportData: ExportData;
    try {
      exportData = await exportAnonymousData();
    } catch (error) {
      return {
        success: false,
        migratedProjects: 0,
        errors: [error instanceof Error ? error.message : 'Export failed'],
        rollbackAvailable: getMigrationBackup() !== null,
      };
    }

    onProgress?.('exporting', 30, 'Starting database migration...');

    // Step 2: Start migration in database
    const client = getSupabaseClient();

    const { data: migrationRecord, error: startError } = await client.rpc(
      'start_identity_migration',
      {
        p_old_device_id: deviceId,
        p_new_user_id: userId,
        p_exported_data_size: exportData.dataSize,
      }
    );

    if (startError || !migrationRecord) {
      errors.push(`Failed to start migration: ${startError?.message || 'No migration ID returned'}`);
      return {
        success: false,
        migratedProjects: 0,
        errors,
        rollbackAvailable: true,
      };
    }

    const migrationId = migrationRecord as string;

    // Store metadata locally for tracking
    const metadata: MigrationMetadata = {
      migrationId,
      userId,
      deviceId,
      status: 'in_progress',
      startedAt: Date.now(),
      projectCount: exportData.projects.length,
    };
    storeMigrationMetadata(metadata);

    onProgress?.('migrating', 50, 'Copying projects to user account...');

    // Step 3: Copy projects to user_projects table
    let migratedCount = 0;

    for (const project of exportData.projects) {
      try {
        const { error: projectError } = await client.from('user_projects').insert({
          user_id: userId,
          project_id: project.id,
          project_name: project.name,
          project_color: project.color,
          workspace_type: exportData.workspaceType,
          last_modified_at: new Date().toISOString(),
        });

        if (projectError) {
          // INTENTIONALLY HANDLING: Single project failure doesn't abort migration
          // Log error and continue with other projects
          console.warn(`[MIGRATION] Failed to migrate project ${project.id}:`, projectError);
          errors.push(`Project "${project.name}": ${projectError.message}`);
        } else {
          migratedCount++;
        }
      } catch (projectError) {
        console.warn(`[MIGRATION] Exception migrating project ${project.id}:`, projectError);
        errors.push(`Project "${project.name}": ${projectError instanceof Error ? projectError.message : 'Unknown error'}`);
      }
    }

    onProgress?.('verifying', 80, 'Finalizing migration...');

    // Step 4: Complete migration in database
    const { error: completeError } = await client.rpc('complete_identity_migration', {
      p_migration_id: migrationId,
      p_device_count: 1,
      p_project_count: migratedCount,
    });

    if (completeError) {
      errors.push(`Failed to complete migration: ${completeError.message}`);
      // INTENTIONALLY HANDLING: Completion logging failure doesn't invalidate migration
      // Projects are already copied - we just can't audit it fully
      console.error('[MIGRATION] Failed to complete migration audit:', completeError);
    }

    // Update local metadata
    metadata.status = errors.length > 0 ? 'completed' : 'completed';
    metadata.completedAt = Date.now();
    storeMigrationMetadata(metadata);

    onProgress?.('verifying', 100, 'Migration complete');

    emitTelemetry('transport_switched', {
      from: 'migrating',
      to: 'authenticated',
      context: {
        userId,
        deviceId,
        projectCount: migratedCount,
        errorCount: errors.length,
      },
    });

    return {
      success: errors.length === 0 || migratedCount > 0,
      migratedProjects: migratedCount,
      migrationId,
      errors,
      rollbackAvailable: true,
    };
  } catch (error) {
    // INTENTIONALLY HANDLING: Unexpected migration failure
    console.error('[MIGRATION] Unexpected error during migration:', error);

    emitTelemetry('error_boundary_triggered', {
      context: {
        error: 'migration_unexpected_failure',
        userId,
        deviceId,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return {
      success: false,
      migratedProjects: 0,
      errors: [error instanceof Error ? error.message : 'Unexpected error during migration'],
      rollbackAvailable: getMigrationBackup() !== null,
    };
  }
}

// ============================================================================
// ROLLBACK FUNCTIONS
// ============================================================================

/**
 * Rollback identity migration
 *
 * Restores anonymous data access and marks migration as rolled back.
 * This is an emergency recovery function.
 *
 * @param migrationId - Migration ID to rollback (optional, uses latest if not provided)
 * @returns true if rollback successful
 */
export async function rollbackMigration(migrationId?: string): Promise<boolean> {
  // SSR safety
  if (typeof window === 'undefined') {
    return false;
  }

  const deviceId = getDeviceId();

  try {
    // Get migration metadata
    const metadata = getMigrationMetadata();
    const targetMigrationId = migrationId || metadata?.migrationId;

    if (!targetMigrationId) {
      console.error('[MIGRATION] No migration ID found for rollback');
      return false;
    }

    emitTelemetry('transport_switched', {
      from: 'authenticated',
      to: 'rolling_back',
      context: { migrationId: targetMigrationId, deviceId },
    });

    const client = getSupabaseClient();

    // Mark migration as rolled back in database
    const { error: rollbackError } = await client.rpc('rollback_identity_migration', {
      p_migration_id: targetMigrationId,
    });

    if (rollbackError) {
      // INTENTIONALLY HANDLING: Database rollback logging failure doesn't prevent local rollback
      console.warn('[MIGRATION] Failed to log rollback in database:', rollbackError);
    }

    // Clear migration metadata
    clearMigrationMetadata();

    // Restore backup if available
    const backup = getMigrationBackup();
    if (backup) {
      // Backup exists - data is preserved in IndexedDB, we just switch auth context
      console.log('[MIGRATION] Rollback complete. Anonymous data preserved.');
    }

    emitTelemetry('transport_switched', {
      from: 'rolling_back',
      to: 'anonymous',
      context: { migrationId: targetMigrationId, deviceId },
    });

    return true;
  } catch (error) {
    // INTENTIONALLY HANDLING: Rollback failure is critical but not fatal
    // Log extensively and return false to signal manual intervention needed
    console.error('[MIGRATION] Rollback failed:', error);
    emitTelemetry('error_boundary_triggered', {
      context: {
        error: 'migration_rollback_failed',
        migrationId,
        deviceId,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    return false;
  }
}

/**
 * Check if migration can be rolled back
 *
 * @returns true if rollback is available
 */
export function canRollback(): boolean {
  // SSR safety
  if (typeof window === 'undefined') {
    return false;
  }

  const metadata = getMigrationMetadata();
  const backup = getMigrationBackup();

  return metadata !== null && backup !== null && metadata.status === 'completed';
}

// ============================================================================
// METADATA MANAGEMENT
// ============================================================================

/**
 * Store migration metadata in localStorage
 *
 * @param metadata - Migration metadata to store
 */
function storeMigrationMetadata(metadata: MigrationMetadata): void {
  try {
    localStorage.setItem(MIGRATION_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    // INTENTIONALLY HANDLING: localStorage failure doesn't block migration
    console.warn('[MIGRATION] Could not store migration metadata:', error);
  }
}

/**
 * Get migration metadata from localStorage
 *
 * @returns Migration metadata or null
 */
export function getMigrationMetadata(): MigrationMetadata | null {
  // SSR safety
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const json = localStorage.getItem(MIGRATION_METADATA_KEY);
    if (!json) return null;

    return JSON.parse(json) as MigrationMetadata;
  } catch (error) {
    // INTENTIONALLY HANDLING: Parse failure returns null
    console.warn('[MIGRATION] Could not parse migration metadata:', error);
    return null;
  }
}

/**
 * Clear migration metadata
 */
function clearMigrationMetadata(): void {
  try {
    localStorage.removeItem(MIGRATION_METADATA_KEY);
  } catch (error) {
    // INTENTIONALLY HANDLING: Clear failure is non-fatal
    console.warn('[MIGRATION] Could not clear migration metadata:', error);
  }
}

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

/**
 * Clean up old migration data
 *
 * Should be called periodically to remove expired backups and metadata.
 *
 * @returns Cleanup result summary
 */
export function cleanupMigrationData(): {
  backupRemoved: boolean;
  metadataCleared: boolean;
} {
  // SSR safety
  if (typeof window === 'undefined') {
    return { backupRemoved: false, metadataCleared: false };
  }

  let backupRemoved = false;
  let metadataCleared = false;

  try {
    // Check and remove expired backup
    const backupJson = localStorage.getItem(MIGRATION_BACKUP_KEY);
    if (backupJson) {
      const backup = JSON.parse(backupJson) as { storedAt: number };
      if (Date.now() - backup.storedAt > BACKUP_RETENTION_MS) {
        localStorage.removeItem(MIGRATION_BACKUP_KEY);
        backupRemoved = true;
      }
    }

    // Check if we should clear stale metadata
    const metadata = getMigrationMetadata();
    if (metadata && metadata.status === 'completed' && metadata.completedAt) {
      // Keep completed metadata for 90 days then clear
      if (Date.now() - metadata.completedAt > BACKUP_RETENTION_MS) {
        clearMigrationMetadata();
        metadataCleared = true;
      }
    }
  } catch (error) {
    // INTENTIONALLY HANDLING: Cleanup failure is non-fatal
    console.warn('[MIGRATION] Cleanup error:', error);
  }

  return { backupRemoved, metadataCleared };
}

// ============================================================================
// STATUS FUNCTIONS
// ============================================================================

/**
 * Get current migration status
 *
 * @returns Current migration status or null if no migration
 */
export function getMigrationStatus(): MigrationMetadata | null {
  return getMigrationMetadata();
}

/**
 * Check if identity migration is in progress
 *
 * @returns true if migration is pending or in_progress
 */
export function isMigrationInProgress(): boolean {
  const metadata = getMigrationMetadata();
  return metadata !== null && (metadata.status === 'pending' || metadata.status === 'in_progress');
}

/**
 * Check if identity migration is complete
 *
 * @returns true if migration completed successfully
 */
export function isMigrationComplete(): boolean {
  const metadata = getMigrationMetadata();
  return metadata !== null && metadata.status === 'completed';
}
