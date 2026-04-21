'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { X, ArrowRight } from 'lucide-react';

export default function PriorityDials() {
    const router = useRouter();
    const { priorityDials, setDialFocus, setDialPriority, activeWorkspaceType, hasPeers, peerIsEditing, selectTaskForToday } = useAppStore(
        useShallow((s) => ({
            priorityDials: s.priorityDials,
            setDialFocus: s.setDialFocus,
            setDialPriority: s.setDialPriority,
            activeWorkspaceType: s.activeWorkspaceType,
            hasPeers: s.hasPeers,
            peerIsEditing: s.peerIsEditing,
            selectTaskForToday: s.selectTaskForToday,
        })),
    );

    const isLocked = activeWorkspaceType === 'personalMulti' && (!hasPeers || peerIsEditing);
    const checkLock = () => {
        if (isLocked) {
            const reason = !hasPeers
                ? 'To prevent sync mismatches, you must have at least 2 devices connected to edit a Shared Project.'
                : 'A peer is currently making changes. Please wait for them to finish.';

            import('sonner').then(({ toast }) => {
                toast.error('Shared Project Locked', {
                    description: reason,
                    icon: '🔒',
                });
            });
            return true;
        }
        return false;
    };

    const { left, right, focusedSide } = priorityDials;
    const hasBoth = left.trim() !== '' && right.trim() !== '';

    const leftRef = useRef<HTMLDivElement>(null);
    const rightRef = useRef<HTMLDivElement>(null);

    return (
        <div className="border border-zinc-300 dark:border-stone-700 rounded-xl p-6 bg-zinc-50 dark:bg-stone-900/50">
            <h2 className="text-center font-serif text-2xl font-bold italic mb-1 text-zinc-900 dark:text-stone-200">
                Dial in Your Priorities
            </h2>
            <p className="text-center text-sm text-zinc-600 dark:text-stone-400 mb-4">
                Focus on what matters now
            </p>
            <div className="grid grid-cols-2 gap-4">
                {/* Dial Left */}
                <div
                    ref={leftRef}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                        if (hasBoth) {
                            if (checkLock()) return;
                            setDialFocus('left');
                        }
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (hasBoth) setDialFocus('left'); } }}
                    className={`relative group rounded-lg p-4 text-left transition-all max-h-24 overflow-y-auto text-sm
            ${focusedSide === 'left' && left.trim()
                            ? 'border-[3px] border-green-500 bg-green-50 dark:bg-green-950/30 shadow-md'
                            : 'border-2 border-green-400/50 dark:border-green-700/50 bg-white dark:bg-stone-900'
                        }
            ${hasBoth && !isLocked ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
            ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
          `}
                >
                    <span className="text-xs font-mono uppercase tracking-widest text-green-700 dark:text-green-400 block mb-1">
                        Dial Left
                    </span>
                    <p className="text-zinc-800 dark:text-stone-300 min-h-[2rem] pr-4">
                        {left || <span className="text-zinc-400 dark:text-stone-600 italic">Click a step in green mode…</span>}
                    </p>
                    {left && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (checkLock()) return;
                                setDialPriority('left', '');
                                setDialFocus('none');
                                leftRef.current?.focus();
                            }}
                            className="absolute top-2 right-2 text-zinc-400 hover:text-red-500 transition-colors p-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover-reveal"
                            title="Clear Dial"
                            aria-label="Clear left priority"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Dial Right */}
                <div
                    ref={rightRef}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                        if (hasBoth) {
                            if (checkLock()) return;
                            setDialFocus('right');
                        }
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (hasBoth) setDialFocus('right'); } }}
                    className={`relative group rounded-lg p-4 text-left transition-all max-h-24 overflow-y-auto text-sm
            ${focusedSide === 'right' && right.trim()
                            ? 'border-[3px] border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 shadow-md'
                            : 'border-2 border-yellow-400/50 dark:border-yellow-700/50 bg-white dark:bg-stone-900'
                        }
            ${hasBoth && !isLocked ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
            ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
          `}
                >
                    <span className="text-xs font-mono uppercase tracking-widest text-yellow-700 dark:text-yellow-400 block mb-1">
                        Dial Right
                    </span>
                    <p className="text-zinc-800 dark:text-stone-300 min-h-[2rem] pr-4">
                        {right || <span className="text-zinc-400 dark:text-stone-600 italic">Click a step in yellow mode…</span>}
                    </p>
                    {right && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (checkLock()) return;
                                setDialPriority('right', '');
                                setDialFocus('none');
                                rightRef.current?.focus();
                            }}
                            className="absolute top-2 right-2 text-zinc-400 hover:text-red-500 transition-colors p-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover-reveal"
                            title="Clear Dial"
                            aria-label="Clear right priority"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Go to Today Action - Only show when both dials are populated */}
            {hasBoth && (
                <div className="mt-4 flex justify-center">
                    <button
                        onClick={() => {
                            // Determine which dial has focus to pre-select that task
                            const selectedDial = focusedSide === 'right' ? 'right' : 'left';
                            const selectedTaskName = selectedDial === 'right' ? right : left;
                            
                            // Find the row in the todo list that contains this priority step
                            const todoRows = useAppStore.getState().todoRows;
                            const matchingRow = todoRows.find(r => r.steps.some(s => s.text.trim() === selectedTaskName.trim()));
                            
                            if (matchingRow) {
                                // Pre-select the task for Today
                                selectTaskForToday(matchingRow.id, selectedDial as 'left' | 'right');
                            }
                            
                            // Navigate to Today page with shallow routing for instant transition
                            router.push('/today');
                        }}
                        className="group flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-semibold shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 transition-all duration-300 transform hover:scale-105 active:scale-95"
                        aria-label="Go to Today page to focus on this priority"
                    >
                        <span className="text-xl">🍅</span>
                        <span>Go to Today</span>
                        <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                </div>
            )}
        </div>
    );
}
