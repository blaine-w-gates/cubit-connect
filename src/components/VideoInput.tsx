'use client';

import { RefObject, useCallback, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';
import { GemininService } from '@/services/gemini';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import UploadZone from '@/components/UploadZone';
import { Key, Search, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

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
  const { apiKey, setApiKey, setVideoHandleState, saveTask, saveTasks, inputMode, setInputMode } = useAppStore(
    useShallow((state) => ({
      apiKey: state.apiKey,
      setApiKey: state.setApiKey,
      setVideoHandleState: state.setVideoHandleState,
      saveTask: state.saveTask,
      saveTasks: state.saveTasks,
      inputMode: state.inputMode,
      setInputMode: state.setInputMode,
    })),
  );
  const isOnline = useNetworkStatus();

  // Ignition State
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [engineError, setEngineError] = useState<string | null>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  // Initial check: If key exists, ensure ignition is ready (hidden)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (apiKey) setShowKeyInput(false);
  }, [apiKey]);

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

      // 1. Ignition Check
      if (!apiKey) {
        setEngineError('Ignition Key Required');
        setShowKeyInput(true);
        setTimeout(() => {
          keyInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          keyInputRef.current?.focus();
        }, 100);
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
        const newTasks = await GemininService.analyzeTranscript(
          apiKey,
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
          setEngineError(
            "You've reached the 20 requests quota. To continue, create a new project and new keys by clicking the link.",
          );
          setShowKeyInput(true);
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
    [apiKey, isOnline, saveTasks, startProcessing],
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
        <UploadZone
          onVideoSelected={handleVideoSelected}
          onTranscriptParsed={handleTranscriptParsed}
          footerContent={
            <button
              onClick={() => setInputMode('scout')}
              className="text-xs font-mono text-zinc-400 hover:text-black hover:underline transition-colors flex items-center gap-2"
            >
              <Search className="w-3 h-3" />
              Need inspiration? Scout for topics.
            </button>
          }
        />
      )}

      {/* The Scout Mode */}
      {inputMode === 'scout' && <ScoutView />}

      {/* Igniton Slot (Absolute overlay or integrated?)
                Design Choice: Integrated into the bottom of UploadZone via portal or just state check
                Simplest: Render below UploadZone if showing key.
            */}

      <AnimatePresence>
        <AnimatePresence>
          {showKeyInput && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 transition-opacity"
                onClick={() => setShowKeyInput(false)} // Allow dismissal
              />

              {/* Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 z-50 border border-zinc-100 dark:border-zinc-800"
              >
                <div className="flex flex-col gap-6">
                  {/* Header / Error Message */}
                  <div className="space-y-2 text-center">
                    <div className="mx-auto w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mb-2">
                      <Key className="w-5 h-5 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                      {engineError ? 'Quota Limit Reached' : 'API Key Required'}
                    </h3>
                    <p className="text-sm text-zinc-500 leading-relaxed px-2">
                      {engineError || 'Please enter your Google Gemini API key to continue.'}
                    </p>
                  </div>

                  {/* Input Section */}
                  <div className="space-y-4">
                    <div className="relative">
                      <input
                        ref={keyInputRef}
                        type="password"
                        value={tempKey}
                        onChange={(e) => setTempKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-red-500 focus:bg-white dark:focus:bg-zinc-900 rounded-xl py-3 px-4 font-mono text-sm outline-none transition-all shadow-sm dark:text-white"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setApiKey(tempKey);
                            setShowKeyInput(false);
                          }
                        }}
                      />
                    </div>

                    <button
                      onClick={() => {
                        setApiKey(tempKey);
                        setShowKeyInput(false);
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all text-sm uppercase tracking-wide"
                    >
                      Save & Continue
                    </button>

                    {/* Helper Link */}
                    <div className="text-center pt-2">
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-600 transition-colors font-medium group"
                      >
                        <span>Get new key from Google AI Studio</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </AnimatePresence>
    </div>
  );
}
