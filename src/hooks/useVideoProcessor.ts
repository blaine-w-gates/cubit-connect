import { useRef, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { TaskItem } from '@/services/storage';

const MAX_WIDTH = 640;
const QUALITY = 0.7;

export const useVideoProcessor = () => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const { tasks, updateTask, setProcessing } = useAppStore();

    const processQueue = useCallback(async (queue: TaskItem[]) => {
        if (queue.length === 0) {
            setProcessing(false);
            return;
        }

        const currentTask = queue[0];
        const video = videoRef.current;

        if (!video || !video.src) {
            console.warn("Video source lost. Waiting for user re-selection.");
            alert("Video source connection lost. Please re-select the video file to resume processing.");
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
                // Cleanup event listener is handled by the "once" option or manual removal if we strictly separate
                // But here we rely on the flow: seek -> event -> callback. 
                // We'll proceed to the next item in the remaining queue.
                processQueue(queue.slice(1));
            }
        };

        // The Critical Async Flow
        const onSeeked = () => {
            captureFrame();
        };

        // Setup "once" listener for the seeked event
        video.addEventListener('seeked', onSeeked, { once: true });

        // Trigger the seek
        video.currentTime = currentTask.timestamp_seconds + 1.5;

    }, [setProcessing, updateTask]);

    const startProcessing = useCallback(() => {
        const pendingTasks = tasks.filter(t => !t.screenshot_base64);
        if (pendingTasks.length > 0) {
            setProcessing(true);
            processQueue(pendingTasks);
        }
    }, [tasks, setProcessing, processQueue]);

    return {
        videoRef,
        startProcessing
    };
};
