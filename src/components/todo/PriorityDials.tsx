'use client';

import { useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { X } from 'lucide-react';

export default function PriorityDials() {
    const { priorityDials, setDialFocus, setDialPriority } = useAppStore(
        useShallow((s) => ({
            priorityDials: s.priorityDials,
            setDialFocus: s.setDialFocus,
            setDialPriority: s.setDialPriority,
        })),
    );

    const { left, right, focusedSide } = priorityDials;
    const hasBoth = left.trim() !== '' && right.trim() !== '';

    const leftRef = useRef<HTMLDivElement>(null);
    const rightRef = useRef<HTMLDivElement>(null);

    return (
        <div className="border border-zinc-300 dark:border-stone-700 rounded-xl p-6 bg-zinc-50 dark:bg-stone-900/50">
            <h2 className="text-center font-serif text-xl font-bold mb-4 text-zinc-900 dark:text-stone-200">
                Dial in Your Priorities
            </h2>
            <div className="grid grid-cols-2 gap-4">
                {/* Dial Left */}
                <div
                    ref={leftRef}
                    role="button"
                    tabIndex={0}
                    onClick={() => hasBoth && setDialFocus('left')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (hasBoth) setDialFocus('left'); } }}
                    className={`relative group rounded-lg p-4 text-left transition-all max-h-24 overflow-y-auto text-sm
            ${focusedSide === 'left'
                            ? 'border-[3px] border-green-500 bg-green-50 dark:bg-green-950/30 shadow-md'
                            : 'border-2 border-green-400/50 dark:border-green-700/50 bg-white dark:bg-stone-900'
                        }
            ${hasBoth ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
          `}
                >
                    <span className="text-xs font-mono uppercase tracking-widest text-green-600 dark:text-green-400 block mb-1">
                        Dial Left
                    </span>
                    <p className="text-zinc-800 dark:text-stone-300 min-h-[2rem] pr-4">
                        {left || <span className="text-zinc-400 dark:text-stone-600 italic">Click a step in green mode…</span>}
                    </p>
                    {left && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setDialPriority('left', '');
                                setDialFocus('none');
                                leftRef.current?.focus();
                            }}
                            className="absolute top-2 right-2 text-zinc-400 hover:text-red-500 transition-colors p-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
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
                    onClick={() => hasBoth && setDialFocus('right')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (hasBoth) setDialFocus('right'); } }}
                    className={`relative group rounded-lg p-4 text-left transition-all max-h-24 overflow-y-auto text-sm
            ${focusedSide === 'right'
                            ? 'border-[3px] border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 shadow-md'
                            : 'border-2 border-yellow-400/50 dark:border-yellow-700/50 bg-white dark:bg-stone-900'
                        }
            ${hasBoth ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
          `}
                >
                    <span className="text-xs font-mono uppercase tracking-widest text-yellow-600 dark:text-yellow-400 block mb-1">
                        Dial Right
                    </span>
                    <p className="text-zinc-800 dark:text-stone-300 min-h-[2rem] pr-4">
                        {right || <span className="text-zinc-400 dark:text-stone-600 italic">Click a step in yellow mode…</span>}
                    </p>
                    {right && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setDialPriority('right', '');
                                setDialFocus('none');
                                rightRef.current?.focus();
                            }}
                            className="absolute top-2 right-2 text-zinc-400 hover:text-red-500 transition-colors p-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                            title="Clear Dial"
                            aria-label="Clear right priority"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
