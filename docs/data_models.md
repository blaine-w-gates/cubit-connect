interface TaskItem {
id: string; // UUID
task_name: string;
timestamp_seconds: number;
description: string;
screenshot_base64: string; // Stored in IndexedDB, Max Width 640px
sub_steps?: string[]; // If populated, these are the Cubit steps
}

interface ProjectState {
hasVideoHandle: boolean; // Tracks if we have the file in current session
isProcessing: boolean;
}

interface ProcessingQueueItem {
status: 'pending' | 'processing' | 'completed' | 'error';
taskId: string;
}
