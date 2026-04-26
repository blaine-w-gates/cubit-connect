/**
 * OfflineIndicator Component Tests
 *
 * @module OfflineIndicator.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('OfflineIndicator Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/OfflineIndicator');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: OfflineIndicator } = await import('@/components/OfflineIndicator');
    expect(typeof OfflineIndicator).toBe('function');
  });

  it('should have component name', async () => {
    const { default: OfflineIndicator } = await import('@/components/OfflineIndicator');
    expect(OfflineIndicator.name).toBe('OfflineIndicator');
  });
});
