/**
 * Feature Flag System for Supabase Migration
 *
 * Provides production-grade feature flagging with:
 * - Cross-tab synchronization via storage events
 * - Telemetry for monitoring
 * - Graceful degradation when localStorage is unavailable
 *
 * @module featureFlags
 * @version 1.0.0
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * LocalStorage key for the Supabase sync feature flag
 */
const USE_SUPABASE_SYNC_KEY = 'USE_SUPABASE_SYNC';

/**
 * Default value for the feature flag (false = use legacy WebSocket)
 */
const DEFAULT_USE_SUPABASE_SYNC = false;

// ============================================================================
// TELEMETRY SYSTEM
// ============================================================================

/**
 * Telemetry event types
 */
export type TelemetryEventType =
  | 'flag_toggled'
  | 'transport_switched'
  | 'supabase_auth_attempt'
  | 'supabase_auth_success'
  | 'supabase_auth_failure'
  | 'error_boundary_triggered';

/**
 * Telemetry event structure
 */
export interface TelemetryEvent {
  event: TelemetryEventType;
  timestamp: number;
  value?: boolean;
  from?: string;
  to?: string;
  attempt?: number;
  error?: string;
  context?: Record<string, unknown>;
}

/**
 * Global telemetry array for debugging and monitoring
 * Accessible via window.__SYNC_TELEMETRY__
 */
declare global {
  interface Window {
    __SYNC_TELEMETRY__?: TelemetryEvent[];
    __USE_SUPABASE_SYNC__?: boolean;
    __toggleSupabaseSync__?: () => void;
    __SYNC_HAS_UNSAVED_CHANGES__?: boolean;
  }
}

/**
 * Initialize telemetry system
 */
function initTelemetry(): void {
  if (typeof window === 'undefined') return;

  if (!window.__SYNC_TELEMETRY__) {
    window.__SYNC_TELEMETRY__ = [];
  }
}

/**
 * Emit a telemetry event
 *
 * @param event - Event type
 * @param data - Additional event data
 */
export function emitTelemetry(
  event: TelemetryEventType,
  data?: Omit<TelemetryEvent, 'event' | 'timestamp'>
): void {
  if (typeof window === 'undefined') return;

  initTelemetry();

  const telemetryEvent: TelemetryEvent = {
    event,
    timestamp: Date.now(),
    ...data,
  };

  window.__SYNC_TELEMETRY__?.push(telemetryEvent);

  // Keep only last 100 events to prevent memory bloat
  if (window.__SYNC_TELEMETRY__ && window.__SYNC_TELEMETRY__.length > 100) {
    window.__SYNC_TELEMETRY__ = window.__SYNC_TELEMETRY__.slice(-100);
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
  }
}

// ============================================================================
// LOCAL STORAGE UTILITIES
// ============================================================================

/**
 * Check if localStorage is available and working
 *
 * @returns true if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const test = '__storage_test__';
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch {
    // INTENTIONALLY SWALLOWING: localStorage unavailable (private mode, disabled)
    // Return false allows graceful fallback to memory-only storage
    return false;
  }
}

/**
 * Safely read from localStorage
 *
 * @param key - Storage key
 * @param defaultValue - Default value if key not found or storage unavailable
 * @returns Parsed value or default
 */
function safeLocalStorageGet<T>(key: string, defaultValue: T): T {
  if (!isLocalStorageAvailable()) {
    return defaultValue;
  }

  try {
    const item = window.localStorage.getItem(key);
    if (item === null) return defaultValue;

    // Parse as JSON if possible
    try {
      return JSON.parse(item) as T;
    } catch {
      // INTENTIONALLY FALLBACK: Not valid JSON, return as raw string
      // Legacy values may be stored as plain strings
      return item as unknown as T;
    }
  } catch {
    // INTENTIONALLY FALLBACK: Storage read failure returns default
    // Could be quota exceeded, corruption, or private mode
    return defaultValue;
  }
}

/**
 * Safely write to localStorage
 *
 * @param key - Storage key
 * @param value - Value to store
 * @returns true if successful
 */
function safeLocalStorageSet<T>(key: string, value: T): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    window.localStorage.setItem(key, serialized);
    return true;
  } catch (e) {
    // INTENTIONALLY RETURNING FALSE: Storage write failure
    // Typically quota exceeded or private mode - app continues with in-memory only
    console.error('[FEATURE FLAGS] localStorage write failed:', e);
    return false;
  }
}

// ============================================================================
// FEATURE FLAG API
// ============================================================================

/**
 * Get the current value of the Supabase sync feature flag
 *
 * Reads from localStorage if available, otherwise returns default.
 * Safe to call during SSR (returns default on server).
 *
 * @returns true if Supabase sync should be used, false for legacy WebSocket
 */
export function getUseSupabaseSync(): boolean {
  // SSR safety: return default on server
  if (typeof window === 'undefined') {
    return DEFAULT_USE_SUPABASE_SYNC;
  }

  const value = safeLocalStorageGet<boolean>(USE_SUPABASE_SYNC_KEY, DEFAULT_USE_SUPABASE_SYNC);

  // Ensure boolean (handle string "true"/"false" from localStorage)
  if (typeof value === 'string') {
    return value === 'true';
  }

  return value ?? DEFAULT_USE_SUPABASE_SYNC;
}

/**
 * Check if there are unsynced changes in the application
 *
 * This is a placeholder that will be wired to actual app state in integration.
 * For now, it checks a window global that the app can set.
 *
 * @returns true if there are unsynced changes
 */
function hasUnsyncedChanges(): boolean {
  if (typeof window === 'undefined') return false;
  // Check for app-provided indicator
  return window.__SYNC_HAS_UNSAVED_CHANGES__ === true;
}

// ============================================================================
// DEBOUNCING
// ============================================================================

const DEBOUNCE_DELAY = 300; // 300ms debounce
let lastToggleTime = 0;

/**
 * Check if toggle is being debounced
 *
 * @returns true if toggle should be blocked due to debouncing
 */
function isDebouncing(): boolean {
  const now = Date.now();
  const timeSinceLastToggle = now - lastToggleTime;
  return timeSinceLastToggle < DEBOUNCE_DELAY;
}

/**
 * Update last toggle time
 */
function recordToggle(): void {
  lastToggleTime = Date.now();
}

/**
 * Reset debounce state (for testing)
 * @internal
 */
export function resetDebounceState(): void {
  lastToggleTime = 0;
}

/**
 * Set the Supabase sync feature flag
 *
 * Persists to localStorage and triggers cross-tab synchronization.
 * Emits telemetry event for monitoring.
 *
 * DATA LOSS PREVENTION: Will block toggle if hasUnsyncedChanges() returns true.
 * Use force=true to override (emergency only).
 *
 * @param value - true to enable Supabase sync, false for legacy
 * @param force - Override data loss prevention (default: false)
 * @returns true if successfully persisted, false if blocked or failed
 */
export function setUseSupabaseSync(value: boolean, force: boolean = false): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const oldValue = getUseSupabaseSync();

  // If value isn't changing, allow it (idempotent)
  if (value === oldValue) {
    return true;
  }

  // Debouncing: Prevent rapid toggles (only when value changes)
  if (!force && isDebouncing()) {
    console.warn('[FEATURE FLAGS] Toggle debounced: Please wait before toggling again');
    return false;
  }

  // Data Loss Prevention: Check for unsynced changes
  if (!force && hasUnsyncedChanges()) {
    console.error('[FEATURE FLAGS] BLOCKED: Cannot toggle sync while unsaved changes exist');
    console.error('[FEATURE FLAGS] Use setUseSupabaseSync(value, true) to force (may lose data)');

    emitTelemetry('error_boundary_triggered', {
      context: {
        error: 'toggle_blocked_unsaved_changes',
        attemptedValue: value,
      },
    });

    return false;
  }

  // Record toggle time for debouncing
  recordToggle();

  const success = safeLocalStorageSet(USE_SUPABASE_SYNC_KEY, value);

  if (success) {
    // Update window global for debugging
    window.__USE_SUPABASE_SYNC__ = value;

    // Emit telemetry
    emitTelemetry('flag_toggled', {
      value,
      context: { previousValue: oldValue, forced: force },
    });

    // Dispatch custom event for same-tab listeners
    window.dispatchEvent(
      new CustomEvent('sync:featureFlagChange', {
        detail: { flag: USE_SUPABASE_SYNC_KEY, value, previousValue: oldValue, forced: force },
      })
    );

  }

  return success;
}

/**
 * Toggle the Supabase sync feature flag
 *
 * Convenience method that flips the current value.
 * Respects data loss prevention (will fail if unsaved changes exist).
 *
 * @param force - Override data loss prevention (default: false)
 * @returns new value after toggle, or current value if blocked
 */
export function toggleUseSupabaseSync(force: boolean = false): boolean {
  const current = getUseSupabaseSync();
  const newValue = !current;
  const success = setUseSupabaseSync(newValue, force);
  return success ? newValue : current;
}

/**
 * Reset feature flag to default (false)
 *
 * Useful for emergency rollback.
 *
 * @returns true if successful
 */
export function resetUseSupabaseSync(): boolean {
  return setUseSupabaseSync(DEFAULT_USE_SUPABASE_SYNC);
}

// ============================================================================
// CROSS-TAB SYNCHRONIZATION
// ============================================================================

/**
 * Initialize cross-tab synchronization
 *
 * Sets up listener for storage events to sync flag state across tabs.
 */
function initCrossTabSync(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('storage', (event) => {
    if (event.key === USE_SUPABASE_SYNC_KEY) {
      const newValue = event.newValue === 'true';
      const oldValue = event.oldValue === 'true';

      // Update window global
      window.__USE_SUPABASE_SYNC__ = newValue;

      // Emit telemetry
      emitTelemetry('flag_toggled', {
        value: newValue,
        context: { previousValue: oldValue, source: 'cross-tab' },
      });

      // Dispatch custom event
      window.dispatchEvent(
        new CustomEvent('sync:featureFlagChange', {
          detail: { flag: USE_SUPABASE_SYNC_KEY, value: newValue, previousValue: oldValue, source: 'cross-tab' },
        })
      );

    }
  });
}

/**
 * Subscribe to feature flag changes
 *
 * @param callback - Function to call when flag changes
 * @returns Unsubscribe function
 */
export function onFeatureFlagChange(
  callback: (value: boolean, previousValue: boolean, source: 'local' | 'cross-tab') => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {}; // No-op for SSR
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{
      flag: string;
      value: boolean;
      previousValue: boolean;
      source?: 'cross-tab';
    }>;

    if (customEvent.detail?.flag === USE_SUPABASE_SYNC_KEY) {
      callback(
        customEvent.detail.value,
        customEvent.detail.previousValue,
        customEvent.detail.source || 'local'
      );
    }
  };

  window.addEventListener('sync:featureFlagChange', handler);

  return () => {
    window.removeEventListener('sync:featureFlagChange', handler);
  };
}

// ============================================================================
// DEVTOOLS INTEGRATION
// ============================================================================

/**
 * Initialize DevTools helpers
 *
 * Exposes debugging utilities on window object:
 * - window.__USE_SUPABASE_SYNC__ (current flag value)
 * - window.__toggleSupabaseSync__ (toggle function)
 * - window.__SYNC_TELEMETRY__ (telemetry array)
 */
function initDevTools(): void {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'development') return;

  window.__USE_SUPABASE_SYNC__ = getUseSupabaseSync();

  window.__toggleSupabaseSync__ = () => {
    const newValue = toggleUseSupabaseSync();
    window.__USE_SUPABASE_SYNC__ = newValue;
    return newValue;
  };

  initTelemetry();

}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize on module load (browser only)
if (typeof window !== 'undefined') {
  initCrossTabSync();
  initDevTools();

  // Set initial window global
  window.__USE_SUPABASE_SYNC__ = getUseSupabaseSync();
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  USE_SUPABASE_SYNC_KEY,
  DEFAULT_USE_SUPABASE_SYNC,
};

// Default export for convenience
const featureFlags = {
  getUseSupabaseSync,
  setUseSupabaseSync,
  toggleUseSupabaseSync,
  resetUseSupabaseSync,
  onFeatureFlagChange,
  emitTelemetry,
};

export default featureFlags;
