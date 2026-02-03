"use client";

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Search, Loader2, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { GemininService } from '@/services/gemini';

export default function ScoutView() {
    const {
        apiKey,
        scoutTopic,
        setScoutTopic,
        scoutPlatform,
        setScoutPlatform,
        setInputMode
    } = useAppStore();

    const [isScouting, setIsScouting] = useState(false);
    const { scoutResults: storeResults, setScoutResults: setStoreResults } = useAppStore();

    // Platforms
    const platforms = ["Instagram", "TikTok", "Reddit", "LinkedIn", "Facebook", "Copy Only"];

    // Handler: Generate Terms (Gemini)
    const handleGenerate = async () => {
        if (!scoutTopic.trim() || isScouting) return;

        // Security: Sanitize Input (Basic XSS/Injection prevention)
        const cleanTopic = scoutTopic.replace(/[<>]/g, '').trim();
        if (!cleanTopic) return;

        setIsScouting(true);
        try {
            if (!apiKey) {
                toast.error("Ignition Key Missing", {
                    description: "Please add an API Key in settings first."
                });
                return;
            }

            // Omni-Mix: Generate 10 mixed results regardless of platform.
            const results = await GemininService.generateSearchQueries(apiKey, cleanTopic);
            setStoreResults(results);
        } catch (e: unknown) {
            console.error("Scout failed", e);
            toast.error("Scout Failed", {
                description: (e as Error).message || "Could not generate search terms. Try again."
            });
        } finally {
            setIsScouting(false);
        }
    };

    // Handler: Search / Open
    const handleResultClick = (query: string, idx: number) => {
        const q = query.replace(/^#/, ''); // Strip hash if present just in case

        let url = "";

        // Default to Instagram if no platform selected (matching UI state)
        const activePlatform = scoutPlatform || "Instagram";

        switch (activePlatform) {
            case "Instagram":
                // Strict Tag Cleaning: Remove #, spaces, and punctuation (like ?)
                const cleanTag = q.replace(/[^a-zA-Z0-9_]/g, '');
                url = `https://www.instagram.com/explore/tags/${cleanTag}/`;
                break;
            case "TikTok":
                // Use Search (supports phrases/questions), not Tags
                url = `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`;
                break;
            case "Reddit":
                url = `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`;
                break;
            case "LinkedIn":
                url = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(query)}`;
                break;
            case "Facebook":
                url = `https://www.facebook.com/search/top?q=${encodeURIComponent(query)}`;
                break;
            case "Copy Only":
                navigator.clipboard.writeText(query);
                // We need visual feedback. 
                // Let's implement a quick local "copied" state for this index?
                // For MVP, lets just alert or assume user saw it.
                // "Show 'Check' icon state" - implied per item.
                // We'll add a temporary "copiedId" state.
                setCopiedId(idx);
                setTimeout(() => setCopiedId(null), 1500);
                return;
        }

        if (url) {
            const win = window.open(url, '_blank', 'noopener,noreferrer');
            if (win) win.opener = null;
        }
    };

    const [copiedId, setCopiedId] = useState<number | null>(null);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 w-full animate-in fade-in zoom-in-95 duration-300">
            <div className="w-full max-w-2xl text-center space-y-8">
                <div className="space-y-2">
                    <h1 className="text-4xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                        The Scout
                    </h1>
                    <p className="text-zinc-400 dark:text-zinc-500 font-medium">
                        Find high-signal source material.
                    </p>
                </div>

                <div className="relative p-1 md:p-8 md:border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-white/50 dark:bg-zinc-900/50 space-y-6">

                    {/* Header Row: Close Button */}
                    <div className="absolute top-3 right-3 z-50">
                        <button
                            onClick={() => setInputMode('video')}
                            className="text-[10px] text-zinc-400 hover:text-red-600 uppercase tracking-widest px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors font-medium bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-100 dark:border-zinc-700 shadow-sm min-h-[44px] flex items-center justify-center"
                        >
                            [ Close ]
                        </button>
                    </div>

                    {/* Input Area - Added pt-10 to clear the absolute close button */}
                    <div className="flex flex-col gap-4 w-full max-w-xl mx-auto pt-10">

                        {/* 1. The Topic Input */}
                        <div className="flex flex-col sm:flex-row gap-2 w-full shadow-sm">
                            <input
                                type="text"
                                value={scoutTopic}
                                maxLength={100}
                                onChange={(e) => setScoutTopic(e.target.value)}
                                placeholder="What do you want to learn? (e.g. Sourdough)"
                                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl sm:rounded-r-none sm:rounded-l-xl p-4 font-mono text-base sm:text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:z-10 transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600 text-zinc-800 dark:text-zinc-100"
                                onKeyDown={(e) => e.key === 'Enter' && !isScouting && handleGenerate()}
                                autoFocus
                            />
                            <button
                                onClick={handleGenerate}
                                disabled={isScouting || !scoutTopic.trim()}
                                className="w-full sm:w-auto bg-zinc-900 hover:bg-black dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white px-8 py-3 sm:py-0 rounded-xl sm:rounded-l-none sm:rounded-r-xl font-mono text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all min-w-[120px]"
                            >
                                {isScouting ? <Loader2 className="w-4 h-4 animate-spin" /> : "SEARCH"}
                            </button>
                        </div>

                        {/* 2. The Platform Slider */}
                        <div className="w-full overflow-x-auto pb-2 scrollbar-none [mask-image:linear-gradient(to_right,black_85%,transparent_100%)]">
                            <div className="flex gap-1 p-1 bg-zinc-100/80 dark:bg-zinc-800/50 rounded-xl mx-auto w-max md:w-full justify-between">
                                {platforms.map((p) => {
                                    const isActive = scoutPlatform === p || (p === "Instagram" && !scoutPlatform); // Default
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setScoutPlatform(p)}
                                            aria-label={p === "Copy Only" ? "Switch to Copy Only mode" : `Switch to ${p} search mode`}
                                            aria-pressed={isActive}
                                            className={`
                                                relative px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap
                                                ${isActive
                                                    ? "bg-white dark:bg-zinc-700 text-black dark:text-zinc-50 shadow-sm"
                                                    : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
                                                }
                                            `}
                                        >
                                            {p === "Copy Only" ? "📋 Copy" : p}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-zinc-400 text-center mt-2 px-4">
                                Select a platform to tailor your search results.
                            </p>
                        </div>
                    </div>

                    {/* Results Area */}
                    {storeResults.length > 0 && (
                        <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="h-px w-20 bg-zinc-200 mx-auto" />
                            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                                {storeResults.map((query, idx) => {
                                    // Dynamic Accent Color based on Platform
                                    const accentClass =
                                        scoutPlatform === 'Instagram' ? 'group-hover:border-pink-300 group-hover:bg-pink-50 dark:group-hover:bg-pink-900/30 group-hover:text-pink-700 dark:group-hover:text-pink-300 dark:group-hover:border-pink-700' :
                                            scoutPlatform === 'Reddit' ? 'group-hover:border-orange-300 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/30 group-hover:text-orange-700 dark:group-hover:text-orange-300 dark:group-hover:border-orange-700' :
                                                scoutPlatform === 'TikTok' ? 'group-hover:border-black dark:group-hover:border-zinc-500 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-700 group-hover:text-black dark:group-hover:text-white' :
                                                    scoutPlatform === 'Facebook' ? 'group-hover:border-blue-600 dark:group-hover:border-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-800 dark:group-hover:text-blue-300' :
                                                        'group-hover:border-sky-300 group-hover:bg-sky-50 dark:group-hover:bg-sky-900/30 group-hover:text-sky-700 dark:group-hover:text-sky-300 dark:group-hover:border-sky-700';

                                    const iconColor = 'group-hover:text-blue-600 dark:group-hover:text-blue-400';

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleResultClick(query, idx)}
                                            className={`
                                            px-4 py-2.5 rounded-full border transition-all cursor-pointer text-xs font-mono flex items-center gap-2 group
                                            ${copiedId === idx
                                                    ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                                                    : `bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 shadow-sm ${accentClass}`
                                                }
                                        `}
                                        >
                                            <Search className={`w-3 h-3 min-w-[12px] transition-colors ${copiedId === idx ? "text-green-600" : `text-zinc-400 dark:text-zinc-500 ${iconColor}`}`} />
                                            <span className="text-left whitespace-normal leading-tight">{query}</span>
                                            {copiedId === idx ? (
                                                <Check className="w-3 h-3 text-green-600" />
                                            ) : (
                                                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {!storeResults.length && <div className="h-8" />}
                </div>
            </div>
        </div>
    );
}
