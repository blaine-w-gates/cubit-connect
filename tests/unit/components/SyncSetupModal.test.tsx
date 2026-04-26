/**
 * SyncSetupModal Component Tests
 *
 * @module SyncSetupModal.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('SyncSetupModal Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/SyncSetupModal');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: SyncSetupModal } = await import('@/components/SyncSetupModal');
    expect(typeof SyncSetupModal).toBe('function');
  });

  it('should have component name', async () => {
    const { default: SyncSetupModal } = await import('@/components/SyncSetupModal');
    expect(SyncSetupModal.name).toBe('SyncSetupModal');
  });
});
