'use client';

import type { TaskItem } from '@/lib/types';
import { useCubit } from '@/hooks/useCubit';

interface TaskListProps {
  tasks: TaskItem[];
}

/**
 * Format seconds to MM:SS display
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function TaskList({ tasks }: TaskListProps) {
  const { handleCubit, loadingTaskId } = useCubit();

  if (!tasks || tasks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Extracted Tasks ({tasks.length})
      </h2>

      <div className="space-y-4">
        {tasks.map((task, index) => (
          <TaskCard 
            key={task.id} 
            task={task} 
            index={index}
            onCubit={() => handleCubit(task.id)}
            isLoading={loadingTaskId === task.id}
          />
        ))}
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: TaskItem;
  index: number;
  onCubit: () => void;
  isLoading: boolean;
}

function TaskCard({ task, index, onCubit, isLoading }: TaskCardProps) {
  const hasScreenshot = task.screenshot_base64 && task.screenshot_base64.length > 0;
  const hasSubSteps = task.sub_steps && task.sub_steps.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Mobile: Stack vertically, Desktop: Side by side */}
      <div className="flex flex-col md:flex-row">
        {/* Screenshot Section */}
        <div className="md:w-64 md:flex-shrink-0 bg-gray-100">
          {hasScreenshot ? (
            <img
              src={task.screenshot_base64}
              alt={`Screenshot for ${task.task_name}`}
              className="w-full h-40 md:h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-40 md:h-full flex items-center justify-center bg-gray-200">
              <div className="text-center text-gray-400">
                <div className="animate-pulse">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-gray-300" />
                  <p className="text-xs">Loading...</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 p-4">
          {/* Header: Number, Name, Timestamp */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center">
                {index + 1}
              </span>
              <h3 className="font-semibold text-gray-900 line-clamp-2">
                {task.task_name}
              </h3>
            </div>
            <span className="flex-shrink-0 text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {formatTimestamp(task.timestamp_seconds)}
            </span>
          </div>

          {/* Description */}
          <p className="text-gray-600 text-sm leading-relaxed">
            {task.description}
          </p>

          {/* Sub-steps OR Cube It Button */}
          {hasSubSteps ? (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-indigo-600 mb-2 flex items-center gap-1">
                <span>🧊</span> Cubit Breakdown
              </p>
              <ol className="space-y-2">
                {task.sub_steps!.map((step, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={onCubit}
                disabled={isLoading}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${isLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200'
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full" />
                    Breaking down...
                  </>
                ) : (
                  <>
                    <span>🧊</span>
                    Cube It
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
