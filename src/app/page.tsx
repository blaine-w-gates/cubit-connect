"use client";

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { GemininService } from '@/services/gemini';
import { useVideoProcessor } from '@/hooks/useVideoProcessor';

// Components
import SettingsDialog from '@/components/SettingsDialog';
import UploadZone from '@/components/UploadZone';
import TaskFeed from '@/components/TaskFeed';
import ExportControl from '@/components/ExportControl';

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

  const { videoRef, startProcessing } = useVideoProcessor();

  // Hydrate on mount
  useEffect(() => {
    loadProject();
  }, [loadProject]);

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
    if (!apiKey) return; // Should be handled by SettingsDialog

    try {
      // 1. Parse VTT to get timestamps map if needed, or pass raw text behavior.
      // The current GemininService.analyzeTranscript takes raw text and Gemini extracts timestamps.
      // We might want to pass the parsed cues to be more precise, but following Phase 1 logic:
      // We send text to Gemini.

      // However, we also have GemininService.parseVTT available. 
      // Let's use it to clean the text at least? 
      // Actually, let's stick to the simpler flow: 
      // Send raw text -> Gemini returns JSON tasks with timestamps.

      const newTasks = await GemininService.analyzeTranscript(apiKey, transcriptText);

      // 2. Clear old legacy
      // (Optional: resetProject() if we want fresh start)

      // 3. Populate Store
      for (const task of newTasks) {
        await saveTask(task);
      }

      // 4. Start Video Processing (Screenshots)
      // We need to wait a tick for store to update? 
      // No, saveTask is async but startProcessing checks store.
      // We should trigger processing *after* tasks are in store.

      // Small delay or effect dependency could handle this, 
      // but explicit call is safer if tasks is valid.

      // Limitation: useVideoProcessor reads `tasks` from store. 
      // Since `saveTask` updates store, but `tasks` in `useVideoProcessor` comes from the hook's subscription,
      // we might need to rely on an Effect or simply call startProcessing() in a `setTimeout`.
      setTimeout(() => {
        startProcessing();
      }, 500);

    } catch (e: any) {
      console.error("Analysis Failed", e);
      if (e?.message?.includes('503') || e?.message?.includes('overloaded')) {
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
  const handleCubit = async (taskId: string, taskName: string, desc: string) => {
    if (!apiKey) return;

    // 1. Optimistic / Loading State could go here

    try {
      const steps = await GemininService.generateSubSteps(apiKey, taskName, desc);

      // 2. Update Store
      await useAppStore.getState().updateTask(taskId, { sub_steps: steps });

    } catch (e) {
      alert("Failed to Cubit.");
      console.error(e);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
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
      <header className="h-[60px] border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/80 backdrop-blur z-10">
        <div className="font-bold text-lg tracking-tight">
          Cubit Connect <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">MVP</span>
        </div>
        <div className="flex items-center gap-4">
          <ExportControl />
          {apiKey && (
            <button
              onClick={() => {
                if (confirm("Disconnect API Key & Clear Data?")) fullLogout();
              }}
              className="text-xs bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded transition-colors"
            >
              Disconnect Key
            </button>
          )}
          {tasks.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Reset everything?")) resetProject();
              }}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Reset Project
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative">
        {!apiKey ? (
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
    </main>
  );
}
