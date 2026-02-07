'use client';

import { useAppStore } from '@/store/useAppStore';
import { GeminiService } from '@/services/gemini';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import TaskFeed from '@/components/TaskFeed';
import { toast } from 'sonner';

import { useCallback } from 'react';

export default function ResultsFeed() {
  // Optimization: Only re-render when 'tasks' change.
  // Use granular selector to avoid re-renders on 'scoutTopic' or 'isProcessing' changes.
  const tasks = useAppStore((state) => state.tasks);
  const isOnline = useNetworkStatus();

  // Handler: Cubit Generation
  const handleCubit = useCallback(
    async (taskId: string, context: string, stepId?: string) => {
      // Access latest state without subscription
      const state = useAppStore.getState();
      const {
        apiKey,
        transcript: fullTranscript,
        tasks: currentTasks,
        updateTask,
        addMicroSteps,
      } = state;

      if (!apiKey) return;
      if (!isOnline) {
        toast.error('Offline Mode', { description: 'You are offline. AI features unavailable.' });
        return;
      }

      // Electric UI: Set Active ID
      const targetId = stepId || taskId;
      useAppStore.getState().setActiveProcessingId(targetId);

      try {
        // Pass fullTranscript to service
        // context contains the User's Instruction (e.g. "Task: Tie my shoes...")
        // Calculate Neighbor Context (Boundary Logic)
        let neighborContext = '';
        if (stepId) {
          const parentTask = currentTasks.find((t) => t.id === taskId);
          if (parentTask && parentTask.sub_steps) {
            const currentIndex = parentTask.sub_steps.findIndex((s) => s.id === stepId);
            if (currentIndex !== -1) {
              const prev = parentTask.sub_steps[currentIndex - 1];
              const next = parentTask.sub_steps[currentIndex + 1];

              // Helper: handle migration unions
              const getText = (s: unknown) =>
                typeof s === 'string' ? s : (s as { text: string }).text;

              if (prev) neighborContext += `User has ALREADY completed: "${getText(prev)}". `;
              if (next) neighborContext += `User will SUBSEQUENTLY do: "${getText(next)}". `;
            }
          }
        }

        // Pass context + neighbors
        const rawSteps = await GeminiService.generateSubSteps(
          apiKey,
          context,
          fullTranscript || undefined,
          neighborContext,
        );

        if (stepId) {
          // CASE: DEEP DIVE (Level 3)
          await addMicroSteps(taskId, stepId, rawSteps);
        } else {
          // CASE: TOP LEVEL (Level 2)
          const objectSteps = rawSteps.map((text) => ({
            id: crypto.randomUUID(),
            text: text,
            sub_steps: [],
          }));
          await updateTask(taskId, { sub_steps: objectSteps });
        }
      } catch (e: unknown) {
        const err = e as Error;
        console.error(err);
        if (err.message?.includes('PROJECT_QUOTA_EXCEEDED')) {
          toast.error('Quota Limit Reached', {
            description: "You've exhausted your free tier. Please update your API Key.",
            action: {
              label: 'Update Key',
              onClick: () => useAppStore.getState().setIsSettingsOpen(true, 'quota'),
            },
          });
          useAppStore.getState().setIsSettingsOpen(true, 'quota');
        } else if (err.message === 'OVERLOADED') {
          toast.warning('AI Overloaded', {
            description: 'Rate limit hit (429). Please wait 10 seconds.',
          });
        } else {
          toast.error('Cubit Failed', { description: err.message || 'Unknown Error' });
        }
      } finally {
        // Electric UI: Clear Active ID
        useAppStore.getState().setActiveProcessingId(null);
      }
    },
    [isOnline],
  ); // Only recreate if network status changes

  return (
    <div className="relative pb-24 min-h-[400px]">
      <TaskFeed tasks={tasks} onCubit={handleCubit} />
    </div>
  );
}
