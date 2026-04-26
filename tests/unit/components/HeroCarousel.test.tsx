/**
 * HeroCarousel Component Tests
 *
 * @module HeroCarousel.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('HeroCarousel Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/HeroCarousel');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: HeroCarousel } = await import('@/components/HeroCarousel');
    expect(typeof HeroCarousel).toBe('function');
  });

  it('should have component name', async () => {
    const { default: HeroCarousel } = await import('@/components/HeroCarousel');
    expect(HeroCarousel.name).toBe('HeroCarousel');
  });
});
