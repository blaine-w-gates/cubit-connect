import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import { storageService } from '../../src/services/storage';
import { TaskItem } from '../../src/services/storage';

// Mock storageService
vi.mock('../../src/services/storage', () => ({
  storageService: {
    getProject: vi.fn(),
    saveProject: vi.fn(),
    clearProject: vi.fn(),
  },
}));

describe('Store Double Save Reproduction', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    // Reset store state
    await useAppStore.getState().resetProject();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('importTasks triggers only ONE save (Subscription only)', async () => {
    // FIX: Match TaskItemSchema structure
    const tasks: TaskItem[] = [
      {
        id: '1',
        task_name: 'Task 1',
        timestamp_seconds: 0,
        description: 'Test description',
        sub_steps: [],
        screenshot_base64: '' // Required by schema default? It's optional in Zod but inferred type might require it if not strict
      },
    ];

    // Call importTasks
    await useAppStore.getState().importTasks(tasks);

    // Expect NO immediate manual save
    expect(storageService.saveProject).toHaveBeenCalledTimes(0);

    // Fast-forward debounce time (500ms)
    vi.advanceTimersByTime(500);

    // Expect subscription save (Total 1)
    expect(storageService.saveProject).toHaveBeenCalledTimes(1);
  });

  it('loadProject with migration triggers only ONE save (Subscription only)', async () => {
    // Mock getProject to return legacy data requiring migration
    const legacyTasks = [
       {
         id: '1',
         task_name: 'Legacy Task', // FIX: 'text' -> 'task_name'
         timestamp_seconds: 0,
         description: 'Legacy Desc',
         sub_steps: ['Legacy Step 1'], // String array triggers migration
         screenshot_base64: ''
       }
    ];

    vi.mocked(storageService.getProject).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tasks: legacyTasks as any,
      transcript: undefined, // FIX: 'null' -> 'undefined'
      scoutResults: [],
      projectType: 'video',
      projectTitle: 'Legacy Project',
      scoutTopic: '',
      scoutPlatform: 'instagram',
      updatedAt: Date.now()
    });

    await useAppStore.getState().loadProject();

    // Expect NO immediate manual save
    expect(storageService.saveProject).toHaveBeenCalledTimes(0);

    // Fast-forward debounce time (500ms)
    vi.advanceTimersByTime(500);

    // Expect subscription save (Total 1)
    expect(storageService.saveProject).toHaveBeenCalledTimes(1);
  });
});
