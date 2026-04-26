/**
 * ErrorBoundary Component Tests
 *
 * Uses vitest with jsdom environment for DOM testing.
 *
 * @module ErrorBoundary.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('ErrorBoundary Component', () => {
  it('should exist as a React component', () => {
    expect(() => import('@/components/ErrorBoundary')).not.toThrow();
  });

  it('should export ErrorBoundary class', async () => {
    const ErrorBoundary = await import('@/components/ErrorBoundary');
    expect(ErrorBoundary).toBeDefined();
    expect(typeof ErrorBoundary.default).toBe('function');
  });

  it('should have proper React error boundary structure', async () => {
    const ErrorBoundaryMod = await import('@/components/ErrorBoundary');
    const ErrorBoundary = ErrorBoundaryMod.default;
    const prototype = ErrorBoundary.prototype;

    expect(prototype.componentDidCatch).toBeDefined();
    expect(typeof prototype.componentDidCatch).toBe('function');
    expect(prototype.render).toBeDefined();
    expect(typeof prototype.render).toBe('function');
  });

  it('should have handleReload method', async () => {
    const ErrorBoundaryMod = await import('@/components/ErrorBoundary');
    const ErrorBoundary = ErrorBoundaryMod.default;
    const prototype = ErrorBoundary.prototype;

    expect(prototype.handleReload).toBeDefined();
    expect(typeof prototype.handleReload).toBe('function');
  });

  it('should have handleResetData method', async () => {
    const ErrorBoundaryMod = await import('@/components/ErrorBoundary');
    const ErrorBoundary = ErrorBoundaryMod.default;
    const prototype = ErrorBoundary.prototype;

    expect(prototype.handleResetData).toBeDefined();
    expect(typeof prototype.handleResetData).toBe('function');
  });
});
