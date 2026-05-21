/**
 * Unit tests for auth.ts
 *
 * Tests authentication module including signUp, signIn, signOut,
 * getAuthState, and linkDeviceToUser functions.
 *
 * @module tests/unit/auth
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing module
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  getSupabaseClient: vi.fn(() => ({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      getSession: mockGetSession,
    },
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

vi.mock('@/lib/featureFlags', () => ({
  emitTelemetry: vi.fn(),
}));

vi.mock('@/lib/identity', () => ({
  getDeviceId: vi.fn(() => 'test-device-id-123'),
  getDeviceLabel: vi.fn(() => 'Test Device'),
}));

// Import module after mocking
import {
  signUp,
  signIn,
  signOut,
  getAuthState,
  linkDeviceToUser,
  getLinkedDevices,
  isAuthEnabled,
  MIN_PASSWORD_LENGTH,
} from '@/lib/auth';

describe('auth constants', () => {
  it('should export correct minimum password length', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});

describe('signUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: 'device-link-id', error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should succeed with valid email and password', async () => {
    // Arrange
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: { user: { id: 'user-123' } } },
      error: null,
    });

    // Act
    const result = await signUp('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(true);
    expect(result.userId).toBe('user-123');
    expect(result.requiresEmailConfirmation).toBe(false);
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should require email confirmation when no session returned', async () => {
    // Arrange
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: null },
      error: null,
    });

    // Act
    const result = await signUp('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(true);
    expect(result.requiresEmailConfirmation).toBe(true);
  });

  it('should fail with invalid email format', async () => {
    // Act
    const result = await signUp('invalid-email', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('Please enter a valid email address');
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('should fail with weak password', async () => {
    // Act
    const result = await signUp('test@example.com', 'weak');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('at least 8 characters');
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('should handle existing email error', async () => {
    // Arrange
    mockSignUp.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    });

    // Act
    const result = await signUp('existing@example.com', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('should handle invalid credentials error', async () => {
    // Arrange
    mockSignUp.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    // Act
    const result = await signUp('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid email or password');
  });

  it('should handle network errors gracefully', async () => {
    // Arrange
    mockSignUp.mockRejectedValue(new Error('Network error'));

    // Act
    const result = await signUp('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('An unexpected error occurred. Please try again.');
  });

  it('should return SSR error during server-side rendering', async () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act
    const result = await signUp('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('server-side rendering');

    // Restore
    global.window = originalWindow;
  });
});

describe('signIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: 'device-link-id', error: null });
  });

  it('should succeed with valid credentials', async () => {
    // Arrange
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });

    // Act
    const result = await signIn('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(true);
    expect(result.userId).toBe('user-123');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should fail with wrong password', async () => {
    // Arrange
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    // Act
    const result = await signIn('test@example.com', 'wrongpassword');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid email or password');
  });

  it('should fail with non-existent email', async () => {
    // Arrange
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    // Act
    const result = await signIn('nonexistent@example.com', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid email or password');
  });

  it('should fail with invalid email format', async () => {
    // Act
    const result = await signIn('invalid-email', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('Please enter a valid email address');
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('should handle network errors gracefully', async () => {
    // Arrange
    mockSignInWithPassword.mockRejectedValue(new Error('Network error'));

    // Act
    const result = await signIn('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('An unexpected error occurred. Please try again.');
  });

  it('should normalize email to lowercase', async () => {
    // Arrange
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });

    // Act
    await signIn('TEST@EXAMPLE.COM', 'password123');

    // Assert
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should return SSR error during server-side rendering', async () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act
    const result = await signIn('test@example.com', 'password123');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('server-side rendering');

    // Restore
    global.window = originalWindow;
  });
});

describe('signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should succeed and clear session', async () => {
    // Arrange
    mockSignOut.mockResolvedValue({ error: null });

    // Act
    await signOut();

    // Assert
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    // Arrange
    mockSignOut.mockRejectedValue(new Error('Sign out failed'));

    // Act - should not throw
    await expect(signOut()).resolves.not.toThrow();

    // Assert - function completed despite error
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should handle SSR safely', async () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act - should not throw or call signOut
    await signOut();

    // Assert
    expect(mockSignOut).not.toHaveBeenCalled();

    // Restore
    global.window = originalWindow;
  });
});

describe('getAuthState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return authenticated state when session exists', async () => {
    // Arrange
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-123', email: 'test@example.com' },
        },
      },
      error: null,
    });

    // Act
    const result = await getAuthState();

    // Assert
    expect(result.status).toBe('authenticated');
    expect(result.userId).toBe('user-123');
    expect(result.email).toBe('test@example.com');
    expect(result.deviceId).toBe('test-device-id-123');
  });

  it('should return anonymous state when no session', async () => {
    // Arrange
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Act
    const result = await getAuthState();

    // Assert
    expect(result.status).toBe('anonymous');
    expect(result.userId).toBeNull();
    expect(result.email).toBeNull();
  });

  it('should return anonymous on session error', async () => {
    // Arrange
    mockGetSession.mockResolvedValue({
      data: null,
      error: { message: 'Session error' },
    });

    // Act
    const result = await getAuthState();

    // Assert
    expect(result.status).toBe('anonymous');
  });

  it('should handle exceptions gracefully', async () => {
    // Arrange
    mockGetSession.mockRejectedValue(new Error('Unexpected error'));

    // Act
    const result = await getAuthState();

    // Assert
    expect(result.status).toBe('anonymous');
    expect(result.userId).toBeNull();
  });

  it('should return SSR placeholder during server-side rendering', async () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act
    const result = await getAuthState();

    // Assert
    expect(result.status).toBe('anonymous');
    expect(result.deviceId).toBe('ssr-placeholder');

    // Restore
    global.window = originalWindow;
  });
});

describe('linkDeviceToUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
  });

  it('should link device successfully', async () => {
    // Act
    const result = await linkDeviceToUser('user-123', 'device-456');

    // Assert
    expect(result).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('link_device_to_user', {
      p_user_id: 'user-123',
      p_device_id: 'device-456',
      p_device_name: expect.any(String),
      p_device_fingerprint: expect.any(String),
    });
  });

  it('should handle RPC errors gracefully', async () => {
    // Arrange
    mockRpc.mockResolvedValue({ error: { message: 'RPC failed' } });

    // Act
    const result = await linkDeviceToUser('user-123', 'device-456');

    // Assert
    expect(result).toBe(false);
  });

  it('should handle exceptions gracefully', async () => {
    // Arrange
    mockRpc.mockRejectedValue(new Error('Network error'));

    // Act
    const result = await linkDeviceToUser('user-123', 'device-456');

    // Assert
    expect(result).toBe(false);
  });

  it('should return false during SSR', async () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act
    const result = await linkDeviceToUser('user-123', 'device-456');

    // Assert
    expect(result).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();

    // Restore
    global.window = originalWindow;
  });
});

describe('getLinkedDevices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return list of linked devices', async () => {
    // Arrange
    const mockFromChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              { device_id: 'device-1', device_name: 'Device 1', last_seen_at: '2024-01-01' },
              { device_id: 'device-2', device_name: 'Device 2', last_seen_at: '2024-01-02' },
            ],
            error: null,
          })),
        })),
      })),
    };
    mockFrom.mockReturnValue(mockFromChain);

    // Act
    const result = await getLinkedDevices('user-123');

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].deviceId).toBe('device-1');
    expect(result[1].deviceId).toBe('device-2');
  });

  it('should return empty array on error', async () => {
    // Arrange
    const mockFromChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: null,
            error: { message: 'Query failed' },
          })),
        })),
      })),
    };
    mockFrom.mockReturnValue(mockFromChain);

    // Act
    const result = await getLinkedDevices('user-123');

    // Assert
    expect(result).toEqual([]);
  });

  it('should return empty array during SSR', async () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act
    const result = await getLinkedDevices('user-123');

    // Assert
    expect(result).toEqual([]);

    // Restore
    global.window = originalWindow;
  });
});

describe('isAuthEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage mock
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should return true by default', () => {
    expect(isAuthEnabled()).toBe(true);
  });

  it('should return false when DISABLE_AUTH is set', () => {
    // Arrange
    localStorage.setItem('DISABLE_AUTH', 'true');

    // Act
    const result = isAuthEnabled();

    // Assert
    expect(result).toBe(false);
  });

  it('should return false during SSR', () => {
    // Arrange
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    // Act
    const result = isAuthEnabled();

    // Assert
    expect(result).toBe(false);

    // Restore
    global.window = originalWindow;
  });
});
