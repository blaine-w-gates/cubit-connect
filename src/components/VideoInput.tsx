'use client';

import { RefObject, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';
import { GeminiService } from '@/services/gemini';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import UploadZone from '@/components/UploadZone';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useShallow } from 'zustand/react/shallow';

// Lazy Load Heavy Scout Component
const ScoutView = dynamic(() => import('@/components/ScoutView'), {
  loading: () => (
    <div className="h-96 w-full flex flex-col items-center justify-center gap-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      <p className="text-sm text-zinc-400 font-mono">Loading Scout...</p>
    </div>
  ),
  ssr: false,
});

interface VideoInputProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  startProcessing: () => void;
}

export default function VideoInput({ videoRef, startProcessing }: VideoInputProps) {
  const { setVideoHandleState, saveTasks, inputMode, setInputMode } =
    useAppStore(
      useShallow((state) => ({


        setVideoHandleState: state.setVideoHandleState,
        saveTasks: state.saveTasks,
        inputMode: state.inputMode,
        setInputMode: state.setInputMode,
        setIsSettingsOpen: state.setIsSettingsOpen,
      })),
    );
  const isOnline = useNetworkStatus();

  // Ignition State removed (using global settings)

  // Handler: When user selects a video file
  const handleVideoSelected = useCallback(
    (file: File) => {
      if (videoRef.current) {
        // Revoke previous URL to prevent leak
        if (videoRef.current.src) {
          URL.revokeObjectURL(videoRef.current.src);
        }
        const url = URL.createObjectURL(file);
        videoRef.current.src = url;
        setVideoHandleState(true);
      }
    },
    [videoRef, setVideoHandleState],
  );

  // Cleanup on unmount
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video && video.src) {
        URL.revokeObjectURL(video.src);
      }
    };
  }, [videoRef]);

  const runEngine = useCallback(
    async (transcriptText: string, videoDuration?: number) => {
      // 0. Concurrency Lock
      if (useAppStore.getState().isProcessing) {
        return;
      }



      if (!isOnline) {
        toast.error('Offline Mode', {
          description: 'Cannot Ignite Engine while offline.',
        });
        return;
      }

      try {
        // 2. Announce Start (Optimistic Update)
        useAppStore.getState().addLog('Ignition Sequence Started. Analyzing Input...');
        useAppStore.getState().setProcessing(true);

        // ⚡️ AUTO-RESET: Clear previous tasks but Preserve Mode & Title & Video Handle
        const currentType = useAppStore.getState().projectType;
        const currentTitle = useAppStore.getState().projectTitle;
        const currentHandle = useAppStore.getState().hasVideoHandle; // Capture handle state

        await useAppStore.getState().resetProject();

        // Restore Context
        await useAppStore.getState().setProjectType(currentType);
        await useAppStore.getState().setProjectTitle(currentTitle);
        await useAppStore.getState().setVideoHandleState(currentHandle); // Restore handle state

        // 3. Save Transcript (Re-save since reset cleared it)
        await useAppStore.getState().setTranscript(transcriptText);

        // 4. Generate Tasks
        const projectType = useAppStore.getState().projectType;
        const newTasks = await GeminiService.analyzeTranscript(
          transcriptText,
          projectType,
          videoDuration,
        );

        // 5. Populate Store
        await saveTasks(newTasks);

        // 6. Start Processing (VIDEO ONLY)
        if (projectType === 'video') {
          // ⚡️ RELEASE LOCK: Must set false so startProcessing can re-acquire it!
          useAppStore.getState().setProcessing(false);
          setTimeout(() => {
            startProcessing();
          }, 500);
        } else {
          // Text Mode: Finialize immediately
          useAppStore.getState().addLog(`Analysis Complete. ${newTasks.length} Tasks Generated.`);
          useAppStore.getState().setProcessing(false);
        }
      } catch (e: unknown) {
        useAppStore.getState().setProcessing(false); // Stop spinning on error
        console.error('Engine Stalled', e);

        // 🛑 QUOTA HANDLING (429)
        // Normalize error string to catch all variations
        const errString = String((e as Error)?.message || e || '').toLowerCase();

        if (errString.includes('429') || errString.includes('quota') || errString.includes('403')) {
          toast.error('Quota Limit Reached', {
            description: "You've exhausted your free tier. Please update your API Key.",
            duration: 8000,
          });
          useAppStore.getState().setIsSettingsOpen(true, 'quota');
        } else if (errString.includes('503') || errString.includes('overloaded')) {
          toast.warning('Engine Overheated (Gemini 503)', {
            description: 'The AI is cooling down. Please try again in a moment.',
          });
        } else if (errString.includes('safety') || errString.includes('blocked')) {
          toast.error('Safety Block', {
            description: 'The AI refused to process this content due to safety guidelines.',
          });
        } else {
          toast.error('Engine Failure', {
            description: (e as Error).message,
          });
        }
      }
    },
    [isOnline, saveTasks, startProcessing],
  );

  // Scout State Removed -> Delegated to ScoutView.tsx

  // Handler: Passed to UploadZone
  const handleTranscriptParsed = useCallback(
    (text: string) => {
      // Capture Duration if available
      const duration =
        videoRef.current && !isNaN(videoRef.current.duration)
          ? videoRef.current.duration
          : undefined;
      runEngine(text, duration);
    },
    [runEngine, videoRef],
  );

  return (
    <div className="relative" id="ignition">
      {/* Standard Upload Zone */}
      {inputMode !== 'scout' && (
        <div className="flex flex-col gap-4">
          <UploadZone
            onVideoSelected={handleVideoSelected}
            onTranscriptParsed={handleTranscriptParsed}
            footerContent={
              <button
                onClick={() => setInputMode('scout')}
                className="text-xs font-mono text-zinc-700 hover:text-black hover:underline transition-colors flex items-center gap-2"
              >
                <Search className="w-3 h-3" />
                Need inspiration? Scout for topics.
              </button>
            }
          />
          <div className="bg-amber-50/80 border border-amber-200/60 rounded-lg p-3 mx-auto w-full max-w-2xl">
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 text-sm" aria-hidden="true">
                👁️
              </span>
              <div className="text-xs text-amber-700/80 leading-relaxed">
                <strong>Privacy Notice:</strong> Video transcripts are sent to Google Gemini for analysis. Please ensure your video does not contain sensitive personal, corporate, or financial information before analyzing.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* The Scout Mode */}
      {inputMode === 'scout' && <ScoutView />}
    </div>
  );
}
