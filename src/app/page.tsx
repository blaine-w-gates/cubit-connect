"use client";

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { GemininService } from '@/services/gemini';
import { useVideoProcessor } from '@/hooks/useVideoProcessor';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';

// Components
import SettingsDialog from '@/components/SettingsDialog';
import UploadZone from '@/components/UploadZone';
import TaskFeed from '@/components/TaskFeed';
import ExportControl from '@/components/ExportControl';
import { PrintableReport } from '@/components/PrintableReport';

export default function Home() {
  const {
    apiKey,
    tasks,
    loadProject,
    saveTask,
    resetProject,
    fullLogout,
    hasVideoHandle,
    setVideoHandleState
  } = useAppStore();

  const isOnline = useNetworkStatus();
  const { videoRef, startProcessing } = useVideoProcessor();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Cubit Connect Report"
  });

  // Hydrate on mount
  useEffect(() => {
    loadProject();
    setMounted(true);
  }, [loadProject]);

  const [mounted, setMounted] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  // Auto-reset confirmation states if tasks change or 3s timeout
  useEffect(() => {
    if (confirmingReset) {
      const timer = setTimeout(() => setConfirmingReset(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingReset]);

  useEffect(() => {
    if (confirmingDisconnect) {
      const timer = setTimeout(() => setConfirmingDisconnect(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingDisconnect]);

  // Handler: When user selects a video file
  const handleVideoSelected = (file: File) => {
    if (videoRef.current) {
      const url = URL.createObjectURL(file);
      videoRef.current.src = url;
      setVideoHandleState(true);
    }
  };

  // Handler: When user provides VTT and clicks Analyze
  const handleTranscriptParsed = async (transcriptText: string) => {
    if (!apiKey) return;
    if (!isOnline) {
      alert("You are offline. AI analysis requires an internet connection.");
      return;
    }

    try {
      // 1. Save Transcript to Store for Context Awareness
      await useAppStore.getState().setTranscript(transcriptText);

      // 2. Generate Tasks
      const newTasks = await GemininService.analyzeTranscript(apiKey, transcriptText);

      // 3. Populate Store
      for (const task of newTasks) {
        await saveTask(task);
      }

      // 4. Start Video Processing
      setTimeout(() => {
        startProcessing();
      }, 500);

    } catch (e: any) {
      console.error("Analysis Failed", e);
      if (e?.message?.includes('503') || e?.message?.includes('overloaded') || e?.message === "OVERLOADED") {
        alert("Gemini is currently overloaded. Please wait 30 seconds and try again.");
      } else {
        alert("Analysis Failed. Check console for details.");
      }
    }
  };

  // Re-trigger processing if we gain the video handle and have pending tasks
  useEffect(() => {
    if (hasVideoHandle && tasks.some(t => !t.screenshot_base64)) {
      startProcessing();
    }
  }, [hasVideoHandle, tasks, startProcessing]);


  // Handler: Cubit Generation
  const handleCubit = async (taskId: string, context: string, stepId?: string) => {
    if (!apiKey) return;
    if (!isOnline) {
      alert("You are offline. AI features unavailable.");
      return;
    }

    // Get current transcript from store
    const fullTranscript = useAppStore.getState().transcript;

    try {
      // Pass fullTranscript to service
      const rawSteps = await GemininService.generateSubSteps(apiKey, "Task", context, fullTranscript || undefined);

      if (stepId) {
        // CASE: DEEP DIVE (Level 3)
        await useAppStore.getState().addMicroSteps(taskId, stepId, rawSteps);
      } else {
        // CASE: TOP LEVEL (Level 2)
        const objectSteps = rawSteps.map(text => ({
          id: crypto.randomUUID(),
          text: text,
          sub_steps: []
        }));
        await useAppStore.getState().updateTask(taskId, { sub_steps: objectSteps });
      }

    } catch (e: any) {
      console.error(e);
      if (e.message === "OVERLOADED") {
        alert("⚠️ AI is overloaded (429). Please wait 10 seconds and try again.");
      } else {
        alert("Failed to Cubit: " + (e.message || "Unknown Error"));
      }
    }
  };

  // Hydration Fix:
  // Server sees null apiKey. Client sees value.
  // We must force client to behave like server until mounted.
  const safeApiKey = mounted ? apiKey : null;

  return (
    <main className="min-h-screen text-zinc-100 flex flex-col">
      <SettingsDialog />

      {/* Hidden Video Element for Processing */}
      <video
        ref={videoRef}
        className="fixed top-0 left-0 w-1 pointer-events-none opacity-0"
        playsInline
        muted
        crossOrigin="anonymous"
      />

      {/* Header */}
      <header className="sticky top-0 z-50 h-[60px] border-b border-white/10 flex items-center justify-between px-6 bg-zinc-950/60 backdrop-blur-xl">
        <div className="font-bold text-lg tracking-tight flex items-center gap-2">
          Cubit Connect
          <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">MVP</span>
          {!isOnline && (
            <span className="text-xs bg-red-900/50 text-red-200 border border-red-800 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Offline
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <ExportControl onPrint={() => handlePrint && handlePrint()} />
          {safeApiKey && (
            <button
              onClick={() => {
                if (confirmingDisconnect) {
                  fullLogout();
                  setConfirmingDisconnect(false);
                } else {
                  setConfirmingDisconnect(true);
                }
              }}
              className={`text-xs px-3 py-1.5 rounded transition-colors border ${confirmingDisconnect
                ? "bg-red-900/50 border-red-500 text-red-200 hover:bg-red-900"
                : "bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                }`}
            >
              {confirmingDisconnect ? "Confirm Disconnect?" : "Disconnect Key"}
            </button>
          )}
          {mounted && tasks.length > 0 && (
            <button
              onClick={() => {
                if (confirmingReset) {
                  resetProject();
                  setConfirmingReset(false);
                } else {
                  setConfirmingReset(true);
                }
              }}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${confirmingReset
                ? "bg-red-600 text-white hover:bg-red-500 font-bold"
                : "text-red-400 hover:text-red-300"
                }`}
            >
              {confirmingReset ? "Sure? Click Again" : "Reset Project"}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative">
        {!safeApiKey ? (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
            Waiting for Configuration...
          </div>
        ) : tasks.length === 0 ? (
          <UploadZone
            onVideoSelected={handleVideoSelected}
            onTranscriptParsed={handleTranscriptParsed}
          />
        ) : (
          <div className="h-full">
            {/* Re-Hydration Check */}
            {!hasVideoHandle && (
              <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
                <div className="bg-zinc-900 border border-red-900/50 p-6 rounded-xl max-w-md text-center">
                  <h3 className="text-xl font-bold text-red-400 mb-2">Resume Session</h3>
                  <p className="text-zinc-400 mb-4">
                    We have your data, but the browser lost access to the video file.
                    Please re-select the video to continue processing screenshots.
                  </p>
                  <label className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg cursor-pointer">
                    Re-Select Video
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                      if (e.target.files?.[0]) handleVideoSelected(e.target.files[0]);
                    }} />
                  </label>
                </div>
              </div>
            )}
            <TaskFeed tasks={tasks} onCubit={handleCubit} />
          </div>
        )}
      </div>

      {/* Shadow Component for Printing */}
      <PrintableReport ref={printRef} tasks={tasks} />
    </main>
  );
}
