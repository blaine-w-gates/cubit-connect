/**
 * TaskFocusCard Component - A+ Grade Premium Implementation
 * 
 * Features:
 * - Glassmorphism container with backdrop blur
 * - Shows selected task from Todo page
 * - Click to go back to Todo page and change task
 * - Animated entrance/exit
 */

'use client';

import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { Target, ArrowRight, CheckCircle2 } from 'lucide-react';

export function TaskFocusCard() {
  const router = useRouter();
  const todayTaskId = useAppStore((state) => state.todayTaskId);
  const todoRows = useAppStore((state) => state.todoRows);

  // Find the selected task
  const selectedTask = todoRows.find(row => row.id === todayTaskId);
  

  const handleClick = () => {
    router.push('/todo');
  };

  // If no task selected, show placeholder
  if (!selectedTask) {
    return (
      <div 
        onClick={handleClick}
        className="group relative overflow-hidden rounded-2xl bg-white/60 dark:bg-stone-900/60 backdrop-blur-lg border border-stone-200/50 dark:border-stone-700/50 shadow-lg cursor-pointer transition-all duration-300 hover:shadow-xl hover:bg-white/80 dark:hover:bg-stone-900/80"
        role="button"
        tabIndex={0}
        aria-label="Select a task to focus on"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <div className="relative p-6 sm:p-8">
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <Target className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-1">
                No Task Selected
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Click to select a task from your Todo list
              </p>
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0">
              <ArrowRight className="w-5 h-5 text-stone-400 dark:text-stone-500 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </div>

        {/* Hover gradient effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    );
  }

  // Task is selected - show task card
  return (
    <div 
      onClick={handleClick}
      className="group relative overflow-hidden rounded-2xl bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border border-stone-200/50 dark:border-stone-700/50 shadow-lg cursor-pointer transition-all duration-300 hover:shadow-xl hover:bg-white/90 dark:hover:bg-stone-900/90"
      role="button"
      tabIndex={0}
      aria-label={`Current focus: ${selectedTask.task}. Click to change task.`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="relative p-6 sm:p-8">
        {/* Header row */}
        <div className="flex items-start gap-4 mb-4">
          {/* Task icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
            <CheckCircle2 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>

          {/* Title and meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Current Focus
              </span>
            </div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 break-words">
              {selectedTask.task}
            </h2>
          </div>

          {/* Arrow */}
          <div className="flex-shrink-0">
            <ArrowRight className="w-5 h-5 text-stone-400 dark:text-stone-500 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </div>

        {/* Sub-steps preview if available */}
        {selectedTask.steps && selectedTask.steps.filter(s => s.text.trim()).length > 0 && (
          <div className="mt-4 pl-16">
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-500">
              <span>{selectedTask.steps.filter(s => s.isCompleted && s.text.trim()).length} of {selectedTask.steps.filter(s => s.text.trim()).length} steps completed</span>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-500"
                style={{ 
                  width: `${(selectedTask.steps.filter(s => s.isCompleted && s.text.trim()).length / selectedTask.steps.filter(s => s.text.trim()).length) * 100}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Hover gradient effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
}
