import { create } from 'zustand';
import { storageService, TaskItem, CubitStep } from '@/services/storage';
import { GeminiEvents } from '@/services/gemini';
import { cryptoUtils } from '@/lib/crypto';

export interface ProjectState {
  isHydrated: boolean; // New: Hydration Guard
  hasVideoHandle: boolean;
  isProcessing: boolean;
  tasks: TaskItem[];
  transcript: string | null; // New state
  scoutResults: string[];
  scoutHistory: string[]; // New: Scout feature persistence
  projectType: 'video' | 'text'; // New: MVP Text Mode
  projectTitle: string; // New: Title Persistence
  apiKey: string | null;

  // Strike 17.5: Global Input Mode & Scout Persistence
  inputMode: 'video' | 'text' | 'scout';
  setInputMode: (mode: 'video' | 'text' | 'scout') => void;
  scoutTopic: string;
  setScoutTopic: (topic: string) => void;
  scoutPlatform: string; // 'instagram' | 'reddit' | 'tiktok' | etc
  setScoutPlatform: (platform: string) => void;

  activeProcessingId: string | null; // Electric UI
  setActiveProcessingId: (id: string | null) => void;

  // Actions
  setApiKey: (key: string) => void;
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
}

export interface LogEntry {
  id: string;
  message: string;
  timestamp: string;
}

const STORAGE_KEY_API = 'cubit_api_key';

export const useAppStore = create<ProjectState>((set, get) => ({
  // Initial State
  isHydrated: false,
  hasVideoHandle: false, // Default: Force re-selection on reload
  isProcessing: false,
  tasks: [],
  transcript: null,
  scoutResults: [],
  scoutHistory: [],
  projectType: 'video', // Default
  projectTitle: 'New Project', // Default
  apiKey:
    typeof window !== 'undefined'
      ? cryptoUtils.decrypt(localStorage.getItem(STORAGE_KEY_API) || '')
      : null,

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

  logs: [],

  // Actions
  setApiKey: (key: string) => {
    const safeKey = cryptoUtils.cleanInput(key);
    const encrypted = cryptoUtils.encrypt(safeKey);
    localStorage.setItem(STORAGE_KEY_API, encrypted);
    set({ apiKey: safeKey });
  },

  setVideoHandleState: (hasHandle: boolean) => {
    set({ hasVideoHandle: hasHandle });
  },

  loadProject: async () => {
    console.log('LOADING PROJECT...');
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

    set({
      tasks: migratedTasks,
      transcript: data.transcript || null,
      scoutResults: data.scoutResults || [],
      projectType: data.projectType || 'video',
      projectTitle: data.projectTitle || 'New Project',
      scoutTopic: data.scoutTopic || '', // Restore or default
      scoutPlatform: data.scoutPlatform || 'instagram',
      scoutHistory: data.scoutHistory || [], // Restore or default
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
    set({
      tasks: [],
      transcript: null,
      scoutResults: [],
      scoutHistory: [],
      hasVideoHandle: false,
      projectType: 'video',
      projectTitle: 'New Project',
      logs: [],
      isProcessing: false, // ⚡️ Ensure we reset processing state
      activeProcessingId: null,
      scoutTopic: '',
      scoutPlatform: 'instagram',
      inputMode: 'video',
    });
  },

  fullLogout: async () => {
    // Factory Reset
    await storageService.clearProject();
    localStorage.removeItem(STORAGE_KEY_API);
    set({
      tasks: [],
      transcript: null,
      scoutResults: [],
      scoutHistory: [],
      hasVideoHandle: false,
      apiKey: null,
      projectType: 'video',
      projectTitle: 'New Project',
      logs: [],
      scoutTopic: '',
      scoutPlatform: 'instagram',
      inputMode: 'video',
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
    // Filter: Only save if there is meaningful data
    if (state.tasks.length > 0 || state.transcript || state.projectTitle !== 'New Project') {
      try {
        if (process.env.NODE_ENV === 'development') {
        }
        // Assuming storageService is imported at the top (Checked: It is)
        await storageService.saveProject(
          state.tasks,
          state.transcript || undefined,
          state.scoutResults,
          state.projectType,
          state.projectTitle,
          state.scoutTopic,
          state.scoutPlatform,
          state.scoutHistory,
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
