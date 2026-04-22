'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Clock, Bell, Repeat } from 'lucide-react';
import { AlarmRecord, RecurrenceType } from '@/schemas/storage';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';

interface AlarmTimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  rowId: string;
  stepIndex: number;
  stepText: string;
  taskText: string;
  projectName: string;
  stepId: string;
}

export function AlarmTimePickerModal({
  isOpen,
  onClose,
  projectId,
  rowId,
  stepIndex,
  stepText,
  taskText,
  projectName,
  stepId,
}: AlarmTimePickerModalProps) {
  // Calculate initial date/time (now + 25 minutes) once on mount
  const getInitialDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 25);
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  const getInitialPermission = (): NotificationPermission => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  };

  const [dateTime, setDateTime] = useState(getInitialDateTime);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('once');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(getInitialPermission);
  const inputRef = useRef<HTMLInputElement>(null);
  const createAlarm = useAppStore((state) => state.createAlarm);
  const deviceId = useAppStore((state) => state.deviceId);
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const activeWorkspaceType = useAppStore((state) => state.activeWorkspaceType);


  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dateTime) {
      toast.error('Please select a date and time');
      return;
    }

    // Check notification permission
    if (notificationPermission !== 'granted') {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      if (result !== 'granted') {
        toast.error('Notifications are required for alarms to work');
        return;
      }
    }

    // Convert local datetime to Unix timestamp (ms)
    const alarmTimeMs = new Date(dateTime).getTime();

    // Validate: must be in the future
    if (alarmTimeMs <= Date.now()) {
      toast.error('Please select a time in the future');
      return;
    }

    // Create the alarm record
    const alarm: AlarmRecord = {
      id: crypto.randomUUID(),
      stepText: stepText || `Step ${stepIndex + 1}`,
      taskText: taskText || 'Untitled Task',
      projectName: projectName || 'Untitled Project',
      sourceProjectId: projectId,
      sourceTaskId: rowId,
      sourceStepId: stepId,
      alarmTimeMs,
      status: 'pending',
      snoozeCount: 0,
      createdAt: Date.now(),
      ownerClientId: deviceId,
      // V1.5: Identity bridging for future Supabase migration
      workspaceId: activeWorkspaceId,
      workspaceType: activeWorkspaceType,
      // V2: Recurrence support
      recurrence: recurrenceType !== 'once' ? {
        type: recurrenceType,
        weekdays: recurrenceType === 'weekdays' ? [1, 2, 3, 4, 5] : undefined, // Mon-Fri default
        isRecurringInstance: false,
      } : undefined,
    };

    createAlarm(projectId, alarm);

    // Format for display using user's system locale (V1.5 fix for timezone correctness)
    const formattedTime = new Date(alarmTimeMs).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    toast.success(`Alarm set for ${formattedTime}`, {
      description: `${projectName} → ${taskText} → ${alarm.stepText}`,
    });

    onClose();
  };

  if (!isOpen) return null;

  const needsPermission = notificationPermission !== 'granted';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Set Alarm
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Context Display */}
        <div className="mb-6 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Alarm for:</p>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
            {projectName}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            → {taskText || 'Untitled Task'}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            → {stepText || `Step ${stepIndex + 1}`}
          </p>
        </div>

        {/* Permission Warning */}
        {needsPermission && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Browser notifications are required for alarms. You&apos;ll be prompted to enable them when you save.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            When should we remind you?
          </label>
          <input
            ref={inputRef}
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
            min={new Date().toISOString().slice(0, 16)}
          />
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Default: 25 minutes from now (Pomodoro)
          </p>

          {/* Recurrence Selection */}
          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              <Repeat className="w-4 h-4" />
              Repeat
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRecurrenceType('once')}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  recurrenceType === 'once'
                    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                Once
              </button>
              <button
                type="button"
                onClick={() => setRecurrenceType('daily')}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  recurrenceType === 'daily'
                    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setRecurrenceType('weekdays')}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  recurrenceType === 'weekdays'
                    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                Weekdays
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors shadow-sm"
            >
              Set Alarm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
