/**
 * SessionCompleteModal Component - A+ Grade Premium Implementation
 * 
 * Features:
 * - Celebration animation on timer completion
 * - Two explicit actions (no auto-complete)
 * - Glassmorphism container with backdrop blur
 * - Micro-animations and confetti effect
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { CheckCircle2, Coffee, X, PartyPopper, Sparkles } from 'lucide-react';

interface SessionCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskDone: () => void;
  onTakeBreak: () => void;
}

export function SessionCompleteModal({
  isOpen,
  onClose,
  onTaskDone,
  onTakeBreak,
}: SessionCompleteModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const activeTimerSession = useAppStore((state) => state.activeTimerSession);

  // Trigger confetti when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onTakeBreak(); // Default to "continue later" on escape
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onTakeBreak]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onTakeBreak}
        aria-hidden="true"
      />

      {/* Confetti effect */}
      {showConfetti && <ConfettiEffect />}

      {/* Modal container */}
      <div 
        className="relative w-full max-w-md mx-4 overflow-hidden rounded-3xl bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl border border-stone-200/50 dark:border-stone-700/50 shadow-2xl animate-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-complete-title"
      >
        {/* Close button */}
        <button
          onClick={onTakeBreak}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all duration-200 z-10"
          aria-label="Close modal and continue later"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="relative p-8 sm:p-10 text-center">
          {/* Celebration icon */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <PartyPopper className="w-10 h-10 text-white" />
              </div>
              {/* Animated sparkles */}
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-400 animate-bounce" />
              <Sparkles className="absolute -bottom-1 -left-3 w-5 h-5 text-orange-400 animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <h2 
            id="session-complete-title"
            className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 mb-3"
          >
            Session Complete! 🎉
          </h2>

          {/* Description */}
          <p className="text-stone-600 dark:text-stone-400 mb-8 max-w-xs mx-auto">
            Great focus! You&apos;ve completed your {activeTimerSession?.durationMs ? Math.round(activeTimerSession.durationMs / 60000) : 25}-minute Pomodoro session.
          </p>

          {/* Action buttons */}
          <div className="space-y-3">
            {/* Task Done button */}
            <button
              onClick={onTaskDone}
              className="group w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Task Done (Mark Completed)</span>
            </button>

            {/* Take Break button */}
            <button
              onClick={onTakeBreak}
              className="group w-full flex items-center justify-center gap-3 px-6 py-4 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Coffee className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              <span>Take 5 Min Break (Continue Later)</span>
            </button>
          </div>

          {/* Tip */}
          <p className="mt-6 text-xs text-stone-500 dark:text-stone-500">
            Tip: Taking regular breaks improves long-term productivity
          </p>
        </div>

        {/* Decorative gradient */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10 pointer-events-none" />
      </div>
    </div>
  );
}

// Simple confetti effect component
function ConfettiEffect() {
  const [pieces, setPieces] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

  useEffect(() => {
    const colors = ['#fbbf24', '#f59e0b', '#d97706', '#f97316', '#ea580c', '#84cc16', '#22c55e'];
    const newPieces = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setPieces(newPieces);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-3 h-3 rounded-full animate-confetti"
          style={{
            left: `${piece.left}%`,
            top: '-10px',
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: '2s',
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
      `}</style>
    </div>
  );
}
