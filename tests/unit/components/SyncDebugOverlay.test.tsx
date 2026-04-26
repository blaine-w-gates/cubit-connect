/**
 * SyncDebugOverlay Component Tests
 *
 * @module SyncDebugOverlay.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('SyncDebugOverlay Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/SyncDebugOverlay');
    expect(mod).toBeDefined();
    expect(mod.SyncDebugOverlay).toBeDefined();
  });

  it('should export a React component', async () => {
    const { SyncDebugOverlay } = await import('@/components/SyncDebugOverlay');
    expect(typeof SyncDebugOverlay).toBe('function');
  });

  it('should have component name', async () => {
    const { SyncDebugOverlay } = await import('@/components/SyncDebugOverlay');
    expect(SyncDebugOverlay.name).toBe('SyncDebugOverlay');
  });
});
