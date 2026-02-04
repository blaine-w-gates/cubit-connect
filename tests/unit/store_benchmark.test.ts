import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { TaskItem, storageService } from '@/services/storage';

// Mock storage service to avoid side effects
vi.mock('@/services/storage', () => ({
  storageService: {
    saveProject: vi.fn(),
    getProject: vi.fn().mockResolvedValue({ tasks: [] }),
    clearProject: vi.fn(),
  },
}));

// Mock localStorage for apiKey
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Store Performance Benchmark', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    // Reset store
    await useAppStore.getState().resetProject();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const taskCount = 10000;
  const tasks: TaskItem[] = Array.from({ length: taskCount }, (_, i) => ({
    id: `task-${i}`,
    task_name: `Task ${i}`,
    timestamp_seconds: i,
    description: `Description ${i}`,
    screenshot_base64: '',
    sub_steps: [],
  }));

  it('measures performance of adding tasks sequentially', async () => {
    const startTime = performance.now();

    // Simulate VideoInput.tsx loop
    for (const task of tasks) {
      await useAppStore.getState().saveTask(task);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(
      `\n\n[BASELINE] Time to add ${taskCount} tasks sequentially: ${duration.toFixed(2)}ms\n`,
    );

    expect(useAppStore.getState().tasks).toHaveLength(taskCount);
  });

  it('measures performance of adding tasks via batch saveTasks and verifies persistence', async () => {
    const startTime = performance.now();

    await useAppStore.getState().saveTasks(tasks);

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(
      `\n\n[OPTIMIZED] Time to add ${taskCount} tasks via batch: ${duration.toFixed(2)}ms\n`,
    );

    expect(useAppStore.getState().tasks).toHaveLength(taskCount);

    // Verify persistence (Debounced by 500ms)
    vi.advanceTimersByTime(600);
    expect(storageService.saveProject).toHaveBeenCalled();
  });
});
