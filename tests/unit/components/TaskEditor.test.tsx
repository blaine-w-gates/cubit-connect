/**
 * TaskEditor Component Tests
 *
 * @module TaskEditor.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('TaskEditor Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/TaskEditor');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: TaskEditor } = await import('@/components/TaskEditor');
    expect(typeof TaskEditor).toBe('function');
  });

  it('should have component name', async () => {
    const { default: TaskEditor } = await import('@/components/TaskEditor');
    expect(TaskEditor.name).toBe('TaskEditor');
  });
});
