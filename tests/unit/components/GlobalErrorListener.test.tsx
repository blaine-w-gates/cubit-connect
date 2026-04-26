/**
 * GlobalErrorListener Component Tests
 *
 * @module GlobalErrorListener.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('GlobalErrorListener Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/GlobalErrorListener');
    expect(mod).toBeDefined();
  });

  it('should export React components', async () => {
    const components = await import('@/components/GlobalErrorListener');
    expect(Object.keys(components).length).toBeGreaterThan(0);
  });
});
