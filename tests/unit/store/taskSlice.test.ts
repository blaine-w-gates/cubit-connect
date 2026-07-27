/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock yjsContext before importing taskSlice
vi.mock('@/lib/yjsContext', () => ({
  yjsContext: {
    ydoc: { transact: (fn: () => void) => fn() },
    yProjectsMap: new Map(),
    yTasksMap: new Map(),
    yMetaMap: new Map(),
    yTranscript: { toString: () => '', delete: () => {} },
  },
}));

// Mock yjsHelpers
vi.mock('@/lib/yjsHelpers', () => ({
  bindTodoProjectToYMap: vi.fn(() => ({})),
  bindTaskItemToYMap: vi.fn(() => ({})),
  bindTodoRowToYMap: vi.fn(() => ({})),
  bindCubitStepToYMap: vi.fn(() => ({})),
  bindAlarmToYMap: vi.fn(() => ({})),
  applyUpdateToYText: vi.fn(),
  generateOrderKey: vi.fn(() => 'key-0'),
}));

import { createTaskSlice } from '@/store/slices/taskSlice';
import type { TaskSliceState } from '@/store/slices/taskSlice';

describe('taskSlice smoke tests', () => {
  let set: any;
  let get: any;
  let slice: TaskSliceState;

  beforeEach(() => {
    const state: Record<string, any> = {};
    set = (partial: any) => {
      if (typeof partial === 'function') {
        Object.assign(state, partial(state));
      } else {
        Object.assign(state, partial);
      }
    };
    get = () => state;
    slice = createTaskSlice(set, get);
  });

  it('returns all expected action keys', () => {
    const expectedActions = [
      'addTodoProject',
      'setActiveProject',
      'renameTodoProject',
      'deleteTodoProject',
      'changeProjectColor',
      'reorderTodoProjects',
      'transferOwnership',
      'addTodoRow',
      'deleteTodoRow',
      'updateTodoCell',
      'moveTodoRowToBottom',
      'reorderTodoRows',
      'setTodoSteps',
      'insertTodoRowAfter',
      'setDialPriority',
      'setDialFocus',
      'toggleTodoRowCompletion',
      'completeStepsUpTo',
      'restoreTodoRow',
      'setLastAddedRowId',
      'saveTask',
      'saveTasks',
      'updateTask',
      'deleteTask',
      'toggleTaskExpansion',
      'addMicroSteps',
      'updateDeepStep',
      'toggleStepCompletion',
      'importTasks',
      'createAlarm',
      'updateAlarmStatus',
      'deleteAlarm',
    ];

    for (const key of expectedActions) {
      expect(slice, `Missing action: ${key}`).toHaveProperty(key);
      expect(typeof (slice as any)[key], `${key} should be a function`).toBe('function');
    }
  });

  it('returns all expected initial state values', () => {
    const expectedState = [
      'todoProjects',
      'activeProjectId',
      'nextProjectNumber',
      'todoRows',
      'priorityDials',
      'lastAddedRowId',
    ];

    for (const key of expectedState) {
      expect(slice, `Missing state: ${key}`).toHaveProperty(key);
    }

    expect(slice.todoProjects).toEqual([]);
    expect(slice.activeProjectId).toBeNull();
    expect(slice.nextProjectNumber).toBe(1);
    expect(slice.todoRows).toEqual([]);
    expect(slice.lastAddedRowId).toBeNull();
    expect(slice.priorityDials).toEqual({ left: '', right: '', focusedSide: 'none' });
  });

  it('setLastAddedRowId updates state', () => {
    slice.setLastAddedRowId('row-123');
    expect(get().lastAddedRowId).toBe('row-123');

    slice.setLastAddedRowId(null);
    expect(get().lastAddedRowId).toBeNull();
  });
});
