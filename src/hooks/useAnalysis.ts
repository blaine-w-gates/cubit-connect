'use client';

import { useCallback, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { parseVTT, getFullTranscriptText } from '@/lib/vtt-parser';
import { analyzeTranscript } from '@/lib/gemini';
import { getScreenshotQueue } from '@/lib/video-queue';
import { getHiddenProcessorElement } from '@/components/dashboard/VideoPlayer';

/**
 * Custom hook to orchestrate the analysis workflow
 * 
 * Workflow:
 * 1. Parse VTT transcript
 * 2. Send to Gemini for task extraction
 * 3. Capture screenshots for each task using async queue
 * 4. Update store progressively
 */
export function useAnalysis() {
  const apiKey = useAppStore((state) => state.apiKey);
  const transcript = useAppStore((state) => state.transcript);
  const setTasks = useAppStore((state) => state.setTasks);
  const updateTask = useAppStore((state) => state.updateTask);
  const setProcessing = useAppStore((state) => state.setProcessing);
  const setError = useAppStore((state) => state.setError);

  // Prevent double execution
  const isRunningRef = useRef(false);

  const startAnalysis = useCallback(async () => {
    // Guard against double-clicks
    if (isRunningRef.current) {
      console.log('[useAnalysis] Already running, skipping');
      return;
    }

    if (!apiKey || !transcript) {
      setError('Missing API key or transcript');
      return;
    }

    isRunningRef.current = true;
    setError(null);

    try {
      // Step 1: Parse VTT
      setProcessing(true, 5, 'Parsing transcript...');
      const segments = parseVTT(transcript);
      
      if (segments.length === 0) {
        setError('No valid transcript segments found. Please check your VTT/SRT file.');
        setProcessing(false);
        isRunningRef.current = false;
        return;
      }

      const fullText = getFullTranscriptText(segments);
      console.log(`[useAnalysis] Parsed ${segments.length} segments, ${fullText.length} chars`);

      // Step 2: Send to Gemini
      setProcessing(true, 15, 'Analyzing with AI...');
      const result = await analyzeTranscript(fullText, apiKey);

      if (result.error) {
        setError(result.error);
        setProcessing(false);
        isRunningRef.current = false;
        return;
      }

      if (result.tasks.length === 0) {
        setError('No tasks extracted from transcript. Try with more detailed content.');
        setProcessing(false);
        isRunningRef.current = false;
        return;
      }

      console.log(`[useAnalysis] Extracted ${result.tasks.length} tasks`);

      // Step 3: Store initial tasks (without screenshots)
      await setTasks(result.tasks);
      setProcessing(true, 30, 'Preparing screenshots...');

      // Step 4: Get video element and initialize queue
      const videoElement = getHiddenProcessorElement();
      
      if (!videoElement) {
        setError('Video element not found. Please re-select your video file.');
        setProcessing(false);
        isRunningRef.current = false;
        return;
      }

      // Wait for video metadata to load
      if (videoElement.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Video load timeout')), 10000);
          videoElement.onloadedmetadata = () => {
            clearTimeout(timeout);
            resolve();
          };
          videoElement.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Video load error'));
          };
        });
      }

      const queue = getScreenshotQueue();
      queue.setVideo(videoElement);

      // Step 5: Capture screenshots one by one
      const totalTasks = result.tasks.length;
      
      for (let i = 0; i < totalTasks; i++) {
        const task = result.tasks[i];
        const progress = 30 + Math.round((i / totalTasks) * 65);
        setProcessing(true, progress, `Capturing screenshot ${i + 1}/${totalTasks}...`);

        try {
          // Clamp timestamp to video duration
          const timestamp = Math.min(
            Math.max(0, task.timestamp_seconds),
            videoElement.duration - 0.1
          );

          const screenshot = await queue.add(task.id, timestamp);
          
          // Update task with screenshot progressively
          await updateTask(task.id, { screenshot_base64: screenshot });
          
          console.log(`[useAnalysis] Screenshot ${i + 1}/${totalTasks} captured`);
        } catch (err) {
          console.error(`[useAnalysis] Screenshot failed for task ${task.id}:`, err);
          // Continue with other tasks even if one fails
        }
      }

      // Step 6: Complete
      setProcessing(true, 100, 'Complete!');
      
      // Brief pause to show 100%
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProcessing(false);
      console.log('[useAnalysis] Analysis complete');

    } catch (error) {
      console.error('[useAnalysis] Analysis failed:', error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
      setProcessing(false);
    } finally {
      isRunningRef.current = false;
    }
  }, [apiKey, transcript, setTasks, updateTask, setProcessing, setError]);

  return { startAnalysis };
}
