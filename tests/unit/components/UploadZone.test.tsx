/**
 * UploadZone Component Tests
 *
 * @module UploadZone.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('UploadZone Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/UploadZone');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: UploadZone } = await import('@/components/UploadZone');
    expect(typeof UploadZone).toBe('function');
  });

  it('should have component name', async () => {
    const { default: UploadZone } = await import('@/components/UploadZone');
    expect(UploadZone.name).toBe('UploadZone');
  });
});
