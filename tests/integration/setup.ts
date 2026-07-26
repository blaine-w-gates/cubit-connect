import { vi, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { SupabaseSyncProd } from '@/lib/supabaseSyncProd';

// ============================================================================
// LOAD .env.local INTO process.env
// Next.js loads .env.local automatically, but Vitest does not.
// This ensures integration tests can access Supabase credentials.
// ============================================================================
(function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
})();

// ============================================================================
// GLOBAL FEATUREFLAGS MOCK
// ============================================================================
vi.mock('@/lib/featureFlags', () => ({
  emitTelemetry: vi.fn(),
  setFlag: vi.fn(),
  getFlag: vi.fn().mockReturnValue(false),
  getAllFlags: vi.fn().mockReturnValue({}),
  resetFlags: vi.fn(),
  resetDebounceState: vi.fn(),
  isDebouncing: vi.fn().mockReturnValue(false),
  recordToggle: vi.fn(),
  setUseSupabaseSync: vi.fn(),
  getUseSupabaseSync: vi.fn().mockReturnValue(true),
}));

// ============================================================================
// GLOBAL NEXT/SERVER MOCK
// ============================================================================
vi.mock('next/server', () => {
  return {
    NextResponse: {
      json: vi.fn((body, init) => ({
        status: init?.status || 200,
        json: async () => body,
      })),
    },
  };
});

// ============================================================================
// GLOBAL WINDOW MOCKS
// ============================================================================
if (typeof window !== 'undefined') {
  (window as unknown as { __SYNC_TELEMETRY__: unknown[] }).__SYNC_TELEMETRY__ = [];
}

// ============================================================================
// TEST HELPER: connectWithTimeout
// Uses AbortController for clean cancellation instead of Promise.race
// This prevents abandoned fetch promises causing UND_ERR_INVALID_ARG
// ============================================================================
export async function connectWithTimeout(
  sync: SupabaseSyncProd,
  key: CryptoKey,
  timeoutMs = 5000
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await sync.connect(key, controller.signal);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      // Expected timeout - swallow silently
      return;
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// CLEANUP
// ============================================================================
afterEach(() => {
  vi.clearAllMocks();
});
