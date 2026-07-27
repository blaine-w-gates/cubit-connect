import type { TimerSession, TodayPreferences } from '@/schemas/storage';
import { yjsContext } from '@/lib/yjsContext';

export interface TimerSliceState {
  // Timer State
  activeTimerSession: TimerSession | null;
  timerRemainingSeconds: number;
  timerStatus: 'idle' | 'running' | 'paused' | 'completed';

  // Task Selection
  todayTaskId: string | null;
  todayTaskDialSource: 'left' | 'right' | null;
  todayPreferences: TodayPreferences;
  timerSessions: TimerSession[];

  // Timer Actions
  selectTaskForToday: (taskId: string, dialSource: 'left' | 'right' | null) => void;
  clearTodayTask: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  completeTimer: () => void;
  tickTimer: (remainingSeconds: number) => void;
  updateTimerPreferences: (prefs: Partial<TodayPreferences>) => void;
  addTimerSession: (session: TimerSession) => void;
}

export function createTimerSlice(
  set: (partial: any) => void,
  get: () => any
): TimerSliceState {
  return {
    // Initial State
    activeTimerSession: null,
    timerRemainingSeconds: 25 * 60,
    timerStatus: 'idle',
    todayTaskId: null,
    todayTaskDialSource: null,
    todayPreferences: {
      defaultDuration: 25,
      autoStart: false,
      soundEnabled: true,
      soundVolume: 1,
      notificationEnabled: true,
      vibrationEnabled: true,
      showRowTomatoButtons: true,
    },
    timerSessions: [],

    // Actions
    selectTaskForToday: (taskId: string, dialSource: 'left' | 'right' | null) => {
      const state = get();
      const activeProject = state.todoProjects.find((p: any) => p.id === state.activeProjectId);
      const task = activeProject?.todoRows.find((r: any) => r.id === taskId);

      if (!task) {
        return;
      }

      set({
        todayTaskId: taskId,
        todayTaskDialSource: dialSource,
        timerStatus: 'idle',
        timerRemainingSeconds: state.todayPreferences.defaultDuration * 60,
      });
    },

    clearTodayTask: () => {
      const state = get();
      if (state.timerStatus === 'running' || state.timerStatus === 'paused') {
        if (state.activeTimerSession) {
          const abandonedSession = {
            ...state.activeTimerSession,
            status: 'abandoned' as const,
            endedAt: Date.now(),
          };
          set((s: any) => ({
            timerSessions: [...s.timerSessions, abandonedSession],
          }));
        }
      }

      set({
        todayTaskId: null,
        todayTaskDialSource: null,
        activeTimerSession: null,
        timerStatus: 'idle',
        timerRemainingSeconds: get().todayPreferences.defaultDuration * 60,
      });
    },

    startTimer: () => {
      const state = get();
      if (!state.todayTaskId) {
        return;
      }
      if (state.activeTimerSession?.status === 'running') {
        return;
      }

      const now = Date.now();
      const durationMs = state.todayPreferences.defaultDuration * 60 * 1000;

      const newSession = {
        id: crypto.randomUUID(),
        taskId: state.todayTaskId,
        projectId: state.activeProjectId || '',
        dialSource: state.todayTaskDialSource || 'left',
        status: 'running' as const,
        startedAt: now,
        durationMs,
        totalPausedMs: 0,
        interruptions: [],
        ownerClientId: '',
        ownerTabId: '',
        ownerDeviceId: state.deviceId,
        completed: false,
      };

      set({
        activeTimerSession: newSession,
        timerStatus: 'running',
        timerRemainingSeconds: state.todayPreferences.defaultDuration * 60,
      });
    },

    pauseTimer: () => {
      const state = get();
      if (state.timerStatus !== 'running' || !state.activeTimerSession) {
        return;
      }
      if (state.activeTimerSession.status === 'paused') {
        return;
      }

      const now = Date.now();
      const pausedAt = now;

      const updatedSession = {
        ...state.activeTimerSession,
        status: 'paused' as const,
        lastPausedAt: pausedAt,
        interruptions: [
          ...state.activeTimerSession.interruptions,
          { pausedAt, resumedAt: undefined },
        ],
      };

      set({
        activeTimerSession: updatedSession,
        timerStatus: 'paused',
      });
    },

    resumeTimer: () => {
      const state = get();
      if (state.timerStatus !== 'paused' || !state.activeTimerSession) {
        return;
      }
      if (state.activeTimerSession.status === 'running') {
        return;
      }

      const now = Date.now();
      const pausedDuration = state.activeTimerSession.lastPausedAt
        ? now - state.activeTimerSession.lastPausedAt
        : 0;

      const updatedInterruptions = [...state.activeTimerSession.interruptions];
      const lastInterruption = updatedInterruptions[updatedInterruptions.length - 1];
      if (lastInterruption && !lastInterruption.resumedAt) {
        lastInterruption.resumedAt = now;
      }

      const updatedSession = {
        ...state.activeTimerSession,
        status: 'running' as const,
        totalPausedMs: state.activeTimerSession.totalPausedMs + pausedDuration,
        lastPausedAt: undefined,
        interruptions: updatedInterruptions,
      };

      set({
        activeTimerSession: updatedSession,
        timerStatus: 'running',
      });
    },

    stopTimer: () => {
      const state = get();
      if (!state.activeTimerSession) {
        return;
      }

      const abandonedSession = {
        ...state.activeTimerSession,
        status: 'abandoned' as const,
        endedAt: Date.now(),
      };

      set((s: any) => ({
        timerSessions: [...s.timerSessions, abandonedSession],
        activeTimerSession: null,
        timerStatus: 'idle',
        timerRemainingSeconds: s.todayPreferences.defaultDuration * 60,
      }));

      yjsContext.ydoc.transact(() => {
        yjsContext.yMetaMap.set('timerSessions', JSON.stringify([...get().timerSessions, abandonedSession]));
        yjsContext.yMetaMap.delete('activeTimerSession');
        yjsContext.yMetaMap.delete('timerStatus');
        yjsContext.yMetaMap.delete('timerRemainingSeconds');
      }, 'local');
    },

    resetTimer: () => {
      set((s: any) => ({
        activeTimerSession: null,
        timerStatus: 'idle',
        timerRemainingSeconds: s.todayPreferences.defaultDuration * 60,
      }));
    },

    completeTimer: () => {
      const state = get();
      if (!state.activeTimerSession) {
        return;
      }

      const completedSession = {
        ...state.activeTimerSession,
        status: 'completed' as const,
        completed: true,
        endedAt: Date.now(),
      };

      const updatedSession = {
        ...completedSession,
        status: 'completed' as const,
      };

      set((s: any) => ({
        timerSessions: [...s.timerSessions, completedSession],
        activeTimerSession: updatedSession,
        timerStatus: 'completed',
      }));

      if (state.todayPreferences.notificationEnabled && typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          new Notification('Pomodoro Complete!', {
            body: 'Time for a break!',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'pomodoro-complete',
            requireInteraction: true,
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              new Notification('Pomodoro Complete!', {
                body: 'Time for a break!',
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'pomodoro-complete',
                requireInteraction: true,
              });
            }
          });
        }
      }

      yjsContext.ydoc.transact(() => {
        yjsContext.yMetaMap.set('timerSessions', JSON.stringify([...get().timerSessions, completedSession]));
        yjsContext.yMetaMap.set('activeTimerSession', JSON.stringify(updatedSession));
        yjsContext.yMetaMap.set('timerStatus', 'completed');
      }, 'local');

      setTimeout(() => {
        yjsContext.ydoc.transact(() => {
          yjsContext.yMetaMap.delete('activeTimerSession');
          yjsContext.yMetaMap.delete('timerStatus');
          yjsContext.yMetaMap.delete('timerRemainingSeconds');
        }, 'local');
      }, 5000);
    },

    tickTimer: (remainingSeconds: number) => {
      set({ timerRemainingSeconds: remainingSeconds });
    },

    updateTimerPreferences: (prefs: Partial<TodayPreferences>) => {
      set((s: any) => ({
        todayPreferences: { ...s.todayPreferences, ...prefs },
      }));
    },

    addTimerSession: (session: TimerSession) => {
      set((s: any) => ({
        timerSessions: [...s.timerSessions, session],
      }));
    },
  };
}
