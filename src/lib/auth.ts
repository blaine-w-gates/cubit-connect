/**
 * User Authentication Module
 *
 * Provides email/password authentication with Supabase Auth,
 * device linkage for multi-device access, and identity migration support.
 *
 * @module src/lib/auth
 * @production
 * @version 1.0.0
 */

import { getSupabaseClient } from './supabaseClient';
import { emitTelemetry } from './featureFlags';
import { getDeviceId, getDeviceLabel } from './identity';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum password length requirement
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Email validation regex (RFC 5322 compliant subset)
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Authentication status states
 */
export type AuthStatus = 'anonymous' | 'authenticated' | 'pending';

/**
 * Result of authentication operation
 */
export interface AuthResult {
  /** Whether authentication was successful */
  success: boolean;
  /** User ID if successful */
  userId?: string;
  /** Error message if failed */
  error?: string;
  /** Whether email confirmation is required */
  requiresEmailConfirmation?: boolean;
}

/**
 * Current authentication state
 */
export interface AuthState {
  /** Current authentication status */
  status: AuthStatus;
  /** Supabase user ID if authenticated */
  userId: string | null;
  /** Device ID (always present) */
  deviceId: string;
  /** User email if authenticated */
  email: string | null;
  /** Whether device is linked to user account */
  deviceLinked: boolean;
  /** Whether identity migration is complete */
  migrationComplete: boolean;
}

/**
 * Device information for user account
 */
export interface LinkedDevice {
  /** Device identifier */
  deviceId: string;
  /** Human-readable device name */
  deviceName: string;
  /** Last activity timestamp */
  lastSeenAt: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate email format
 *
 * @param email - Email address to validate
 * @returns true if valid email format
 */
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Validate password strength
 *
 * @param password - Password to validate
 * @returns Validation result with boolean and error message
 */
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }
  return { valid: true };
}

// ============================================================================
// CORE AUTH FUNCTIONS
// ============================================================================

/**
 * Register new user with email/password
 *
 * On successful registration:
 * 1. Creates Supabase Auth user
 * 2. Links current device to user
 * 3. Logs auth telemetry
 *
 * @param email - User email address
 * @param password - User password
 * @returns AuthResult with success status and userId
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  // Validate email format
  if (!isValidEmail(email)) {
    return {
      success: false,
      error: 'Please enter a valid email address',
    };
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return {
      success: false,
      error: passwordValidation.error,
    };
  }

  // SSR safety
  if (typeof window === 'undefined') {
    return {
      success: false,
      error: 'Cannot sign up during server-side rendering',
    };
  }

  try {
    emitTelemetry('supabase_auth_attempt', {
      context: { operation: 'signUp', email: email.toLowerCase() },
    });

    const client = getSupabaseClient();
    const { data, error } = await client.auth.signUp({
      email: email.toLowerCase(),
      password,
    });

    if (error) {
      // INTENTIONALLY HANDLING: Supabase auth errors are user-facing
      // Log for debugging but return friendly message
      emitTelemetry('supabase_auth_failure', {
        error: error.message,
        context: { operation: 'signUp' },
      });

      return {
        success: false,
        error: getFriendlyAuthError(error.message),
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Registration failed. Please try again.',
      };
    }

    const userId = data.user.id;
    const deviceId = getDeviceId();

    // Link device to user
    await linkDeviceToUser(userId, deviceId);

    emitTelemetry('supabase_auth_success', {
      context: {
        operation: 'signUp',
        userId,
        deviceId,
        requiresConfirmation: data.session === null,
      },
    });

    return {
      success: true,
      userId,
      requiresEmailConfirmation: data.session === null,
    };
  } catch (error) {
    // INTENTIONALLY HANDLING: Unexpected errors during signup
    // Log full error for debugging, return user-friendly message
    console.error('[AUTH] Unexpected error during signUp:', error);
    emitTelemetry('supabase_auth_failure', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context: { operation: 'signUp', unexpected: true },
    });

    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Sign in existing user with email/password
 *
 * On successful sign in:
 * 1. Authenticates with Supabase Auth
 * 2. Links current device to user
 * 3. Logs auth telemetry
 *
 * @param email - User email address
 * @param password - User password
 * @returns AuthResult with success status and userId
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  // Validate email format
  if (!isValidEmail(email)) {
    return {
      success: false,
      error: 'Please enter a valid email address',
    };
  }

  // SSR safety
  if (typeof window === 'undefined') {
    return {
      success: false,
      error: 'Cannot sign in during server-side rendering',
    };
  }

  try {
    emitTelemetry('supabase_auth_attempt', {
      context: { operation: 'signIn', email: email.toLowerCase() },
    });

    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) {
      // INTENTIONALLY HANDLING: Invalid credentials are expected
      // Don't log as telemetry failure - this is normal user behavior
      if (error.message.includes('Invalid login credentials')) {
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      emitTelemetry('supabase_auth_failure', {
        error: error.message,
        context: { operation: 'signIn' },
      });

      return {
        success: false,
        error: getFriendlyAuthError(error.message),
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Sign in failed. Please try again.',
      };
    }

    const userId = data.user.id;
    const deviceId = getDeviceId();

    // Link device to user
    await linkDeviceToUser(userId, deviceId);

    emitTelemetry('supabase_auth_success', {
      context: {
        operation: 'signIn',
        userId,
        deviceId,
      },
    });

    return {
      success: true,
      userId,
    };
  } catch (error) {
    // INTENTIONALLY HANDLING: Unexpected errors during signIn
    console.error('[AUTH] Unexpected error during signIn:', error);
    emitTelemetry('supabase_auth_failure', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context: { operation: 'signIn', unexpected: true },
    });

    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Sign out current user
 *
 * Clears Supabase session and returns to anonymous state.
 * Preserves local device data.
 *
 * @returns Promise that resolves when sign out complete
 */
export async function signOut(): Promise<void> {
  // SSR safety
  if (typeof window === 'undefined') {
    return;
  }

  try {
    emitTelemetry('supabase_auth_attempt', {
      context: { operation: 'signOut' },
    });

    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();

    if (error) {
      // INTENTIONALLY HANDLING: Sign out errors are non-fatal
      // Session may already be expired, local state still needs clearing
      console.warn('[AUTH] Sign out error (session may be expired):', error);
    }

    emitTelemetry('supabase_auth_success', {
      context: { operation: 'signOut' },
    });
  } catch (error) {
    // INTENTIONALLY HANDLING: Sign out is cleanup, failure doesn't break app
    // Log but don't throw - we want user to be "logged out" in UI even if server fails
    console.error('[AUTH] Unexpected error during signOut:', error);
  }
}

/**
 * Get current authentication state
 *
 * Returns complete auth state including:
 * - Current session status
 * - User ID if authenticated
 * - Device linkage status
 *
 * @returns Current AuthState
 */
export async function getAuthState(): Promise<AuthState> {
  // SSR safety - return anonymous state
  if (typeof window === 'undefined') {
    return {
      status: 'anonymous',
      userId: null,
      deviceId: 'ssr-placeholder',
      email: null,
      deviceLinked: false,
      migrationComplete: false,
    };
  }

  const deviceId = getDeviceId();

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();

    if (error || !data.session) {
      // INTENTIONALLY HANDLING: No session = anonymous state
      // This is normal for unauthenticated users
      return {
        status: 'anonymous',
        userId: null,
        deviceId,
        email: null,
        deviceLinked: false,
        migrationComplete: false,
      };
    }

    const userId = data.session.user.id;
    const email = data.session.user.email || null;

    // Check if device is linked to user
    const deviceLinked = await checkDeviceLinked(userId, deviceId);

    return {
      status: 'authenticated',
      userId,
      deviceId,
      email,
      deviceLinked,
      migrationComplete: false, // Will be updated by migration module
    };
  } catch (error) {
    // INTENTIONALLY HANDLING: Session retrieval failure
    // Return anonymous state as safe fallback
    console.error('[AUTH] Error getting auth state:', error);

    return {
      status: 'anonymous',
      userId: null,
      deviceId,
      email: null,
      deviceLinked: false,
      migrationComplete: false,
    };
  }
}

/**
 * Link current device to authenticated user
 *
 * Idempotent - safe to call multiple times. Updates last_seen_at
 * on re-link. Creates new record on first link.
 *
 * @param userId - Supabase user ID
 * @param deviceId - Device identifier
 * @param deviceName - Optional human-readable device name
 * @returns true if linking successful
 */
export async function linkDeviceToUser(
  userId: string,
  deviceId: string,
  deviceName?: string
): Promise<boolean> {
  // SSR safety
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const client = getSupabaseClient();

    // Use the database function for idempotent upsert
    const { error } = await client.rpc('link_device_to_user', {
      p_user_id: userId,
      p_device_id: deviceId,
      p_device_name: deviceName || getDeviceLabel() || `Device ${deviceId.slice(0, 8)}`,
      p_device_fingerprint: generateDeviceFingerprint(),
    });

    if (error) {
      // INTENTIONALLY HANDLING: Device linking failure is non-fatal
      // Auth still succeeds, device will retry linking on next auth check
      console.warn('[AUTH] Device linking failed:', error);
      emitTelemetry('error_boundary_triggered', {
        context: {
          error: 'device_link_failed',
          userId,
          deviceId,
          message: error.message,
        },
      });
      return false;
    }

    return true;
  } catch (error) {
    // INTENTIONALLY HANDLING: RPC call failure
    console.error('[AUTH] Unexpected error linking device:', error);
    return false;
  }
}

/**
 * Check if device is linked to user
 *
 * @param userId - Supabase user ID
 * @param deviceId - Device identifier
 * @returns true if device is linked to user
 */
async function checkDeviceLinked(userId: string, deviceId: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('user_devices')
      .select('id')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (error) {
      // INTENTIONALLY HANDLING: Query failure returns false
      // Device may need re-linking
      console.warn('[AUTH] Error checking device link:', error);
      return false;
    }

    return data !== null;
  } catch (error) {
    // INTENTIONALLY HANDLING: Query exception returns false
    console.error('[AUTH] Exception checking device link:', error);
    return false;
  }
}

/**
 * Get list of devices linked to user
 *
 * @param userId - Supabase user ID
 * @returns Array of linked devices
 */
export async function getLinkedDevices(userId: string): Promise<LinkedDevice[]> {
  // SSR safety
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('user_devices')
      .select('device_id, device_name, last_seen_at')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false });

    if (error) {
      // INTENTIONALLY HANDLING: Query failure returns empty list
      console.warn('[AUTH] Error fetching linked devices:', error);
      return [];
    }

    return (data || []).map((device) => ({
      deviceId: device.device_id,
      deviceName: device.device_name || `Device ${device.device_id.slice(0, 8)}`,
      lastSeenAt: device.last_seen_at,
    }));
  } catch (error) {
    // INTENTIONALLY HANDLING: Query exception returns empty list
    console.error('[AUTH] Exception fetching linked devices:', error);
    return [];
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert Supabase auth error to user-friendly message
 *
 * @param errorMessage - Raw Supabase error message
 * @returns User-friendly error message
 */
function getFriendlyAuthError(errorMessage: string): string {
  const errorMap: Record<string, string> = {
    'User already registered': 'An account with this email already exists. Please sign in instead.',
    'Invalid login credentials': 'Invalid email or password',
    'Email not confirmed': 'Please confirm your email address before signing in',
    'Rate limit exceeded': 'Too many attempts. Please try again later.',
    'Password should be at least 6 characters': 'Password must be at least 6 characters',
  };

  // Check for exact matches
  if (errorMap[errorMessage]) {
    return errorMap[errorMessage];
  }

  // Check for partial matches
  if (errorMessage.includes('already registered')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (errorMessage.includes('rate limit')) {
    return 'Too many attempts. Please try again later.';
  }
  if (errorMessage.includes('password')) {
    return 'Password does not meet requirements. Please use at least 8 characters.';
  }

  // Default fallback
  return 'Authentication failed. Please try again.';
}

/**
 * Generate device fingerprint for duplicate detection
 *
 * Combines user agent and screen characteristics into a fingerprint.
 * Not cryptographically secure - used only for UX improvements.
 *
 * @returns Device fingerprint string
 */
function generateDeviceFingerprint(): string {
  if (typeof window === 'undefined') {
    return 'ssr';
  }

  const components = [
    navigator.userAgent,
    screen.width,
    screen.height,
    navigator.language,
    navigator.platform,
  ];

  // Simple hash function
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16);
}

// ============================================================================
// FEATURE FLAG INTEGRATION
// ============================================================================

/**
 * Check if authentication is enabled via feature flag
 *
 * @returns true if auth is enabled
 */
export function isAuthEnabled(): boolean {
  // Auth is enabled by default in Phase 6
  // Can be disabled via feature flag for emergency rollback
  if (typeof window === 'undefined') {
    return false;
  }

  // Check for explicit disable flag
  const authDisabled = window.localStorage.getItem('DISABLE_AUTH') === 'true';
  return !authDisabled;
}
