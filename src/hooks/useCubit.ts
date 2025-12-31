'use client';

import { useCallback, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { generateSubSteps } from '@/lib/gemini';
import { parseVTT, getContextAroundTimestamp } from '@/lib/vtt-parser';

/**
 * Custom hook to handle the "Cube It" (drill-down) feature
 * Breaks a single task into 4 sub-steps using AI
 */
export function useCubit() {
  const apiKey = useAppStore((state) => state.apiKey);
  const transcript = useAppStore((state) => state.transcript);
  const tasks = useAppStore((state) => state.tasks);
  const updateTask = useAppStore((state) => state.updateTask);

  // Track which task is currently loading (by ID)
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCubit = useCallback(async (taskId: string) => {
    // Prevent multiple simultaneous requests
    if (loadingTaskId) {
      console.log('[useCubit] Already processing another task');
      return;
    }

    if (!apiKey) {
      setError('API key not found');
      return;
    }

    // Find the task
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      setError('Task not found');
      return;
    }

    // Already has sub-steps
    if (task.sub_steps && task.sub_steps.length > 0) {
      console.log('[useCubit] Task already has sub-steps');
      return;
    }

    setLoadingTaskId(taskId);
    setError(null);

    try {
      // Get context from transcript around the task's timestamp
      let contextText = '';
      if (transcript) {
        const segments = parseVTT(transcript);
        contextText = getContextAroundTimestamp(segments, task.timestamp_seconds, 30);
      }

      console.log(`[useCubit] Generating sub-steps for "${task.task_name}"`);

      // Call Gemini to generate sub-steps
      const result = await generateSubSteps(task.task_name, contextText, apiKey);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.subSteps.length === 0) {
        setError('No sub-steps generated');
        return;
      }

      // Update the task with sub-steps
      await updateTask(taskId, { sub_steps: result.subSteps });
      
      console.log(`[useCubit] Generated ${result.subSteps.length} sub-steps`);

    } catch (err) {
      console.error('[useCubit] Failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate sub-steps');
    } finally {
      setLoadingTaskId(null);
    }
  }, [apiKey, transcript, tasks, updateTask, loadingTaskId]);

  return {
    handleCubit,
    loadingTaskId,
    error,
    clearError: () => setError(null),
  };
}
