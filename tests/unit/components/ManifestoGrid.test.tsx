/**
 * ManifestoGrid Component Tests
 *
 * @module ManifestoGrid.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('ManifestoGrid Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/ManifestoGrid');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: ManifestoGrid } = await import('@/components/ManifestoGrid');
    expect(typeof ManifestoGrid).toBe('function');
  });

  it('should have component name', async () => {
    const { default: ManifestoGrid } = await import('@/components/ManifestoGrid');
    expect(ManifestoGrid.name).toBe('ManifestoGrid');
  });
});
