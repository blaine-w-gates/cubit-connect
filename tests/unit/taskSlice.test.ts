/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTaskSlice, type TaskSliceState } from '@/store/slices/taskSlice';

// Mock yjsContext to avoid touching real Yjs state
vi.mock('@/lib/yjsContext', () => {
  const mockMap = {
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(() => false),
    keys: vi.fn(() => []),
    values: vi.fn(() => []),
    size: 0,
    observeDeep: vi.fn(),
  };
  return {
    yjsContext: {
      ydoc: { transact: vi.fn((fn: () => void) => fn()) },
      yProjectsMap: mockMap,
      yTasksMap: mockMap,
      yMetaMap: mockMap,
      yTranscript: { toString: vi.fn(() => ''), delete: vi.fn() },
      syncManager: null,
      idleCheckpointTimer: null,
    },
  };
});

// Mock yjsHelpers
vi.mock('@/lib/yjsHelpers', () => ({
  bindTodoProjectToYMap: vi.fn((p: unknown) => p),
  bindTaskItemToYMap: vi.fn((t: unknown) => t),
  bindTodoRowToYMap: vi.fn((r: unknown) => r),
  bindCubitStepToYMap: vi.fn((s: unknown) => s),
  bindAlarmToYMap: vi.fn((a: unknown) => a),
  applyUpdateToYText: vi.fn(),
  generateOrderKey: vi.fn(() => 'mock-order-key'),
}));

describe('taskSlice', () => {
  let set: (partial: any) => void;
  let get: () => any;
  let slice: TaskSliceState;

  beforeEach(() => {
    set = vi.fn() as any;
    get = vi.fn(() => ({
      todoProjects: [],
      activeProjectId: null,
      todoRows: [],
      nextProjectNumber: 1,
      activeWorkspaceType: 'personalUno',
      activeWorkspaceId: 'test-ws',
      deviceId: 'test-device',
      forceSyncUpdate: vi.fn(),
    })) as any;
    slice = createTaskSlice(set, get);
  });

  describe('initial state', () => {
    it('returns correct default values', () => {
      expect(slice.todoProjects).toEqual([]);
      expect(slice.activeProjectId).toBeNull();
      expect(slice.nextProjectNumber).toBe(1);
      expect(slice.todoRows).toEqual([]);
      expect(slice.priorityDials).toEqual({ left: '', right: '', focusedSide: 'none' });
      expect(slice.lastAddedRowId).toBeNull();
    });
  });

  describe('action keys', () => {
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

    it.each(expectedActions)('exposes %s as a function', (key) => {
      expect(typeof (slice as unknown as Record<string, unknown>)[key]).toBe('function');
    });
  });

  describe('setLastAddedRowId', () => {
    it('calls set with the rowId', () => {
      slice.setLastAddedRowId('row-123');
      expect(set).toHaveBeenCalledWith({ lastAddedRowId: 'row-123' });
    });

    it('calls set with null', () => {
      slice.setLastAddedRowId(null);
      expect(set).toHaveBeenCalledWith({ lastAddedRowId: null });
    });
  });

  describe('setActiveProject', () => {
    it('does nothing if project not found', () => {
      get = vi.fn(() => ({ todoProjects: [], activeProjectId: null })) as any;
      slice = createTaskSlice(set, get);
      slice.setActiveProject('nonexistent');
      expect(set).not.toHaveBeenCalled();
    });

    it('sets active project, todoRows, and priorityDials when found', () => {
      const mockProject = {
        id: 'proj-1',
        todoRows: [{ id: 'row-1', task: 'test', steps: [], isCompleted: false, orderKey: 'a' }],
        priorityDials: { left: 'L', right: 'R', focusedSide: 'left' as const },
      };
      get = vi.fn(() => ({ todoProjects: [mockProject], activeProjectId: null })) as any;
      slice = createTaskSlice(set, get);
      slice.setActiveProject('proj-1');
      expect(set).toHaveBeenCalledWith({
        activeProjectId: 'proj-1',
        todoRows: mockProject.todoRows,
        priorityDials: mockProject.priorityDials,
      });
    });
  });

  describe('addTodoRow', () => {
    it('does nothing when no active project', () => {
      get = vi.fn(() => ({ activeProjectId: null, todoRows: [] })) as any;
      slice = createTaskSlice(set, get);
      slice.addTodoRow('new task');
      expect(set).not.toHaveBeenCalled();
    });
  });

  describe('deleteTodoRow', () => {
    it('does nothing when no active project', () => {
      get = vi.fn(() => ({ activeProjectId: null })) as any;
      slice = createTaskSlice(set, get);
      slice.deleteTodoRow('row-1');
      expect(set).not.toHaveBeenCalled();
    });
  });

  describe('importTasks', () => {
    it('calls forceSyncUpdate after importing', async () => {
      const forceSyncUpdate = vi.fn();
      get = vi.fn(() => ({ forceSyncUpdate })) as any;
      slice = createTaskSlice(set, get);

      const { yjsContext } = await import('@/lib/yjsContext');
      (yjsContext.yTasksMap.keys as ReturnType<typeof vi.fn>).mockReturnValue([]);

      await slice.importTasks([]);
      expect(forceSyncUpdate).toHaveBeenCalled();
    });
  });
});
