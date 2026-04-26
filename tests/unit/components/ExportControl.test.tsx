/**
 * ExportControl Component Tests
 *
 * @module ExportControl.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('ExportControl Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/ExportControl');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: ExportControl } = await import('@/components/ExportControl');
    expect(typeof ExportControl).toBe('function');
  });

  it('should have component name', async () => {
    const { default: ExportControl } = await import('@/components/ExportControl');
    expect(ExportControl.name).toBe('ExportControl');
  });
});
