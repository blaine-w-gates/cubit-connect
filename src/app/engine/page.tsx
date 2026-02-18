'use client';

import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useVideoProcessor } from '@/hooks/useVideoProcessor';
import { useReactToPrint } from 'react-to-print';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Manifesto } from '@/components/Manifesto';
import Header from '@/components/Header';
import SettingsDialog from '@/components/SettingsDialog';
import { PrintableReport } from '@/components/PrintableReport';
import VideoInput from '@/components/VideoInput';
import ResultsFeed from '@/components/ResultsFeed';
import ProcessingLog from '@/components/ProcessingLog';
import { FadeIn } from '@/components/ui/FadeIn';

export default function EnginePage() {
  const router = useRouter();

  // 🧠 PERFORMANCE: Granular Selectors
  const apiKey = useAppStore((state) => state.apiKey);
  const tasks = useAppStore((state) => state.tasks);
  const loadProject = useAppStore((state) => state.loadProject);
  const resetProject = useAppStore((state) => state.resetProject);
  const hasVideoHandle = useAppStore((state) => state.hasVideoHandle);
  const projectTitle = useAppStore((state) => state.projectTitle);
  const projectType = useAppStore((state) => state.projectType);
  const isProcessing = useAppStore((state) => state.isProcessing);
  const isHydrated = useAppStore((state) => state.isHydrated); // New Selector
  // const setInputMode = useAppStore(state => state.setInputMode); // Unused
  // const isOnline = useNetworkStatus(); // Unused here, passed to children via logic check if needed? No, logic is in components.
  const { videoRef, startProcessing } = useVideoProcessor();
  const printRef = useRef<HTMLDivElement>(null);

  // Updated Print Logic (PDF Export)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Cubit_Report_${projectTitle.replace(/[^a-z0-9]/gi, '_')}`, // Clean Filename
    // @ts-expect-error: onBeforeGetContent exists in standard usage but types may be strict
    onBeforeGetContent: () => {
      toast.info('Generating PDF Report...', {
        description: 'Please wait while we prepare your document.',
      });
    },
  });

  const [mounted, setMounted] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  // isSettingsOpen moved to Global Store
  const [resetKey, setResetKey] = useState(0);

  // Hydrate on mount
  useEffect(() => {
    loadProject();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, [loadProject]);

  // Auth Guard: Redirect to Home if no API Key (and fully loaded)
  useEffect(() => {
    if (mounted && !apiKey) {
      router.push('/');
    }
  }, [mounted, apiKey, router]);

  // Wrapper for Hard Reset (Clears Store + Remounts Input Components)
  const handleManualReset = async () => {
    await resetProject();
    setResetKey((prev) => prev + 1);
  };

  // Auto-reset confirmation states
  useEffect(() => {
    if (confirmingReset) {
      const timer = setTimeout(() => setConfirmingReset(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingReset]);

  // Re-trigger processing if video handle is restored (session resume only)
  // NOTE: tasks removed from deps — the VideoInput component handles initial processing.
  // Having tasks here caused double-processing because saveTasks() triggers this effect.
  useEffect(() => {
    if (hasVideoHandle) {
      const pending = useAppStore.getState().tasks.filter((t) => !t.screenshot_base64);
      if (pending.length > 0) {
        startProcessing();
      }
    }
  }, [hasVideoHandle, startProcessing]);

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <main className="min-h-[100dvh] text-[#111111] bg-[#FAFAFA] dark:bg-stone-950 dark:text-stone-200 flex flex-col font-sans transition-colors duration-300">
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
      <Header
        onPrint={() => handlePrint && handlePrint()}
        // Settings State moved to Global Store
        confirmingReset={confirmingReset}
        setConfirmingReset={setConfirmingReset}
        resetProject={handleManualReset}
        mounted={mounted}
        tasksLength={tasks.length}
      />

      {/* Main Content: THE WORKSHEET */}
      <FadeIn
        when={isHydrated}
        className="flex-1 w-full max-w-7xl mx-auto border-x border-black dark:border-[#292524] bg-white dark:bg-[#1c1917] shadow-xl min-h-screen my-8 md:p-12 p-4 transition-colors duration-300"
      >
        {/* Step 2: The Assessment (Bento Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Main App (Left) */}
          <div className="lg:col-span-12 space-y-8">
            {/* 2A: Ignition (Manifesto + Input) */}
            <div className="border border-black dark:border-stone-700 p-1 bg-[#FAFAFA] dark:bg-stone-950/50 transition-colors">
              <div className="border border-black dark:border-stone-700 border-dashed p-6">
                {/* Manifesto Splash (Visible only when empty and idle) */}
                {tasks.length === 0 && !isProcessing && <Manifesto />}

                {/* Video/Text Input */}
                <VideoInput key={resetKey} videoRef={videoRef} startProcessing={startProcessing} />
              </div>
            </div>

            {/* 2B: The Output (Results) */}
            {tasks.length > 0 && (
              <div className="border-t-2 border-black dark:border-stone-700 pt-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h3 className="font-serif text-2xl font-bold italic">Your Distilled Recipe:</h3>
                </div>

                {!hasVideoHandle && projectType === 'video' && (
                  <div className="bg-amber-50 border border-amber-500 p-4 mb-6 text-center text-sm font-mono text-amber-800 flex items-center justify-center gap-2">
                    <span>⚠</span>
                    <strong>Session Restored:</strong>
                    <span>Please re-select your video file to resume processing.</span>
                  </div>
                )}

                <ResultsFeed />
              </div>
            )}
          </div>
        </div>
      </FadeIn>

      {/* Task 3: The 'System Drawer' (Fixed Bottom) */}
      <ProcessingLog />

      {/* Shadow Component for Printing */}
      <PrintableReport
        ref={printRef}
        tasks={tasks}
        projectTitle={projectTitle}
        projectType={projectType}
      />
    </main>
  );
}
