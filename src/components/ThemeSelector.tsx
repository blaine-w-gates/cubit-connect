"use client";

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThemeSelectorProps {
    mobile?: boolean;
}

export default function ThemeSelector({ mobile = false }: ThemeSelectorProps) {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-8 h-8" />; // Skeleton or null
    }

    const currentIcon = () => {
        if (resolvedTheme === 'dark') return <Moon className="w-4 h-4" />;
        return <Sun className="w-4 h-4" />;
    };

    // MOBILE: Simple Row inside the menu
    if (mobile) {
        return (
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg w-full justify-between">
                {(['light', 'dark'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={`
                            flex-1 p-2 rounded-md flex items-center justify-center transition-all
                            ${theme === t
                                ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-zinc-50'
                                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                            }
                        `}
                        title={`Switch to ${t} mode`}
                    >
                        {t === 'light' && <Sun className="w-4 h-4" />}
                        {t === 'dark' && <Moon className="w-4 h-4" />}
                    </button>
                ))}
            </div>
        );
    }

    // DESKTOP: Pop-out Pill (Right Aligned)
    return (
        <div
            className="relative flex items-center justify-end h-8 min-w-[32px]"
            onMouseLeave={() => setExpanded(false)}
        >
            <AnimatePresence>
                {expanded ? (
                    <motion.div
                        key="expanded"
                        initial={{ opacity: 0, width: 32 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 32 }}
                        className="absolute right-0 flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-full p-1 overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm z-50"
                    >
                        {(['light', 'dark'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => {
                                    setTheme(t);
                                    setExpanded(false);
                                }}
                                className={`
                                    p-1.5 rounded-full transition-all
                                    ${theme === t
                                        ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-zinc-50'
                                        : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                    }
                                `}
                                title={t}
                            >
                                {t === 'light' && <Sun className="w-3.5 h-3.5" />}
                                {t === 'dark' && <Moon className="w-3.5 h-3.5" />}
                            </button>
                        ))}
                    </motion.div>
                ) : (
                    <motion.button
                        key="collapsed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setExpanded(true)}
                        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
                        title="Change Theme"
                    >
                        {currentIcon()}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
