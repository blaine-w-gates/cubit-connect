"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight } from 'lucide-react';
import { GemininService } from '@/services/gemini';
import { useAppStore } from '@/store/useAppStore';

export default function IgnitionForm() {
    const [key, setKey] = useState("");
    const [status, setStatus] = useState<'idle' | 'igniting' | 'error' | 'network_error'>('idle');
    const router = useRouter();
    const { setApiKey } = useAppStore();

    const handleIgnite = async () => {
        if (!key?.trim()) return;
        setStatus('igniting');

        try {
            // 🧠 ARCHITECT: The "Law of Ignition"
            // Use lightweight validation (countTokens) instead of full generation
            await GemininService.validateConnection(key);

            // Success
            setApiKey(key); // Save to Store (LocalStorage)
            router.push('/engine'); // Redirect to Engine

        } catch (e: unknown) {
            console.error("Ignition Failed", e);

            // Check specific error strings from Gemini SDK
            // 400 usually indicates Bad Request / Invalid Key
            const err = e as Error;
            if (err.message && (err.message.includes('400') || err.message.includes('API key'))) {
                setStatus('error'); // Invalid Key
            } else {
                setStatus('network_error'); // Offline/Overloaded
            }

            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    return (
        <section className="w-full max-w-xl mx-auto" aria-label="API Key Entry">
            <div className={`
                flex flex-col md:flex-row gap-0 border p-1 rounded-sm bg-white shadow-lg transition-all 
                ${status === 'error' ? 'border-red-500 ring-2 ring-red-500/20' : 'border-zinc-300 focus-within:ring-2 focus-within:ring-black/5'}
            `}>
                <label htmlFor="api-key-input" className="sr-only">Enter Google Gemini API Key</label>
                <input
                    id="api-key-input"
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleIgnite()}
                    placeholder="Enter API keys and start that engine ..."
                    className="flex-1 bg-transparent border-none text-zinc-900 px-6 py-4 font-mono text-sm focus:outline-none placeholder:text-zinc-400 w-full"
                    disabled={status === 'igniting'}
                    autoComplete="off"
                />
                <button
                    onClick={handleIgnite}
                    disabled={status === 'igniting'}
                    className={`
                        px-8 py-4 font-bold font-mono tracking-widest transition-all flex items-center justify-center gap-2 min-w-[140px] rounded-sm
                        ${status === 'error' ? 'bg-red-600 text-white' :
                            status === 'network_error' ? 'bg-amber-600 text-white' :
                                'bg-zinc-900 text-white hover:bg-black'}
                    `}
                >
                    {status === 'igniting' ? (
                        <Loader2 className="animate-spin w-4 h-4" />
                    ) : status === 'error' ? (
                        "INVALID"
                    ) : status === 'network_error' ? (
                        "ERROR"
                    ) : (
                        <>
                            START <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>
            <p className="mt-4 text-[10px] text-zinc-600 font-mono uppercase tracking-widest text-center">
                * Keys are stored locally on your device.
            </p>
            <div className="mt-2 text-center">
                <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-xs font-sans underline"
                >
                    Get a key from Google AI Studio
                </a>
            </div>
        </section>
    );
}
