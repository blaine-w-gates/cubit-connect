/**
 * IgnitionForm Component Tests
 *
 * @module IgnitionForm.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('IgnitionForm Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/IgnitionForm');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: IgnitionForm } = await import('@/components/IgnitionForm');
    expect(typeof IgnitionForm).toBe('function');
  });

  it('should have component name', async () => {
    const { default: IgnitionForm } = await import('@/components/IgnitionForm');
    expect(IgnitionForm.name).toBe('IgnitionForm');
  });
});
