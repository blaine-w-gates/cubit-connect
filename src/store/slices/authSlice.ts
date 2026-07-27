/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auth Slice — Authentication and identity state.
 *
 * Includes: authUserId, authStatus, migrationStatus, authEmail,
 * and auth actions (signUp, signIn, signOut, initializeAuth).
 *
 * Does NOT include fullLogout (which involves syncManager, storage, and window reload).
 */

import { getDeviceId } from '@/lib/identity';
import {
  signUp as authSignUp,
  signIn as authSignIn,
  signOut as authSignOut,
  getAuthState,
  linkDeviceToUser,
} from '@/lib/auth';
import { migrateAnonymousData, getMigrationMetadata } from '@/lib/migration';

export interface AuthSliceState {
  // --- Auth & Identity State (Phase 6) ---
  authUserId: string | null;
  authStatus: 'anonymous' | 'authenticated' | 'pending';
  migrationStatus: 'idle' | 'exporting' | 'migrating' | 'complete' | 'error';
  authEmail: string | null;

  // Auth Actions
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export function createAuthSlice(set: any): AuthSliceState {
  return {
    // --- Auth & Identity State ---
    authUserId: null,
    authStatus: 'anonymous',
    migrationStatus: 'idle',
    authEmail: null,

    // Auth Actions
    signUp: async (email: string, password: string) => {
      set({ authStatus: 'pending' });

      try {
        const result = await authSignUp(email, password);

        if (result.success && result.userId) {
          set({
            authUserId: result.userId,
            authEmail: email.toLowerCase(),
            authStatus: 'authenticated',
          });

          set({ migrationStatus: 'exporting' });

          try {
            const migrationResult = await migrateAnonymousData(result.userId, (stage) => {
              if (stage === 'exporting') {
                set({ migrationStatus: 'exporting' });
              } else if (stage === 'migrating') {
                set({ migrationStatus: 'migrating' });
              }
            });

            set({
              migrationStatus: migrationResult.success ? 'complete' : 'error',
            });
          } catch (migrationError) {
            console.error('[STORE] Migration failed after signUp:', migrationError);
            set({ migrationStatus: 'error' });
          }

          return { success: true };
        } else {
          set({ authStatus: 'anonymous' });
          return { success: false, error: result.error };
        }
      } catch (error) {
        console.error('[STORE] Unexpected error in signUp:', error);
        set({ authStatus: 'anonymous' });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
        };
      }
    },

    signIn: async (email: string, password: string) => {
      set({ authStatus: 'pending' });

      try {
        const result = await authSignIn(email, password);

        if (result.success && result.userId) {
          const deviceId = getDeviceId();

          const existingMigration = getMigrationMetadata();
          const alreadyMigrated = existingMigration?.status === 'completed' &&
                                  existingMigration?.userId === result.userId;

          if (alreadyMigrated) {
            await linkDeviceToUser(result.userId, deviceId);

            set({
              authUserId: result.userId,
              authEmail: email.toLowerCase(),
              authStatus: 'authenticated',
              migrationStatus: 'complete',
            });
          } else {
            set({
              authUserId: result.userId,
              authEmail: email.toLowerCase(),
              authStatus: 'authenticated',
            });

            await linkDeviceToUser(result.userId, deviceId);

            set({ migrationStatus: 'exporting' });

            try {
              const migrationResult = await migrateAnonymousData(result.userId, (stage) => {
                if (stage === 'exporting') {
                  set({ migrationStatus: 'exporting' });
                } else if (stage === 'migrating') {
                  set({ migrationStatus: 'migrating' });
                }
              });

              set({
                migrationStatus: migrationResult.success ? 'complete' : 'error',
              });
            } catch (migrationError) {
              console.error('[STORE] Migration failed after signIn:', migrationError);
              set({ migrationStatus: 'error' });
            }
          }

          return { success: true };
        } else {
          set({ authStatus: 'anonymous' });
          return { success: false, error: result.error };
        }
      } catch (error) {
        console.error('[STORE] Unexpected error in signIn:', error);
        set({ authStatus: 'anonymous' });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
        };
      }
    },

    signOut: async () => {
      set({ authStatus: 'pending' });

      try {
        await authSignOut();

        set({
          authUserId: null,
          authEmail: null,
          authStatus: 'anonymous',
          migrationStatus: 'idle',
        });
      } catch (error) {
        console.error('[STORE] Error during signOut:', error);

        set({
          authUserId: null,
          authEmail: null,
          authStatus: 'anonymous',
          migrationStatus: 'idle',
        });
      }
    },

    initializeAuth: async () => {
      if (typeof window === 'undefined') {
        return;
      }

      try {
        const authState = await getAuthState();

        if (authState.status === 'authenticated' && authState.userId) {
          const migrationMetadata = getMigrationMetadata();
          const migrationComplete = migrationMetadata?.status === 'completed' &&
                                  migrationMetadata?.userId === authState.userId;

          set({
            authUserId: authState.userId,
            authEmail: authState.email,
            authStatus: 'authenticated',
            migrationStatus: migrationComplete ? 'complete' : 'idle',
          });

          const deviceId = getDeviceId();
          await linkDeviceToUser(authState.userId, deviceId);
        } else {
          set({
            authUserId: null,
            authEmail: null,
            authStatus: 'anonymous',
            migrationStatus: 'idle',
          });
        }
      } catch (error) {
        console.error('[STORE] Error initializing auth:', error);

        set({
          authUserId: null,
          authEmail: null,
          authStatus: 'anonymous',
          migrationStatus: 'idle',
        });
      }
    },
  };
}
