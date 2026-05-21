/**
 * Auth Initializer Component
 *
 * Initializes authentication state on app startup by calling
 * initializeAuth() from the store. Handles session restoration
 * and device linking for returning authenticated users.
 *
 * @module src/components/AuthInitializer
 * @production
 * @version 1.0.0
 */

'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

/**
 * Auth Initializer
 *
 * Client component that runs once on app mount to restore
 * authentication state from Supabase session.
 *
 * @returns null - This component renders nothing
 */
export function AuthInitializer(): null {
  const initializeAuth = useAppStore((state) => state.initializeAuth);

  useEffect(() => {
    // Initialize auth state on app startup
    // This restores authenticated sessions after page reload
    const init = async () => {
      try {
        await initializeAuth();
      } catch (error) {
        // INTENTIONALLY HANDLING: Auth init errors are non-fatal
        // App continues in anonymous mode if auth init fails
        console.error('[AUTH INITIALIZER] Failed to initialize auth:', error);
      }
    };

    init();
  }, [initializeAuth]);

  // This component renders nothing - it's purely for side effects
  return null;
}
