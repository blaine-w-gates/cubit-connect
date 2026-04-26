/**
 * TaskFeed Component Tests
 *
 * @module TaskFeed.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('TaskFeed Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/TaskFeed');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: TaskFeed } = await import('@/components/TaskFeed');
    expect(typeof TaskFeed).toBe('function');
  });

  it('should have component name', async () => {
    const { default: TaskFeed } = await import('@/components/TaskFeed');
    expect(TaskFeed.name).toBe('TaskFeed');
  });
});
