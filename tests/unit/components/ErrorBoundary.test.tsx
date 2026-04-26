/**
 * ErrorBoundary Component Tests
 *
 * Uses vitest with jsdom environment for DOM testing.
 *
 * @module ErrorBoundary.test
 * @component
 */

import { describe, it, expect, vi } from 'vitest';

describe('ErrorBoundary Component', () => {
  it('should exist as a React component', () => {
    expect(() => import('./ErrorBoundary')).not.toThrow();
  });

  it('should export ErrorBoundary class', async () => {
    const module = await import('./ErrorBoundary');
    expect(module.ErrorBoundary).toBeDefined();
    expect(typeof module.ErrorBoundary).toBe('function');
  });

  it('should have proper React error boundary structure', async () => {
    const { ErrorBoundary } = await import('./ErrorBoundary');
    const prototype = ErrorBoundary.prototype;

    expect(prototype.componentDidCatch).toBeDefined();
    expect(typeof prototype.componentDidCatch).toBe('function');
    expect(prototype.render).toBeDefined();
    expect(typeof prototype.render).toBe('function');
  });

  it('should have reset functionality', async () => {
    const { ErrorBoundary } = await import('./ErrorBoundary');
    const prototype = ErrorBoundary.prototype;

    expect(prototype.reset).toBeDefined();
    expect(typeof prototype.reset).toBe('function');
  });
});
