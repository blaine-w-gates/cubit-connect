/**
 * Today Page - A+ Grade Premium UI Implementation
 * 
 * Per Phase 2 Authorization:
 * - Premium aesthetic with glassmorphism effects
 * - Dark/light mode integration
 * - Micro-animations throughout
 * - Accessibility: aria-live, keyboard navigation (Spacebar)
 * - Respects prefers-reduced-motion
 * - Component isolation: PomodoroTimer, TimerDisplay, TimerControls, TaskFocusCard
 */

'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { PomodoroTimer } from '@/components/today/PomodoroTimer';
import { TaskFocusCard } from '@/components/today/TaskFocusCard';
import { Settings, X } from 'lucide-react';

export default function TodayPage() {
  const [showSettings, setShowSettings] = useState(false);
  const todayPreferences = useAppStore((state) => state.todayPreferences);
  const updateTimerPreferences = useAppStore((state) => state.updateTimerPreferences);

  // Reset timer to idle on page mount (fresh start every visit)
  useEffect(() => {
    useAppStore.getState().resetTimer();
  }, []);
  
  const toggleShowRowTomatoButtons = () => {
    updateTimerPreferences({ showRowTomatoButtons: !todayPreferences.showRowTomatoButtons });
  };
  
  return (
    <main 
      className="min-h-screen w-full bg-background text-foreground transition-colors duration-500"
      aria-label="Today - Pomodoro Focus"
    >
      {/* Background gradient effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 dark:from-amber-900/10 dark:via-transparent dark:to-orange-900/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl dark:bg-amber-600/5" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl dark:bg-orange-600/5" />
      </div>

      {/* Main content container */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        
        {/* Header */}
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-3">
              <span className="bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
                Today
              </span>
            </h1>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              aria-label="Toggle settings"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          <p className="text-lg text-stone-600 dark:text-stone-400 max-w-md mx-auto">
            Focus on what matters. One task at a time.
          </p>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <section className="mb-8 p-6 rounded-2xl bg-white/60 dark:bg-stone-900/60 backdrop-blur-lg border border-stone-200/50 dark:border-stone-700/50 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
                aria-label="Close settings"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-stone-200/50 dark:border-stone-700/50">
              <div>
                <p className="font-medium text-stone-900 dark:text-stone-100">Show tomato buttons on task rows</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">Display quick-access 🍅 buttons on each task in the Todo table</p>
              </div>
              <button
                onClick={toggleShowRowTomatoButtons}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  todayPreferences.showRowTomatoButtons
                    ? 'bg-amber-500 dark:bg-amber-600'
                    : 'bg-stone-300 dark:bg-stone-600'
                }`}
                role="switch"
                aria-checked={todayPreferences.showRowTomatoButtons}
                aria-label={todayPreferences.showRowTomatoButtons ? 'Disable row tomato buttons' : 'Enable row tomato buttons'}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    todayPreferences.showRowTomatoButtons ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-stone-900 dark:text-stone-100">Enable notifications</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">Show desktop notification when timer completes</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateTimerPreferences({ notificationEnabled: !todayPreferences.notificationEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    todayPreferences.notificationEnabled
                      ? 'bg-amber-500 dark:bg-amber-600'
                      : 'bg-stone-300 dark:bg-stone-600'
                  }`}
                  role="switch"
                  aria-checked={todayPreferences.notificationEnabled}
                  aria-label={todayPreferences.notificationEnabled ? 'Disable notifications' : 'Enable notifications'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      todayPreferences.notificationEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Primary focus area - Glassmorphism container */}
        <div className="grid gap-8">
          
          {/* Task Focus Card - Shows selected task */}
          <section aria-label="Current Task">
            <TaskFocusCard />
          </section>

          {/* Pomodoro Timer - Main interaction */}
          <section aria-label="Pomodoro Timer">
            <PomodoroTimer />
          </section>

        </div>

        {/* Instructions */}
        <footer className="mt-16 text-center">
          <p className="text-sm text-stone-500 dark:text-stone-500">
            Press <kbd className="px-2 py-1 bg-stone-200 dark:bg-stone-800 rounded text-xs font-mono">Space</kbd> to start/pause • 
            Select a task from the Todo page to begin
          </p>
        </footer>

      </div>
    </main>
  );
}
