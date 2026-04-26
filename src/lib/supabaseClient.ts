/**
 * Supabase Client with Resilience
 *
 * Provides production-grade Supabase client with:
 * - Anonymous authentication
 * - Exponential backoff retry logic
 * - Timeout handling
 * - Rate limit (429) handling
 * - SSR safety
 *
 * @module supabaseClient
 * @version 1.0.0
 */

import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { emitTelemetry } from './featureFlags';
import { handleSyncError, isRetryableError } from './syncErrorRecovery';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum number of retry attempts for auth operations
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Base delay for exponential backoff (ms)
 */
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Maximum retry delay (ms)
 */
const MAX_RETRY_DELAY_MS = 5000;

/**
 * Timeout for auth operations (ms)
 */
const AUTH_TIMEOUT_MS = 10000;

/**
 * Supabase project URL from environment
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Supabase anonymous key from environment
 */
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Supabase client configuration options
 */
export interface SupabaseClientOptions {
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Authentication result
 */
export interface AuthResult {
  /** Whether authentication was successful */
  success: boolean;
  /** Session data if successful */
  session?: Session | null;
  /** Error message if failed */
  error?: string;
  /** Number of retry attempts made */
  attempts: number;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate environment variables
 *
 * @throws Error if required environment variables are missing
 */
function validateEnvironment(): void {
  if (typeof window === 'undefined') {
    // SSR - don't throw, just return
    return;
  }

  if (!SUPABASE_URL) {
    throw new Error(
      '[SUPABASE CLIENT] Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL\n' +
        'Please check your .env.local file and ensure the Supabase URL is configured.'
    );
  }

  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      '[SUPABASE CLIENT] Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
        'Please check your .env.local file and ensure the Supabase anonymous key is configured.'
    );
  }

  // Validate URL format
  try {
    new URL(SUPABASE_URL);
  } catch {
    // INTENTIONALLY PROPAGATING: Invalid URL must prevent client creation
    // Throw with descriptive message for developer to fix configuration
    throw new Error(
      `[SUPABASE CLIENT] Invalid Supabase URL format: ${SUPABASE_URL}\n` +
        'Please ensure the URL is valid (e.g., https://your-project.supabase.co)'
    );
  }
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Calculate exponential backoff delay
 *
 * @param attempt - Current attempt number (0-indexed)
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number): number {
  const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, Math.floor(delay + jitter));
}

/**
 * Sleep for specified duration
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after ms
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute function with timeout
 *
 * @param fn - Function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param context - Context for error messages
 * @returns Result of function or throws timeout error
 */
async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  context: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`[SUPABASE CLIENT] Timeout: ${context} exceeded ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// ============================================================================
// SUPABASE CLIENT SINGLETON
// ============================================================================

/**
 * Singleton Supabase client instance
 */
let supabaseInstance: SupabaseClient | null = null;

/**
 * Get or create Supabase client instance
 *
 * @param options - Client options
 * @returns Supabase client
 */
export function getSupabaseClient(options: SupabaseClientOptions = {}): SupabaseClient {
  // SSR safety
  if (typeof window === 'undefined') {
    throw new Error('[SUPABASE CLIENT] Cannot create client during SSR');
  }

  // Return existing instance
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Validate environment
  validateEnvironment();

  // Create new instance
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('[SUPABASE CLIENT] Missing required environment variables');
  }

  supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  if (options.debug) {
  }

  return supabaseInstance;
}

/**
 * Reset Supabase client (for testing)
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
}

// ============================================================================
// ANONYMOUS AUTHENTICATION
// ============================================================================

/**
 * Sign in anonymously with retry logic and timeout
 *
 * @returns Auth result with success status and session
 */
export async function signInAnonymously(): Promise<AuthResult> {
  // SSR safety
  if (typeof window === 'undefined') {
    return {
      success: false,
      error: 'Cannot authenticate during SSR',
      attempts: 0,
    };
  }

  const client = getSupabaseClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      emitTelemetry('supabase_auth_attempt', { attempt: attempt + 1 });

      const result = await withTimeout(
        () => client.auth.signInAnonymously(),
        AUTH_TIMEOUT_MS,
        'Anonymous auth'
      );

      if (result.error) {
        throw result.error;
      }

      emitTelemetry('supabase_auth_success', {
        attempt: attempt + 1,
        context: { userId: result.data.user?.id },
      });

      return {
        success: true,
        session: result.data.session,
        attempts: attempt + 1,
      };
    } catch (error) {
      // INTENTIONALLY HANDLING: Auth retry loop - error is logged and retried
      // Will either succeed on retry or fail after MAX_RETRY_ATTEMPTS
      lastError = error instanceof Error ? error : new Error(String(error));

      // Use centralized error handling
      const isRateLimit = isRetryableError(lastError);

      handleSyncError(lastError, isRateLimit ? 'warning' : 'error', {
        phase: 'auth',
        operation: 'signInAnonymously',
        attempt: attempt + 1,
      });

      if (isRateLimit) {
        emitTelemetry('supabase_auth_failure', {
          error: 'rate_limit',
          attempt: attempt + 1,
        });

      } else {
        emitTelemetry('supabase_auth_failure', {
          error: lastError.message,
          attempt: attempt + 1,
        });
      }

      // Don't retry on last attempt
      if (attempt < MAX_RETRY_ATTEMPTS - 1 && isRateLimit) {
        const delay = calculateBackoffDelay(attempt);
        await sleep(delay);
      }
    }
  }

  // All attempts failed
  return {
    success: false,
    error: lastError?.message || 'Anonymous authentication failed after all retry attempts',
    attempts: MAX_RETRY_ATTEMPTS,
  };
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Get current session
 *
 * @returns Current session or null if not authenticated
 */
export async function getCurrentSession(): Promise<Session | null> {
  // SSR safety
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();

    if (error) {
      return null;
    }

    return data.session;
  } catch (error) {
    // INTENTIONALLY RETURNING NULL: Session retrieval is best-effort
    // Failure returns null to signal "no active session", not fatal
    console.error('[SUPABASE CLIENT] Get session failed:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 *
 * @returns true if authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return session !== null;
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  // SSR safety
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const client = getSupabaseClient();
    await client.auth.signOut();
  } catch (error) {
    // INTENTIONALLY SWALLOWING: Sign out is cleanup operation
    // Failure doesn't prevent cleanup, just means server-side session remains
    console.error('[SUPABASE CLIENT] Sign out failed:', error);
  }
}

// ============================================================================
// DEVTOOLS INTEGRATION
// ============================================================================

/**
 * Initialize DevTools helpers
 */
function initDevTools(): void {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'development') return;

  // Expose for debugging
  // @ts-expect-error - Adding to window for DevTools
  window.__supabaseClient = {
    getClient: getSupabaseClient,
    signInAnonymously,
    getCurrentSession,
    isAuthenticated,
    signOut,
  };

}

// Initialize DevTools in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  initDevTools();
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  MAX_RETRY_ATTEMPTS,
  BASE_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  AUTH_TIMEOUT_MS,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
};

// Default export
const supabaseClient = {
  getSupabaseClient,
  resetSupabaseClient,
  signInAnonymously,
  getCurrentSession,
  isAuthenticated,
  signOut,
};

export default supabaseClient;
