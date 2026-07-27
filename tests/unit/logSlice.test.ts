/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogSlice, type LogSliceState } from '@/store/slices/logSlice';

describe('logSlice', () => {
  let set: (partial: any) => void;
  let slice: LogSliceState;

  beforeEach(() => {
    set = vi.fn() as any;
    slice = createLogSlice(set);
  });

  describe('initial state', () => {
    it('returns empty logs array', () => {
      expect(slice.logs).toEqual([]);
    });
  });

  describe('action keys', () => {
    const expectedActions = ['addLog', 'clearLogs'];

    it.each(expectedActions)('exposes %s as a function', (key) => {
      expect(typeof (slice as any)[key]).toBe('function');
    });
  });

  describe('addLog', () => {
    it('adds a new log entry with id, message, and timestamp', () => {
      let currentState: any = { logs: [] };
      set = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentState = updater(currentState);
        }
      }) as any;
      slice = createLogSlice(set);

      slice.addLog('test message');

      expect(currentState.logs.length).toBe(1);
      expect(currentState.logs[0].message).toBe('test message');
      expect(currentState.logs[0].id).toBeDefined();
      expect(currentState.logs[0].timestamp).toBeDefined();
    });

    it('deduplicates consecutive identical messages', () => {
      let currentState: any = { logs: [] };
      set = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentState = updater(currentState);
        }
      }) as any;
      slice = createLogSlice(set);

      slice.addLog('same message');
      slice.addLog('same message');

      expect(currentState.logs.length).toBe(1);
    });

    it('allows different consecutive messages', () => {
      let currentState: any = { logs: [] };
      set = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentState = updater(currentState);
        }
      }) as any;
      slice = createLogSlice(set);

      slice.addLog('first');
      slice.addLog('second');

      expect(currentState.logs.length).toBe(2);
    });

    it('caps at 50 entries', () => {
      let currentState: any = { logs: [] };
      set = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentState = updater(currentState);
        }
      }) as any;
      slice = createLogSlice(set);

      for (let i = 0; i < 55; i++) {
        slice.addLog(`message-${i}`);
      }

      expect(currentState.logs.length).toBe(50);
    });
  });

  describe('clearLogs', () => {
    it('sets logs to empty array', () => {
      slice.clearLogs();
      expect(set).toHaveBeenCalledWith({ logs: [] });
    });
  });
});
