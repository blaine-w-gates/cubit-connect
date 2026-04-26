/**
 * ResultsFeed Component Tests
 *
 * @module ResultsFeed.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('ResultsFeed Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/ResultsFeed');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: ResultsFeed } = await import('@/components/ResultsFeed');
    expect(typeof ResultsFeed).toBe('function');
  });

  it('should have component name', async () => {
    const { default: ResultsFeed } = await import('@/components/ResultsFeed');
    expect(ResultsFeed.name).toBe('ResultsFeed');
  });
});
