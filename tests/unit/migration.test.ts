/**
 * Unit tests for migration.ts
 *
 * Tests data migration module including export, migration, rollback,
 * and status tracking functions for identity transitions.
 *
 * @module tests/unit/migration
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing module
const mockGetProject = vi.fn();
const mockRpc = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  getSupabaseClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

vi.mock('@/lib/featureFlags', () => ({
  emitTelemetry: vi.fn(),
}));

vi.mock('@/lib/identity', () => ({
  getDeviceId: vi.fn(() => 'test-device-123'),
  getUnoWorkspaceId: vi.fn(() => 'workspace-123'),
}));

vi.mock('@/services/storage', () => ({
  storageService: {
    getProject: vi.fn((...args) => mockGetProject(...args)),
  },
}));

// Import module after mocking
import {
  exportAnonymousData,
  getMigrationBackup,
  migrateAnonymousData,
  rollbackMigration,
  canRollback,
  cleanupMigrationData,
  getMigrationStatus,
  isMigrationInProgress,
  isMigrationComplete,
  BACKUP_RETENTION_MS,
} from '@/lib/migration';

describe('migration constants', () => {
  it('should export correct backup retention period', () => {
    expect(BACKUP_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000); // 30 days in ms
  });
});

describe('exportAnonymousData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProject.mockResolvedValue({
      todoProjects: [
        { id: 'project-1', name: 'Test Project', color: '#FF0000', todoRows: [] },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('should export anonymous data with projects', async () => {
    // Act
    const result = await exportAnonymousData();

    // Assert
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].name).toBe('Test Project');
    expect(result.deviceId).toBe('test-device-123');
    expect(result.workspaceType).toBe('personalUno');
    expect(result.version).toBe('1.0.0');
    expect(result.dataSize).toBeGreaterThan(0);
  });

  it('should export empty projects when none exist', async () => {
    // Arrange
    mockGetProject.mockResolvedValue({ todoProjects: [] });

    // Act
    const result = await exportAnonymousData();

    // Assert
    expect(result.projects).toEqual([]);
    expect(result.dataSize).toBeGreaterThan(0); // Still has metadata
  });

  it('should store backup in localStorage', async () => {
    // Act
    await exportAnonymousData();

    // Assert
    const backup = localStorage.getItem('cubit_migration_backup');
    expect(backup).not.toBeNull();
    const parsed = JSON.parse(backup!);
    expect(parsed.data).toBeDefined();
    expect(parsed.storedAt).toBeDefined();
  });

  it('should throw error during SSR', async () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act & Assert
    await expect(exportAnonymousData()).rejects.toThrow('server-side rendering');

    // Restore
    global.window = originalWindow;
  });

  it('should handle storage errors gracefully', async () => {
    // Arrange
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    setItemSpy.mockImplementation(() => {
      throw new Error('Storage full');
    });

    // Act - should not throw
    const result = await exportAnonymousData();

    // Assert
    expect(result).toBeDefined();
    expect(result.projects).toHaveLength(1);

    // Restore
    setItemSpy.mockRestore();
  });
});

describe('getMigrationBackup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return backup when it exists', () => {
    // Arrange
    const mockBackup = {
      data: { projects: [], deviceId: 'device-1', workspaceType: 'personalUno', workspaceId: 'ws-1', timestamp: Date.now(), version: '1.0.0', dataSize: 100 },
      storedAt: Date.now(),
    };
    localStorage.setItem('cubit_migration_backup', JSON.stringify(mockBackup));

    // Act
    const result = getMigrationBackup();

    // Assert
    expect(result).not.toBeNull();
    expect(result?.deviceId).toBe('device-1');
  });

  it('should return null when no backup exists', () => {
    // Act
    const result = getMigrationBackup();

    // Assert
    expect(result).toBeNull();
  });

  it('should return null when backup is expired', () => {
    // Arrange
    const expiredBackup = {
      data: { projects: [], deviceId: 'device-1', workspaceType: 'personalUno', workspaceId: 'ws-1', timestamp: Date.now(), version: '1.0.0', dataSize: 100 },
      storedAt: Date.now() - (31 * 24 * 60 * 60 * 1000), // 31 days old
    };
    localStorage.setItem('cubit_migration_backup', JSON.stringify(expiredBackup));

    // Act
    const result = getMigrationBackup();

    // Assert
    expect(result).toBeNull();
    // Verify it was cleaned up
    expect(localStorage.getItem('cubit_migration_backup')).toBeNull();
  });

  it('should handle parse errors gracefully', () => {
    // Arrange
    localStorage.setItem('cubit_migration_backup', 'invalid-json');

    // Act
    const result = getMigrationBackup();

    // Assert
    expect(result).toBeNull();
  });

  it('should return null during SSR', () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act
    const result = getMigrationBackup();

    // Assert
    expect(result).toBeNull();

    // Restore
    global.window = originalWindow;
  });
});

describe('migrateAnonymousData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Setup default mocks
    mockRpc.mockImplementation((procedure) => {
      if (procedure === 'start_identity_migration') {
        return { data: 'migration-id-123', error: null };
      }
      if (procedure === 'complete_identity_migration') {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      insert: mockInsert,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should succeed with projects to migrate', async () => {
    // Arrange
    // Setup backup data
    const mockBackup = {
      data: {
        projects: [
          { id: 'project-1', name: 'Test Project', color: '#FF0000', todoRows: [] },
        ],
        deviceId: 'device-1',
        workspaceType: 'personalUno',
        workspaceId: 'ws-1',
        timestamp: Date.now(),
        version: '1.0.0',
        dataSize: 1000,
      },
      storedAt: Date.now(),
    };
    localStorage.setItem('cubit_migration_backup', JSON.stringify(mockBackup));

    mockGetProject.mockResolvedValue({
      todoProjects: [{ id: 'project-1', name: 'Test Project', color: '#FF0000', todoRows: [] }],
    });

    // Act
    const result = await migrateAnonymousData('user-123');

    // Assert
    expect(result.success).toBe(true);
    expect(result.migratedProjects).toBe(1);
    expect(result.migrationId).toBe('migration-id-123');
    expect(result.rollbackAvailable).toBe(true);
  });

  it('should succeed with no projects to migrate', async () => {
    // Arrange
    mockGetProject.mockResolvedValue({ todoProjects: [] });

    // Act
    const result = await migrateAnonymousData('user-123');

    // Assert
    expect(result.success).toBe(true);
    expect(result.migratedProjects).toBe(0);
  });

  it('should invoke progress callback during migration', async () => {
    // Arrange
    const progressCallback = vi.fn();
    mockGetProject.mockResolvedValue({ todoProjects: [] });

    // Act
    await migrateAnonymousData('user-123', progressCallback);

    // Assert
    expect(progressCallback).toHaveBeenCalled();
    // Should be called with 'exporting' stage
    expect(progressCallback).toHaveBeenCalledWith('exporting', expect.any(Number), expect.any(String));
  });

  it('should handle RPC errors during migration start', async () => {
    // Arrange
    mockRpc.mockImplementation((procedure) => {
      if (procedure === 'start_identity_migration') {
        return { data: null, error: { message: 'RPC failed' } };
      }
      return { data: null, error: null };
    });

    mockGetProject.mockResolvedValue({ todoProjects: [] });

    // Act
    const result = await migrateAnonymousData('user-123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Failed to start migration');
  });

  it('should handle export failures', async () => {
    // Arrange
    mockGetProject.mockRejectedValue(new Error('Storage error'));

    // Act
    const result = await migrateAnonymousData('user-123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Failed to export anonymous data');
  });

  it('should handle unexpected errors gracefully', async () => {
    // Arrange
    mockRpc.mockRejectedValue(new Error('Unexpected error'));
    mockGetProject.mockResolvedValue({ todoProjects: [] });

    // Act
    const result = await migrateAnonymousData('user-123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.migratedProjects).toBe(0);
  });

  it('should return SSR error during server-side rendering', async () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act
    const result = await migrateAnonymousData('user-123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('server-side rendering');

    // Restore
    global.window = originalWindow;
  });
});

describe('rollbackMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockRpc.mockResolvedValue({ error: null });
  });

  it('should succeed when migration exists', async () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 1,
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));

    // Act
    const result = await rollbackMigration();

    // Assert
    expect(result).toBe(true);
    // Verify metadata was cleared
    expect(localStorage.getItem('cubit_migration_metadata')).toBeNull();
  });

  it('should succeed with specific migrationId', async () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 1,
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));

    // Act
    const result = await rollbackMigration('migration-123');

    // Assert
    expect(result).toBe(true);
  });

  it('should return false when no migration to rollback', async () => {
    // Act
    const result = await rollbackMigration();

    // Assert
    expect(result).toBe(false);
  });

  it('should handle RPC errors gracefully', async () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 1,
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));

    mockRpc.mockResolvedValue({ error: { message: 'RPC failed' } });

    // Act - should not throw even on RPC error
    const result = await rollbackMigration();

    // Assert
    expect(result).toBe(true); // Still returns true because local state is cleared
  });

  it('should handle exceptions gracefully', async () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 1,
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));

    mockRpc.mockRejectedValue(new Error('Network error'));

    // Act
    const result = await rollbackMigration();

    // Assert
    expect(result).toBe(false);
  });

  it('should return false during SSR', async () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act
    const result = await rollbackMigration();

    // Assert
    expect(result).toBe(false);

    // Restore
    global.window = originalWindow;
  });
});

describe('canRollback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return true when metadata and backup exist', () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 1,
    };
    const mockBackup = {
      data: { projects: [], deviceId: 'device-1', workspaceType: 'personalUno', workspaceId: 'ws-1', timestamp: Date.now(), version: '1.0.0', dataSize: 100 },
      storedAt: Date.now(),
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));
    localStorage.setItem('cubit_migration_backup', JSON.stringify(mockBackup));

    // Act
    const result = canRollback();

    // Assert
    expect(result).toBe(true);
  });

  it('should return false when no metadata', () => {
    // Arrange
    const mockBackup = {
      data: { projects: [], deviceId: 'device-1', workspaceType: 'personalUno', workspaceId: 'ws-1', timestamp: Date.now(), version: '1.0.0', dataSize: 100 },
      storedAt: Date.now(),
    };
    localStorage.setItem('cubit_migration_backup', JSON.stringify(mockBackup));

    // Act
    const result = canRollback();

    // Assert
    expect(result).toBe(false);
  });

  it('should return false when no backup', () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 1,
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));

    // Act
    const result = canRollback();

    // Assert
    expect(result).toBe(false);
  });

  it('should return false when migration not completed', () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'in_progress', // Not completed
      startedAt: Date.now(),
      projectCount: 1,
    };
    const mockBackup = {
      data: { projects: [], deviceId: 'device-1', workspaceType: 'personalUno', workspaceId: 'ws-1', timestamp: Date.now(), version: '1.0.0', dataSize: 100 },
      storedAt: Date.now(),
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));
    localStorage.setItem('cubit_migration_backup', JSON.stringify(mockBackup));

    // Act
    const result = canRollback();

    // Assert
    expect(result).toBe(false);
  });

  it('should return false during SSR', () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act
    const result = canRollback();

    // Assert
    expect(result).toBe(false);

    // Restore
    global.window = originalWindow;
  });
});

describe('cleanupMigrationData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should remove expired backup', () => {
    // Arrange
    const expiredBackup = {
      data: { projects: [], deviceId: 'device-1', workspaceType: 'personalUno', workspaceId: 'ws-1', timestamp: Date.now(), version: '1.0.0', dataSize: 100 },
      storedAt: Date.now() - (31 * 24 * 60 * 60 * 1000), // 31 days old
    };
    localStorage.setItem('cubit_migration_backup', JSON.stringify(expiredBackup));

    // Act
    const result = cleanupMigrationData();

    // Assert
    expect(result.backupRemoved).toBe(true);
    expect(localStorage.getItem('cubit_migration_backup')).toBeNull();
  });

  it('should preserve recent backup', () => {
    // Arrange
    const recentBackup = {
      data: { projects: [], deviceId: 'device-1', workspaceType: 'personalUno', workspaceId: 'ws-1', timestamp: Date.now(), version: '1.0.0', dataSize: 100 },
      storedAt: Date.now() - (5 * 24 * 60 * 60 * 1000), // 5 days old
    };
    localStorage.setItem('cubit_migration_backup', JSON.stringify(recentBackup));

    // Act
    const result = cleanupMigrationData();

    // Assert
    expect(result.backupRemoved).toBe(false);
    expect(localStorage.getItem('cubit_migration_backup')).not.toBeNull();
  });

  it('should remove completed metadata after 90 days', () => {
    // Arrange
    const oldMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'completed',
      startedAt: Date.now() - (91 * 24 * 60 * 60 * 1000),
      completedAt: Date.now() - (91 * 24 * 60 * 60 * 1000),
      projectCount: 1,
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(oldMetadata));

    // Act
    const result = cleanupMigrationData();

    // Assert
    expect(result.metadataCleared).toBe(true);
    expect(localStorage.getItem('cubit_migration_metadata')).toBeNull();
  });

  it('should handle errors gracefully', () => {
    // Arrange
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage error');
    });

    // Act - should not throw
    const result = cleanupMigrationData();

    // Assert
    expect(result).toEqual({ backupRemoved: false, metadataCleared: false });

    // Restore
    getItemSpy.mockRestore();
  });
});

describe('getMigrationStatus', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return correct status when metadata exists', () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 1,
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));

    // Act
    const result = getMigrationStatus();

    // Assert
    expect(result).not.toBeNull();
    expect(result?.migrationId).toBe('migration-123');
    expect(result?.status).toBe('completed');
  });

  it('should return null when no metadata', () => {
    // Act
    const result = getMigrationStatus();

    // Assert
    expect(result).toBeNull();
  });
});

describe('isMigrationInProgress', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return true when migration is pending', () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'pending',
      startedAt: Date.now(),
      projectCount: 1,
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));

    // Act
    const result = isMigrationInProgress();

    // Assert
    expect(result).toBe(true);
  });

  it('should return true when migration is in_progress', () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'in_progress',
      startedAt: Date.now(),
      projectCount: 1,
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));

    // Act
    const result = isMigrationInProgress();

    // Assert
    expect(result).toBe(true);
  });

  it('should return false when migration is completed', () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 1,
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));

    // Act
    const result = isMigrationInProgress();

    // Assert
    expect(result).toBe(false);
  });
});

describe('isMigrationComplete', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return true when migration is completed', () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 1,
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));

    // Act
    const result = isMigrationComplete();

    // Assert
    expect(result).toBe(true);
  });

  it('should return false when migration is in_progress', () => {
    // Arrange
    const mockMetadata = {
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-1',
      status: 'in_progress',
      startedAt: Date.now(),
      projectCount: 1,
    };
    localStorage.setItem('cubit_migration_metadata', JSON.stringify(mockMetadata));

    // Act
    const result = isMigrationComplete();

    // Assert
    expect(result).toBe(false);
  });

  it('should return false when no migration', () => {
    // Act
    const result = isMigrationComplete();

    // Assert
    expect(result).toBe(false);
  });
});
