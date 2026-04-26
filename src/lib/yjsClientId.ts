/**
 * Yjs ClientID utilities for testing isolation
 * 
 * Yjs uses crypto.getRandomValues() to generate ClientIDs. When testing with multiple
 * tabs on the same device, they may share the same entropy pool and generate identical
 * IDs. This causes each peer to ignore the other's updates as "local changes".
 * 
 * This module provides deterministic ClientID generation for testing scenarios.
 */

// Counter for unique ID generation
let clientIdCounter = 0;

/**
 * Generate a unique ClientID for production use.
 * Combines device fingerprint, timestamp, and random to ensure uniqueness across devices.
 * This prevents the Yjs ClientID collision issue where two devices generate the same ID.
 */
export function generateUniqueClientId(): number {
  // Get device fingerprint for uniqueness across devices
  const deviceId = getOrCreateDeviceId();
  const deviceHash = hashStringToNumber(deviceId);
  
  const now = Math.floor(Date.now() / 1000);
  const counter = ++clientIdCounter % 0xFFFF;
  const random = Math.floor(Math.random() * 0xFFFF);
  
  // Mix device hash into the high bits to ensure cross-device uniqueness
  const high = ((now & 0xFFFF) | ((deviceHash & 0xFFFF) << 16)) * 0x100000000;
  const low = ((counter << 16) | random) & 0xFFFFFFFF;
  
  const clientId = high + low;
  
  return clientId;
}

/**
 * Get or create a persistent device ID for this browser.
 * Stored in localStorage to persist across sessions.
 */
function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr-device';
  
  const key = 'cubit_device_id';
  let deviceId = localStorage.getItem(key);
  
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(key, deviceId);
  }
  
  return deviceId;
}

/**
 * Simple string hash function for device ID hashing.
 */
function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a deterministic unique ClientID for testing.
 * This ensures different tabs/peers on the same device have unique ClientIDs.
 * 
 * The ID is constructed from:
 * - High 32 bits: timestamp (seconds since epoch, truncated)
 * - Low 32 bits: counter + random component
 */
export function generateTestClientId(): number {
  const now = Math.floor(Date.now() / 1000);
  const counter = ++clientIdCounter % 0xFFFF;
  const random = Math.floor(Math.random() * 0xFFFF);
  
  // Combine into 64-bit number
  const high = (now & 0xFFFFFFFF) * 0x100000000;
  const low = ((counter << 16) | random) & 0xFFFFFFFF;
  
  return high + low;
}

/**
 * Generate a unique session ID for test isolation.
 * This is used to namespace localStorage keys and BroadcastChannels.
 */
export function generateSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Check if we're running in a test environment (Playwright, Jest, Vitest).
 * Uses multiple detection methods for robustness.
 */
export function isTestEnvironment(): boolean {
  if (typeof window === 'undefined') return true; // SSR/Node
  
  // Check for Playwright
  if ((window as unknown as { __PLAYWRIGHT__?: boolean }).__PLAYWRIGHT__) {
    return true;
  }
  
  // Check for test globals
  if (typeof (globalThis as unknown as { jest?: unknown }).jest !== 'undefined') {
    return true;
  }
  
  // Check for test URL patterns
  if (window.location?.pathname?.includes('test')) {
    return true;
  }
  
  // Check for NODE_ENV (set by most test runners)
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  return false;
}

/**
 * Get or create a unique session ID for this browser context.
 * Persists for the lifetime of the page (not stored to localStorage).
 */
let cachedSessionId: string | null = null;

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr-session';
  
  if (!cachedSessionId) {
    cachedSessionId = generateSessionId();
    // Make it available globally for debugging
    (window as unknown as { __CUBIT_SESSION_ID__?: string }).__CUBIT_SESSION_ID__ = cachedSessionId;
  }
  
  return cachedSessionId;
}

/**
 * Prefix a key with the current session ID for isolation.
 * This prevents localStorage collisions between test sessions.
 */
export function withSessionPrefix(key: string): string {
  const sessionId = getSessionId();
  return `${sessionId}:${key}`;
}

/**
 * Get a namespaced localStorage key that won't collide with other sessions.
 */
export function getNamespacedStorageKey(baseKey: string): string {
  // Only namespace in test environments to avoid breaking production data
  if (isTestEnvironment()) {
    return withSessionPrefix(baseKey);
  }
  return baseKey;
}

/**
 * Create a namespaced BroadcastChannel name.
 * Prevents cross-tab contamination during testing.
 */
export function getNamespacedChannelName(baseName: string): string {
  if (isTestEnvironment()) {
    return withSessionPrefix(baseName);
  }
  return baseName;
}

// Type augmentation for Y.Doc constructor options
declare module 'yjs' {
  interface DocOptions {
    clientID?: number;
  }
}
