'use client';

import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { Plus, Sparkles, Telescope, ArrowLeftCircle, ArrowRightCircle } from 'lucide-react';

export default function ActionBar() {
    const { activeMode, setActiveMode, addTodoRow } = useAppStore(
        useShallow((s) => ({
            activeMode: s.activeMode,
            setActiveMode: s.setActiveMode,
            addTodoRow: s.addTodoRow,
        })),
    );

    const modes = [
        { key: 'cubit' as const, label: 'Cubit', color: 'cyan', Icon: Sparkles },
        { key: 'deepDive' as const, label: 'Deep Dive', color: 'fuchsia', Icon: Telescope },
        { key: 'dialLeft' as const, label: 'Dial Left', color: 'green', Icon: ArrowLeftCircle },
        { key: 'dialRight' as const, label: 'Dial Right', color: 'yellow', Icon: ArrowRightCircle },
    ] as const;

    const colorMap: Record<string, { active: string; ring: string; text: string }> = {
        cyan: {
            active: 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30',
            ring: 'ring-2 ring-cyan-400/50',
            text: 'text-cyan-600 dark:text-cyan-400',
        },
        fuchsia: {
            active: 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30',
            ring: 'ring-2 ring-fuchsia-400/50',
            text: 'text-fuchsia-600 dark:text-fuchsia-400',
        },
        green: {
            active: 'bg-green-500 text-white shadow-lg shadow-green-500/30',
            ring: 'ring-2 ring-green-400/50',
            text: 'text-green-600 dark:text-green-400',
        },
        yellow: {
            active: 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/30',
            ring: 'ring-2 ring-yellow-400/50',
            text: 'text-yellow-600 dark:text-yellow-400',
        },
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm border-t border-zinc-200 dark:border-stone-700 px-4 py-3 safe-bottom">
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 sm:gap-3">
                {modes.map(({ key, label, color, Icon }) => {
                    const isActive = activeMode === key;
                    const colors = colorMap[color];

                    return (
                        <button
                            key={key}
                            onClick={() => setActiveMode(activeMode === key ? null : key)}
                            className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-none text-xs sm:text-sm font-semibold font-mono uppercase tracking-wide transition-all
                ${isActive
                                    ? `${colors.active} scale-105`
                                    : `bg-zinc-100 dark:bg-stone-800 ${colors.text} hover:bg-zinc-200 dark:hover:bg-stone-700`
                                }
              `}
                            aria-pressed={isActive}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{label}</span>
                        </button>
                    );
                })}

                {/* + Task button */}
                <div className="h-6 w-[1px] bg-zinc-300 dark:bg-stone-600 mx-1" />
                <button
                    onClick={() => addTodoRow()}
                    className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-none text-xs sm:text-sm font-semibold font-mono uppercase tracking-wide bg-zinc-900 dark:bg-stone-200 text-white dark:text-stone-900 hover:bg-zinc-800 dark:hover:bg-stone-300 transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    <span>Task</span>
                </button>
            </div>
        </div>
    );
}
