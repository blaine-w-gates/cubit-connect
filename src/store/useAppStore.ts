import { create } from 'zustand';
import { storageService, TaskItem, CubitStep, TodoRow, PriorityDials, TodoProject } from '@/services/storage';
import { GeminiEvents, GeminiService } from '@/services/gemini';
import { cryptoUtils } from '@/lib/crypto';

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
  restoreTodoRow: (row: TodoRow, index: number) => void;
}

export interface LogEntry {
  id: string;
  message: string;
  timestamp: string;
}



const STORAGE_KEY_API = 'cubit_api_key';

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

  // --- Book Tab Project Actions ---
  addTodoProject: (name?: string) => {
    const { todoProjects, nextProjectNumber } = get();
    // Name = slot position (current count + 1), Color = monotonic counter cycle
    const colorIdx = (nextProjectNumber - 1) % TAB_COLORS.length;
    const slotNumber = todoProjects.length + 1;
    const newProject: TodoProject = {
      id: crypto.randomUUID(),
      name: name || `Project ${slotNumber}`,
      color: TAB_COLORS[colorIdx],
      todoRows: [],
      priorityDials: { left: '', right: '', focusedSide: 'none' as const },
      createdAt: Date.now(),
    };
    const updated = [...todoProjects, newProject];
    set({
      todoProjects: updated,
      activeProjectId: newProject.id,
      todoRows: newProject.todoRows,
      priorityDials: newProject.priorityDials,
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
    set((state) => ({
      todoProjects: state.todoProjects.map((p) =>
        p.id === projectId ? { ...p, name } : p,
      ),
    }));
  },

  deleteTodoProject: (projectId: string) => {
    const { todoProjects, activeProjectId } = get();
    const filtered = todoProjects.filter((p) => p.id !== projectId);
    // If deleting the active project, switch to first remaining or null
    let newActiveId = activeProjectId;
    let newRows: TodoRow[] = get().todoRows;
    let newDials: PriorityDials = get().priorityDials;
    if (activeProjectId === projectId) {
      const next = filtered[0] || null;
      newActiveId = next?.id || null;
      newRows = next?.todoRows || [];
      newDials = next?.priorityDials || { left: '', right: '', focusedSide: 'none' as const };
    }
    set({
      todoProjects: filtered,
      activeProjectId: newActiveId,
      todoRows: newRows,
      priorityDials: newDials,
    });
  },

  reorderTodoProjects: (fromIdx: number, toIdx: number) => {
    set((state) => {
      const projects = [...state.todoProjects];
      const [moved] = projects.splice(fromIdx, 1);
      projects.splice(toIdx, 0, moved);
      return { todoProjects: projects };
    });
  },

  changeProjectColor: (projectId: string, color: string) => {
    set((state) => ({
      todoProjects: state.todoProjects.map((p) =>
        p.id === projectId ? { ...p, color } : p
      ),
    }));
  },

  // Helper pattern: all row mutations update both todoRows AND the matching project in todoProjects

  addTodoRow: (task = '') => {
    const newRow: TodoRow = {
      id: crypto.randomUUID(),
      task,
      steps: ['', '', '', ''],
      isCompleted: false,
    };
    set((state) => {
      const newRows = [newRow, ...state.todoRows];
      return {
        todoRows: newRows,
        todoProjects: state.todoProjects.map((p) =>
          p.id === state.activeProjectId ? { ...p, todoRows: newRows } : p,
        ),
      };
    });
  },

  deleteTodoRow: (rowId: string) => {
    set((state) => {
      const newRows = state.todoRows.filter((r) => r.id !== rowId);
      return {
        todoRows: newRows,
        todoProjects: state.todoProjects.map((p) =>
          p.id === state.activeProjectId ? { ...p, todoRows: newRows } : p,
        ),
      };
    });
  },

  updateTodoCell: (rowId, field, value, stepIdx) => {
    set((state) => {
      const newRows = state.todoRows.map((row) => {
        if (row.id !== rowId) return row;
        if (field === 'task') return { ...row, task: value };
        if (field === 'step' && stepIdx !== undefined) {
          const steps = [...row.steps] as [string, string, string, string];
          steps[stepIdx] = value;
          return { ...row, steps };
        }
        return row;
      });
      return {
        todoRows: newRows,
        todoProjects: state.todoProjects.map((p) =>
          p.id === state.activeProjectId ? { ...p, todoRows: newRows } : p,
        ),
      };
    });
  },

  moveTodoRowToBottom: (rowId: string) => {
    set((state) => {
      const row = state.todoRows.find((r) => r.id === rowId);
      if (!row) return state;
      const newRows = [...state.todoRows.filter((r) => r.id !== rowId), row];
      return {
        todoRows: newRows,
        todoProjects: state.todoProjects.map((p) =>
          p.id === state.activeProjectId ? { ...p, todoRows: newRows } : p,
        ),
      };
    });
  },

  reorderTodoRows: (fromIdx: number, toIdx: number) => {
    set((state) => {
      const rows = [...state.todoRows];
      const [moved] = rows.splice(fromIdx, 1);
      rows.splice(toIdx, 0, moved);
      return {
        todoRows: rows,
        todoProjects: state.todoProjects.map((p) =>
          p.id === state.activeProjectId ? { ...p, todoRows: rows } : p,
        ),
      };
    });
  },

  setTodoSteps: (rowId: string, steps: [string, string, string, string]) => {
    set((state) => {
      const newRows = state.todoRows.map((r) => (r.id === rowId ? { ...r, steps } : r));
      return {
        todoRows: newRows,
        todoProjects: state.todoProjects.map((p) =>
          p.id === state.activeProjectId ? { ...p, todoRows: newRows } : p,
        ),
      };
    });
  },

  insertTodoRowAfter: (afterRowId: string, task: string, sourceStepId?: string) => {
    const newId = crypto.randomUUID();
    const newRow: TodoRow = {
      id: newId,
      task,
      steps: ['', '', '', ''],
      isCompleted: false,
      sourceStepId,
    };
    set((state) => {
      const idx = state.todoRows.findIndex((r) => r.id === afterRowId);
      const rows = [...state.todoRows];
      rows.splice(idx + 1, 0, newRow);
      return {
        todoRows: rows,
        todoProjects: state.todoProjects.map((p) =>
          p.id === state.activeProjectId ? { ...p, todoRows: rows } : p,
        ),
      };
    });
    return newId;
  },

  setDialPriority: (side, text) => {
    set((state) => {
      const newDials = { ...state.priorityDials, [side]: text };
      return {
        priorityDials: newDials,
        todoProjects: state.todoProjects.map((p) =>
          p.id === state.activeProjectId ? { ...p, priorityDials: newDials } : p,
        ),
      };
    });
  },

  setDialFocus: (side) => {
    set((state) => {
      const newDials = { ...state.priorityDials, focusedSide: side };
      return {
        priorityDials: newDials,
        todoProjects: state.todoProjects.map((p) =>
          p.id === state.activeProjectId ? { ...p, priorityDials: newDials } : p,
        ),
      };
    });
  },

  toggleTodoRowCompletion: (rowId: string) => {
    set((state) => {
      const newRows = state.todoRows.map((r) =>
        r.id === rowId ? { ...r, isCompleted: !r.isCompleted } : r,
      );
      return {
        todoRows: newRows,
        todoProjects: state.todoProjects.map((p) =>
          p.id === state.activeProjectId ? { ...p, todoRows: newRows } : p,
        ),
      };
    });
  },

  restoreTodoRow: (row: TodoRow, index: number) => {
    set((state) => {
      const rows = [...state.todoRows];
      const safeIdx = Math.min(index, rows.length);
      rows.splice(safeIdx, 0, row);
      return {
        todoRows: rows,
        todoProjects: state.todoProjects.map((p) =>
          p.id === state.activeProjectId ? { ...p, todoRows: rows } : p,
        ),
      };
    });
  },

  // Actions
  toggleTaskExpansion: async (taskId: string) => {
    const { tasks } = get();
    const newTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, isExpanded: !t.isExpanded } : t,
    );
    set({ tasks: newTasks });
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

    set({
      tasks: migratedTasks,
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
      // Using length + 1 means existing projects occupy slots 1..N,
      // and the next new project gets slot N+1.
      nextProjectNumber: todoProjects.length + 1,
      isHydrated: true, // ✅ Hydration Complete
    });

    // Manual save removed here (Optimization)
  },

  saveTask: async (task: TaskItem) => {
    const { tasks } = get();
    const newTasks = [...tasks, task];

    // Update local state immediately (Optimistic UI)
    set({ tasks: newTasks });

    // Persist to IDB
  },

  saveTasks: async (newTasksList: TaskItem[]) => {
    const { tasks } = get();
    const updatedTasks = [...tasks, ...newTasksList];
    set({ tasks: updatedTasks });
  },

  updateTask: async (taskId: string, updates: Partial<TaskItem>) => {
    const { tasks } = get();
    const newTasks = tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t));

    set({ tasks: newTasks });
  },

  deleteTask: async (taskId: string) => {
    const { tasks } = get();
    const newTasks = tasks.filter((t) => t.id !== taskId);

    set({ tasks: newTasks });
  },

  // New Action: Specifically for adding Level 3 Micro-steps
  addMicroSteps: async (taskId: string, stepId: string, microSteps: string[]) => {
    const { tasks } = get();
    const newTasks = tasks.map((task) => {
      if (task.id !== taskId) return task;

      // Found Task, now find Sub-step
      const newSubSteps = task.sub_steps?.map((step) => {
        if (step.id !== stepId) return step;

        // Found Step, add micro-steps (As Objects now)
        const newMicroSteps: CubitStep[] = microSteps.map((text) => ({
          id: crypto.randomUUID(),
          text: text,
          sub_steps: [],
        }));
        return { ...step, sub_steps: newMicroSteps };
      });

      return { ...task, sub_steps: newSubSteps };
    });

    set({ tasks: newTasks });
  },

  // New Action: Update text of any step (Level 2 or 3)
  updateDeepStep: async (taskId: string, stepId: string, newText: string) => {
    const { tasks } = get();

    // Recursive helper to find and update nested steps
    const updateRecursive = (steps: CubitStep[]): CubitStep[] => {
      return steps.map((step) => {
        // Match found? Update text.
        if (step.id === stepId) {
          return { ...step, text: newText };
        }

        // Has children? Recurse.
        if (step.sub_steps && Array.isArray(step.sub_steps)) {
          // Check if children are strings (legacy/micro) or objects
          // If they are strings, we can't recurse easily with IDs.
          const firstChild = step.sub_steps[0];
          if (typeof firstChild !== 'string') {
            // Recurse to Level 3
            return { ...step, sub_steps: updateRecursive(step.sub_steps as CubitStep[]) };
          }
          // Legacy Fallback (Should be caught by migration)
          return step;
        }

        return step;
      });
    };

    const newTasks = tasks.map((task) => {
      if (task.id !== taskId) return task;
      if (!task.sub_steps) return task;
      return { ...task, sub_steps: updateRecursive(task.sub_steps) };
    });

    set({ tasks: newTasks });
  },

  // New Action: Toggle Checkbox (Level 2 or 3)
  toggleStepCompletion: async (taskId: string, stepId: string) => {
    const { tasks } = get();

    // Recursive helper
    const toggleRecursive = (steps: CubitStep[]): CubitStep[] => {
      return steps.map((step) => {
        // Match found? Toggle.
        if (step.id === stepId) {
          return { ...step, isCompleted: !step.isCompleted };
        }

        // Has children? Recurse.
        if (step.sub_steps && Array.isArray(step.sub_steps)) {
          const firstChild = step.sub_steps[0];
          if (typeof firstChild !== 'string') {
            return { ...step, sub_steps: toggleRecursive(step.sub_steps as CubitStep[]) };
          }
        }
        return step;
      });
    };

    const newTasks = tasks.map((task) => {
      if (task.id !== taskId) return task;
      if (!task.sub_steps) return task;
      return { ...task, sub_steps: toggleRecursive(task.sub_steps) };
    });

    set({ tasks: newTasks });
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
