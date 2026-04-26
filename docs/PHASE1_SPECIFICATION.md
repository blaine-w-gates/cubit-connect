# Phase 1 Specification: Foundations & Resilience

## Goal
Establish a robust, testable, and reversible foundation for the Supabase migration.

## Architecture

### 1. Feature Flag System (`src/lib/featureFlags.ts`)
- **Storage**: `localStorage` (key: `USE_SUPABASE_SYNC`)
- **Default**: `false`
- **Synchronization**: Cross-tab sync via `storage` event listener.
- **Telemetry**: 100-event circular buffer in `window.__SYNC_TELEMETRY__`.

### 2. Supabase Client (`src/lib/supabaseClient.ts`)
- **Initialization**: Singleton pattern.
- **Retries**: 3 attempts with exponential backoff.
- **Timeouts**: 10s for auth operations.
- **Auth**: `signInAnonymously()` handled as a precondition for sync.

### 3. Error Recovery (`src/lib/syncErrorRecovery.ts`)
- **Severity**: Warning, Error, Critical.
- **Auto-Rollback**: On `critical` severity, the `USE_SUPABASE_SYNC` flag is reset to `false`.
- **User Feedback**: Prompts for page reload on fatal transport failures.

### 4. Lazy Loading (`src/lib/supabaseSyncLoader.ts`)
- **Method**: Dynamic `import()`.
- **Benefit**: Reduces initial bundle size by ~50KB for users not in the Supabase experiment.

## Verification
- **Unit Tests**: 66 tests covering edge cases (localStorage full, network timeout, cross-tab events).
- **Manual**: DevTools console helpers (`window.__toggleSupabaseSync__()`).
