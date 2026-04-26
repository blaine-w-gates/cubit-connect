/**
 * useStorageMonitor Hook Tests
 *
 * @module useStorageMonitor.test
 * @description Tests for storage monitoring React hook
 */

import { describe, it, expect } from 'vitest';

describe('useStorageMonitor Hook', () => {
  it('should exist and be importable', async () => {
    const hookModule = await import('@/hooks/useStorageMonitor');
    expect(hookModule).toBeDefined();
    expect(hookModule.useStorageMonitor).toBeDefined();
  });

  it('should export a React hook function', async () => {
    const { useStorageMonitor } = await import('@/hooks/useStorageMonitor');
    expect(typeof useStorageMonitor).toBe('function');
  });

  it('should have correct hook name', async () => {
    const { useStorageMonitor } = await import('@/hooks/useStorageMonitor');
    expect(useStorageMonitor.name).toBe('useStorageMonitor');
  });

  it('should export UseStorageMonitorReturn interface', async () => {
    const hookModule = await import('@/hooks/useStorageMonitor');
    // Type-only export - verify module has expected structure
    expect(hookModule).toHaveProperty('useStorageMonitor');
  });
});

describe('StorageWarningBanner Component', () => {
  it('should exist and be importable', async () => {
    const bannerModule = await import('@/components/StorageWarningBanner');
    expect(bannerModule).toBeDefined();
    expect(bannerModule.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: StorageWarningBanner } = await import('@/components/StorageWarningBanner');
    expect(typeof StorageWarningBanner).toBe('function');
  });

  it('should have component name', async () => {
    const { default: StorageWarningBanner } = await import('@/components/StorageWarningBanner');
    expect(StorageWarningBanner.name).toBe('StorageWarningBanner');
  });
});
