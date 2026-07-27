/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Task Slice — To-do project/row management, task CRUD, deep steps, alarms.
 *
 * All actions interact with Yjs data structures via yjsContext.
 * Extracted from useAppStore.ts as part of store decomposition (#25).
 */

import * as Y from 'yjs';
import type { TaskItem, CubitStep, TodoRow, PriorityDials, TodoProject } from '@/services/storage';
import type { AlarmRecord, AlarmStatus } from '@/schemas/storage';
import { yjsContext } from '@/lib/yjsContext';
import {
  bindTodoProjectToYMap,
  bindTaskItemToYMap,
  bindTodoRowToYMap,
  bindCubitStepToYMap,
  bindAlarmToYMap,
  applyUpdateToYText,
  generateOrderKey,
} from '@/lib/yjsHelpers';

// Book Tab color palette — cycles through these for new projects
const TAB_COLORS = [
  '#F87171', '#FB923C', '#FBBF24', '#A3E635', '#34D399',
  '#22D3EE', '#818CF8', '#C084FC', '#F472B6', '#94A3B8',
];

export interface TaskSliceState {
  // --- To-Do Page State (Project-Scoped via Book Tabs) ---
  todoProjects: TodoProject[];
  activeProjectId: string | null;
  nextProjectNumber: number;
  todoRows: TodoRow[];
  priorityDials: PriorityDials;
  lastAddedRowId: string | null;

  // Project management actions (Book Tabs)
  addTodoProject: (name?: string) => void;
  setActiveProject: (projectId: string) => void;
  renameTodoProject: (projectId: string, name: string) => void;
  deleteTodoProject: (projectId: string) => void;
  changeProjectColor: (projectId: string, color: string) => void;
  reorderTodoProjects: (fromIdx: number, toIdx: number) => void;
  transferOwnership: (projectId: string, newOwnerId: string) => void;

  // Todo row actions (operate on active project)
  addTodoRow: (task?: string) => void;
  deleteTodoRow: (rowId: string) => void;
  updateTodoCell: (rowId: string, field: 'task' | 'step', value: string, stepIdx?: number) => void;
  moveTodoRowToBottom: (rowId: string) => void;
  reorderTodoRows: (fromIdx: number, toIdx: number) => void;
  setTodoSteps: (rowId: string, steps: [string, string, string, string]) => void;
  insertTodoRowAfter: (afterRowId: string, task: string, sourceStepId?: string) => string;
  setDialPriority: (side: 'left' | 'right', text: string) => void;
  setDialFocus: (side: 'left' | 'right' | 'none') => void;
  toggleTodoRowCompletion: (rowId: string) => void;
  completeStepsUpTo: (rowId: string, maxStepIdx: number) => void;
  restoreTodoRow: (row: TodoRow, index: number) => void;
  setLastAddedRowId: (rowId: string | null) => void;

  // Task CRUD (Cubit/Deep Dive)
  saveTask: (task: TaskItem) => Promise<void>;
  saveTasks: (tasks: TaskItem[]) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<TaskItem>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskExpansion: (taskId: string) => Promise<void>;
  addMicroSteps: (taskId: string, stepId: string, microSteps: string[]) => Promise<void>;
  updateDeepStep: (taskId: string, stepId: string, newText: string) => Promise<void>;
  toggleStepCompletion: (taskId: string, stepId: string) => Promise<void>;
  importTasks: (tasks: TaskItem[]) => Promise<void>;

  // Alarm System Actions (V1)
  createAlarm: (projectId: string, alarm: AlarmRecord) => void;
  updateAlarmStatus: (projectId: string, alarmId: string, status: AlarmStatus, updates?: Partial<AlarmRecord>) => void;
  deleteAlarm: (projectId: string, alarmId: string) => void;
}

export function createTaskSlice(
  set: (partial: any) => void,
  get: () => any
): TaskSliceState {
  return {
    // --- Initial State ---
    todoProjects: [],
    activeProjectId: null,
    nextProjectNumber: 1,
    todoRows: [],
    priorityDials: { left: '', right: '', focusedSide: 'none' as const },
    lastAddedRowId: null,

    // --- Book Tab Project Actions ---
    addTodoProject: (name?: string) => {
      const { todoProjects, nextProjectNumber, activeWorkspaceType, activeWorkspaceId, deviceId } = get();
      const colorIdx = (nextProjectNumber - 1) % TAB_COLORS.length;
      const slotNumber = todoProjects.length + 1;
      const newId = crypto.randomUUID();
      const newProject: TodoProject = {
        id: newId,
        name: name || `Project ${slotNumber}`,
        color: TAB_COLORS[colorIdx],
        todoRows: [],
        priorityDials: { left: '', right: '', focusedSide: 'none' as const },
        createdAt: Date.now(),
        orderKey: generateOrderKey(todoProjects.length > 0 ? todoProjects[todoProjects.length - 1].orderKey : undefined),
        workspaceType: activeWorkspaceType,
        workspaceId: activeWorkspaceId,
        ownerId: deviceId,
        alarms: [],
      };

      yjsContext.ydoc.transact(() => {
        yjsContext.yProjectsMap.set(newId, bindTodoProjectToYMap(newProject));
      });

      set({
        activeProjectId: newId,
        nextProjectNumber: nextProjectNumber + 1,
      });
    },

    setActiveProject: (projectId: string) => {
      const { todoProjects } = get();
      const project = todoProjects.find((p: TodoProject) => p.id === projectId);
      if (!project) return;
      set({
        activeProjectId: projectId,
        todoRows: project.todoRows,
        priorityDials: project.priorityDials,
      });
    },

    renameTodoProject: (projectId: string, name: string) => {
      const yProj = yjsContext.yProjectsMap.get(projectId);
      if (!yProj) return;
      yjsContext.ydoc.transact(() => {
        yProj.set('name', new Y.Text(name));
      });
    },

    deleteTodoProject: (projectId: string) => {
      const { todoProjects, activeProjectId } = get();
      yjsContext.ydoc.transact(() => {
        const yProj = yjsContext.yProjectsMap.get(projectId);
        if (yProj) yProj.set('isDeleted', true);
      });

      if (activeProjectId === projectId) {
        const filtered = todoProjects.filter((p: TodoProject) => p.id !== projectId);
        const next = filtered[0] || null;
        set({
          activeProjectId: next?.id || null,
          todoRows: next?.todoRows || [],
          priorityDials: next?.priorityDials || { left: '', right: '', focusedSide: 'none' as const },
        });
      }
    },

    reorderTodoProjects: (fromIdx: number, toIdx: number) => {
      const { todoProjects } = get();
      if (fromIdx < 0 || fromIdx >= todoProjects.length || toIdx < 0 || toIdx >= todoProjects.length) return;

      const movedProject = todoProjects[fromIdx];
      const prevProj = toIdx === 0 ? undefined : (fromIdx < toIdx ? todoProjects[toIdx] : todoProjects[toIdx - 1]);
      const nextProj = toIdx === todoProjects.length - 1 ? undefined : (fromIdx > toIdx ? todoProjects[toIdx] : todoProjects[toIdx + 1]);

      const newOrderKey = generateOrderKey(prevProj?.orderKey, nextProj?.orderKey);

      const yProj = yjsContext.yProjectsMap.get(movedProject.id);
      if (yProj) {
        yProj.set('orderKey', newOrderKey);
      }
    },

    changeProjectColor: (projectId: string, color: string) => {
      const yProj = yjsContext.yProjectsMap.get(projectId);
      if (yProj) {
        yProj.set('color', color);
      }
    },

    transferOwnership: (projectId: string, newOwnerId: string) => {
      const yProj = yjsContext.yProjectsMap.get(projectId);
      if (yProj) {
        yjsContext.ydoc.transact(() => {
          yProj.set('ownerId', newOwnerId);
        });
      }
    },

    // --- Todo Row Actions ---
    addTodoRow: (task = '') => {
      const { activeProjectId, todoRows } = get();
      if (!activeProjectId) return;

      const yProj = yjsContext.yProjectsMap.get(activeProjectId);
      if (!yProj) {
        console.error('addTodoRow: yProj not found for activeProjectId', activeProjectId);
        return;
      }

      const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
      const emptyStep = { text: '', isCompleted: false };

      const prevFirstKey = todoRows.length > 0 ? todoRows[0].orderKey : undefined;
      const orderKey = generateOrderKey(undefined, prevFirstKey);
      const newRowId = crypto.randomUUID();

      const newRow: TodoRow = {
        id: newRowId,
        task,
        steps: [{ ...emptyStep }, { ...emptyStep }, { ...emptyStep }, { ...emptyStep }],
        isCompleted: false,
        orderKey,
      };

      yjsContext.ydoc.transact(() => {
        yRows.set(newRow.id, bindTodoRowToYMap(newRow, orderKey));
      });

      set({ lastAddedRowId: newRowId });
    },

    deleteTodoRow: (rowId: string) => {
      const { activeProjectId } = get();
      if (!activeProjectId) return;
      const yProj = yjsContext.yProjectsMap.get(activeProjectId);
      if (!yProj) return;

      const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
      yjsContext.ydoc.transact(() => {
        const yRow = yRows.get(rowId);
        if (yRow) yRow.set('isDeleted', true);
      });
    },

    updateTodoCell: (rowId, field, value, stepIdx) => {
      const { activeProjectId } = get();
      if (!activeProjectId) return;
      const yProj = yjsContext.yProjectsMap.get(activeProjectId);
      if (!yProj) return;

      const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
      const yRow = yRows.get(rowId);
      if (!yRow) return;

      yjsContext.ydoc.transact(() => {
        if (field === 'task') {
          const yText = yRow.get('task') as Y.Text;
          applyUpdateToYText(yText, value);
        } else if (field === 'step' && stepIdx !== undefined) {
          const ySteps = yRow.get('steps') as Y.Array<Y.Map<any>>;
          const yStep = ySteps.get(stepIdx);
          if (yStep) {
            const yStepText = yStep.get('text') as Y.Text;
            applyUpdateToYText(yStepText, value);
          }
        }
      });
    },

    moveTodoRowToBottom: (rowId: string) => {
      const { activeProjectId, todoRows } = get();
      if (!activeProjectId || todoRows.length === 0) return;

      const yProj = yjsContext.yProjectsMap.get(activeProjectId);
      if (!yProj) return;

      const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
      const yRow = yRows.get(rowId);
      if (!yRow) return;

      if (todoRows[todoRows.length - 1].id === rowId) return;

      const lastKey = todoRows[todoRows.length - 1].orderKey;
      const newOrderKey = generateOrderKey(lastKey, undefined);

      yjsContext.ydoc.transact(() => {
        yRow.set('orderKey', newOrderKey);
      });
    },

    reorderTodoRows: (fromIdx: number, toIdx: number) => {
      const { activeProjectId, todoRows } = get();
      if (!activeProjectId) return;
      if (fromIdx < 0 || fromIdx >= todoRows.length || toIdx < 0 || toIdx >= todoRows.length) return;

      const yProj = yjsContext.yProjectsMap.get(activeProjectId);
      if (!yProj) return;

      const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
      const movedRow = todoRows[fromIdx];
      const yRow = yRows.get(movedRow.id);
      if (!yRow) return;

      const prevRow = toIdx === 0 ? undefined : (fromIdx < toIdx ? todoRows[toIdx] : todoRows[toIdx - 1]);
      const nextRow = toIdx === todoRows.length - 1 ? undefined : (fromIdx > toIdx ? todoRows[toIdx] : todoRows[toIdx + 1]);

      const newOrderKey = generateOrderKey(prevRow?.orderKey, nextRow?.orderKey);

      yjsContext.ydoc.transact(() => {
        yRow.set('orderKey', newOrderKey);
      });
    },

    setTodoSteps: (rowId: string, steps: [string, string, string, string]) => {
      const { activeProjectId } = get();
      if (!activeProjectId) return;
      const yProj = yjsContext.yProjectsMap.get(activeProjectId);
      if (!yProj) return;

      const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
      const yRow = yRows.get(rowId);
      if (!yRow) return;

      yjsContext.ydoc.transact(() => {
        const ySteps = yRow.get('steps') as Y.Array<Y.Map<any>>;
        steps.forEach((text, i) => {
          const yStep = ySteps.get(i);
          if (yStep) {
            const yStepText = yStep.get('text') as Y.Text;
            applyUpdateToYText(yStepText, text);
          }
        });
      });
    },

    insertTodoRowAfter: (afterRowId: string, task: string, sourceStepId?: string) => {
      const { activeProjectId, todoRows } = get();
      if (!activeProjectId) return '';
      const yProj = yjsContext.yProjectsMap.get(activeProjectId);
      if (!yProj) return '';

      const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;

      const idx = todoRows.findIndex((r: TodoRow) => r.id === afterRowId);
      const prevKey = idx >= 0 ? todoRows[idx].orderKey : undefined;
      const nextKey = idx >= 0 && idx < todoRows.length - 1 ? todoRows[idx + 1].orderKey : undefined;
      const orderKey = generateOrderKey(prevKey, nextKey);

      const newId = crypto.randomUUID();
      const emptyStep = { text: '', isCompleted: false };
      const newRow: TodoRow = {
        id: newId,
        task,
        steps: [{ ...emptyStep }, { ...emptyStep }, { ...emptyStep }, { ...emptyStep }],
        isCompleted: false,
        sourceStepId,
        orderKey,
      };

      yjsContext.ydoc.transact(() => {
        yRows.set(newId, bindTodoRowToYMap(newRow, orderKey));
      });

      set({ lastAddedRowId: newId });
      return newId;
    },

    setDialPriority: (side, text) => {
      const { activeProjectId } = get();
      if (!activeProjectId) return;
      const yProj = yjsContext.yProjectsMap.get(activeProjectId);
      if (!yProj) return;

      const yDials = yProj.get('priorityDials') as Y.Map<any>;
      if (!yDials) return;

      yjsContext.ydoc.transact(() => {
        const yText = yDials.get(side) as Y.Text;
        applyUpdateToYText(yText, text);
      });
    },

    setDialFocus: (side) => {
      const { activeProjectId } = get();
      if (!activeProjectId) return;
      const yProj = yjsContext.yProjectsMap.get(activeProjectId);
      if (!yProj) return;

      const yDials = yProj.get('priorityDials') as Y.Map<any>;
      if (!yDials) return;

      yjsContext.ydoc.transact(() => {
        yDials.set('focusedSide', side);
      });
    },

    toggleTodoRowCompletion: (rowId: string) => {
      const { activeProjectId } = get();
      if (!activeProjectId) return;
      const yProj = yjsContext.yProjectsMap.get(activeProjectId);
      if (!yProj) return;

      const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
      const yRow = yRows.get(rowId);
      if (!yRow) return;

      yjsContext.ydoc.transact(() => {
        yRow.set('isCompleted', !yRow.get('isCompleted'));
      });
    },

    completeStepsUpTo: (rowId: string, maxStepIdx: number) => {
      const { activeProjectId } = get();
      if (!activeProjectId) return;
      const yProj = yjsContext.yProjectsMap.get(activeProjectId);
      if (!yProj) return;

      const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
      const yRow = yRows.get(rowId);
      if (!yRow) return;

      yjsContext.ydoc.transact(() => {
        const ySteps = yRow.get('steps') as Y.Array<Y.Map<any>>;
        let populatedCount = 0;
        let completeCount = 0;

        for (let i = 0; i < ySteps.length; i++) {
          const yStep = ySteps.get(i);
          const textLen = (yStep.get('text') as Y.Text).length;
          if (textLen > 0) {
            populatedCount++;
            const shouldComplete = i <= maxStepIdx;
            yStep.set('isCompleted', shouldComplete);
            if (shouldComplete) completeCount++;
          } else {
            yStep.set('isCompleted', false);
          }
        }

        const rowCompleted = populatedCount > 0 && populatedCount === completeCount;
        yRow.set('isCompleted', rowCompleted);
      });
    },

    restoreTodoRow: (row: TodoRow, index: number) => {
      const { activeProjectId, todoRows } = get();
      if (!activeProjectId) return;
      const yProj = yjsContext.yProjectsMap.get(activeProjectId);
      if (!yProj) return;

      const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;

      const prevKey = index > 0 && index <= todoRows.length ? todoRows[index - 1].orderKey : undefined;
      const nextKey = index < todoRows.length ? todoRows[index].orderKey : undefined;
      const orderKey = generateOrderKey(prevKey, nextKey);

      yjsContext.ydoc.transact(() => {
        yRows.set(row.id, bindTodoRowToYMap({ ...row, orderKey }, orderKey));
      });
    },

    setLastAddedRowId: (rowId: string | null) => {
      set({ lastAddedRowId: rowId });
    },

    // --- Task CRUD (Cubit/Deep Dive) ---
    saveTask: async (task: TaskItem) => {
      yjsContext.ydoc.transact(() => {
        yjsContext.yTasksMap.set(task.id, bindTaskItemToYMap(task));
      });
    },

    saveTasks: async (newTasksList: TaskItem[]) => {
      yjsContext.ydoc.transact(() => {
        newTasksList.forEach(task => {
          yjsContext.yTasksMap.set(task.id, bindTaskItemToYMap(task));
        });
      });
    },

    updateTask: async (taskId: string, updates: Partial<TaskItem>) => {
      const yTask = yjsContext.yTasksMap.get(taskId);
      if (!yTask) return;

      yjsContext.ydoc.transact(() => {
        if (updates.task_name !== undefined) {
          applyUpdateToYText(yTask.get('task_name') as Y.Text, updates.task_name);
        }
        if (updates.description !== undefined) {
          applyUpdateToYText(yTask.get('description') as Y.Text, updates.description);
        }
        if (updates.timestamp_seconds !== undefined) {
          yTask.set('timestamp_seconds', updates.timestamp_seconds);
        }
        if (updates.screenshot_base64 !== undefined) {
          yTask.set('screenshot_base64', updates.screenshot_base64);
        }
        if (updates.isExpanded !== undefined) {
          yTask.set('isExpanded', updates.isExpanded);
        }
        if (updates.sub_steps !== undefined) {
          let ySubSteps = yTask.get('sub_steps') as Y.Array<Y.Map<any>>;
          if (!ySubSteps) {
            ySubSteps = new Y.Array<Y.Map<any>>();
            yTask.set('sub_steps', ySubSteps);
          } else {
            ySubSteps.delete(0, ySubSteps.length);
          }
          updates.sub_steps.forEach(step => {
            ySubSteps.push([bindCubitStepToYMap(step)]);
          });
        }
      });
    },

    deleteTask: async (taskId: string) => {
      yjsContext.ydoc.transact(() => {
        const yTaskObj = yjsContext.yTasksMap.get(taskId);
        if (yTaskObj) yTaskObj.set('isDeleted', true);
      });
    },

    toggleTaskExpansion: async (taskId: string) => {
      const yTask = yjsContext.yTasksMap.get(taskId);
      if (!yTask) return;
      yjsContext.ydoc.transact(() => {
        yTask.set('isExpanded', !yTask.get('isExpanded'));
      });
    },

    addMicroSteps: async (taskId: string, stepId: string, microSteps: string[]) => {
      const yTask = yjsContext.yTasksMap.get(taskId);
      if (!yTask) return;

      yjsContext.ydoc.transact(() => {
        const ySubList = yTask.get('sub_steps') as Y.Array<Y.Map<any>>;

        const findStep = (array: Y.Array<Y.Map<any>>, targetId: string): Y.Map<any> | null => {
          for (let i = 0; i < array.length; i++) {
            const s = array.get(i);
            if (Array.isArray(s)) return findStep(s[0].get('sub_steps'), targetId);

            if (s.get('id') === targetId) return s;
            const childSub = s.get('sub_steps') as Y.Array<Y.Map<any>>;
            if (childSub && childSub.length > 0) {
              const found = findStep(childSub, targetId);
              if (found) return found;
            }
          }
          return null;
        };

        const targetYStep = findStep(ySubList, stepId);
        if (targetYStep) {
          let childArray = targetYStep.get('sub_steps') as Y.Array<Y.Map<any>>;
          if (!childArray) {
            childArray = new Y.Array();
            targetYStep.set('sub_steps', childArray);
          }
          microSteps.forEach(text => {
            const fallback: CubitStep = { id: crypto.randomUUID(), text, sub_steps: [] };
            childArray.push([bindCubitStepToYMap(fallback)]);
          });
        }
      });
    },

    updateDeepStep: async (taskId: string, stepId: string, newText: string) => {
      const yTask = yjsContext.yTasksMap.get(taskId);
      if (!yTask) return;

      yjsContext.ydoc.transact(() => {
        const ySubList = yTask.get('sub_steps') as Y.Array<Y.Map<any>>;

        const updateStepTextRec = (array: Y.Array<Y.Map<any>>): boolean => {
          for (let i = 0; i < array.length; i++) {
            const s = array.get(i);
            if (Array.isArray(s)) { if (updateStepTextRec(s[0].get('sub_steps'))) return true; }
            else if (s.get('id') === stepId) {
              const yNodeText = s.get('text') as Y.Text;
              applyUpdateToYText(yNodeText, newText);
              return true;
            } else {
              const childSub = s.get('sub_steps') as Y.Array<Y.Map<any>>;
              if (childSub && childSub.length > 0) {
                if (updateStepTextRec(childSub)) return true;
              }
            }
          }
          return false;
        };

        updateStepTextRec(ySubList);
      });
    },

    toggleStepCompletion: async (taskId: string, stepId: string) => {
      const yTask = yjsContext.yTasksMap.get(taskId);
      if (!yTask) return;

      yjsContext.ydoc.transact(() => {
        const ySubList = yTask.get('sub_steps') as Y.Array<Y.Map<any>>;

        const toggleStepRec = (array: Y.Array<Y.Map<any>>): boolean => {
          for (let i = 0; i < array.length; i++) {
            const s = array.get(i);
            if (Array.isArray(s)) { if (toggleStepRec(s[0].get('sub_steps'))) return true; }
            else if (s.get('id') === stepId) {
              s.set('isCompleted', !s.get('isCompleted'));
              return true;
            } else {
              const childSub = s.get('sub_steps') as Y.Array<Y.Map<any>>;
              if (childSub && childSub.length > 0) {
                if (toggleStepRec(childSub)) return true;
              }
            }
          }
          return false;
        };

        toggleStepRec(ySubList);
      });
    },

    importTasks: async (newTasks: TaskItem[]) => {
      yjsContext.ydoc.transact(() => {
        Array.from(yjsContext.yTasksMap.keys()).forEach(k => {
          const yTask = yjsContext.yTasksMap.get(k);
          if (yTask) yTask.set('isDeleted', true);
        });

        newTasks.forEach(task => {
          yjsContext.yTasksMap.set(task.id, bindTaskItemToYMap(task));
        });
      });

      get().forceSyncUpdate();
    },

    // --- Alarm System Actions (V1) ---
    createAlarm: (projectId: string, alarm: AlarmRecord) => {
      const yProj = yjsContext.yProjectsMap.get(projectId);
      if (!yProj) return;

      yjsContext.ydoc.transact(() => {
        let yAlarms = yProj.get('alarms') as Y.Map<any>;
        if (!yAlarms) {
          yAlarms = new Y.Map();
          yProj.set('alarms', yAlarms);
        }
        yAlarms.set(alarm.id, bindAlarmToYMap(alarm));
      });
    },

    updateAlarmStatus: (projectId: string, alarmId: string, status: AlarmStatus, updates?: Partial<AlarmRecord>) => {
      const yProj = yjsContext.yProjectsMap.get(projectId);
      if (!yProj) return;

      const yAlarms = yProj.get('alarms') as Y.Map<any>;
      if (!yAlarms) return;

      const yAlarm = yAlarms.get(alarmId);
      if (!yAlarm) return;

      yjsContext.ydoc.transact(() => {
        yAlarm.set('status', status);
        if (updates?.alarmTimeMs !== undefined) {
          yAlarm.set('alarmTimeMs', updates.alarmTimeMs);
        }
        if (updates?.snoozeCount !== undefined) {
          yAlarm.set('snoozeCount', updates.snoozeCount);
        }
        if (updates?.originalAlarmTimeMs !== undefined) {
          yAlarm.set('originalAlarmTimeMs', updates.originalAlarmTimeMs);
        }
      });
    },

    deleteAlarm: (projectId: string, alarmId: string) => {
      const yProj = yjsContext.yProjectsMap.get(projectId);
      if (!yProj) return;

      const yAlarms = yProj.get('alarms') as Y.Map<any>;
      if (!yAlarms) return;

      yjsContext.ydoc.transact(() => {
        const yAlarm = yAlarms.get(alarmId);
        if (yAlarm) {
          yAlarm.set('isDeleted', true);
        }
      });
    },
  };
}
