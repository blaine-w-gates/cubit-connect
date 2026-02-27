'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useRouter } from 'next/navigation';

import Header from '@/components/Header';
import SettingsDialog from '@/components/SettingsDialog';
import { FadeIn } from '@/components/ui/FadeIn';
import PriorityDials from '@/components/todo/PriorityDials';
import TodoTable from '@/components/todo/TodoTable';
import ActionBar from '@/components/todo/ActionBar';
import BookTabSidebar from '@/components/todo/BookTabSidebar';

export default function TodoPage() {
    const router = useRouter();

    // Granular selectors

    const loadProject = useAppStore((state) => state.loadProject);
    const isHydrated = useAppStore((state) => state.isHydrated);
    const todoRows = useAppStore((state) => state.todoRows);
    const resetProject = useAppStore((state) => state.resetProject);

    const [mounted, setMounted] = useState(false);
    const [confirmingReset, setConfirmingReset] = useState(false);

    // Hydrate on mount
    useEffect(() => {
        loadProject();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, [loadProject]);



    // Auto-reset confirmation
    useEffect(() => {
        if (confirmingReset) {
            const timer = setTimeout(() => setConfirmingReset(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [confirmingReset]);

    if (!mounted) return null;

    const activeTasks = todoRows.filter((r) => !r.isCompleted).length;

    return (
        <main className="min-h-[100dvh] text-[#111111] bg-[#FAFAFA] dark:bg-stone-950 dark:text-stone-200 flex flex-col font-sans transition-colors duration-300">
            <SettingsDialog />

            {/* Header — fully wired with reset + task count */}
            <Header
                confirmingReset={confirmingReset}
                setConfirmingReset={setConfirmingReset}
                resetProject={resetProject}
                mounted={mounted}
                tasksLength={todoRows.length}
            />

            {/* Loading Skeleton — shown while IndexedDB is loading */}
            {!isHydrated && (
                <div className="flex-1 w-full max-w-7xl mx-auto border-x border-black dark:border-[#292524] bg-white dark:bg-[#1c1917] shadow-xl min-h-screen my-8 md:p-12 p-4 transition-colors duration-300">
                    <div className="border border-black dark:border-stone-700 p-1 bg-[#FAFAFA] dark:bg-stone-950/50">
                        <div className="border border-black dark:border-stone-700 border-dashed p-6 space-y-6 animate-pulse">
                            {/* Skeleton: Priority Dials */}
                            <div className="text-center">
                                <div className="h-6 w-48 bg-zinc-200 dark:bg-stone-700 rounded mx-auto mb-4" />
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-20 rounded-lg bg-green-100 dark:bg-green-950/20 border-2 border-green-300/30" />
                                    <div className="h-20 rounded-lg bg-yellow-100 dark:bg-yellow-950/20 border-2 border-yellow-300/30" />
                                </div>
                            </div>
                            {/* Skeleton: Table */}
                            <div className="space-y-3 mt-8">
                                <div className="h-8 bg-zinc-200 dark:bg-stone-700 rounded w-full" />
                                <div className="h-12 bg-zinc-100 dark:bg-stone-800 rounded w-full" />
                                <div className="h-12 bg-zinc-100 dark:bg-stone-800 rounded w-full" />
                                <div className="h-12 bg-zinc-100 dark:bg-stone-800 rounded w-full" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content — flex row: sidebar + content */}
            <div className="flex flex-1 w-full max-w-7xl mx-auto">
                {/* Book Tab Sidebar */}
                {isHydrated && <BookTabSidebar />}

                {/* Content Panel — fades in once hydrated */}
                <FadeIn
                    when={isHydrated}
                    className="flex-1 border-x border-black dark:border-[#292524] bg-white dark:bg-[#1c1917] shadow-xl min-h-screen my-8 md:p-12 p-4 transition-colors duration-300"
                >
                    {/* Section Heading — mirrors Engine's "Your Distilled Recipe:" */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
                        <h3 className="font-serif text-2xl font-bold italic">Your Task Board:</h3>
                        {todoRows.length > 0 && (
                            <span className="text-sm font-mono text-zinc-500 dark:text-stone-500">
                                {activeTasks} active {activeTasks === 1 ? 'task' : 'tasks'} · {todoRows.length} total
                            </span>
                        )}
                    </div>

                    {/* Engine-style Double Border Container */}
                    <div className="border border-black dark:border-stone-700 p-1 bg-[#FAFAFA] dark:bg-stone-950/50 transition-colors">
                        <div className="border border-black dark:border-stone-700 border-dashed p-6">
                            {/* Priority Dials */}
                            <PriorityDials />

                            {/* Task Table with Horizontal Scroll */}
                            <div className="mt-8">
                                <TodoTable />
                            </div>

                            {/* Action Bar (Cubit / Deep Dive / Dial Left / Dial Right / + Task) */}
                            <ActionBar />
                        </div>
                    </div>
                </FadeIn>
            </div>
        </main>
    );
}
