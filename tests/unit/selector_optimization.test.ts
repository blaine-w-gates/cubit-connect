import { describe, it, expect, vi } from 'vitest';
import { TaskItem } from '@/services/storage';

// Mock state structure for the test
interface MockState {
  updateTask: () => void;
  updateDeepStep: () => void;
  toggleStepCompletion: () => void;
  activeProcessingId: string | null;
}

const mockActions = {
  updateTask: vi.fn(),
  updateDeepStep: vi.fn(),
  toggleStepCompletion: vi.fn(),
};

const createState = (activeId: string | null): MockState => ({
  ...mockActions,
  activeProcessingId: activeId,
});

// The current (BAD) selector
const currentSelector = (state: MockState) => ({
  updateTask: state.updateTask,
  updateDeepStep: state.updateDeepStep,
  toggleStepCompletion: state.toggleStepCompletion,
  activeProcessingId: state.activeProcessingId,
});

// The proposed (GOOD) selector
const createOptimizedSelector = (task: TaskItem) => (state: MockState) => {
  let relevantId: string | null = null;

  if (state.activeProcessingId === task.id) {
    relevantId = state.activeProcessingId;
  } else if (task.sub_steps?.some((step) => step.id === state.activeProcessingId)) {
    relevantId = state.activeProcessingId;
  }

  return {
    updateTask: state.updateTask,
    updateDeepStep: state.updateDeepStep,
    toggleStepCompletion: state.toggleStepCompletion,
    activeProcessingId: relevantId,
  };
};

describe('TaskEditor Selector Optimization', () => {
  const task: TaskItem = {
    id: 'task-1',
    task_name: 'Test Task',
    description: '',
    timestamp_seconds: 0,
    screenshot_base64: '',
    isExpanded: false,
    sub_steps: [
      { id: 'step-1', text: 'Step 1', sub_steps: [] },
      { id: 'step-2', text: 'Step 2', sub_steps: [] },
    ],
  };

  it('CURRENT selector returns different objects (triggering re-render) for unrelated processing IDs', () => {
    const stateA = createState('unrelated-task-99');
    const stateB = createState('unrelated-task-100');

    const resultA = currentSelector(stateA);
    const resultB = currentSelector(stateB);

    // Should be different because activeProcessingId is different
    expect(resultA.activeProcessingId).toBe('unrelated-task-99');
    expect(resultB.activeProcessingId).toBe('unrelated-task-100');
    expect(resultA).not.toEqual(resultB);

    // In zustand useShallow, this inequality triggers re-render
  });

  it('OPTIMIZED selector returns IDENTICAL objects (preventing re-render) for unrelated processing IDs', () => {
    const stateA = createState('unrelated-task-99');
    const stateB = createState('unrelated-task-100');

    const selector = createOptimizedSelector(task);
    const resultA = selector(stateA);
    const resultB = selector(stateB);

    // Should both be null
    expect(resultA.activeProcessingId).toBeNull();
    expect(resultB.activeProcessingId).toBeNull();

    // Objects should be equal (assuming actions are stable references)
    expect(resultA).toEqual(resultB);
  });

  it('OPTIMIZED selector correctly passes through RELEVANT processing IDs', () => {
    const stateTask = createState('task-1');
    const stateStep = createState('step-1');

    const selector = createOptimizedSelector(task);

    const resultTask = selector(stateTask);
    expect(resultTask.activeProcessingId).toBe('task-1');

    const resultStep = selector(stateStep);
    expect(resultStep.activeProcessingId).toBe('step-1');
  });
});
