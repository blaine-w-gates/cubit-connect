import { create } from 'zustand';
import { storageService, TaskItem, CubitStep, TodoRow, PriorityDials, TodoProject, TodoStep, StoredProjectData } from '@/services/storage';
import { GeminiEvents, GeminiService } from '@/services/gemini';
import { cryptoUtils } from '@/lib/crypto';
import * as Y from 'yjs';
import {
  bindTodoProjectToYMap,
  extractTodoProjectFromYMap,
  bindTaskItemToYMap,
  extractTaskItemFromYMap,
  sortYMapList,
  generateOrderKey,
  bindTodoRowToYMap,
  bindCubitStepToYMap,
  applyUpdateToYText,
} from '../lib/yjsHelpers';
import { NetworkSync } from '@/lib/networkSync';

// --- headless Yjs Core ---
// Required for E2EE environments so devices deeply-offline don't lose tombstones
export const ydoc = new Y.Doc({ gc: false });

export const yProjectsMap = ydoc.getMap<Y.Map<any>>('projects');
export const yTasksMap = ydoc.getMap<Y.Map<any>>('tasks');
// -------------------------

// Book Tab color palette — cycles through these for new projects
const TAB_COLORS = [
  '#F87171', '#FB923C', '#FBBF24', '#A3E635', '#34D399',
  '#22D3EE', '#818CF8', '#C084FC', '#F472B6', '#94A3B8',
];

export interface ProjectState {
  apiKey: string;
  setApiKey: (key: string) => void;
  isHydrated: boolean; // New: Hydration Guard
  hasVideoHandle: boolean;
  isProcessing: boolean;
  tasks: TaskItem[];
  transcript: string | null; // New state
  scoutResults: string[];
  scoutHistory: string[]; // New: Scout feature persistence
  projectType: 'video' | 'text'; // New: MVP Text Mode
  projectTitle: string; // New: Title Persistence

  // Strike 17.5: Global Input Mode & Scout Persistence
  inputMode: 'video' | 'text' | 'scout';
  setInputMode: (mode: 'video' | 'text' | 'scout') => void;
  scoutTopic: string;
  setScoutTopic: (topic: string) => void;
  scoutPlatform: string; // 'instagram' | 'reddit' | 'tiktok' | etc
  setScoutPlatform: (platform: string) => void;

  activeProcessingId: string | null; // Electric UI
  setActiveProcessingId: (id: string | null) => void;

  // UI State
  isSettingsOpen: boolean;
  settingsVariant: 'default' | 'quota';
  setIsSettingsOpen: (isOpen: boolean, variant?: 'default' | 'quota') => void;

  // New Sync Modal State
  isSyncModalOpen: boolean;
  setIsSyncModalOpen: (isOpen: boolean) => void;

  // Actions
  setVideoHandleState: (hasHandle: boolean) => void;
  loadProject: () => Promise<void>;
  saveTask: (task: TaskItem) => Promise<void>;
  saveTasks: (tasks: TaskItem[]) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<TaskItem>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  resetProject: () => Promise<void>;
  fullLogout: () => Promise<void>;
  importTasks: (tasks: TaskItem[]) => Promise<void>;
  setProcessing: (isProcessing: boolean) => void;
  addMicroSteps: (taskId: string, stepId: string, microSteps: string[]) => Promise<void>;
  updateDeepStep: (taskId: string, stepId: string, newText: string) => Promise<void>;
  toggleStepCompletion: (taskId: string, stepId: string) => Promise<void>; // New Action
  toggleTaskExpansion: (taskId: string) => Promise<void>; // New Persistence
  setTranscript: (text: string) => Promise<void>; // New action
  setScoutResults: (results: string[]) => Promise<void>;
  addToScoutHistory: (topic: string) => void;
  setProjectType: (type: 'video' | 'text') => Promise<void>;
  setProjectTitle: (title: string) => Promise<void>;
  startTextProject: (title: string, text: string) => Promise<void>;

  // Log Persistence
  logs: LogEntry[];
  addLog: (message: string) => void;
  clearLogs: () => void;

  // --- To-Do Page State (Project-Scoped via Book Tabs) ---
  todoProjects: TodoProject[];
  activeProjectId: string | null;
  nextProjectNumber: number; // monotonic — never decrements on delete
  // Derived getters — resolve from active project (backwards-compatible with TodoTable/PriorityDials)
  todoRows: TodoRow[];
  priorityDials: PriorityDials;
  activeMode: 'cubit' | 'deepDive' | 'dialLeft' | 'dialRight' | null; // UI-only state — NOT persisted
  setActiveMode: (mode: 'cubit' | 'deepDive' | 'dialLeft' | 'dialRight' | null) => void;
  processingRowId: string | null; // UI-only state — NOT persisted
  setProcessingRowId: (rowId: string | null) => void;
  // Project management actions (Book Tabs)
  addTodoProject: (name?: string) => void;
  setActiveProject: (projectId: string) => void;
  renameTodoProject: (projectId: string, name: string) => void;
  deleteTodoProject: (projectId: string) => void;
  changeProjectColor: (projectId: string, color: string) => void;
  reorderTodoProjects: (fromIdx: number, toIdx: number) => void;
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


  // --- Network Sync Actions & State ---
  syncStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  roomFingerprint: string | null;
  connectToSyncServer: (passphrase: string) => Promise<void>;
  disconnectSyncServer: () => void;
}

export interface LogEntry {
  id: string;
  message: string;
  timestamp: string;
}



const STORAGE_KEY_API = 'cubit_api_key';

// MIGRATION MUTEX: Prevents React.StrictMode from double-booting legacy JSON into Yjs
let isMigrating = false;

// E2EE WEBSOCKET MANAGER
let networkSync: NetworkSync | null = null;
const SYNC_SERVER_URL = process.env.NEXT_PUBLIC_SYNC_SERVER_URL || 'wss://cubit-connect.onrender.com';
let idleCheckpointTimer: NodeJS.Timeout | null = null;

export const useAppStore = create<ProjectState>((set, get) => ({
  // Initial State
  apiKey:
    typeof window !== 'undefined'
      ? cryptoUtils.decrypt(localStorage.getItem(STORAGE_KEY_API) || '')
      : '',
  setApiKey: (key: string) => {
    const safeKey = cryptoUtils.cleanInput(key);
    const encrypted = cryptoUtils.encrypt(safeKey);
    localStorage.setItem(STORAGE_KEY_API, encrypted);
    GeminiService.resetState();
    set({ apiKey: safeKey });
  },
  isHydrated: false,
  hasVideoHandle: false, // Default: Force re-selection on reload
  isProcessing: false,
  tasks: [],
  transcript: null,
  scoutResults: [],
  scoutHistory: [],
  projectType: 'video', // Default
  projectTitle: 'New Project', // Default

  // Strike 17.5: Defaults
  inputMode: 'video',
  setInputMode: (mode) => set({ inputMode: mode }),
  scoutTopic: '',
  setScoutTopic: (topic) => set({ scoutTopic: topic }),
  scoutPlatform: 'instagram',
  setScoutPlatform: (platform) => set({ scoutPlatform: platform }),
  addToScoutHistory: (topic: string) =>
    set((state) => {
      const current = state.scoutHistory;
      if (!topic.trim()) return state;
      const filtered = current.filter((t) => t !== topic);
      const updated = [topic, ...filtered].slice(0, 5);
      return { scoutHistory: updated };
    }),

  // --- To-Do Page State (Project-Scoped) ---
  todoProjects: [],
  activeProjectId: null,
  nextProjectNumber: 1, // starts at 1; only ever goes up
  // Derived getters — resolved from active project
  todoRows: [],
  priorityDials: { left: '', right: '', focusedSide: 'none' as const },
  activeMode: null,
  setActiveMode: (mode) => set({ activeMode: mode }),
  processingRowId: null,
  setProcessingRowId: (rowId) => set({ processingRowId: rowId }),

  // --- Network Sync Actions & State ---
  syncStatus: 'disconnected',
  roomFingerprint: null,

  // --- Book Tab Project Actions ---
  addTodoProject: (name?: string) => {
    const { todoProjects, nextProjectNumber } = get();
    // Name = slot position (current count + 1), Color = monotonic counter cycle
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
    };

    // Mutate Yjs Data Structure
    ydoc.transact(() => {
      yProjectsMap.set(newId, bindTodoProjectToYMap(newProject));
    });

    // Update the local pointers for UI interaction
    set({
      activeProjectId: newId,
      nextProjectNumber: nextProjectNumber + 1,
    });
  },

  setActiveProject: (projectId: string) => {
    const { todoProjects } = get();
    const project = todoProjects.find((p) => p.id === projectId);
    if (!project) return;
    set({
      activeProjectId: projectId,
      todoRows: project.todoRows,
      priorityDials: project.priorityDials,
    });
  },

  renameTodoProject: (projectId: string, name: string) => {
    const yProj = yProjectsMap.get(projectId);
    if (!yProj) return;
    ydoc.transact(() => {
      yProj.set('name', new Y.Text(name));
    });
  },

  deleteTodoProject: (projectId: string) => {
    const { todoProjects, activeProjectId } = get();
    // Explicit Tombstones prevent orphaned items when offline architectures collide
    ydoc.transact(() => {
      const yProj = yProjectsMap.get(projectId);
      if (yProj) yProj.set('isDeleted', true);
    });

    // Update active project locally if we deleted the open tab
    if (activeProjectId === projectId) {
      const filtered = todoProjects.filter((p) => p.id !== projectId);
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

    // Calculate new fractional index
    const movedProject = todoProjects[fromIdx];
    const prevProj = toIdx === 0 ? undefined : (fromIdx < toIdx ? todoProjects[toIdx] : todoProjects[toIdx - 1]);
    const nextProj = toIdx === todoProjects.length - 1 ? undefined : (fromIdx > toIdx ? todoProjects[toIdx] : todoProjects[toIdx + 1]);

    const newOrderKey = generateOrderKey(prevProj?.orderKey, nextProj?.orderKey);

    const yProj = yProjectsMap.get(movedProject.id);
    if (yProj) {
      yProj.set('orderKey', newOrderKey); // Emits change, triggers React sort
    }
  },

  changeProjectColor: (projectId: string, color: string) => {
    const yProj = yProjectsMap.get(projectId);
    if (yProj) {
      yProj.set('color', color);
    }
  },

  // Helper pattern: all row mutations update both todoRows AND the matching project in todoProjects

  addTodoRow: (task = '') => {
    const { activeProjectId, todoRows } = get();
    if (!activeProjectId) return;

    const yProj = yProjectsMap.get(activeProjectId);
    if (!yProj) return;

    const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
    const emptyStep = { text: '', isCompleted: false };

    // Sort ordering: put new item at the top (before the first item)
    const prevFirstKey = todoRows.length > 0 ? todoRows[0].orderKey : undefined;
    const orderKey = generateOrderKey(undefined, prevFirstKey);

    const newRow: TodoRow = {
      id: crypto.randomUUID(),
      task,
      steps: [{ ...emptyStep }, { ...emptyStep }, { ...emptyStep }, { ...emptyStep }],
      isCompleted: false,
      orderKey,
    };

    ydoc.transact(() => {
      yRows.set(newRow.id, bindTodoRowToYMap(newRow, orderKey));
    });
  },

  deleteTodoRow: (rowId: string) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    const yProj = yProjectsMap.get(activeProjectId);
    if (!yProj) return;

    const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
    ydoc.transact(() => {
      const yRow = yRows.get(rowId);
      if (yRow) yRow.set('isDeleted', true);
    });
  },

  updateTodoCell: (rowId, field, value, stepIdx) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    const yProj = yProjectsMap.get(activeProjectId);
    if (!yProj) return;

    const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
    const yRow = yRows.get(rowId);
    if (!yRow) return;

    ydoc.transact(() => {
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

    const yProj = yProjectsMap.get(activeProjectId);
    if (!yProj) return;

    const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
    const yRow = yRows.get(rowId);
    if (!yRow) return;

    // Fractional Indexing: To move to bottom, we generate a key *after* the current last item
    // Wait, if IT is the last item, do nothing
    if (todoRows[todoRows.length - 1].id === rowId) return;

    const lastKey = todoRows[todoRows.length - 1].orderKey;
    const newOrderKey = generateOrderKey(lastKey, undefined);

    ydoc.transact(() => {
      yRow.set('orderKey', newOrderKey);
    });
  },

  reorderTodoRows: (fromIdx: number, toIdx: number) => {
    const { activeProjectId, todoRows } = get();
    if (!activeProjectId) return;
    if (fromIdx < 0 || fromIdx >= todoRows.length || toIdx < 0 || toIdx >= todoRows.length) return;

    const yProj = yProjectsMap.get(activeProjectId);
    if (!yProj) return;

    const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
    const movedRow = todoRows[fromIdx];
    const yRow = yRows.get(movedRow.id);
    if (!yRow) return;

    // Calculate new fractional index
    const prevRow = toIdx === 0 ? undefined : (fromIdx < toIdx ? todoRows[toIdx] : todoRows[toIdx - 1]);
    const nextRow = toIdx === todoRows.length - 1 ? undefined : (fromIdx > toIdx ? todoRows[toIdx] : todoRows[toIdx + 1]);

    const newOrderKey = generateOrderKey(prevRow?.orderKey, nextRow?.orderKey);

    ydoc.transact(() => {
      yRow.set('orderKey', newOrderKey);
    });
  },

  setTodoSteps: (rowId: string, steps: [string, string, string, string]) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    const yProj = yProjectsMap.get(activeProjectId);
    if (!yProj) return;

    const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
    const yRow = yRows.get(rowId);
    if (!yRow) return;

    ydoc.transact(() => {
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
    const yProj = yProjectsMap.get(activeProjectId);
    if (!yProj) return '';

    const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;

    // Find index to calculate order key
    const idx = todoRows.findIndex((r) => r.id === afterRowId);
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

    ydoc.transact(() => {
      yRows.set(newId, bindTodoRowToYMap(newRow, orderKey));
    });

    return newId;
  },

  setDialPriority: (side, text) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    const yProj = yProjectsMap.get(activeProjectId);
    if (!yProj) return;

    const yDials = yProj.get('priorityDials') as Y.Map<any>;
    if (!yDials) return;

    ydoc.transact(() => {
      const yText = yDials.get(side) as Y.Text;
      applyUpdateToYText(yText, text);
    });
  },

  setDialFocus: (side) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    const yProj = yProjectsMap.get(activeProjectId);
    if (!yProj) return;

    const yDials = yProj.get('priorityDials') as Y.Map<any>;
    if (!yDials) return;

    ydoc.transact(() => {
      yDials.set('focusedSide', side);
    });
  },

  toggleTodoRowCompletion: (rowId: string) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    const yProj = yProjectsMap.get(activeProjectId);
    if (!yProj) return;

    const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
    const yRow = yRows.get(rowId);
    if (!yRow) return;

    ydoc.transact(() => {
      yRow.set('isCompleted', !yRow.get('isCompleted'));
    });
  },

  completeStepsUpTo: (rowId: string, maxStepIdx: number) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    const yProj = yProjectsMap.get(activeProjectId);
    if (!yProj) return;

    const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;
    const yRow = yRows.get(rowId);
    if (!yRow) return;

    ydoc.transact(() => {
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
    const yProj = yProjectsMap.get(activeProjectId);
    if (!yProj) return;

    const yRows = yProj.get('todoRows') as Y.Map<Y.Map<any>>;

    const prevKey = index > 0 && index <= todoRows.length ? todoRows[index - 1].orderKey : undefined;
    const nextKey = index < todoRows.length ? todoRows[index].orderKey : undefined;
    const orderKey = generateOrderKey(prevKey, nextKey);

    ydoc.transact(() => {
      yRows.set(row.id, bindTodoRowToYMap({ ...row, orderKey }, orderKey));
    });
  },

  // --- Network Sync Actions ---
  connectToSyncServer: async (passphrase: string) => {
    const { isHydrated } = get();
    // Architectural Mandate: Genesis Hydration Lock
    if (!isHydrated) {
      console.warn("E2EE Sync Blocked: Cannot connect to relay before local IndexedDB establishes genesis state.");
      return;
    }

    set({ syncStatus: 'connecting', roomFingerprint: null });

    try {
      if (!networkSync) {
        // 1. Salted Single-Secret UX (Routing Security)
        // Turbopack strictly requires relative paths for dynamic imports in some configurations
        const { deriveRoomId, deriveSyncKey } = await import('../lib/cryptoSync');
        const roomIdHash = await deriveRoomId(passphrase);
        const syncKey = await deriveSyncKey(passphrase);

        // 2. The Fingerprint for UI Verification (Solitary Universe Trap)
        const roomFingerprint = roomIdHash.slice(0, 4).toUpperCase();
        set({ roomFingerprint });

        networkSync = new NetworkSync(ydoc, SYNC_SERVER_URL, roomIdHash, (status) => {
          set({ syncStatus: status });
        });

        // UI Race Condition Patch: Await the onopen Promise directly
        await networkSync.connect(syncKey);
      }
    } catch (err) {
      console.error("Failed to connect to E2EE Relay:", err);
      set({ syncStatus: 'error', roomFingerprint: null });
    }
  },

  disconnectSyncServer: () => {
    if (networkSync) {
      networkSync.disconnect();
      networkSync = null;
    }
    set({ syncStatus: 'disconnected', roomFingerprint: null });
  },

  // Actions
  toggleTaskExpansion: async (taskId: string) => {
    const yTask = yTasksMap.get(taskId);
    if (!yTask) return;
    ydoc.transact(() => {
      yTask.set('isExpanded', !yTask.get('isExpanded'));
    });
  },

  logs: [],

  // Actions
  setVideoHandleState: (hasHandle: boolean) => {
    set({ hasVideoHandle: hasHandle });
  },

  loadProject: async () => {
    // Guard: Don't re-fetch if already hydrated (prevents redundant IDB reads on navigation)
    if (get().isHydrated) return;

    const data = await storageService.getProject();

    // --- MIGRATION LAYER ---
    // Detects legacy string[] sub_steps and converts to CubitStep[] objects
    const migratedTasks = data.tasks.map((task: unknown) => {
      const t = task as TaskItem; // Assume current structure but verify

      // Safety check: Does it have sub_steps?
      if (t.sub_steps && Array.isArray(t.sub_steps) && t.sub_steps.length > 0) {
        // Heuristic: Is the first item a simple string? (Level 2 Migration)
        // We cast to 'any' purely for the check because Typescript expects strict CubitStep[]
        if (typeof (t.sub_steps[0] as unknown) === 'string') {
          if (process.env.NODE_ENV === 'development')
            console.warn(`Migrating Legacy Task [${t.task_name}] to Recursive Schema`);
          const legacySteps = t.sub_steps as unknown as string[];
          const newSubSteps: CubitStep[] = legacySteps.map((text: string) => ({
            id: crypto.randomUUID(),
            text: text,
            sub_steps: [],
          }));
          return { ...t, sub_steps: newSubSteps };
        }

        // Level 3 Migration: Check if sub_steps have sub_steps that are strings
        const updatedSubSteps = t.sub_steps.map((subStep: CubitStep) => {
          if (subStep.sub_steps && subStep.sub_steps.length > 0) {
            const firstChild = subStep.sub_steps[0] as unknown;
            if (typeof firstChild === 'string') {
              if (process.env.NODE_ENV === 'development')
                console.warn(`Migrating Legacy Level 3 [${subStep.text}] to Objects`);

              // Convert ["Micro A", "Micro B"] -> [{id, text, sub_steps: []}, ...]
              const legacyMicro = subStep.sub_steps as unknown as string[];
              const newMicroSteps: CubitStep[] = legacyMicro.map((text: string) => ({
                id: crypto.randomUUID(),
                text: text,
                sub_steps: [],
              }));
              return { ...subStep, sub_steps: newMicroSteps };
            }
          }
          return subStep;
        });
        return { ...t, sub_steps: updatedSubSteps };
      }
      return t; // Return as-is if already migrated or empty
    });
    // -----------------------

    // --- BOOK TABS MIGRATION ---
    // If old flat todoRows exist but no todoProjects, wrap them into a default project
    let todoProjects = data.todoProjects || [];
    let activeProjectId = data.activeProjectId || null;

    if (
      todoProjects.length === 0 &&
      data.todoRows &&
      data.todoRows.length > 0
    ) {
      const defaultProject: TodoProject = {
        id: crypto.randomUUID(),
        name: 'My First Project',
        color: '#22D3EE',
        todoRows: data.todoRows,
        priorityDials: data.priorityDials || { left: '', right: '', focusedSide: 'none' as const },
        createdAt: Date.now(),
      };
      todoProjects = [defaultProject];
      activeProjectId = defaultProject.id;
      if (process.env.NODE_ENV === 'development')
        console.warn('Migrated flat todoRows into default TodoProject (Book Tabs).');
    }

    // If no projects exist at all, create an empty default
    if (todoProjects.length === 0) {
      const emptyProject: TodoProject = {
        id: crypto.randomUUID(),
        name: 'My First Project',
        color: '#22D3EE',
        todoRows: [],
        priorityDials: { left: '', right: '', focusedSide: 'none' as const },
        createdAt: Date.now(),
      };
      todoProjects = [emptyProject];
      activeProjectId = emptyProject.id;
    }

    // Ensure activeProjectId points to a valid project
    if (!activeProjectId || !todoProjects.find((p) => p.id === activeProjectId)) {
      activeProjectId = todoProjects[0].id;
    }

    const activeProject = todoProjects.find((p) => p.id === activeProjectId)!;
    // -----------------------

    // ==========================================
    // 🧬 THE GENESIS BOOT & YJS SYNCHRONIZATION 
    // ==========================================
    if (data.yjsState && data.yjsState instanceof Uint8Array) {
      // 1. BINARY PERSISTENCE: The Highest Authority
      // If we have a binary history, we decode it. It overwrites ALL legacy JSON logic.
      Y.applyUpdate(ydoc, data.yjsState);
      if (process.env.NODE_ENV === 'development') console.log('✅ Y.Doc Booted from Binary IDB History');

      // We still need to map the Yjs state back to the Zustand arrays for the first render
      todoProjects = Array.from(yProjectsMap.values()).map(extractTodoProjectFromYMap);
      migratedTasks.length = 0; // Clear legacy, Yjs is truth
      migratedTasks.push(...Array.from(yTasksMap.values()).map(extractTaskItemFromYMap));

    } else if (!isMigrating) {
      // 2. THE GENESIS BOOT (Legacy JSON -> Yjs)
      isMigrating = true;
      if (process.env.NODE_ENV === 'development') console.warn('🧬 Executing Genesis Boot: Migrating JSON to Y.Doc');

      ydoc.transact(() => {
        // Map legacy Tasks
        migratedTasks.forEach((task) => {
          yTasksMap.set(task.id, bindTaskItemToYMap(task as TaskItem));
        });

        // Map legacy Projects
        todoProjects.forEach((proj, i) => {
          const orderKey = proj.orderKey || generateOrderKey(i === 0 ? undefined : (todoProjects[i - 1].orderKey || undefined));
          const yProj = bindTodoProjectToYMap({ ...proj, orderKey });
          yProjectsMap.set(proj.id, yProj);
        });
      });
      console.log('🧬 Genesis Boot Complete.');
    }

    set({
      tasks: migratedTasks as TaskItem[],
      transcript: data.transcript || null,
      scoutResults: data.scoutResults || [],
      projectType: data.projectType || 'video',
      projectTitle: data.projectTitle || 'New Project',
      scoutTopic: data.scoutTopic || '',
      scoutPlatform: data.scoutPlatform || 'instagram',
      scoutHistory: data.scoutHistory || [],
      todoProjects,
      activeProjectId,
      todoRows: activeProject.todoRows,
      priorityDials: activeProject.priorityDials,
      // Seed the counter so new projects always have unique names & colors.
      nextProjectNumber: todoProjects.length + 1,
      isHydrated: true, // ✅ Hydration Complete
    });

    // ---------------------------------------------------------------------------
    // ⚛️ THE REACT OBSERVER PATTERN (One-Way Data Flow & Structural Sharing)
    // ---------------------------------------------------------------------------

    // MICRO-CACHES: These WeakMaps/Maps ensure we only generate new Object references
    // if the underlying Y.Map JSON actually changed. This is our "React Re-Render Armor".
    const taskCache = new Map<string, { json: string, parsed: TaskItem }>();
    const projectCache = new Map<string, { json: string, parsed: TodoProject }>();

    ydoc.on('update', (update: Uint8Array, origin: any) => {
      // THE ECHO STORM PREVENTION (Outbound Broadcast)
      if (origin !== 'network' && networkSync) {
        // BAND 1: Instantly broadcast tiny live diffs
        networkSync.broadcastUpdate(update);

        // BAND 2: The Deep Idle Checkpoint (30 seconds)
        // Reset the inactivity timer every time the user types.
        if (idleCheckpointTimer) clearTimeout(idleCheckpointTimer);
        idleCheckpointTimer = setTimeout(() => {
          console.log("Deep Idle Reached: Generating 1MB+ E2EE Checkpoint...");
          const fullState = Y.encodeStateAsUpdate(ydoc);
          networkSync?.broadcastCheckpoint(fullState);
        }, 30000);
      }

      // --- THE CATCH-UP RENDER THROTTLE ---
      // When the WebSocket sends 1 Checkpoint + 100 Live Diffs, this event fires 101 times in 10ms.
      // If we call set() every time, React freezes. We debounce the actual Zustand update.
      if ((window as any)._crdtRenderDebounce) {
        clearTimeout((window as any)._crdtRenderDebounce);
      }

      (window as any)._crdtRenderDebounce = setTimeout(() => {
        // 1. Extract raw lists but filter out tombstones immediately
        const rawYProjects = Array.from(yProjectsMap.values()).filter(p => !p.get('isDeleted'));
        const rawYTasks = Array.from(yTasksMap.values()).filter(t => !t.get('isDeleted'));

        // 2. Map through cache for Structural Sharing
        const sharedProjects = rawYProjects.map(yProj => {
          const parsed = extractTodoProjectFromYMap(yProj);
          const json = JSON.stringify(parsed);
          const cached = projectCache.get(parsed.id);
          if (cached && cached.json === json) return cached.parsed;
          projectCache.set(parsed.id, { json, parsed });
          return parsed;
        });

        const sharedTasks = rawYTasks.map(yTask => {
          const parsed = extractTaskItemFromYMap(yTask);
          const json = JSON.stringify(parsed);
          const cached = taskCache.get(parsed.id);
          if (cached && cached.json === json) return cached.parsed;
          taskCache.set(parsed.id, { json, parsed });
          return parsed;
        });

        const updatedProjects = sortYMapList(sharedProjects);

        const currentActiveId = get().activeProjectId;
        const actProj = updatedProjects.find(p => p.id === currentActiveId) || updatedProjects[0]; // Fallback to 0 if active was deleted

        setTimeout(() => {
          set({
            todoProjects: updatedProjects,
            tasks: sharedTasks,
            activeProjectId: actProj?.id || null, // Ensure UI shifts if tab deleted
            todoRows: actProj ? actProj.todoRows : [],
            priorityDials: actProj ? actProj.priorityDials : { left: '', right: '', focusedSide: 'none' },
          });
        }, 50); // 50ms render throttle
      }, 100); // Close the _crdtRenderDebounce setTimeout
    }); // Close the ydoc.on callback
  }, // Close the connectToSyncServer function call

  // ---------------------------------------------------------------------------

  saveTask: async (task: TaskItem) => {
    ydoc.transact(() => {
      yTasksMap.set(task.id, bindTaskItemToYMap(task));
    });
  },

  saveTasks: async (newTasksList: TaskItem[]) => {
    ydoc.transact(() => {
      newTasksList.forEach(task => {
        yTasksMap.set(task.id, bindTaskItemToYMap(task));
      });
    });
  },

  updateTask: async (taskId: string, updates: Partial<TaskItem>) => {
    const yTask = yTasksMap.get(taskId);
    if (!yTask) return;

    ydoc.transact(() => {
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
    });
  },

  deleteTask: async (taskId: string) => {
    ydoc.transact(() => {
      const yTaskObj = yTasksMap.get(taskId);
      if (yTaskObj) yTaskObj.set('isDeleted', true);
    });
  },

  // New Action: Specifically for adding Level 3 Micro-steps
  addMicroSteps: async (taskId: string, stepId: string, microSteps: string[]) => {
    const yTask = yTasksMap.get(taskId);
    if (!yTask) return;

    ydoc.transact(() => {
      const ySubList = yTask.get('sub_steps') as Y.Array<Y.Map<any>>;

      // Helper to find the Y.Map step recursively
      const findStep = (array: Y.Array<Y.Map<any>>, targetId: string): Y.Map<any> | null => {
        for (let i = 0; i < array.length; i++) {
          const s = array.get(i);
          if (Array.isArray(s)) return findStep(s[0].get('sub_steps'), targetId); // Handle Y.Array nested in Y.Array edgecase

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
          childArray.push([bindCubitStepToYMap(fallback)]); // Requires array bracket wrapper for Yjs pushing Map
        });
      }
    });
  },

  // New Action: Update text of any step (Level 2 or 3)
  updateDeepStep: async (taskId: string, stepId: string, newText: string) => {
    const yTask = yTasksMap.get(taskId);
    if (!yTask) return;

    ydoc.transact(() => {
      const ySubList = yTask.get('sub_steps') as Y.Array<Y.Map<any>>;

      const updateStepTextRec = (array: Y.Array<Y.Map<any>>): boolean => {
        for (let i = 0; i < array.length; i++) {
          const s = array.get(i);
          if (Array.isArray(s)) { if (updateStepTextRec(s[0].get('sub_steps'))) return true; } // Safety
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

  // New Action: Toggle Checkbox (Level 2 or 3)
  toggleStepCompletion: async (taskId: string, stepId: string) => {
    const yTask = yTasksMap.get(taskId);
    if (!yTask) return;

    ydoc.transact(() => {
      const ySubList = yTask.get('sub_steps') as Y.Array<Y.Map<any>>;

      const toggleStepRec = (array: Y.Array<Y.Map<any>>): boolean => {
        for (let i = 0; i < array.length; i++) {
          const s = array.get(i);
          if (Array.isArray(s)) { if (toggleStepRec(s[0].get('sub_steps'))) return true; } // Safety
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

  setTranscript: async (text: string) => {
    set({ transcript: text });
  },

  setScoutResults: async (results: string[]) => {
    set({ scoutResults: results });
  },

  setProjectType: async (type: 'video' | 'text') => {
    set({ projectType: type });
  },

  setProjectTitle: async (title: string) => {
    set({ projectTitle: title });
  },

  // Atomic Action for Text Mode Initialization
  startTextProject: async (title: string, text: string) => {
    const type = 'text';
    set({
      projectType: type,
      projectTitle: title,
      transcript: text,
    });
  },

  // ⚡️ GLITCH-FREE RESET: For "Start Analysis" workflow
  // Clears content but KEEPS processing state to prevent Manifesto flash
  startNewAnalysis: async (type: 'video' | 'text', title: string) => {
    await storageService.clearProject();
    set({
      tasks: [],
      transcript: null,
      scoutResults: [],
      scoutHistory: [],
      // Keep existing handle/key/processing/inputMode
      projectType: type,
      projectTitle: title,
      logs: [],
      isProcessing: true, // FORCE True (Prevent Manifesto Flash)
      // Strike 17.5: Do we clear Scout on new analysis? Probably yes.
      scoutTopic: '',
      scoutPlatform: 'instagram',
    });
  },
  resetProject: async () => {
    // Smart Reset: Clear data but KEEP API Key
    await storageService.clearProject();
    const defaultProject: TodoProject = {
      id: crypto.randomUUID(),
      name: 'My First Project',
      color: '#22D3EE',
      todoRows: [],
      priorityDials: { left: '', right: '', focusedSide: 'none' as const },
      createdAt: Date.now(),
    };
    set({
      tasks: [],
      transcript: null,
      scoutResults: [],
      scoutHistory: [],
      hasVideoHandle: false,
      projectType: 'video',
      projectTitle: 'New Project',
      logs: [],
      isProcessing: false,
      activeProcessingId: null,
      scoutTopic: '',
      scoutPlatform: 'instagram',
      inputMode: 'video',
      todoProjects: [defaultProject],
      activeProjectId: defaultProject.id,
      todoRows: [],
      priorityDials: { left: '', right: '', focusedSide: 'none' as const },
      activeMode: null,
      processingRowId: null,
      nextProjectNumber: 2, // "My First Project" was #1
    });
  },

  fullLogout: async () => {
    // Factory Reset
    await storageService.clearProject();
    localStorage.removeItem(STORAGE_KEY_API);
    const defaultProject: TodoProject = {
      id: crypto.randomUUID(),
      name: 'My First Project',
      color: '#22D3EE',
      todoRows: [],
      priorityDials: { left: '', right: '', focusedSide: 'none' as const },
      createdAt: Date.now(),
    };
    set({
      tasks: [],
      transcript: null,
      scoutResults: [],
      scoutHistory: [],
      hasVideoHandle: false,
      projectType: 'video',
      projectTitle: 'New Project',
      logs: [],
      scoutTopic: '',
      scoutPlatform: 'instagram',
      inputMode: 'video',
      todoProjects: [defaultProject],
      activeProjectId: defaultProject.id,
      todoRows: [],
      priorityDials: { left: '', right: '', focusedSide: 'none' as const },
      activeMode: null,
      nextProjectNumber: 2, // "My First Project" was #1
      apiKey: '',
    });
  },

  importTasks: async (newTasks: TaskItem[]) => {
    // Logic: Import usually implies replacing data. But transcript might be missing in import.
    // Let's assume keep existing transcript for now unless we import full project.
    set({ tasks: newTasks });
    // Manual save removed (Optimization)
  },

  setProcessing: (isProcessing: boolean) => {
    set({ isProcessing });
  },

  // Contextual Loading State (Electric UI)
  activeProcessingId: null,
  setActiveProcessingId: (id: string | null) => set({ activeProcessingId: id }),

  // UI State
  isSettingsOpen: false,
  settingsVariant: 'default',
  setIsSettingsOpen: (isOpen: boolean, variant: 'default' | 'quota' = 'default') =>
    set({ isSettingsOpen: isOpen, settingsVariant: variant }),

  isSyncModalOpen: false,
  setIsSyncModalOpen: (isOpen: boolean) => set({ isSyncModalOpen: isOpen }),

  addLog: (message: string) => {
    set((state) => {
      const lastLog = state.logs[state.logs.length - 1];
      if (lastLog && lastLog.message === message) return state; // De-dupe at source

      const newEntry: LogEntry = {
        id: crypto.randomUUID(),
        message,
        timestamp: new Date().toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };

      return { logs: [...state.logs, newEntry].slice(-50) }; // Keep last 50
    });
  },
  clearLogs: () => set({ logs: [] }),
}));

// Test Hook for Playwright
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__STORE__ = useAppStore;
}

// ---------------------------------------------------------------------------
// 💾 AUTO-SAVE SUBSCRIPTION (Debounced)
// ---------------------------------------------------------------------------
let saveTimeout: NodeJS.Timeout;

useAppStore.subscribe((state) => {
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(async () => {
    // Filter: Only save if hydration is complete (prevents overwriting with initial empty state)
    if (state.isHydrated) {
      try {
        // [TECH DEBT]: We are saving the full binary string on every keystroke debounce.
        // For Chunk 3, this guarantees safety. In the future, we need incremental compaction.
        const yjsState = Y.encodeStateAsUpdate(ydoc);

        await storageService.saveProject(
          state.tasks,
          state.transcript || undefined,
          state.scoutResults,
          state.projectType,
          state.projectTitle,
          state.scoutTopic,
          state.scoutPlatform,
          state.scoutHistory,
          state.todoProjects,
          state.activeProjectId || undefined,
          yjsState,
        );
      } catch (err) {
        console.error('Auto-Save Failed:', err);
      }
    }
  }, 500);
});
// ---------------------------------------------------------------------------
// 🌍 GEMINI SYSTEM LOG BRIDGE
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  GeminiEvents.addEventListener('gemini-log', ((event: CustomEvent) => {
    const { message, type } = event.detail;
    // Prefix message with type if warning/error for better visibility in simple log
    const prefix = type === 'warning' ? '⚠️ ' : type === 'error' ? '🔴 ' : '';
    useAppStore.getState().addLog(`${prefix}${message}`);
  }) as EventListener);
}
