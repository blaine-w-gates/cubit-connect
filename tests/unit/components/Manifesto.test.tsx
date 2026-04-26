/**
 * Manifesto Component Tests
 *
 * @module Manifesto.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('Manifesto Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/Manifesto');
    expect(mod).toBeDefined();
    expect(mod.Manifesto).toBeDefined();
  });

  it('should export a React component', async () => {
    const { Manifesto } = await import('@/components/Manifesto');
    expect(typeof Manifesto).toBe('function');
  });

  it('should have component name', async () => {
    const { Manifesto } = await import('@/components/Manifesto');
    expect(Manifesto.name).toBe('Manifesto');
  });
});
