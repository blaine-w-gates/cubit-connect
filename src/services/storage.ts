import { get, set, del, keys } from 'idb-keyval';
import { ProjectDataSchema, StoredProjectData, TaskItem, TodoProject, TimerSession, TodayPreferences } from '@/schemas/storage';
import { getUnoWorkspaceId, getDeviceId, getStorageKey } from '@/lib/identity';
import type { WorkspaceType } from '@/lib/identity';

const LEGACY_KEY = 'cubit_connect_project_v1';
const MIGRATION_FLAG = 'cubit_migration_done_v2';
const MIGRATION_BACKUP_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export type { StoredProjectData, TaskItem, CubitStep, TodoRow, PriorityDials, TodoProject, TodoStep, TimerSession, TodayPreferences, AlarmRecord } from '@/schemas/storage';

function emptyState(): StoredProjectData {
  return {
    tasks: [],
    todoRows: [],
    priorityDials: { left: '', right: '', focusedSide: 'none' as const },
    todoProjects: [],
    yjsState: undefined,
    // Today Page timer state defaults
    timerSessions: [],
    todayPreferences: {
      defaultDuration: 25,
      autoStart: false,
      soundEnabled: true,
      soundVolume: 1,
      notificationEnabled: true,
      vibrationEnabled: true,
      showRowTomatoButtons: true,
    },
    activeTimerSession: null,
    todayTaskId: null,
    todayTaskDialSource: null,
    updatedAt: Date.now(),
  };
}

/**
 * Parameters for saving project data - refactored from 19 positional args
 * to a single object to prevent parameter order bugs and improve maintainability.
 */
export interface SaveProjectParams {
  tasks: TaskItem[];
  transcript?: string;
  scoutResults?: string[];
  projectType: 'video' | 'text' | 'scout' | null;
  projectTitle: string;
  scoutTopic?: string;
  scoutPlatform?: string;
  scoutHistory?: string[];
  inputMode: 'video' | 'text' | 'scout' | null;
  todoProjects: TodoProject[];
  activeProjectId?: string | null;
  yjsState: Uint8Array;
  workspaceType: WorkspaceType;
  workspaceId?: string;
  // Today Page timer state
  timerSessions?: TimerSession[];
  todayPreferences?: TodayPreferences;
  activeTimerSession?: TimerSession | null;
  todayTaskId?: string | null;
  todayTaskDialSource?: 'left' | 'right' | null;
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

      // Pre-process: Transform legacy todoRows with string steps to proper objects
      if (raw && typeof raw === 'object' && 'todoRows' in raw) {
        const rawData = raw as { todoRows?: unknown[] };
        if (Array.isArray(rawData.todoRows)) {
          rawData.todoRows = rawData.todoRows.map((row: unknown) => {
            if (row && typeof row === 'object' && 'steps' in row) {
              const rowObj = row as { steps: unknown; [key: string]: unknown };
              if (Array.isArray(rowObj.steps)) {
                // Transform string steps to TodoStep objects
                rowObj.steps = rowObj.steps.map((step: unknown) => {
                  if (typeof step === 'string') {
                    return { text: step, isCompleted: false };
                  }
                  return step;
                });
              }
            }
            return row;
          });
        }
      }

      // Pre-process: Backfill UUIDs for steps that don't have IDs (Alarm system V1 compatibility)
      // This ensures all steps have stable IDs for alarm references
      if (raw && typeof raw === 'object' && 'todoProjects' in raw) {
        const rawData = raw as { todoProjects?: unknown[] };
        if (Array.isArray(rawData.todoProjects)) {
          rawData.todoProjects = rawData.todoProjects.map((project: unknown) => {
            if (project && typeof project === 'object' && 'todoRows' in project) {
              const projObj = project as { todoRows?: unknown[]; [key: string]: unknown };
              if (Array.isArray(projObj.todoRows)) {
                projObj.todoRows = projObj.todoRows.map((row: unknown) => {
                  if (row && typeof row === 'object' && 'steps' in row) {
                    const rowObj = row as { steps?: unknown[]; [key: string]: unknown };
                    if (Array.isArray(rowObj.steps)) {
                      // Backfill UUID for any step missing an ID
                      rowObj.steps = rowObj.steps.map((step: unknown) => {
                        if (step && typeof step === 'object' && !('id' in step)) {
                          return { ...step, id: crypto.randomUUID() };
                        }
                        return step;
                      });
                    }
                  }
                  return row;
                });
              }
            }
            return project;
          });
        }
      }

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
            // Today Page timer state defaults for legacy salvage
            timerSessions: [],
            todayPreferences: {
              defaultDuration: 25,
              autoStart: false,
              soundEnabled: true,
              soundVolume: 1,
              notificationEnabled: true,
              vibrationEnabled: true,
              showRowTomatoButtons: true,
            },
            activeTimerSession: null,
            todayTaskId: null,
            todayTaskDialSource: null,
            updatedAt: Date.now(),
          } as StoredProjectData;
        }
        return emptyState();
      }

      // Migration: Inject defaults for missing timer fields
      const data = result.data;
      const migrated: StoredProjectData = {
        ...data,
        timerSessions: data.timerSessions ?? [],
        todayPreferences: data.todayPreferences ?? {
          defaultDuration: 25,
          autoStart: false,
          soundEnabled: true,
          notificationEnabled: true,
          vibrationEnabled: true,
          showRowTomatoButtons: true,
        },
        activeTimerSession: data.activeTimerSession ?? null,
        todayTaskId: data.todayTaskId ?? null,
        todayTaskDialSource: data.todayTaskDialSource ?? null,
      };

      return migrated;
    } catch (error) {
      console.error('Failed to load project from IndexedDB:', error);
      return emptyState();
    }
  },

  /**
   * Saves the entire project state to the workspace-namespaced key.
   */
  async saveProject(params: SaveProjectParams): Promise<void> {
    const wsType = params.workspaceType || 'personalUno';
    const wsId = params.workspaceId || getUnoWorkspaceId();
    const key = getStorageKey(wsType, wsId);

    try {
      const payload: StoredProjectData = {
        tasks: params.tasks,
        transcript: params.transcript,
        scoutResults: params.scoutResults,
        projectType: params.projectType,
        projectTitle: params.projectTitle,
        scoutTopic: params.scoutTopic,
        scoutPlatform: params.scoutPlatform,
        scoutHistory: params.scoutHistory,
        inputMode: params.inputMode,
        todoRows: [],
        priorityDials: { left: '', right: '', focusedSide: 'none' },
        todoProjects: params.todoProjects || [],
        activeProjectId: params.activeProjectId || null,
        yjsState: params.yjsState,
        workspaceId: wsId,
        workspaceType: wsType,
        // Today Page timer state (P1-T2)
        timerSessions: params.timerSessions || [],
        todayPreferences: params.todayPreferences || {
          defaultDuration: 25,
          autoStart: false,
          soundEnabled: true,
          soundVolume: 1,
          notificationEnabled: true,
          vibrationEnabled: true,
          showRowTomatoButtons: true,
        },
        activeTimerSession: params.activeTimerSession || null,
        todayTaskId: params.todayTaskId || null,
        todayTaskDialSource: params.todayTaskDialSource || null,
        updatedAt: Date.now(),
      };
      await set(key, payload);
    } catch (error: unknown) {
      console.error('Failed to save project to IndexedDB:', error);
      const err = error as Error;
      if (err?.name === 'QuotaExceededError') {
        if (typeof window !== 'undefined') {
          import('@/store/useAppStore').then(({ useAppStore }) => {
            useAppStore.getState().setIsSettingsOpen(true);
          });
        }
        alert('⚠️ Storage full! Open Settings to export and clear data.');
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

  /**
   * Estimate storage usage and quota for this origin.
   * Returns null if Storage API is unavailable (e.g. non-secure context).
   */
  async getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    } catch {
      return null;
    }
  },

  /**
   * Returns true if storage usage is above 80% of quota (warn user).
   */
  async isStorageNearLimit(): Promise<boolean> {
    const est = await this.getStorageEstimate();
    if (!est || est.quota <= 0) return false;
    return est.usage / est.quota >= 0.8;
  },
};
