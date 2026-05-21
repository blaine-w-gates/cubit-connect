/**
 * Unit tests for store auth actions
 *
 * Tests Zustand store integration of authentication and migration actions.
 * Validates state updates, action orchestration, and error handling.
 *
 * @module tests/unit/storeAuth
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies - use vi.fn() directly in factories (hoisting-safe)
vi.mock('@/lib/auth', () => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getAuthState: vi.fn(),
  getLinkedDevices: vi.fn(),
  linkDeviceToUser: vi.fn(),
  isAuthEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/migration', () => ({
  migrateAnonymousData: vi.fn(),
  getMigrationMetadata: vi.fn(),
  getMigrationBackup: vi.fn(),
  rollbackMigration: vi.fn(),
  canRollback: vi.fn(),
  cleanupMigrationData: vi.fn(),
  getMigrationStatus: vi.fn(),
  isMigrationInProgress: vi.fn(),
  isMigrationComplete: vi.fn(),
}));

vi.mock('@/lib/identity', () => ({
  getDeviceId: vi.fn(() => 'device-123'),
  getDeviceLabel: vi.fn(() => 'Test Device'),
  getUnoWorkspaceId: vi.fn(() => 'workspace-123'),
}));

vi.mock('@/lib/featureFlags', () => ({
  emitTelemetry: vi.fn(),
}));

// Import store after mocking
import { useAppStore } from '@/store/useAppStore';
import { signUp, signIn, signOut, getAuthState, linkDeviceToUser } from '@/lib/auth';
import { migrateAnonymousData, getMigrationMetadata } from '@/lib/migration';
import { getDeviceId } from '@/lib/identity';

// Get references to mocked functions for test control
const mockSignUp = vi.mocked(signUp);
const mockSignIn = vi.mocked(signIn);
const mockSignOut = vi.mocked(signOut);
const mockGetAuthState = vi.mocked(getAuthState);
const mockLinkDeviceToUser = vi.mocked(linkDeviceToUser);
const mockMigrateAnonymousData = vi.mocked(migrateAnonymousData);
const mockGetMigrationMetadata = vi.mocked(getMigrationMetadata);
const mockGetDeviceId = vi.mocked(getDeviceId);

describe('store auth state', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      authUserId: null,
      authEmail: null,
      authStatus: 'anonymous',
      migrationStatus: 'idle',
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct initial state', () => {
    const state = useAppStore.getState();

    expect(state.authUserId).toBeNull();
    expect(state.authEmail).toBeNull();
    expect(state.authStatus).toBe('anonymous');
    expect(state.migrationStatus).toBe('idle');
  });

  it('should update state atomically', async () => {
    // Arrange
    mockSignUp.mockResolvedValue({ success: true, userId: 'user-123' });
    mockMigrateAnonymousData.mockResolvedValue({ success: true, migratedProjects: 5, errors: [], rollbackAvailable: false });

    // Act
    await useAppStore.getState().signUp('test@example.com', 'password123');

    // Assert
    const state = useAppStore.getState();
    expect(state.authUserId).toBe('user-123');
    expect(state.authEmail).toBe('test@example.com');
    expect(state.authStatus).toBe('authenticated');
    expect(state.migrationStatus).toBe('complete');
  });
});

describe('store signUp action', () => {
  beforeEach(() => {
    useAppStore.setState({
      authUserId: null,
      authEmail: null,
      authStatus: 'anonymous',
      migrationStatus: 'idle',
    });
    vi.clearAllMocks();
  });

  it('should succeed with successful migration', async () => {
    // Arrange
    mockSignUp.mockResolvedValue({ success: true, userId: 'user-123' });
    mockMigrateAnonymousData.mockResolvedValue({ success: true, migratedProjects: 3, errors: [], rollbackAvailable: false });

    // Act
    const result = await useAppStore.getState().signUp('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(true);
    const state = useAppStore.getState();
    expect(state.authUserId).toBe('user-123');
    expect(state.authEmail).toBe('test@example.com');
    expect(state.authStatus).toBe('authenticated');
    expect(state.migrationStatus).toBe('complete');
    expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123');
    expect(mockMigrateAnonymousData).toHaveBeenCalledWith('user-123', expect.any(Function));
  });

  it('should set pending status during sign up', async () => {
    // Arrange
    let capturedStatus: string | null = null;
    mockSignUp.mockImplementation(async () => {
      capturedStatus = useAppStore.getState().authStatus;
      return { success: true, userId: 'user-123' };
    });
    mockMigrateAnonymousData.mockResolvedValue({ success: true, migratedProjects: 3, errors: [], rollbackAvailable: false });

    // Act
    await useAppStore.getState().signUp('test@example.com', 'password123');

    // Assert
    expect(capturedStatus).toBe('pending');
  });

  it('should handle migration failure but keep auth', async () => {
    // Arrange
    mockSignUp.mockResolvedValue({ success: true, userId: 'user-123' });
    mockMigrateAnonymousData.mockResolvedValue({ success: false, migratedProjects: 0, errors: ['Migration failed'], rollbackAvailable: false });

    // Act
    const result = await useAppStore.getState().signUp('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(true); // Auth succeeded even if migration failed
    const state = useAppStore.getState();
    expect(state.authUserId).toBe('user-123');
    expect(state.authStatus).toBe('authenticated');
    expect(state.migrationStatus).toBe('error'); // But migration shows error
  });

  it('should track migration progress', async () => {
    // Arrange
    const progressUpdates: string[] = [];
    mockSignUp.mockResolvedValue({ success: true, userId: 'user-123' });
    mockMigrateAnonymousData.mockImplementation(async (userId, onProgress) => {
      onProgress?.('exporting', 0, 'Exporting...');
      progressUpdates.push(useAppStore.getState().migrationStatus);
      onProgress?.('migrating', 50, 'Migrating...');
      progressUpdates.push(useAppStore.getState().migrationStatus);
      return { success: true, migratedProjects: 3, errors: [], rollbackAvailable: false };
    });

    // Act
    await useAppStore.getState().signUp('test@example.com', 'password123');

    // Assert
    expect(progressUpdates).toContain('exporting');
    expect(progressUpdates).toContain('migrating');
    expect(useAppStore.getState().migrationStatus).toBe('complete');
  });

  it('should handle sign up failure', async () => {
    // Arrange
    mockSignUp.mockResolvedValue({ success: false, error: 'Email already exists' });

    // Act
    const result = await useAppStore.getState().signUp('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('Email already exists');
    const state = useAppStore.getState();
    expect(state.authUserId).toBeNull();
    expect(state.authStatus).toBe('anonymous');
    expect(state.migrationStatus).toBe('idle');
    expect(mockMigrateAnonymousData).not.toHaveBeenCalled();
  });

  it('should handle unexpected errors', async () => {
    // Arrange
    mockSignUp.mockRejectedValue(new Error('Network error'));

    // Act
    const result = await useAppStore.getState().signUp('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
    const state = useAppStore.getState();
    expect(state.authStatus).toBe('anonymous');
  });

  it('should normalize email to lowercase', async () => {
    // Arrange
    mockSignUp.mockResolvedValue({ success: true, userId: 'user-123' });
    mockMigrateAnonymousData.mockResolvedValue({ success: true, migratedProjects: 3, errors: [], rollbackAvailable: false });

    // Act
    await useAppStore.getState().signUp('TEST@EXAMPLE.COM', 'password123');

    // Assert
    expect(useAppStore.getState().authEmail).toBe('test@example.com');
  });
});

describe('store signIn action', () => {
  beforeEach(() => {
    useAppStore.setState({
      authUserId: null,
      authEmail: null,
      authStatus: 'anonymous',
      migrationStatus: 'idle',
    });
    vi.clearAllMocks();
    mockGetDeviceId.mockReturnValue('device-123');
  });

  it('should sign in on new device with full migration', async () => {
    // Arrange
    mockSignIn.mockResolvedValue({ success: true, userId: 'user-123' });
    mockGetMigrationMetadata.mockReturnValue(null); // No previous migration
    mockMigrateAnonymousData.mockResolvedValue({ success: true, migratedProjects: 5, errors: [], rollbackAvailable: false });

    // Act
    const result = await useAppStore.getState().signIn('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(true);
    const state = useAppStore.getState();
    expect(state.authUserId).toBe('user-123');
    expect(state.authEmail).toBe('test@example.com');
    expect(state.authStatus).toBe('authenticated');
    expect(state.migrationStatus).toBe('complete');
    expect(mockLinkDeviceToUser).toHaveBeenCalledWith('user-123', 'device-123');
    expect(mockMigrateAnonymousData).toHaveBeenCalledWith('user-123', expect.any(Function));
  });

  it('should skip migration on already migrated device', async () => {
    // Arrange
    mockSignIn.mockResolvedValue({ success: true, userId: 'user-123' });
    mockGetMigrationMetadata.mockReturnValue({
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-123',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 5,
    });

    // Act
    const result = await useAppStore.getState().signIn('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(true);
    const state = useAppStore.getState();
    expect(state.authStatus).toBe('authenticated');
    expect(state.migrationStatus).toBe('complete');
    // Should skip migration call
    expect(mockMigrateAnonymousData).not.toHaveBeenCalled();
    // But still link device
    expect(mockLinkDeviceToUser).toHaveBeenCalledWith('user-123', 'device-123');
  });

  it('should run migration if metadata for different user', async () => {
    // Arrange
    mockSignIn.mockResolvedValue({ success: true, userId: 'user-456' }); // Different user
    mockGetMigrationMetadata.mockReturnValue({
      migrationId: 'migration-123',
      userId: 'user-123', // Different userId
      deviceId: 'device-123',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 5,
    });
    mockMigrateAnonymousData.mockResolvedValue({ success: true, migratedProjects: 3, errors: [], rollbackAvailable: false });

    // Act
    const result = await useAppStore.getState().signIn('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(true);
    expect(mockMigrateAnonymousData).toHaveBeenCalled(); // Should run migration
  });

  it('should handle sign in failure', async () => {
    // Arrange
    mockSignIn.mockResolvedValue({ success: false, error: 'Invalid credentials' });

    // Act
    const result = await useAppStore.getState().signIn('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid credentials');
    const state = useAppStore.getState();
    expect(state.authStatus).toBe('anonymous');
    expect(state.migrationStatus).toBe('idle');
  });

  it('should set pending status during sign in', async () => {
    // Arrange
    let capturedStatus: string | null = null;
    mockSignIn.mockImplementation(async () => {
      capturedStatus = useAppStore.getState().authStatus;
      return { success: true, userId: 'user-123' };
    });
    mockGetMigrationMetadata.mockReturnValue(null);
    mockMigrateAnonymousData.mockResolvedValue({ success: true, migratedProjects: 3, errors: [], rollbackAvailable: false });

    // Act
    await useAppStore.getState().signIn('test@example.com', 'password123');

    // Assert
    expect(capturedStatus).toBe('pending');
  });

  it('should handle migration failure but keep auth', async () => {
    // Arrange
    mockSignIn.mockResolvedValue({ success: true, userId: 'user-123' });
    mockGetMigrationMetadata.mockReturnValue(null);
    mockMigrateAnonymousData.mockResolvedValue({ success: false, migratedProjects: 0, errors: ['Migration error'], rollbackAvailable: false });

    // Act
    const result = await useAppStore.getState().signIn('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(true);
    const state = useAppStore.getState();
    expect(state.authStatus).toBe('authenticated');
    expect(state.migrationStatus).toBe('error');
  });

  it('should handle unexpected errors', async () => {
    // Arrange
    mockSignIn.mockRejectedValue(new Error('Network error'));

    // Act
    const result = await useAppStore.getState().signIn('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(useAppStore.getState().authStatus).toBe('anonymous');
  });
});

describe('store signOut action', () => {
  beforeEach(() => {
    // Start in authenticated state
    useAppStore.setState({
      authUserId: 'user-123',
      authEmail: 'test@example.com',
      authStatus: 'authenticated',
      migrationStatus: 'complete',
    });
    vi.clearAllMocks();
  });

  it('should clear auth state on sign out', async () => {
    // Arrange
    mockSignOut.mockResolvedValue(undefined);

    // Act
    await useAppStore.getState().signOut();

    // Assert
    const state = useAppStore.getState();
    expect(state.authUserId).toBeNull();
    expect(state.authEmail).toBeNull();
    expect(state.authStatus).toBe('anonymous');
    expect(state.migrationStatus).toBe('idle');
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should set pending status during sign out', async () => {
    // Arrange
    let capturedStatus: string | null = null;
    mockSignOut.mockImplementation(async () => {
      capturedStatus = useAppStore.getState().authStatus;
    });

    // Act
    await useAppStore.getState().signOut();

    // Assert
    expect(capturedStatus).toBe('pending');
  });

  it('should clear state even if signOut fails', async () => {
    // Arrange
    mockSignOut.mockRejectedValue(new Error('Sign out failed'));

    // Act
    await useAppStore.getState().signOut();

    // Assert
    const state = useAppStore.getState();
    expect(state.authUserId).toBeNull();
    expect(state.authStatus).toBe('anonymous');
    expect(state.migrationStatus).toBe('idle');
  });
});

describe('store initializeAuth action', () => {
  beforeEach(() => {
    useAppStore.setState({
      authUserId: null,
      authEmail: null,
      authStatus: 'anonymous',
      migrationStatus: 'idle',
    });
    vi.clearAllMocks();
    mockGetDeviceId.mockReturnValue('device-123');
  });

  it('should restore authenticated session', async () => {
    // Arrange
    mockGetAuthState.mockResolvedValue({
      status: 'authenticated',
      userId: 'user-123',
      deviceId: 'device-123',
      email: 'test@example.com',
      deviceLinked: true,
      migrationComplete: false,
    });
    mockGetMigrationMetadata.mockReturnValue(null);

    // Act
    await useAppStore.getState().initializeAuth();

    // Assert
    const state = useAppStore.getState();
    expect(state.authUserId).toBe('user-123');
    expect(state.authEmail).toBe('test@example.com');
    expect(state.authStatus).toBe('authenticated');
    expect(mockLinkDeviceToUser).toHaveBeenCalledWith('user-123', 'device-123');
  });

  it('should restore migration complete status', async () => {
    // Arrange
    mockGetAuthState.mockResolvedValue({
      status: 'authenticated',
      userId: 'user-123',
      deviceId: 'device-123',
      email: 'test@example.com',
      deviceLinked: true,
      migrationComplete: false,
    });
    mockGetMigrationMetadata.mockReturnValue({
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-123',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 5,
    });

    // Act
    await useAppStore.getState().initializeAuth();

    // Assert
    expect(useAppStore.getState().migrationStatus).toBe('complete');
  });

  it('should set idle migration status for new device', async () => {
    // Arrange
    mockGetAuthState.mockResolvedValue({
      status: 'authenticated',
      userId: 'user-123',
      deviceId: 'device-123',
      email: 'test@example.com',
      deviceLinked: true,
      migrationComplete: false,
    });
    mockGetMigrationMetadata.mockReturnValue(null); // No migration

    // Act
    await useAppStore.getState().initializeAuth();

    // Assert
    expect(useAppStore.getState().migrationStatus).toBe('idle');
  });

  it('should restore anonymous state when no session', async () => {
    // Arrange
    mockGetAuthState.mockResolvedValue({
      status: 'anonymous',
      userId: null,
      deviceId: 'device-123',
      email: null,
      deviceLinked: false,
      migrationComplete: false,
    });

    // Act
    await useAppStore.getState().initializeAuth();

    // Assert
    const state = useAppStore.getState();
    expect(state.authUserId).toBeNull();
    expect(state.authEmail).toBeNull();
    expect(state.authStatus).toBe('anonymous');
    expect(state.migrationStatus).toBe('idle');
  });

  it('should be SSR safe', async () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act - should not throw
    await expect(useAppStore.getState().initializeAuth()).resolves.not.toThrow();

    // Assert - state unchanged
    const state = useAppStore.getState();
    expect(state.authStatus).toBe('anonymous');

    // Restore
    global.window = originalWindow;
  });

  it('should handle getAuthState errors gracefully', async () => {
    // Arrange
    mockGetAuthState.mockRejectedValue(new Error('Auth check failed'));

    // Act
    await useAppStore.getState().initializeAuth();

    // Assert - should fall back to anonymous
    const state = useAppStore.getState();
    expect(state.authStatus).toBe('anonymous');
    expect(state.authUserId).toBeNull();
  });

  it('should not link device during SSR', async () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act
    await useAppStore.getState().initializeAuth();

    // Assert
    expect(mockLinkDeviceToUser).not.toHaveBeenCalled();

    // Restore
    global.window = originalWindow;
  });
});

describe('store auth action integration', () => {
  beforeEach(() => {
    useAppStore.setState({
      authUserId: null,
      authEmail: null,
      authStatus: 'anonymous',
      migrationStatus: 'idle',
    });
    vi.clearAllMocks();
  });

  it('should handle complete auth flow: signUp -> signOut -> signIn', async () => {
    // Arrange
    mockSignUp.mockResolvedValue({ success: true, userId: 'user-123' });
    mockMigrateAnonymousData.mockResolvedValue({ success: true, migratedProjects: 3, errors: [], rollbackAvailable: false });
    mockSignOut.mockResolvedValue(undefined);
    mockSignIn.mockResolvedValue({ success: true, userId: 'user-123' });
    mockGetMigrationMetadata.mockReturnValue({
      migrationId: 'migration-123',
      userId: 'user-123',
      deviceId: 'device-123',
      status: 'completed',
      startedAt: Date.now(),
      projectCount: 3,
    });

    // Act: Sign up
    const signUpResult = await useAppStore.getState().signUp('test@example.com', 'password123');
    expect(signUpResult.success).toBe(true);
    expect(useAppStore.getState().authStatus).toBe('authenticated');
    expect(useAppStore.getState().migrationStatus).toBe('complete');

    // Act: Sign out
    await useAppStore.getState().signOut();
    expect(useAppStore.getState().authStatus).toBe('anonymous');
    expect(useAppStore.getState().authUserId).toBeNull();

    // Act: Sign in again (should skip migration)
    const signInResult = await useAppStore.getState().signIn('test@example.com', 'password123');
    expect(signInResult.success).toBe(true);
    expect(useAppStore.getState().authStatus).toBe('authenticated');
    expect(useAppStore.getState().migrationStatus).toBe('complete');
  });

  it('should maintain independent state from other store properties', async () => {
    // Arrange - set some other store state
    useAppStore.setState({
      todoProjects: [{
        id: 'p1',
        name: 'Test',
        color: '#000',
        todoRows: [],
        priorityDials: { left: '', right: '', focusedSide: 'none' },
        createdAt: Date.now(),
        workspaceType: 'personalUno',
        workspaceId: 'workspace-123',
        version: 1,
      } as unknown as import('@/services/storage').TodoProject],
      activeProjectId: 'p1',
    });

    mockSignUp.mockResolvedValue({ success: true, userId: 'user-123' });
    mockMigrateAnonymousData.mockResolvedValue({ success: true, migratedProjects: 0, errors: [], rollbackAvailable: false });

    // Act
    await useAppStore.getState().signUp('test@example.com', 'password123');

    // Assert - auth state updated, other state preserved
    const state = useAppStore.getState();
    expect(state.authUserId).toBe('user-123');
    expect(state.todoProjects).toHaveLength(1);
    expect(state.activeProjectId).toBe('p1');
  });
});
