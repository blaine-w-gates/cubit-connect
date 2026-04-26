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
    const mod = await import('@/components/TaskEditor');
    const TaskEditor = mod.default;
    // memo() wraps the function, but it should still be a valid React component
    expect(TaskEditor).toBeDefined();
    expect(typeof TaskEditor === 'function' || typeof TaskEditor === 'object').toBe(true);
  });

  it('should have component name', async () => {
    const mod = await import('@/components/TaskEditor');
    const TaskEditor = mod.default;
    // memo() preserves the inner function name as 'TaskEditor'
    // Access type property through unknown to bypass TypeScript restriction
    const typeName = (TaskEditor as unknown as { type?: { name?: string } }).type?.name;
    expect(TaskEditor.name || typeName).toBe('TaskEditor');
  });
});
