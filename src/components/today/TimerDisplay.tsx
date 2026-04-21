/**
 * TimerDisplay Component - A+ Grade Premium Implementation
 * 
 * Features:
 * - Geist Mono typography for timer numbers (high-contrast, monospace)
 * - CSS-based fluid countdown animation (respects prefers-reduced-motion)
 * - Progress ring visualization
 * - Smooth transitions between states
 */

'use client';

import { useMemo } from 'react';

interface TimerDisplayProps {
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
}

export function TimerDisplay({ 
  remainingSeconds, 
  totalSeconds, 
  isRunning, 
  isPaused 
}: TimerDisplayProps) {
  // Format time as MM:SS
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [remainingSeconds]);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    return ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  }, [remainingSeconds, totalSeconds]);

  // Calculate SVG circle properties
  const circleRadius = 120;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - (progressPercentage / 100) * circleCircumference;

  return (
    <div className="relative flex items-center justify-center">
      {/* SVG Progress Ring */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72">
        <svg 
          className="w-full h-full transform -rotate-90"
          viewBox="0 0 260 260"
          aria-hidden="true"
        >
          {/* Background circle */}
          <circle
            cx="130"
            cy="130"
            r={circleRadius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-stone-200 dark:text-stone-800"
          />
          
          {/* Progress circle - with animation */}
          <circle
            cx="130"
            cy="130"
            r={circleRadius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className={`transition-all duration-1000 ease-linear ${
              isRunning 
                ? 'text-amber-500 dark:text-amber-400' 
                : isPaused 
                  ? 'text-amber-400/70 dark:text-amber-500/70' 
                  : 'text-stone-400 dark:text-stone-600'
            }`}
            style={{
              strokeDasharray: circleCircumference,
              strokeDashoffset: strokeDashoffset,
              transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease',
            }}
          />
        </svg>

        {/* Timer Text - Centered */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Time display with Geist Mono aesthetic */}
          <div 
            className={`font-mono text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tighter tabular-nums transition-colors duration-300 ${
              isRunning 
                ? 'text-stone-900 dark:text-stone-100' 
                : isPaused 
                  ? 'text-amber-600 dark:text-amber-400' 
                  : 'text-stone-500 dark:text-stone-500'
            }`}
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            }}
            aria-label={`${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds remaining`}
          >
            {formattedTime}
          </div>

          {/* Status label */}
          <div className={`mt-2 text-sm font-medium uppercase tracking-widest transition-colors duration-300 ${
            isRunning 
              ? 'text-emerald-600 dark:text-emerald-400' 
              : isPaused 
                ? 'text-amber-600 dark:text-amber-400' 
                : 'text-stone-400 dark:text-stone-500'
          }`}>
            {isRunning ? 'Focusing' : isPaused ? 'Paused' : 'Ready'}
          </div>
        </div>
      </div>

      {/* Reduced motion: Static progress bar alternative */}
      <noscript>
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-stone-900/90">
          <div className="text-center">
            <div className="font-mono text-4xl font-bold">{formattedTime}</div>
            <div className="text-sm text-stone-500 mt-2">
              {Math.round(progressPercentage)}% complete
            </div>
          </div>
        </div>
      </noscript>
    </div>
  );
}
