/**
 * WorkspaceSelector Component Tests
 *
 * @module WorkspaceSelector.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('WorkspaceSelector Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/WorkspaceSelector');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: WorkspaceSelector } = await import('@/components/WorkspaceSelector');
    expect(typeof WorkspaceSelector).toBe('function');
  });

  it('should have component name', async () => {
    const { default: WorkspaceSelector } = await import('@/components/WorkspaceSelector');
    expect(WorkspaceSelector.name).toBe('WorkspaceSelector');
  });
});
