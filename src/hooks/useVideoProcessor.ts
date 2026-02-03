import { useRef, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { TaskItem } from '@/services/storage';

const MAX_WIDTH = 640;
const QUALITY = 0.7;

export const useVideoProcessor = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 🧠 PERFORMANCE: Use granular selectors to prevent re-renders and potential hook loops
  const updateTask = useAppStore((state) => state.updateTask);
  const setProcessing = useAppStore((state) => state.setProcessing);
  const addLog = useAppStore((state) => state.addLog);

  const processQueue = useCallback(
    async function processNext(queue: TaskItem[]) {
      if (queue.length === 0) {
        setProcessing(false);
        addLog('Processing Complete.');
        addLog('Ready for Export.');
        return;
      }

      const currentTask = queue[0];
      const video = videoRef.current;

      if (!video || !video.src) {
        console.warn('Video source lost. Waiting for user re-selection.');
        alert(
          'Video source connection lost. Please re-select the video file to resume processing.',
        );
        setProcessing(false);
        return;
      }

      // Safety: Ensure we have a canvas
      if (!canvasRef.current) {
        // Create detached canvas if needed
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      const captureFrame = () => {
        // 1. Resize logic
        const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
        const width = video.videoWidth * scale;
        const height = video.videoHeight * scale;

        canvas.width = width;
        canvas.height = height;

        // 2. Draw
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);

          // 3. Compress & Save
          const base64 = canvas.toDataURL('image/jpeg', QUALITY);

          // 4. Update Store (Async persistence happens inside store)
          updateTask(currentTask.id, { screenshot_base64: base64 });

          // 5. Next Task (Recursive)
          processNext(queue.slice(1));
        }
      };

      // The Critical Async Flow
      // We define timeout first, but we need the function to reference it.
      // We use a mutable object to hold the ID to satisfy 'const' rules if needed,
      // OR we just ignore the linter for this specific pattern if 'let' is required.
      // Actually, cleaner approach:

      let timeoutId: NodeJS.Timeout; // eslint-disable-line prefer-const

      const onSeeked = () => {
        clearTimeout(timeoutId);
        captureFrame();
      };

      // Setup "once" listener for the seeked event
      video.addEventListener('seeked', onSeeked, { once: true });

      // Safety: Force capture if browser throttles seek (tab inactive etc)
      timeoutId = setTimeout(() => {
        console.warn(`Seek timeout for task ${currentTask.id}. Forcing capture.`);
        video.removeEventListener('seeked', onSeeked);
        captureFrame();
      }, 2000);

      // Trigger the seek (with Visual Buffer)
      const targetTime = currentTask.timestamp_seconds + 0.5;

      // ⚡️ OPTIMIZATION: If already close to target (duplicate timestamps), skip seek wait
      if (Math.abs(video.currentTime - targetTime) < 0.1) {
        clearTimeout(timeoutId); // Clear safety if skipping
        video.removeEventListener('seeked', onSeeked); // Remove unused listener
        captureFrame();
      } else {
        video.currentTime = targetTime;
      }
    },
    [setProcessing, updateTask, addLog],
  );

  const startProcessing = useCallback(() => {
    // 🧠 ARCHITECT: Use getState() to avoid stale closure issues when called from async contexts
    const currentTasks = useAppStore.getState().tasks;
    const currentProcessingState = useAppStore.getState().isProcessing;

    if (currentProcessingState) return;

    const pendingTasks = currentTasks.filter((t) => !t.screenshot_base64);
    if (pendingTasks.length > 0) {
      setProcessing(true);
      addLog(`Initializing Media Engine... Queue Size: ${pendingTasks.length}`);
      processQueue(pendingTasks);
    } else {
    }
  }, [setProcessing, processQueue, addLog]);

  return {
    videoRef,
    startProcessing,
  };
};
