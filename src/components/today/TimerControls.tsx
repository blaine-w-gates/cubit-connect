/**
 * TimerControls Component - A+ Grade Premium Implementation
 * 
 * Features:
 * - Micro-animated buttons with smooth hover states
 * - Accessible keyboard navigation
 * - High-contrast icons from Lucide
 * - Disabled states when no task selected
 */

'use client';

import { Play, Pause, RotateCcw } from 'lucide-react';

interface TimerControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  isIdle: boolean;
  hasTask: boolean;
  onToggle: () => void;
  onReset: () => void;
}

export function TimerControls({
  isRunning,
  isPaused,
  isIdle,
  hasTask,
  onToggle,
  onReset,
}: TimerControlsProps) {
  // Main toggle button config
  const toggleConfig = isIdle 
    ? { icon: Play, label: 'Start', variant: 'primary' }
    : isRunning 
      ? { icon: Pause, label: 'Pause', variant: 'secondary' }
      : { icon: Play, label: 'Resume', variant: 'secondary' };

  const ToggleIcon = toggleConfig.icon;

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6">
      {/* Reset button */}
      <button
        onClick={onReset}
        disabled={isIdle || !hasTask}
        className={`group relative p-4 rounded-2xl transition-all duration-300 ${
          isIdle || !hasTask
            ? 'opacity-30 cursor-not-allowed'
            : 'hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95'
        }`}
        aria-label="Reset timer"
        title="Reset"
      >
        <RotateCcw 
          className={`w-6 h-6 transition-transform duration-300 ${
            isIdle ? 'text-stone-400' : 'text-stone-600 dark:text-stone-400 group-hover:rotate-[-45deg]'
          }`} 
        />
      </button>

      {/* Main toggle button (Start/Pause/Resume) */}
      <button
        onClick={onToggle}
        disabled={!hasTask}
        className={`group relative px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 transform ${
          !hasTask
            ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed'
            : toggleConfig.variant === 'primary'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 hover:scale-105 active:scale-95'
              : isPaused
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 active:scale-95'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95'
        }`}
        aria-label={toggleConfig.label}
      >
        <div className="flex items-center gap-3">
          <ToggleIcon 
            className={`w-6 h-6 transition-transform duration-300 ${
              !hasTask ? '' : 'group-hover:scale-110'
            }`} 
          />
          <span>{!hasTask ? 'Select a Task' : toggleConfig.label}</span>
        </div>
        
        {/* Button glow effect for primary state */}
        {toggleConfig.variant === 'primary' && hasTask && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
        )}
      </button>

    </div>
  );
}
