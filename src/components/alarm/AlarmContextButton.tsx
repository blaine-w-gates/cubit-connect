'use client';

import { useState } from 'react';
import { Bell, Clock } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AlarmTimePickerModal } from './AlarmTimePickerModal';

interface AlarmContextButtonProps {
  projectId: string;
  rowId: string;
  stepIndex: number;
  stepText: string;
  taskText: string;
  projectName: string;
  stepId: string;
  isSelected: boolean;
}

export function AlarmContextButton({
  projectId,
  rowId,
  stepIndex,
  stepText,
  taskText,
  projectName,
  stepId,
  isSelected,
}: AlarmContextButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Show clock icon when step is NOT selected but has a pending alarm would be shown here
  // For now, we only show the bell button when selected
  if (!isSelected) return null;

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsModalOpen(true);
        }}
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-full shadow-lg transition-all animate-in zoom-in-75 whitespace-nowrap"
        title="Set alarm for this step"
      >
        <Bell className="w-3.5 h-3.5" />
        <span>Set Alarm</span>
      </button>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <AlarmTimePickerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          projectId={projectId}
          rowId={rowId}
          stepIndex={stepIndex}
          stepText={stepText}
          taskText={taskText}
          projectName={projectName}
          stepId={stepId}
        />,
        document.body
      )}
    </>
  );
}

// Small clock indicator for steps that have pending alarms
interface AlarmIndicatorProps {
  alarmTimeMs: number;
}

export function AlarmIndicator({ alarmTimeMs }: AlarmIndicatorProps) {
  const formattedTime = new Date(alarmTimeMs).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <span className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 ml-1" title={`Alarm at ${formattedTime}`}>
      <Clock className="w-3 h-3" />
      {formattedTime}
    </span>
  );
}
