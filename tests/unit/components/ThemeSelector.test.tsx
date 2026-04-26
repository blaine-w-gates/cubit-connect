/**
 * ThemeSelector Component Tests
 *
 * @module ThemeSelector.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('ThemeSelector Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/ThemeSelector');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: ThemeSelector } = await import('@/components/ThemeSelector');
    expect(typeof ThemeSelector).toBe('function');
  });

  it('should have component name', async () => {
    const { default: ThemeSelector } = await import('@/components/ThemeSelector');
    expect(ThemeSelector.name).toBe('ThemeSelector');
  });
});
