import { get, set, del } from 'idb-keyval';
import { ProjectDataSchema, StoredProjectData, TaskItem } from '@/schemas/storage';

const PROJECT_KEY = 'cubit_connect_project_v1';

// Re-export types from schema to avoid duplication
export type { StoredProjectData, TaskItem, CubitStep, TodoRow, PriorityDials, TodoProject } from '@/schemas/storage';

export const storageService = {
  /**
   * Loads the entire project state from IndexedDB.
   * Returns empty state if nothing found.
   */
  async getProject(): Promise<StoredProjectData> {
    try {
      const raw = await get(PROJECT_KEY);
      if (!raw) return {
        tasks: [],
        todoRows: [],
        priorityDials: { left: '', right: '', focusedSide: 'none' as const },
        todoProjects: [],
        updatedAt: Date.now(),
      };

      const result = ProjectDataSchema.safeParse(raw);

      if (!result.success) {
        console.error('CRITICAL: Storage Schema Validation Failed', result.error);
        // 🛡️ MIGRATION / FALLBACK STRATEGY
        // Attempt Partial Salvage for tasks if possible
        if (
          raw &&
          typeof raw === 'object' &&
          'tasks' in raw &&
          Array.isArray((raw as { tasks: unknown }).tasks)
        ) {
          console.warn('Attempting legacy salvage of tasks...');
          return {
            tasks: (raw as { tasks: TaskItem[] }).tasks,
            todoRows: [],
            priorityDials: { left: '', right: '', focusedSide: 'none' as const },
            todoProjects: [],
            updatedAt: Date.now(),
          } as StoredProjectData;
        }

        return {
          tasks: [],
          todoRows: [],
          priorityDials: { left: '', right: '', focusedSide: 'none' as const },
          todoProjects: [],
          updatedAt: Date.now(),
        };
      }

      return result.data;
    } catch (error) {
      console.error('Failed to load project from IndexedDB:', error);
      return {
        tasks: [],
        todoRows: [],
        priorityDials: { left: '', right: '', focusedSide: 'none' as const },
        todoProjects: [],
        updatedAt: Date.now(),
      };
    }
  },

  /**
   * Saves the entire project state.
   * Note: This includes the base64 images, which is why we use IDB not LocalStorage.
   */
  async saveProject(
    tasks: TaskItem[],
    transcript?: string,
    scoutResults?: string[],
    projectType?: 'video' | 'text',
    projectTitle?: string,
    scoutTopic?: string,
    scoutPlatform?: string,
    scoutHistory?: string[],
    todoProjects?: import('@/schemas/storage').TodoProject[],
    activeProjectId?: string,
  ): Promise<void> {
    try {
      const payload: StoredProjectData = {
        tasks,
        transcript,
        scoutResults,
        projectType,
        projectTitle,
        scoutTopic,
        scoutPlatform,
        scoutHistory,
        // Legacy fields kept empty (migration has already run)
        todoRows: [],
        priorityDials: { left: '', right: '', focusedSide: 'none' },
        // New project-scoped data
        todoProjects: todoProjects || [],
        activeProjectId,
        updatedAt: Date.now(),
      };
      await set(PROJECT_KEY, payload);
    } catch (error: unknown) {
      console.error('Failed to save project to IndexedDB:', error);
      const err = error as Error;
      if (err?.name === 'QuotaExceededError') {
        alert('⚠️ Storage Full! Please EXPORT a backup immediately.');
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
  },
};

