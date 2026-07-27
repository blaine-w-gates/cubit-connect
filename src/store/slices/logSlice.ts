/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Log Slice — Log persistence and management.
 *
 * Includes: logs state, addLog, clearLogs, LogEntry type.
 *
 * Extracted from useAppStore.ts as part of store decomposition (#25).
 */

export interface LogEntry {
  id: string;
  message: string;
  timestamp: string;
}

export interface LogSliceState {
  logs: LogEntry[];
  addLog: (message: string) => void;
  clearLogs: () => void;
}

export function createLogSlice(
  set: (partial: any) => void,
  _get: () => any
): LogSliceState {
  return {
    logs: [],

    addLog: (message: string) => {
      set((state: any) => {
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
  };
}
