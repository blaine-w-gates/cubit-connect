/**
 * useAlarmEngine Hook - V1 Implementation
 *
 * Manages alarm scheduling and triggering for the Pomodoro/Today page.
 *
 * ⚠️ V1 LIMITATION (Documented):
 * This hook uses setInterval which runs in the main browser thread.
 * When the browser tab is backgrounded/minimized:
 *   - Chrome throttles setInterval to at most 1 execution per minute
 *   - Mobile browsers may suspend the tab entirely
 *   - Alarms will NOT fire reliably unless the tab is active and visible
 *
 * For V2, we will implement a Service Worker for true background delivery.
 * Until then, the UI must communicate: "Alarms notify you while the app is open."
 *
 * Architecture:
 * - Reads from Zustand store (alarms stored per-project in TodoProject)
 * - Active alarms are mirrored to a local ref for efficient polling
 * - On trigger: calls notification API + plays sound (if enabled)
 * - Snooze: adds 300000ms (5 minutes) to alarmTimeMs
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { AlarmRecord, AlarmRecurrence } from '@/schemas/storage';
import { showTimerNotification } from '@/components/today/NotificationBell';
import { useAudioContext } from './useAudioContext';
import { toast } from 'sonner';

// V2: Helper to calculate next alarm time based on recurrence
function calculateNextAlarmTime(currentTimeMs: number, recurrence: AlarmRecurrence): number | null {
  const current = new Date(currentTimeMs);
  
  switch (recurrence.type) {
    case 'daily': {
      // Next day at same time
      const next = new Date(current);
      next.setDate(next.getDate() + 1);
      return next.getTime();
    }
    case 'weekdays': {
      // Find next weekday (Mon-Fri)
      const weekdays = recurrence.weekdays || [1, 2, 3, 4, 5]; // Default Mon-Fri
      const currentDay = current.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      
      // Find next valid day
      let daysToAdd = 1;
      let nextDay = (currentDay + daysToAdd) % 7;
      
      while (daysToAdd <= 7) {
        if (weekdays.includes(nextDay)) {
          const next = new Date(current);
          next.setDate(next.getDate() + daysToAdd);
          return next.getTime();
        }
        daysToAdd++;
        nextDay = (currentDay + daysToAdd) % 7;
      }
      return null;
    }
    default:
      return null;
  }
}

// Extended alarm type with project ID attached
interface AlarmWithProjectId extends AlarmRecord {
  _projectId: string;
}

interface AlarmEngineState {
  pendingAlarms: AlarmRecord[];
  checkAlarms: () => void;
  snoozeAlarm: (alarmId: string, projectId: string) => void;
  dismissAlarm: (alarmId: string, projectId: string) => void;
}

const SNOOZE_DURATION_MS = 300000; // 5 minutes
const CHECK_INTERVAL_MS = 1000; // Check every second

export function useAlarmEngine(): AlarmEngineState {
  // V2: Get audio preferences from store
  const todayPreferences = useAppStore((state) => state.todayPreferences);
  
  const { playCompletionSound } = useAudioContext({
    enabled: todayPreferences.soundEnabled,
    volume: todayPreferences.soundVolume ?? 1.0,
  });

  // Get all projects to access their alarms
  const todoProjects = useAppStore((state) => state.todoProjects);
  const updateAlarmStatus = useAppStore((state) => state.updateAlarmStatus);
  const createAlarm = useAppStore((state) => state.createAlarm);

  // Derive alarms directly from store - no duplicate state
  const allAlarms: AlarmWithProjectId[] = useMemo(
    () =>
      todoProjects.flatMap((project) =>
        (project.alarms || []).map((alarm) => ({
          ...alarm,
          _projectId: project.id,
        }))
      ),
    [todoProjects]
  );

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Check all pending alarms and trigger any that are due.
   * V1 Limitation: This only runs when the tab is active.
   */
  const checkAlarms = useCallback(() => {
    const now = Date.now();

    // V1.5 Fix: Only trigger alarms in the visible tab to prevent double-chime
    // when multiple tabs are open. The Yjs sync will propagate the triggered
    // status to all tabs within a few hundred ms.
    if (document.visibilityState === 'hidden') {
      return;
    }

    allAlarms.forEach((alarm) => {
      if (alarm.status !== 'pending') return;

      if (now >= alarm.alarmTimeMs) {
        // Trigger alarm
        console.log('[AlarmEngine] Triggering alarm:', alarm.id, alarm.stepText);

        // Play sound if enabled (with fallback for blocked AudioContext)
        try {
          playCompletionSound();
        } catch (audioError) {
          console.warn('[AlarmEngine] Audio blocked by browser policy:', audioError);
          toast.info('🔔 Alarm Triggered (Audio Blocked)', {
            description: `${alarm.taskText}: ${alarm.stepText}`,
            duration: 5000,
          });
        }

        // Show notification
        showTimerNotification(
          `Alarm: ${alarm.projectName}`,
          `${alarm.taskText}: ${alarm.stepText}`
        );

        // Update status to triggered (V1: alarm shows as triggered until user dismisses in Phase 3 UI)
        updateAlarmStatus?.(alarm.id, alarm._projectId, 'triggered');
        
        // V2: Handle recurrence - create next instance if recurring
        if (alarm.recurrence && alarm.recurrence.type !== 'once') {
          const nextTimeMs = calculateNextAlarmTime(alarm.alarmTimeMs, alarm.recurrence);
          if (nextTimeMs) {
            const nextAlarm: AlarmRecord = {
              ...alarm,
              id: crypto.randomUUID(), // New ID for the next instance
              alarmTimeMs: nextTimeMs,
              status: 'pending',
              snoozeCount: 0,
              createdAt: Date.now(),
              recurrence: {
                ...alarm.recurrence,
                isRecurringInstance: true,
                parentAlarmId: alarm.recurrence.parentAlarmId || alarm.id,
              },
            };
            createAlarm?.(alarm._projectId, nextAlarm);
            console.log('[AlarmEngine] Created next recurring instance:', nextAlarm.id, 'for', new Date(nextTimeMs).toLocaleString());
          }
        }
      }
    });
  }, [allAlarms, playCompletionSound, updateAlarmStatus, createAlarm]);

  /**
   * Snooze an alarm by 5 minutes (300000ms).
   * Increments snoozeCount and updates alarmTimeMs.
   */
  const snoozeAlarm = useCallback(
    (alarmId: string, projectId: string) => {
      const project = todoProjects.find((p) => p.id === projectId);
      if (!project) return;

      const alarm = project.alarms?.find((a) => a.id === alarmId);
      if (!alarm) return;

      const newAlarmTime = Date.now() + SNOOZE_DURATION_MS;
      const newSnoozeCount = (alarm.snoozeCount || 0) + 1;

      // Use Zustand action to update
      updateAlarmStatus?.(alarmId, projectId, 'snoozed', {
        alarmTimeMs: newAlarmTime,
        snoozeCount: newSnoozeCount,
        originalAlarmTimeMs: alarm.originalAlarmTimeMs || alarm.alarmTimeMs,
      });
    },
    [todoProjects, updateAlarmStatus]
  );

  /**
   * Dismiss an alarm permanently.
   */
  const dismissAlarm = useCallback(
    (alarmId: string, projectId: string) => {
      updateAlarmStatus?.(alarmId, projectId, 'dismissed');
    },
    [updateAlarmStatus]
  );

  /**
   * Set up the alarm check interval.
   * V1 Limitation: This interval is throttled when tab is backgrounded.
   */
  useEffect(() => {
    // Set up interval (initial check happens on first tick)
    intervalRef.current = setInterval(() => {
      checkAlarms();
    }, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkAlarms]);

  // Get pending alarms for the return value
  const pendingAlarms = allAlarms.filter((a) => a.status === 'pending');

  return {
    pendingAlarms,
    checkAlarms,
    snoozeAlarm,
    dismissAlarm,
  };
}
