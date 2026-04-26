/**
 * VideoInput Component Tests
 *
 * @module VideoInput.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('VideoInput Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/VideoInput');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: VideoInput } = await import('@/components/VideoInput');
    expect(typeof VideoInput).toBe('function');
  });

  it('should have component name', async () => {
    const { default: VideoInput } = await import('@/components/VideoInput');
    expect(VideoInput.name).toBe('VideoInput');
  });
});
