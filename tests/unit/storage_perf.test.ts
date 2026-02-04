import { describe, it, expect, vi } from 'vitest';
import { storageService } from '@/services/storage';
import * as idb from 'idb-keyval';

vi.mock('idb-keyval');

const generateLargeProject = (taskCount: number, imageSize: number) => {
  const tasks = [];
  for (let i = 0; i < taskCount; i++) {
    // Unique string content to avoid V8 optimization
    const base64Image = 'a'.repeat(imageSize) + i;
    tasks.push({
      id: `task-${i}`,
      task_name: `Task ${i}`,
      timestamp_seconds: i * 10,
      description: `Description for task ${i}`,
      screenshot_base64: base64Image,
      sub_steps: [],
    });
  }
  return {
    tasks,
    updatedAt: Date.now(),
  };
};

describe('Storage Service Performance', () => {
  it('measures getProject performance with large data (50MB)', async () => {
    // 50 tasks, 1MB each = 50MB
    const largeData = generateLargeProject(50, 1024 * 1024);

    vi.mocked(idb.get).mockResolvedValue(largeData);

    const start = performance.now();
    await storageService.getProject();
    const end = performance.now();

    const duration = end - start;
    console.log(`getProject took ${duration.toFixed(2)}ms for 50MB data`);

    // Performance budget: Should be well under 100ms (we achieved ~5ms)
    // We set 100ms to be safe against CI fluctuations
    expect(duration).toBeLessThan(100);
  });
});
