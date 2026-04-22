'use client';

import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { AlarmRecord } from '@/schemas/storage';
import { Bell, Clock, CheckCircle, AlertCircle, PauseCircle, X, Pencil } from 'lucide-react';
import { useMemo, useCallback, useState } from 'react';
import { toast } from 'sonner';

function AlarmCard({
  alarm,
  onSnooze,
  onDismiss,
  onEdit,
  isTriggered,
}: {
  alarm: AlarmRecord;
  onSnooze?: () => void;
  onDismiss: () => void;
  onEdit?: () => void;
  isTriggered: boolean;
}) {
  // V1.5: Use system locale for correct timezone display
  const formattedTime = new Date(alarm.alarmTimeMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        isTriggered
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 shadow-sm animate-pulse'
          : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div
          className={`p-1.5 rounded-full shrink-0 ${
            isTriggered
              ? 'bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-400'
              : 'bg-cyan-100 dark:bg-cyan-800 text-cyan-600 dark:text-cyan-400'
          }`}
        >
          {isTriggered ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <Clock className="w-4 h-4" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1">
            {alarm.projectName}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1">
            → {alarm.taskText}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500 line-clamp-1">
            → {alarm.stepText}
          </p>

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={onEdit}
              disabled={isTriggered || !onEdit}
              className={`text-xs font-medium flex items-center gap-1 transition-colors ${
                isTriggered
                  ? 'text-amber-600 dark:text-amber-400 cursor-default'
                  : 'text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer'
              }`}
              title={isTriggered ? undefined : 'Click to edit time'}
            >
              {formattedTime}
              {!isTriggered && onEdit && (
                <Pencil className="w-3 h-3 opacity-50" />
              )}
            </button>
            {alarm.snoozeCount > 0 && (
              <span className="text-xs text-zinc-500 dark:text-zinc-500">
                (Snoozed {alarm.snoozeCount}x)
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {isTriggered ? (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={onSnooze}
              className="p-1.5 text-zinc-500 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-md transition-colors"
              title="Snooze 5 minutes"
            >
              <PauseCircle className="w-4 h-4" />
            </button>
            <button
              onClick={onDismiss}
              className="p-1.5 text-zinc-500 hover:text-green-600 dark:text-zinc-400 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-colors"
              title="Dismiss"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onDismiss}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-colors shrink-0"
            title="Cancel alarm"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function AlarmDashboard() {
  const { todoProjects, updateAlarmStatus } = useAppStore(
    useShallow((state) => ({
      todoProjects: state.todoProjects,
      updateAlarmStatus: state.updateAlarmStatus,
    }))
  );

  // Collect all alarms from all projects
  const { triggered, pending } = useMemo(() => {
    const allAlarms: { alarm: AlarmRecord; projectId: string }[] = [];

    todoProjects.forEach((project) => {
      (project.alarms || []).forEach((alarm) => {
        if (alarm.status !== 'dismissed') {
          allAlarms.push({
            alarm,
            projectId: project.id,
          });
        }
      });
    });

    // Sort triggered first (by alarm time desc), then pending (by alarm time asc)
    const triggered = allAlarms
      .filter((a) => a.alarm.status === 'triggered')
      .sort((a, b) => b.alarm.alarmTimeMs - a.alarm.alarmTimeMs);

    const pending = allAlarms
      .filter((a) => a.alarm.status === 'pending' || a.alarm.status === 'snoozed')
      .sort((a, b) => a.alarm.alarmTimeMs - b.alarm.alarmTimeMs);

    return { triggered, pending };
  }, [todoProjects]);

  const handleSnooze = useCallback((projectId: string, alarmId: string) => {
    const newTime = Date.now() + 5 * 60 * 1000; // 5 minutes from now
    updateAlarmStatus(projectId, alarmId, 'snoozed', {
      alarmTimeMs: newTime,
    });
    toast.info('Alarm snoozed for 5 minutes');
  }, [updateAlarmStatus]);

  const handleDismiss = (projectId: string, alarmId: string) => {
    updateAlarmStatus(projectId, alarmId, 'dismissed');
    toast.success('Alarm dismissed');
  };

  // V1.5: Edit modal state for pending alarms
  const [editingAlarm, setEditingAlarm] = useState<{ alarm: AlarmRecord; projectId: string } | null>(null);
  const [editDateTime, setEditDateTime] = useState('');

  const handleEditClick = (alarm: AlarmRecord, projectId: string) => {
    setEditingAlarm({ alarm, projectId });
    // Format the existing alarm time for datetime-local input
    const date = new Date(alarm.alarmTimeMs);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    setEditDateTime(date.toISOString().slice(0, 16));
  };

  const handleEditSave = () => {
    if (!editingAlarm || !editDateTime) return;

    const newTimeMs = new Date(editDateTime).getTime();

    if (newTimeMs <= Date.now()) {
      toast.error('Please select a time in the future');
      return;
    }

    updateAlarmStatus(editingAlarm.projectId, editingAlarm.alarm.id, 'pending', {
      alarmTimeMs: newTimeMs,
    });

    const formattedTime = new Date(newTimeMs).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    toast.success(`Alarm rescheduled for ${formattedTime}`);
    setEditingAlarm(null);
  };

  const hasAlarms = triggered.length > 0 || pending.length > 0;

  if (!hasAlarms) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-6 text-center">
        <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-700 rounded-full flex items-center justify-center mx-auto mb-3">
          <Bell className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No alarms set. Select a step in the Task page to set a reminder.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Triggered Alarms */}
      {triggered.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400 mb-3">
            <AlertCircle className="w-4 h-4" />
            Triggered ({triggered.length})
          </h3>
          <div className="space-y-2">
            {triggered.map(({ alarm, projectId }) => (
              <AlarmCard
                key={alarm.id}
                alarm={alarm}
                onSnooze={() => handleSnooze(projectId, alarm.id)}
                onDismiss={() => handleDismiss(projectId, alarm.id)}
                isTriggered={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pending Alarms */}
      {pending.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-600 dark:text-cyan-400 mb-3">
            <Clock className="w-4 h-4" />
            Upcoming ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(({ alarm, projectId }) => (
              <AlarmCard
                key={alarm.id}
                alarm={alarm}
                onSnooze={() => handleSnooze(projectId, alarm.id)}
                onDismiss={() => handleDismiss(projectId, alarm.id)}
                onEdit={() => handleEditClick(alarm, projectId)}
                isTriggered={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Edit Alarm Modal */}
      {editingAlarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditingAlarm(null)}
          />
          <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Reschedule Alarm
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {editingAlarm.alarm.projectName} → {editingAlarm.alarm.taskText}
            </p>
            <input
              type="datetime-local"
              value={editDateTime}
              onChange={(e) => setEditDateTime(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all mb-4"
              min={new Date().toISOString().slice(0, 16)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setEditingAlarm(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
