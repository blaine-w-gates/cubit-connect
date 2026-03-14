import { get, set, del, keys } from 'idb-keyval';
import { ProjectDataSchema, StoredProjectData, TaskItem } from '@/schemas/storage';
import { getUnoWorkspaceId, getDeviceId, getStorageKey } from '@/lib/identity';
import type { WorkspaceType } from '@/lib/identity';

const LEGACY_KEY = 'cubit_connect_project_v1';
const MIGRATION_FLAG = 'cubit_migration_done_v2';
const MIGRATION_BACKUP_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export type { StoredProjectData, TaskItem, CubitStep, TodoRow, PriorityDials, TodoProject, TodoStep } from '@/schemas/storage';

function emptyState(): StoredProjectData {
  return {
    tasks: [],
    todoRows: [],
    priorityDials: { left: '', right: '', focusedSide: 'none' as const },
    todoProjects: [],
    yjsState: undefined,
    updatedAt: Date.now(),
  };
}

export const storageService = {
  /**
   * Loads project state from the workspace-namespaced IndexedDB key.
   * Falls back to the legacy key if no namespaced data exists (pre-migration).
   */
  async getProject(workspaceType?: WorkspaceType, workspaceId?: string): Promise<StoredProjectData> {
    const wsType = workspaceType || 'personalUno';
    const wsId = workspaceId || getUnoWorkspaceId();
    const key = getStorageKey(wsType, wsId);

    try {
      let raw = await get(key);

      // Fallback: if no namespaced data yet, check legacy key (transparent migration)
      if (!raw && wsType === 'personalUno') {
        raw = await get(LEGACY_KEY);
      }

      if (!raw) return emptyState();

      const result = ProjectDataSchema.safeParse(raw);

      if (!result.success) {
        console.error('CRITICAL: Storage Schema Validation Failed', result.error);
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
            yjsState: undefined,
            updatedAt: Date.now(),
          } as StoredProjectData;
        }
        return emptyState();
      }

      return result.data;
    } catch (error) {
      console.error('Failed to load project from IndexedDB:', error);
      return emptyState();
    }
  },

  /**
   * Saves the entire project state to the workspace-namespaced key.
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
    inputMode?: 'video' | 'text' | 'scout',
    todoProjects?: import('@/schemas/storage').TodoProject[],
    activeProjectId?: string,
    yjsState?: Uint8Array,
    workspaceType?: WorkspaceType,
    workspaceId?: string,
  ): Promise<void> {
    const wsType = workspaceType || 'personalUno';
    const wsId = workspaceId || getUnoWorkspaceId();
    const key = getStorageKey(wsType, wsId);

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
        inputMode,
        todoRows: [],
        priorityDials: { left: '', right: '', focusedSide: 'none' },
        todoProjects: todoProjects || [],
        activeProjectId,
        yjsState,
        updatedAt: Date.now(),
      };
      await set(key, payload);
    } catch (error: unknown) {
      console.error('Failed to save project to IndexedDB:', error);
      const err = error as Error;
      if (err?.name === 'QuotaExceededError') {
        alert('⚠️ Storage Full! Please EXPORT a backup immediately.');
      }
      throw error;
    }
  },

  /**
   * Clears project data for a specific workspace namespace.
   */
  async clearProject(workspaceType?: WorkspaceType, workspaceId?: string): Promise<void> {
    const wsType = workspaceType || 'personalUno';
    const wsId = workspaceId || getUnoWorkspaceId();
    const key = getStorageKey(wsType, wsId);

    try {
      await del(key);
    } catch (error) {
      console.error('Failed to clear project:', error);
    }
  },

  /**
   * One-time migration: copy legacy data into personalUno namespace.
   * Keeps the old key as a backup for 30 days.
   */
  async migrateIfNeeded(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const alreadyDone = localStorage.getItem(MIGRATION_FLAG);
    if (alreadyDone) {
      this.cleanupLegacyBackup();
      return false;
    }

    try {
      const legacyData = await get(LEGACY_KEY);
      if (!legacyData) {
        localStorage.setItem(MIGRATION_FLAG, String(Date.now()));
        return false;
      }

      const unoWorkspaceId = getUnoWorkspaceId();
      const deviceId = getDeviceId();
      const newKey = getStorageKey('personalUno', unoWorkspaceId);

      const existingNew = await get(newKey);
      if (existingNew) {
        localStorage.setItem(MIGRATION_FLAG, String(Date.now()));
        return false;
      }

      const parsed = ProjectDataSchema.safeParse(legacyData);
      if (parsed.success) {
        const data = parsed.data;
        if (data.todoProjects) {
          data.todoProjects = data.todoProjects.map(p => ({
            ...p,
            workspaceType: 'personalUno' as const,
            workspaceId: unoWorkspaceId,
            ownerId: deviceId,
          }));
        }
        await set(newKey, data);
      } else {
        await set(newKey, legacyData);
      }

      localStorage.setItem(MIGRATION_FLAG, String(Date.now()));
      console.log('✅ Migration complete: legacy data copied to personalUno namespace');
      return true;
    } catch (error) {
      console.error('Migration failed:', error);
      return false;
    }
  },

  /**
   * Garbage-collect the legacy key after 30-day backup window.
   */
  async cleanupLegacyBackup(): Promise<void> {
    const migrationTime = localStorage.getItem(MIGRATION_FLAG);
    if (!migrationTime) return;

    const elapsed = Date.now() - Number(migrationTime);
    if (elapsed > MIGRATION_BACKUP_TTL) {
      try {
        await del(LEGACY_KEY);
        console.log('🗑️ Legacy backup key removed after 30-day retention');
      } catch {
        // Non-critical
      }
    }
  },

  /**
   * List all workspace-namespaced keys in IndexedDB (for debugging).
   */
  async listNamespaces(): Promise<string[]> {
    const allKeys = await keys();
    return allKeys
      .map(k => String(k))
      .filter(k => k.startsWith('cubit_'));
  },
};
