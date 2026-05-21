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
    // But React may append numbers in test environment (e.g., 'TaskEditor2')
    // Access type property through unknown to bypass TypeScript restriction
    const typeName = (TaskEditor as unknown as { type?: { name?: string } }).type?.name;
    const actualName = TaskEditor.name || typeName;
    // Accept 'TaskEditor' or variations like 'TaskEditor2', 'TaskEditor3', etc.
    expect(actualName).toMatch(/^TaskEditor[0-9]*$/);
  });
});
