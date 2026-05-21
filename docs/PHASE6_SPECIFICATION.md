# Phase 6 Specification: User Identity & Sync Infrastructure

## Executive Summary

Phase 6 migrates Cubit Connect from anonymous device-based identity to optional Supabase Authentication with graceful degradation. This enables data recovery across devices, automatic cloud sync for registered users, and establishes the foundation for future monetization tiers. The implementation follows a "Progressive Identity" model where users start anonymous and can optionally register at any time, with seamless data migration preserving all their work.

---

## Problem Statement

Cubit Connect currently uses anonymous, device-based identity (`deviceId` from localStorage). While this works for single-device usage and passphrase-based multi-device sync, it has critical limitations:

1. **Data Loss Risk**: New device or cleared browser = new identity = lost access to all data
2. **No Recovery Path**: Users cannot recover data if localStorage is cleared
3. **Security Gap**: Passphrase-only protection means anyone with the passphrase can access shared rooms
4. **No Cloud Features**: Anonymous users cannot have automatic backup or cross-device sync without manual passphrase entry
5. **Blocked Monetization**: No user accounts to differentiate free vs paid tiers

**Goal**: Implement optional user authentication while preserving the zero-friction anonymous experience.

---

## Goals

1. Enable seamless migration from anonymous to registered user accounts
2. Provide automatic cloud sync and backup for authenticated users
3. Implement secure data ownership via Row-Level Security (RLS)
4. Maintain backward compatibility for existing anonymous users
5. Support multi-device access for registered users (one login, all devices)
6. Create foundation for future pricing tiers and paid features

---

## Acceptance Criteria

### P0 (Must Have)

- [ ] **AC-1**: User can register new account with email/password via Supabase Auth
- [ ] **AC-2**: User can sign in to existing account with email/password
- [ ] **AC-3**: User can sign out and return to anonymous mode
- [ ] **AC-4**: On first registration, all anonymous projects/data automatically migrate to user account
- [ ] **AC-5**: `user_devices` table tracks device linkage to user accounts
- [ ] **AC-6**: RLS policies prevent users from accessing other users' data
- [ ] **AC-7**: `identity_migrations` table logs all migration events for audit/debugging
- [ ] **AC-8**: Store state includes `authStatus` ('anonymous' | 'authenticated' | 'pending') and `supabaseUserId`
- [ ] **AC-9**: All existing 351 unit tests continue to pass
- [ ] **AC-10**: New auth-related unit tests added and passing (minimum 10 tests)
- [ ] **AC-11**: Build succeeds with `npm run build`
- [ ] **AC-12**: Lint passes with `npm run lint`
- [ ] **AC-13**: TypeScript strict mode passes with `npx tsc --noEmit`

### P1 (Should Have)

- [ ] **AC-14**: Google OAuth provider integration
- [ ] **AC-15**: Settings UI page section for identity management (view linked devices, sign out)
- [ ] **AC-16**: Migration progress indicator UI during data transfer
- [ ] **AC-17**: Pre-migration data export as safety backup
- [ ] **AC-18**: Automatic session refresh (token renewal)
- [ ] **AC-19**: Session persistence across browser restarts

### P2 (Nice to Have)

- [ ] **AC-20**: GitHub OAuth provider
- [ ] **AC-21**: Account deletion flow (GDPR compliance)
- [ ] **AC-22**: Anonymous data retention warning banner ("Your data is at risk - register to backup")
- [ ] **AC-23**: Device management (revoke access from specific devices)
- [ ] **AC-24**: Email verification flow

---

## Constraint Architecture

### Must Do

- [ ] Maintain anonymous mode as default (zero friction for new users)
- [ ] Preserve all existing data during migration (projects, tasks, transcripts)
- [ ] Use existing `supabaseClient.ts` patterns for auth operations
- [ ] Add auth state to `useAppStore.ts` following existing state patterns
- [ ] Implement proper error handling with `// INTENTIONALLY HANDLING` comments
- [ ] Add JSDoc headers to all new functions/modules
- [ ] Follow existing TypeScript strict mode (no `any` types)
- [ ] Test auth flows in both development and production builds
- [ ] Document all RLS policies in SQL comments
- [ ] Store user-scoped data with `supabaseUserId` as ownership key

### Must Not Do

- [ ] Break existing anonymous user workflows
- [ ] Require registration for any current feature
- [ ] Delete anonymous data immediately after migration (keep until retention period)
- [ ] Use `any` types to bypass TypeScript checks
- [ ] Modify the 10 skipped sync E2E tests (deferred to later phase)
- [ ] Implement paid tier restrictions in this phase (foundation only)
- [ ] Change default feature flag values
- [ ] Remove device-based identity (it remains as fallback)

---

## Technical Design

### Database Schema Changes

```sql
-- =====================================================
-- User Device Linkage Table
-- Tracks which devices belong to which users
-- =====================================================
CREATE TABLE user_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id text NOT NULL,
    device_name text,
    device_fingerprint text, -- browser + OS hash for duplicate detection
    last_seen_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, device_id)
);

-- Index for fast user device lookups
CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);

-- =====================================================
-- Identity Migration Audit Log
-- Tracks anonymous -> registered transitions
-- =====================================================
CREATE TABLE identity_migrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    old_device_id text NOT NULL,
    new_user_id uuid REFERENCES auth.users(id),
    device_count_migrated integer DEFAULT 0,
    project_count_migrated integer DEFAULT 0,
    migration_status text DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'rolled_back'
    error_message text,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    rolled_back_at timestamptz
);

-- Index for migration lookups by device
CREATE INDEX idx_identity_migrations_device ON identity_migrations(old_device_id);

-- =====================================================
-- User-Scoped Project Storage (for cloud-synced projects)
-- Eventually Consistent - projects exist in both Yjs/IndexedDB and here
-- =====================================================
CREATE TABLE user_projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id text NOT NULL, -- maps to local project ID
    project_name text NOT NULL,
    project_color text,
    workspace_type text NOT NULL, -- 'personalUno', 'personalMulti', 'teamWorkspace'
    last_modified_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, project_id)
);

-- Index for user project lookups
CREATE INDEX idx_user_projects_user_id ON user_projects(user_id);

-- =====================================================
-- RLS Policies
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own devices
CREATE POLICY "Users can view own devices" ON user_devices
    FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can only insert their own devices
CREATE POLICY "Users can insert own devices" ON user_devices
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own device records
CREATE POLICY "Users can update own devices" ON user_devices
    FOR UPDATE USING (user_id = auth.uid());

-- Policy: Users can delete their own devices
CREATE POLICY "Users can delete own devices" ON user_devices
    FOR DELETE USING (user_id = auth.uid());

-- Policy: Users can view their own migrations
CREATE POLICY "Users can view own migrations" ON identity_migrations
    FOR SELECT USING (new_user_id = auth.uid());

-- Policy: Users can view their own projects
CREATE POLICY "Users can view own projects" ON user_projects
    FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can manage their own projects
CREATE POLICY "Users can manage own projects" ON user_projects
    FOR ALL USING (user_id = auth.uid());
```

### API Design

```typescript
// =====================================================
// src/lib/auth.ts - New Auth Module
// =====================================================

/**
 * Auth State Type Definition
 * 
 * @module src/lib/auth.ts
 * @production
 */
export type AuthStatus = 'anonymous' | 'authenticated' | 'pending';

export interface AuthState {
  status: AuthStatus;
  supabaseUserId: string | null;
  email: string | null;
  deviceLinked: boolean;
  migrationComplete: boolean;
}

export interface SignUpResult {
  success: boolean;
  userId?: string;
  error?: string;
  requiresEmailConfirmation?: boolean;
}

export interface SignInResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Register new user with email/password
 * After successful signup, initiates data migration
 */
export async function signUpWithEmail(
  email: string, 
  password: string,
  deviceId: string
): Promise<SignUpResult>;

/**
 * Sign in existing user
 * Links current device to user account
 */
export async function signInWithEmail(
  email: string, 
  password: string,
  deviceId: string
): Promise<SignInResult>;

/**
 * Sign out current user
 * Returns to anonymous mode, preserves local data
 */
export async function signOutUser(): Promise<void>;

/**
 * Get current auth state
 */
export async function getAuthState(): Promise<AuthState>;

/**
 * Link current device to authenticated user
 * Called automatically after sign in/up
 */
export async function linkDeviceToUser(
  userId: string, 
  deviceId: string,
  deviceName?: string
): Promise<boolean>;

// =====================================================
// src/lib/migration.ts - Data Migration Module
// =====================================================

export interface MigrationResult {
  success: boolean;
  projectsMigrated: number;
  error?: string;
  rollbackAvailable: boolean;
}

/**
 * Migrate anonymous data to user account
 * Called automatically after first registration
 */
export async function migrateAnonymousData(
  deviceId: string,
  userId: string
): Promise<MigrationResult>;

/**
 * Export all anonymous data as JSON backup
 * Safety net before migration
 */
export async function exportAnonymousData(deviceId: string): Promise<{
  projects: TodoProject[];
  exportTimestamp: number;
  deviceId: string;
}>;

/**
 * Rollback migration (emergency recovery)
 */
export async function rollbackMigration(
  migrationId: string
): Promise<boolean>;

// =====================================================
// Extensions to existing supabaseClient.ts
// =====================================================

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(): Promise<AuthResult>;

/**
 * Sign in with GitHub OAuth
 */
export async function signInWithGitHub(): Promise<AuthResult>;
```

### State Management

```typescript
// =====================================================
// Additions to useAppStore.ts State Interface
// =====================================================

export interface ProjectState {
  // ... existing state ...

  // --- Identity & Auth State (Phase 6) ---
  authStatus: 'anonymous' | 'authenticated' | 'pending';
  supabaseUserId: string | null;
  userEmail: string | null;
  linkedDevices: Array<{
    deviceId: string;
    deviceName: string;
    lastSeenAt: number;
  }>;
  migrationStatus: 'none' | 'pending' | 'in_progress' | 'completed' | 'failed';
  migrationProgress: number; // 0-100

  // --- Auth Actions ---
  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
  exportDataBeforeMigration: () => Promise<string>; // returns JSON string
}

// =====================================================
// Initial State Additions
// =====================================================

export const useAppStore = create<ProjectState>((set, get) => ({
  // ... existing initial state ...

  // Identity & Auth (Phase 6)
  authStatus: 'anonymous',
  supabaseUserId: null,
  userEmail: null,
  linkedDevices: [],
  migrationStatus: 'none',
  migrationProgress: 0,

  // ... actions defined below ...
}));
```

### UI Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `AuthModal` | Registration/login modal with email/password form, OAuth buttons | `src/components/auth/AuthModal.tsx` |
| `IdentitySettings` | Settings section showing current auth status, linked devices, sign out | `src/app/settings/IdentitySettings.tsx` |
| `MigrationProgress` | Progress bar + status text during data migration | `src/components/auth/MigrationProgress.tsx` |
| `AnonymousWarningBanner` | Sticky banner warning anonymous users about data risk (P2) | `src/components/auth/AnonymousWarningBanner.tsx` |
| `SignOutConfirmDialog` | Confirmation dialog with "export data first" reminder | `src/components/auth/SignOutConfirmDialog.tsx` |

---

## Task Decomposition

| Task | Time | Dependencies | Owner |
|------|------|--------------|-------|
| 1. Create database migration (SQL) | 2h | None | AI |
| 2. Implement `src/lib/auth.ts` module | 4h | Task 1 | AI |
| 3. Implement `src/lib/migration.ts` module | 4h | Task 1, 2 | AI |
| 4. Extend `supabaseClient.ts` with OAuth | 3h | Task 2 | AI |
| 5. Add auth state to `useAppStore.ts` | 3h | Task 2, 3 | AI |
| 6. Create `AuthModal` component | 3h | Task 5 | AI |
| 7. Create `IdentitySettings` component | 2h | Task 5 | AI |
| 8. Create `MigrationProgress` component | 2h | Task 3, 5 | AI |
| 9. Add auth tests (unit) | 4h | Task 2-5 | AI |
| 10. Write ADR-006 documentation | 2h | All above | AI |
| 11. Update settings page integration | 1h | Task 7 | AI |
| 12. Verification (lint, test, build) | 2h | All above | AI |

**Total Estimated Time: 32 hours**

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | Low | Critical | Pre-migration export; transaction rollback; migration audit log |
| Migration conflicts (duplicate project names) | Medium | Medium | Namespace migration with prefixes; conflict resolution UI |
| Supabase Auth rate limiting | Medium | Low | Exponential backoff; queue auth requests; offline queue |
| Session expiration handling | Medium | Medium | Automatic refresh; graceful degradation to anonymous |
| Device linking errors | Low | Medium | Idempotent device registration; duplicate detection |
| RLS policy misconfiguration | Low | Critical | Extensive testing; policy validation tests; principle of least privilege |
| OAuth provider failures | Low | Low | Fallback to email/password; clear error messages |
| Session token storage vulnerability | Low | High | Use Supabase's secure storage; review security best practices |

---

## Open Questions

1. **Email Verification**: Should we require email verification before enabling cloud sync, or allow immediate sync with unverified emails?
   - *Recommendation*: Allow immediate sync; verification only required for password reset

2. **Anonymous Data Retention**: How long should we keep orphaned anonymous data after migration?
   - *Recommendation*: 30 days with warning banner at day 25

3. **Migration UX**: Should migration be fully automatic or show a confirmation dialog?
   - *Recommendation*: Automatic with visible progress indicator; advanced users can export first

4. **Multi-Device Conflict Resolution**: If user edits on Device A (offline) and Device B (online), how to resolve?
   - *Recommendation*: Defer to Phase 7; Phase 6 assumes single-device migration initially

5. **Pricing Tier Preview**: Should UI show "Pro features coming soon" to set expectations?
   - *Recommendation*: Yes, subtle badge in settings; no feature gates yet

---

## Decision Log

| Decision | Rationale | Status |
|----------|-----------|--------|
| Email/Password MVP, OAuth P1 | Faster implementation; all users have email | Proposed |
| Automatic migration with progress UI | Zero friction; users don't need to understand migration | Proposed |
| Keep deviceId as primary key even after auth | Maintains backward compatibility; simpler state management | Proposed |
| 30-day anonymous data retention | Balance between safety and storage costs | Proposed |
| RLS policies on all user-scoped tables | Security first; prevent data leakage | Proposed |
| Defer sync E2E test fixes | Out of scope; focus on auth infrastructure first | Proposed |

---

## Appendix: Testing Strategy

### Unit Tests Required

```typescript
// src/lib/__tests__/auth.test.ts
describe('Auth Module', () => {
  it('signUpWithEmail creates user and initiates migration', async () => {});
  it('signInWithEmail links device to user', async () => {});
  it('signOutUser clears session but preserves local data', async () => {});
  it('getAuthState returns correct status for anonymous user', async () => {});
  it('getAuthState returns correct status for authenticated user', async () => {});
  it('linkDeviceToUser prevents duplicate entries', async () => {});
  it('linkDeviceToUser updates last_seen_at on re-link', async () => {});
});

// src/lib/__tests__/migration.test.ts
describe('Migration Module', () => {
  it('migrateAnonymousData copies all projects', async () => {});
  it('migrateAnonymousData logs to identity_migrations', async () => {});
  it('exportAnonymousData returns valid JSON', async () => {});
  it('rollbackMigration restores anonymous access', async () => {});
  it('migration handles empty project list gracefully', async () => {});
});

// src/store/__tests__/useAppStore.auth.test.ts
describe('Auth State in Store', () => {
  it('initial state is anonymous', () => {});
  it('signUp action updates authStatus to authenticated', () => {});
  it('signOut action returns to anonymous', () => {});
  it('migrationStatus tracks progress correctly', () => {});
});
```

### E2E Tests (Manual for Phase 6)

- [ ] User can register with email/password
- [ ] User can sign in with existing account
- [ ] User can sign out and return to anonymous
- [ ] After registration, all projects appear in user account
- [ ] RLS prevents cross-user data access
- [ ] Session persists across page refresh

---

**SPECIFICATION COMPLETE - Ready for review**
