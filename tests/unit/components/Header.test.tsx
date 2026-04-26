/**
 * Header Component Tests
 *
 * @module Header.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('Header Component', () => {
  it('should exist and be importable', async () => {
    const module = await import('@/components/Header');
    expect(module).toBeDefined();
    expect(module.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: Header } = await import('@/components/Header');
    expect(typeof Header).toBe('function');
  });

  it('should have component name', async () => {
    const { default: Header } = await import('@/components/Header');
    expect(Header.name).toBe('Header');
  });
});
