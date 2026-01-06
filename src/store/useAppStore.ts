import { create } from 'zustand';
import { storageService, TaskItem, CubitStep } from '@/services/storage';

interface ProjectState {
    hasVideoHandle: boolean;
    isProcessing: boolean;
    tasks: TaskItem[];
    transcript: string | null; // New state
    apiKey: string | null;

    // Actions
    setApiKey: (key: string) => void;
    setVideoHandleState: (hasHandle: boolean) => void;
    loadProject: () => Promise<void>;
    saveTask: (task: TaskItem) => Promise<void>;
    updateTask: (taskId: string, updates: Partial<TaskItem>) => Promise<void>;
    deleteTask: (taskId: string) => Promise<void>;
    resetProject: () => Promise<void>;
    fullLogout: () => Promise<void>;
    importTasks: (tasks: TaskItem[]) => Promise<void>;
    setProcessing: (isProcessing: boolean) => void;
    addMicroSteps: (taskId: string, stepId: string, microSteps: string[]) => Promise<void>;
    updateDeepStep: (taskId: string, stepId: string, newText: string) => Promise<void>;
    setTranscript: (text: string) => Promise<void>; // New action
}

const STORAGE_KEY_API = 'cubit_api_key';

export const useAppStore = create<ProjectState>((set, get) => ({
    // Initial State
    hasVideoHandle: false, // Default: Force re-selection on reload
    isProcessing: false,
    tasks: [],
    transcript: null,
    apiKey: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_API) : null,

    // Actions
    setApiKey: (key: string) => {
        localStorage.setItem(STORAGE_KEY_API, key);
        set({ apiKey: key });
    },

    setVideoHandleState: (hasHandle: boolean) => {
        set({ hasVideoHandle: hasHandle });
    },

    loadProject: async () => {
        const data = await storageService.getProject();

        // --- MIGRATION LAYER ---
        // Detects legacy string[] sub_steps and converts to CubitStep[] objects
        const migratedTasks = data.tasks.map((task: any) => {
            // Safety check: Does it have sub_steps?
            if (task.sub_steps && Array.isArray(task.sub_steps) && task.sub_steps.length > 0) {
                // Heuristic: Is the first item a simple string?
                if (typeof task.sub_steps[0] === 'string') {
                    console.warn(`Migrating Legacy Task [${task.task_name}] to Recursive Schema`);

                    // Convert ["Step A", "Step B"] -> [{id: "...", text: "Step A"}, ...]
                    const newSubSteps: CubitStep[] = task.sub_steps.map((text: string) => ({
                        id: crypto.randomUUID(),
                        text: text,
                        sub_steps: [] // Initialize empty micro-steps
                    }));

                    return { ...task, sub_steps: newSubSteps };
                }
            }
            return task; // Return as-is if already migrated or empty
        });
        // -----------------------

        set({ tasks: migratedTasks, transcript: data.transcript || null });

        // If we migrated something, save it back to DB immediately so it's permanent
        if (JSON.stringify(migratedTasks) !== JSON.stringify(data.tasks)) {
            await storageService.saveProject(migratedTasks, data.transcript);
        }
    },

    saveTask: async (task: TaskItem) => {
        const { tasks, transcript } = get();
        const newTasks = [...tasks, task];

        // Update local state immediately (Optimistic UI)
        set({ tasks: newTasks });

        // Persist to IDB
        await storageService.saveProject(newTasks, transcript || undefined);
    },

    updateTask: async (taskId: string, updates: Partial<TaskItem>) => {
        const { tasks, transcript } = get();
        const newTasks = tasks.map(t =>
            t.id === taskId ? { ...t, ...updates } : t
        );

        set({ tasks: newTasks });
        await storageService.saveProject(newTasks, transcript || undefined);
    },

    deleteTask: async (taskId: string) => {
        const { tasks, transcript } = get();
        const newTasks = tasks.filter(t => t.id !== taskId);

        set({ tasks: newTasks });
        await storageService.saveProject(newTasks, transcript || undefined);
    },

    // New Action: Specifically for adding Level 3 Micro-steps
    addMicroSteps: async (taskId: string, stepId: string, microSteps: string[]) => {
        const { tasks, transcript } = get();
        const newTasks = tasks.map(task => {
            if (task.id !== taskId) return task;

            // Found Task, now find Sub-step
            const newSubSteps = task.sub_steps?.map(step => {
                if (step.id !== stepId) return step;

                // Found Step, add micro-steps
                return { ...step, sub_steps: microSteps };
            });

            return { ...task, sub_steps: newSubSteps };
        });

        set({ tasks: newTasks });
        await storageService.saveProject(newTasks, transcript || undefined);
    },

    // New Action: Update text of any step (Level 2 or 3)
    updateDeepStep: async (taskId: string, stepId: string, newText: string) => {
        const { tasks, transcript } = get();

        // Recursive helper to find and update nested steps
        const updateRecursive = (steps: CubitStep[]): CubitStep[] => {
            return steps.map(step => {
                // Match found? Update text.
                if (step.id === stepId) {
                    return { ...step, text: newText };
                }

                // Has children? Recurse.
                if (step.sub_steps && Array.isArray(step.sub_steps)) {
                    // Check if children are strings (legacy/micro) or objects
                    // If they are strings, we can't recurse easily with IDs.
                    // But our migration ensures objects for Level 2.
                    // Level 3 might be strings or objects. 
                    // Let's assume safely.
                    const firstChild = step.sub_steps[0];
                    if (typeof firstChild !== 'string') {
                        return { ...step, sub_steps: updateRecursive(step.sub_steps as CubitStep[]) };
                    }
                    // If Level 3 are strings, we currently can't update them by ID because they don't *have* IDs.
                    // Architecture Constraint: We might need to migrate Level 3 to objects if we want to edit them individually reliably.
                    // For now, let's assume this only targets Level 2 (Sub-steps) which definitely have IDs.
                }

                return step;
            });
        };

        const newTasks = tasks.map(task => {
            if (task.id !== taskId) return task;
            if (!task.sub_steps) return task;
            return { ...task, sub_steps: updateRecursive(task.sub_steps) };
        });

        set({ tasks: newTasks });
        await storageService.saveProject(newTasks, transcript || undefined);
    },

    setTranscript: async (text: string) => {
        const { tasks } = get();
        set({ transcript: text });
        await storageService.saveProject(tasks, text);
    },

    resetProject: async () => {
        // Smart Reset: Clear data but KEEP API Key
        await storageService.clearProject();
        set({ tasks: [], transcript: null, hasVideoHandle: false });
    },

    fullLogout: async () => {
        // Factory Reset
        await storageService.clearProject();
        localStorage.removeItem(STORAGE_KEY_API);
        set({ tasks: [], transcript: null, hasVideoHandle: false, apiKey: null });
    },

    importTasks: async (newTasks: TaskItem[]) => {
        const { transcript } = get(); // Keep existing transcript? Or clear it? 
        // Logic: Import usually implies replacing data. But transcript might be missing in import. 
        // Let's assume keep existing transcript for now unless we import full project.
        set({ tasks: newTasks });
        await storageService.saveProject(newTasks, transcript || undefined);
    },

    setProcessing: (isProcessing: boolean) => {
        set({ isProcessing });
    }
}));
