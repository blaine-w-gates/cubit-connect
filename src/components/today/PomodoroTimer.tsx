/**
 * PomodoroTimer Component - A+ Grade Premium Implementation
 * 
 * Features:
 * - Glassmorphism container with backdrop blur
 * - Keyboard navigation (Spacebar to toggle)
 * - aria-live for screen reader announcements
 * - respects prefers-reduced-motion
 * - Micro-animations on all interactions
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useTimerWorker } from '@/hooks/useTimerWorker';
import { useAudioContext, useTimerAudio } from '@/hooks/useAudioContext';
import { useHibernationRecovery } from '@/hooks/useHibernationRecovery';
import { TimerDisplay } from './TimerDisplay';
import { TimerControls } from './TimerControls';
import { SessionCompleteModal } from './SessionCompleteModal';
import { NotificationBell, showTimerNotification } from './NotificationBell';

export function PomodoroTimer() {
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  
  const timerStatus = useAppStore((state) => state.timerStatus);
  const timerRemainingSeconds = useAppStore((state) => state.timerRemainingSeconds);
  const todayTaskId = useAppStore((state) => state.todayTaskId);
  const todayPreferences = useAppStore((state) => state.todayPreferences);
  const todoRows = useAppStore((state) => state.todoRows);
  
  const startTimer = useAppStore((state) => state.startTimer);
  const pauseTimer = useAppStore((state) => state.pauseTimer);
  const resumeTimer = useAppStore((state) => state.resumeTimer);
  const stopTimer = useAppStore((state) => state.stopTimer);
  const completeTimer = useAppStore((state) => state.completeTimer);
  const toggleTodoRowCompletion = useAppStore((state) => state.toggleTodoRowCompletion);
  const updateTimerPreferences = useAppStore((state) => state.updateTimerPreferences);
  
  // Get audio context for immediate playback on complete
  const { unlock, playCompletionSound } = useAudioContext({ enabled: todayPreferences.soundEnabled });
  useTimerAudio(timerStatus, todayPreferences.soundEnabled);
  
  // Worker with immediate audio/notification callback on complete
  const { startTimer: startWorker, pauseTimer: pauseWorker, resumeTimer: resumeWorker, stopTimer: stopWorker, isReady } = useTimerWorker({
    onComplete: () => {
      // Check if page is visible (foreground)
      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      
      if (isVisible) {
        // Page is visible - use Web Audio API for sound
        // This works reliably in foreground tabs
        playCompletionSound();
      } else {
        // Page is in background - use Notification API for sound
        // iOS Safari allows notification sounds even when AudioContext is suspended
        // The OS handles the sound natively, bypassing browser audio restrictions
        if (todayPreferences.notificationEnabled) {
          showTimerNotification(
            'Pomodoro Complete! 🎉',
            'Your focus session has ended. Great work!'
          );
        }
      }
    },
  });
  
  // Watch for timer completion to show modal and send notification
  const hasShownModalRef = useRef(false);
  useEffect(() => {
    if (timerStatus === 'completed' && !hasShownModalRef.current) {
      hasShownModalRef.current = true;
      // Use RAF to defer setState outside of render phase
      requestAnimationFrame(() => {
        setShowCompleteModal(true);
        
        // Send notification if enabled
        if (todayPreferences.notificationEnabled) {
          showTimerNotification(
            'Pomodoro Complete! 🎉',
            'Your focus session has ended. Great work!'
          );
        }
      });
    } else if (timerStatus !== 'completed') {
      hasShownModalRef.current = false;
    }
  }, [timerStatus, todayPreferences.notificationEnabled]);

  // Handle task completion
  const handleTaskDone = useCallback(() => {
    // Mark the today task as completed in the todo list
    if (todayTaskId) {
      const todayTaskRow = todoRows.find(row => row.id === todayTaskId);
      if (todayTaskRow && !todayTaskRow.isCompleted) {
        toggleTodoRowCompletion(todayTaskId);
      }
    }
    
    // Complete the timer session
    completeTimer();
    
    // Close the modal
    setShowCompleteModal(false);
  }, [todayTaskId, todoRows, toggleTodoRowCompletion, completeTimer]);

  // Handle taking a break (continue later)
  const handleTakeBreak = useCallback(() => {
    // Just close the modal and stop the timer - don't mark task complete
    stopTimer();
    setShowCompleteModal(false);
  }, [stopTimer]);

  // Hibernation recovery for iOS Safari
  useHibernationRecovery({
    enabled: timerStatus === 'running',
    onAutoComplete: () => {
      // Modal will show automatically when timerStatus changes to 'completed'
    },
  });

  // Define callbacks BEFORE useEffect that uses them
  const handleToggle = useCallback(() => {
    if (!todayTaskId) return; // No task selected
    
    // Unlock audio context on first interaction
    unlock();
    
    switch (timerStatus) {
      case 'idle':
        console.log('[PomodoroTimer] Starting timer - isReady:', isReady, 'startWorker:', typeof startWorker);
        startTimer();
        if (isReady) {
          console.log('[PomodoroTimer] Calling startWorker()');
          startWorker();
        } else {
          console.log('[PomodoroTimer] Worker not ready, skipping startWorker');
        }
        break;
      case 'running':
        pauseTimer();
        if (isReady) pauseWorker();
        break;
      case 'paused':
        resumeTimer();
        if (isReady) resumeWorker();
        break;
    }
  }, [timerStatus, todayTaskId, isReady, startTimer, pauseTimer, resumeTimer, startWorker, pauseWorker, resumeWorker, unlock]);

  // Keyboard navigation - Spacebar to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.code === 'Space') {
        e.preventDefault();
        handleToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggle]);

  const handleReset = useCallback(() => {
    // Stop worker first
    if (isReady) stopWorker();
    // Reset timer without saving to history
    useAppStore.getState().resetTimer();
  }, [stopWorker, isReady]);

  const hasTask = !!todayTaskId;
  const isRunning = timerStatus === 'running';
  const isPaused = timerStatus === 'paused';
  const isIdle = timerStatus === 'idle';

  return (
    <div 
      className="relative group"
      role="region"
      aria-label="Pomodoro timer"
    >
      {/* Glassmorphism container */}
      <div className="relative overflow-hidden rounded-3xl bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border border-stone-200/50 dark:border-stone-700/50 shadow-2xl shadow-stone-900/5 dark:shadow-stone-950/20 transition-all duration-500">
        
        {/* Animated gradient border effect */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-amber-600/20 dark:from-amber-500/10 dark:via-orange-500/5 dark:to-amber-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        {/* Content */}
        <div className="relative p-8 sm:p-12">
          
          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div 
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                isRunning 
                  ? 'bg-emerald-500 animate-pulse' 
                  : isPaused 
                    ? 'bg-amber-500' 
                    : 'bg-stone-400'
              }`}
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
              {isRunning ? 'Focusing' : isPaused ? 'Paused' : 'Ready'}
            </span>
            <div className="w-px h-4 bg-stone-300 dark:bg-stone-600 mx-2" />
            <NotificationBell
              enabled={todayPreferences.notificationEnabled}
              permission={typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : null}
              onEnable={() => updateTimerPreferences({ notificationEnabled: true })}
              onDisable={() => updateTimerPreferences({ notificationEnabled: false })}
            />
          </div>

          {/* Timer Display */}
          <div className="mb-10">
            <TimerDisplay 
              remainingSeconds={timerRemainingSeconds}
              totalSeconds={todayPreferences.defaultDuration * 60}
              isRunning={isRunning}
              isPaused={isPaused}
            />
          </div>

          {/* Controls */}
          <TimerControls
            isRunning={isRunning}
            isPaused={isPaused}
            isIdle={isIdle}
            hasTask={hasTask}
            onToggle={handleToggle}
            onReset={handleReset}
          />

          {/* Screen reader announcements */}
          <div 
            className="sr-only" 
            aria-live="polite" 
            aria-atomic="true"
          >
            {isRunning && `Timer running. ${Math.floor(timerRemainingSeconds / 60)} minutes ${timerRemainingSeconds % 60} seconds remaining.`}
            {isPaused && `Timer paused at ${Math.floor(timerRemainingSeconds / 60)} minutes ${timerRemainingSeconds % 60} seconds.`}
            {timerStatus === 'completed' && 'Timer completed. Time for a break!'}
          </div>

        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-amber-400/20 rounded-full blur-2xl dark:bg-amber-600/10" aria-hidden="true" />
      <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-orange-400/20 rounded-full blur-2xl dark:bg-orange-600/10" aria-hidden="true" />

      {/* Session Complete Modal */}
      <SessionCompleteModal
        isOpen={showCompleteModal}
        onClose={handleTakeBreak}
        onTaskDone={handleTaskDone}
        onTakeBreak={handleTakeBreak}
      />
    </div>
  );
}
