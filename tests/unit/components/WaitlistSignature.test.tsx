/**
 * WaitlistSignature Component Tests
 *
 * @module WaitlistSignature.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('WaitlistSignature Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/WaitlistSignature');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: WaitlistSignature } = await import('@/components/WaitlistSignature');
    expect(typeof WaitlistSignature).toBe('function');
  });

  it('should have component name', async () => {
    const { default: WaitlistSignature } = await import('@/components/WaitlistSignature');
    expect(WaitlistSignature.name).toBe('WaitlistSignature');
  });
});
