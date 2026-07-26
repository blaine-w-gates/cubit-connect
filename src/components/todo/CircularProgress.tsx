'use client';

import { Check } from 'lucide-react';

/**
 * CircularProgress — SVG circular progress ring for the command column.
 *
 * Extracted from TodoTable.tsx as part of component decomposition (#26).
 * Pure presentational component — no store dependencies.
 */
export function CircularProgress({ percentage, isCompleted }: { percentage: number; isCompleted: boolean }) {
    const radius = 12;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    if (isCompleted) {
        return (
            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md shadow-green-500/20 text-white transition-all">
                <Check className="w-4 h-4" strokeWidth={3} />
            </div>
        );
    }

    return (
        <div className="relative w-7 h-7 flex items-center justify-center group">
            {/* Background Track */}
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle
                    cx="14" cy="14" r={radius}
                    className="stroke-zinc-200 dark:stroke-stone-700 transition-colors"
                    strokeWidth="2.5" fill="none"
                />
                {/* Progress Fill */}
                <circle
                    cx="14" cy="14" r={radius}
                    className="stroke-cyan-500 dark:stroke-cyan-400 transition-all duration-500 ease-out"
                    strokeWidth="2.5" fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
            </svg>
            {/* Inner Percentage */}
            <span className="text-[9px] font-bold font-mono text-zinc-500 dark:text-stone-400">
                {Math.round(percentage)}
            </span>
        </div>
    );
}
