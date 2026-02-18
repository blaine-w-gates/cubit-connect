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

export default function TodoPage() {
    const router = useRouter();

    // Granular selectors
    const apiKey = useAppStore((state) => state.apiKey);
    const loadProject = useAppStore((state) => state.loadProject);
    const isHydrated = useAppStore((state) => state.isHydrated);

    const [mounted, setMounted] = useState(false);

    // Hydrate on mount
    useEffect(() => {
        loadProject();
        setMounted(true);
    }, [loadProject]);

    // Auth Guard: Redirect if no API key
    useEffect(() => {
        if (mounted && !apiKey) {
            router.push('/');
        }
    }, [mounted, apiKey, router]);

    if (!mounted) return null;

    return (
        <main className="min-h-[100dvh] text-[#111111] bg-[#FAFAFA] dark:bg-stone-950 dark:text-stone-200 flex flex-col font-sans transition-colors duration-300">
            <SettingsDialog />

            {/* Header — same component, page-aware badge */}
            <Header
                confirmingReset={false}
                setConfirmingReset={() => { }}
                resetProject={() => { }}
                mounted={mounted}
                tasksLength={0}
            />

            {/* Main Content */}
            <FadeIn
                when={isHydrated}
                className="flex-1 w-full max-w-7xl mx-auto border-x border-black dark:border-[#292524] bg-white dark:bg-[#1c1917] shadow-xl min-h-screen my-8 md:p-12 p-4 transition-colors duration-300"
            >
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
        </main>
    );
}
