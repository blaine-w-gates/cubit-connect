/**
 * Core type definitions for Cubit Connect
 * Sourced from docs/data_models.md
 */

export interface TaskItem {
  id: string;
  task_name: string;
  timestamp_seconds: number;
  description: string;
  screenshot_base64: string;
  sub_steps?: string[];
}

export interface ProcessingQueueItem {
  taskId: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  retryCount: number;
}

export interface AIRequestQueueItem {
  id: string;
  type: 'analyze' | 'cubit';
  payload: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: TaskItem[] | string[];
  error?: string;
}

export interface AppState {
  apiKey: string | null;
  videoFile: File | null;
  transcript: string | null;
  tasks: TaskItem[];
  
  isProcessing: boolean;
  processingProgress: number;
  processingStatus: string;
  error: string | null;
  
  isPrivateBrowsing: boolean;
  needsVideoRehydration: boolean;
  
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  setVideoFile: (file: File | null) => void;
  setTranscript: (text: string | null) => void;
  setTasks: (tasks: TaskItem[]) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  setProcessing: (status: boolean, progress?: number, message?: string) => void;
  setError: (error: string | null) => void;
  setPrivateBrowsing: (isPrivate: boolean) => void;
  setNeedsVideoRehydration: (needs: boolean) => void;
  reset: () => void;
}

export type StorageKey = 'cubit_tasks' | 'cubit_transcript' | 'cubit_api_key' | 'cubit_theme';
