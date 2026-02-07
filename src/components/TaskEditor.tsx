'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Wand2, Check } from 'lucide-react';

// Safe internal Spinner to prevent Lucide import issues
const Spinner = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
import { EditableText } from '@/components/ui/EditableText';
import { useAppStore } from '@/store/useAppStore';
import { TaskItem, CubitStep } from '@/services/storage';
import { memo } from 'react';

import { useShallow } from 'zustand/react/shallow';

interface TaskEditorProps {
  task: TaskItem;
  onCubit: (taskId: string, context: string, stepId?: string) => void;
}

const TaskEditor = memo(function TaskEditor({ task, onCubit }: TaskEditorProps) {
  const [expanded, setExpanded] = useState(false);

  // Performance: Use shallow selector to prevent stable re-renders
  // Optimized: Only return activeProcessingId if it matches THIS task or its sub-steps
  const { updateTask, updateDeepStep, toggleStepCompletion, activeProcessingId } = useAppStore(
    useShallow((state) => {
      let relevantId: string | null = null;
      if (state.activeProcessingId === task.id) {
        relevantId = state.activeProcessingId;
      } else if (task.sub_steps?.some((step) => step.id === state.activeProcessingId)) {
        relevantId = state.activeProcessingId;
      }

      return {
        updateTask: state.updateTask,
        updateDeepStep: state.updateDeepStep,
        toggleStepCompletion: state.toggleStepCompletion,
        activeProcessingId: relevantId,
      };
    }),
  );

  return (
    <div className="p-4 mb-3 mx-2 sm:mx-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl hover:shadow-md transition-all">
      <div
        className={`flex gap-4 items-start rounded-lg p-2 transition-all ${activeProcessingId === task.id ? 'bg-purple-50 dark:bg-purple-900/20 animate-pulse' : ''}`}
      >
        {/* Content - Full Width (No Thumbnail) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex-1 pr-2 truncate">
              <EditableText
                value={task.task_name}
                onSave={(val) => updateTask(task.id, { task_name: val })}
                className="text-base font-bold text-zinc-900 dark:text-zinc-100 block truncate"
              />
            </div>
            <button
              className="text-xs flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 transition-colors flex-shrink-0"
              // Main Task Cubit (Level 1 -> 2)
              onClick={() =>
                onCubit(
                  task.id,
                  `Task: ${task.task_name}. Description: ${task.description}`,
                  undefined,
                )
              }
              disabled={activeProcessingId === task.id}
              aria-label="Generate sub-steps"
            >
              {activeProcessingId === task.id ? (
                <Spinner className="w-3 h-3 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
              {activeProcessingId === task.id ? 'Thinking...' : 'Cubit'}
            </button>
          </div>

          <EditableText
            value={task.description}
            onSave={(val) => updateTask(task.id, { description: val })}
            className="text-sm text-zinc-600 dark:text-zinc-400 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700"
            multiline
          />

          {/* Sub-steps Accordion Trigger */}
          {task.sub_steps && task.sub_steps.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs text-zinc-500 dark:text-zinc-500 flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {expanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              {task.sub_steps.length} Steps Generated
            </button>
          )}
        </div>
      </div>

      {/* Accordion Body (Level 2: Sub-steps) */}
      {expanded && task.sub_steps && (
        <div className="mt-3 ml-2 sm:ml-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-lg p-3 text-sm border-t border-zinc-100 dark:border-zinc-800 space-y-4 border border-zinc-200/50 dark:border-zinc-700/50">
          {task.sub_steps.map((step, idx) => (
            <div
              key={step.id || idx}
              className={`space-y-2 rounded-md p-1 transition-all ${activeProcessingId === step.id ? 'bg-purple-50 dark:bg-purple-900/20 shadow-[0_0_15px_-3px_rgba(168,85,247,0.2)]' : ''}`}
            >
              <div className="flex items-start justify-between gap-2 group">
                <div className="flex gap-2 flex-1 items-start">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleStepCompletion(task.id, step.id)}
                    aria-label={
                      step.isCompleted ? 'Mark step as incomplete' : 'Mark step as complete'
                    }
                    className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${step.isCompleted
                      ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100'
                      : 'border-zinc-400 hover:border-zinc-600 dark:border-zinc-500 dark:hover:border-zinc-300'
                      }`}
                  >
                    {step.isCompleted && (
                      <Check className="w-2.5 h-2.5 text-white dark:text-zinc-900" />
                    )}
                  </button>

                  <div className="flex-1">
                    <EditableText
                      value={step.text}
                      onSave={(val) => updateDeepStep(task.id, step.id, val)}
                      className={`transition-all ${step.isCompleted ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'}`}
                    />
                  </div>
                </div>
                {/* Recrusive Cubit Button (Level 2 -> 3) */}
                <button
                  // Deep Dive (Level 2 -> 3) - Pass step.id
                  onClick={() =>
                    onCubit(
                      task.id,
                      `Context: ${task.description}. Step: ${step.text}. Break this step down into 4 micro-steps.`,
                      step.id,
                    )
                  }
                  className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-300 hover:text-purple-500 dark:hover:text-purple-200 bg-purple-50 dark:bg-purple-900/30 px-2 py-1.5 rounded-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border border-purple-100 dark:border-purple-800/50 hover:border-purple-200 dark:hover:border-purple-700/50"
                  disabled={activeProcessingId === step.id}
                  aria-label="Deep Dive"
                >
                  {activeProcessingId === step.id ? (
                    <Spinner className="w-3 h-3 animate-spin" />
                  ) : (
                    <Wand2 className="w-3 h-3" />
                  )}
                  {activeProcessingId === step.id ? 'Thinking...' : 'Deep Dive'}
                </button>
              </div>

              {step.sub_steps && step.sub_steps.length > 0 && (
                <div className="ml-8 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-2 mt-2">
                  {step.sub_steps.map((micro: CubitStep | string, mIdx: number) => {
                    // Migration ensures objects, but handle legacy strings gracefully just in case
                    const isObject = typeof micro !== 'string';
                    const microText = isObject ? micro.text : micro;
                    const microId = isObject ? micro.id : `legacy-${mIdx}`;

                    return (
                      <div
                        key={microId}
                        className="text-xs text-zinc-500 dark:text-zinc-500 flex gap-2 items-start group/micro"
                      >
                        <span className="text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 select-none">
                          {String.fromCharCode(97 + mIdx)}.
                        </span>
                        <div className="flex-1 min-w-0">
                          {isObject ? (
                            <EditableText
                              value={microText}
                              onSave={(val) => updateDeepStep(task.id, microId, val)}
                              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                            />
                          ) : (
                            <span>{microText}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default TaskEditor;
