import { get, set, del } from 'idb-keyval';

// Define the full project data structure saved to DB
export interface StoredProjectData {
    tasks: TaskItem[];
    transcript?: string; // New: Full transcript for context
    updatedAt: number;
}

const PROJECT_KEY = 'cubit_connect_project_v1';

export interface CubitStep {
    id: string;
    text: string;
    sub_steps: string[] | CubitStep[]; // Recursive definition
}

export interface TaskItem {
    id: string; // UUID
    task_name: string;
    timestamp_seconds: number;
    description: string;
    screenshot_base64: string;
    sub_steps?: CubitStep[];
}

export const storageService = {
    /**
     * Loads the entire project state from IndexedDB.
     * Returns empty task list if nothing found.
     */
    async getProject(): Promise<StoredProjectData> {
        try {
            const data = await get<StoredProjectData>(PROJECT_KEY);
            return data || { tasks: [], updatedAt: Date.now() };
        } catch (error) {
            console.error('Failed to load project from IndexedDB:', error);
            // Fail gracefully with empty state rather than crashing
            return { tasks: [], updatedAt: Date.now() };
        }
    },

    /**
     * Saves the entire project state.
     * Note: This includes the base64 images, which is why we use IDB not LocalStorage.
     */
    async saveProject(tasks: TaskItem[], transcript?: string): Promise<void> {
        try {
            const payload: StoredProjectData = {
                tasks,
                transcript,
                updatedAt: Date.now(),
            };
            await set(PROJECT_KEY, payload);
        } catch (error: any) {
            console.error('Failed to save project to IndexedDB:', error);
            if (error?.name === 'QuotaExceededError') {
                alert("⚠️ Storage Full! Please EXPORT a backup immediately.");
            }
            throw error; // Let the UI know save failed
        }
    },

    /**
     * Clears all project data.
     * Used for the "Hard Reset" feature.
     */
    async clearProject(): Promise<void> {
        try {
            await del(PROJECT_KEY);
        } catch (error) {
            console.error('Failed to clear project:', error);
        }
    }
};
