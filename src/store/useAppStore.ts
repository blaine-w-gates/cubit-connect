'use client';

/**
 * Zustand Store for Cubit Connect
 * 
 * Uses manual persistence to IndexedDB via our custom storage utilities.
 * Falls back to sessionStorage in Private Browsing mode.
 */

import { create } from 'zustand';
import type { AppState, TaskItem } from '@/lib/types';
import { 
  checkStorageAvailability, 
  saveToStorage, 
  loadFromStorage,
  removeFromStorage 
} from '@/lib/storage';

interface StoreState extends Omit<AppState, 
  'setApiKey' | 'clearApiKey' | 'setVideoFile' | 'setTranscript' | 
  'setTasks' | 'updateTask' | 'setProcessing' | 'setError' | 
  'setPrivateBrowsing' | 'setNeedsVideoRehydration' | 'reset'
> {
  isHydrated: boolean;
}

interface StoreActions {
  initialize: () => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  clearApiKey: () => Promise<void>;
  setVideoFile: (file: File | null) => void;
  setTranscript: (text: string | null) => void;
  setTasks: (tasks: TaskItem[]) => Promise<void>;
  updateTask: (id: string, updates: Partial<TaskItem>) => Promise<void>;
  setProcessing: (status: boolean, progress?: number, message?: string) => void;
  setError: (error: string | null) => void;
  setPrivateBrowsing: (isPrivate: boolean) => void;
  setNeedsVideoRehydration: (needs: boolean) => void;
  reset: (keepApiKey?: boolean) => Promise<void>;
}

type Store = StoreState & StoreActions;

const initialState: StoreState = {
  apiKey: null,
  videoFile: null,
  transcript: null,
  tasks: [],
  isProcessing: false,
  processingProgress: 0,
  processingStatus: '',
  error: null,
  isPrivateBrowsing: false,
  needsVideoRehydration: false,
  isHydrated: false,
};

export const useAppStore = create<Store>((set, get) => ({
  ...initialState,

  /**
   * Initialize store: check storage availability and load persisted data
   */
  initialize: async () => {
    // Check if IndexedDB is available
    const isAvailable = await checkStorageAvailability();
    set({ isPrivateBrowsing: !isAvailable });

    // Load API key from storage
    const savedKey = localStorage.getItem('cubit_api_key');
    if (savedKey) {
      set({ apiKey: savedKey });
    }

    // Load tasks from IndexedDB
    const savedTasks = await loadFromStorage<TaskItem[]>('cubit_tasks');
    if (savedTasks && savedTasks.length > 0) {
      set({ 
        tasks: savedTasks,
        needsVideoRehydration: true, // Tasks exist but video is gone
      });
    }

    // Load transcript
    const savedTranscript = await loadFromStorage<string>('cubit_transcript');
    if (savedTranscript) {
      set({ transcript: savedTranscript });
    }

    set({ isHydrated: true });
  },

  /**
   * Set and persist API key
   */
  setApiKey: async (key: string) => {
    set({ apiKey: key, error: null });
    // API key goes to localStorage (small, fast access)
    localStorage.setItem('cubit_api_key', key);
  },

  /**
   * Clear API key
   */
  clearApiKey: async () => {
    set({ apiKey: null });
    localStorage.removeItem('cubit_api_key');
  },

  /**
   * Set video file (memory only, not persisted)
   */
  setVideoFile: (file: File | null) => {
    set({ 
      videoFile: file,
      needsVideoRehydration: false,
      error: null,
    });
  },

  /**
   * Set and persist transcript
   */
  setTranscript: (text: string | null) => {
    set({ transcript: text });
    if (text) {
      saveToStorage('cubit_transcript', text);
    } else {
      removeFromStorage('cubit_transcript');
    }
  },

  /**
   * Set and persist tasks
   */
  setTasks: async (tasks: TaskItem[]) => {
    set({ tasks });
    await saveToStorage('cubit_tasks', tasks);
  },

  /**
   * Update a single task and persist
   */
  updateTask: async (id: string, updates: Partial<TaskItem>) => {
    const { tasks } = get();
    const updatedTasks = tasks.map(task => 
      task.id === id ? { ...task, ...updates } : task
    );
    set({ tasks: updatedTasks });
    await saveToStorage('cubit_tasks', updatedTasks);
  },

  /**
   * Set processing state
   */
  setProcessing: (status: boolean, progress = 0, message = '') => {
    set({ 
      isProcessing: status, 
      processingProgress: progress,
      processingStatus: message,
    });
  },

  /**
   * Set error message
   */
  setError: (error: string | null) => {
    set({ error });
  },

  /**
   * Set private browsing flag
   */
  setPrivateBrowsing: (isPrivate: boolean) => {
    set({ isPrivateBrowsing: isPrivate });
  },

  /**
   * Set video rehydration flag
   */
  setNeedsVideoRehydration: (needs: boolean) => {
    set({ needsVideoRehydration: needs });
  },

  /**
   * Reset all state
   * @param keepApiKey - If true, preserves the API key (default: true for "New Project")
   */
  reset: async (keepApiKey = true) => {
    const { apiKey } = get();
    set({
      ...initialState,
      apiKey: keepApiKey ? apiKey : null,
      isHydrated: true,
    });
    await removeFromStorage('cubit_tasks');
    await removeFromStorage('cubit_transcript');
    
    // Also clear API key from localStorage if not keeping
    if (!keepApiKey) {
      localStorage.removeItem('cubit_api_key');
    }
  },
}));
