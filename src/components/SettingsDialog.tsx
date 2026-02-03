import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { GemininService } from '@/services/gemini';
import { Loader2, LogOut } from 'lucide-react';

interface SettingsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function SettingsDialog({ open, onOpenChange }: SettingsProps) {
    const { apiKey, setApiKey, fullLogout } = useAppStore();
    const [inputKey, setInputKey] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Sync input with store when opening, if needed. 
    // But usually we want to keep input clear for security or show masked.

    if (!mounted) return null;
    if (!open) return null;

    const handleSave = async () => {
        if (!inputKey || !inputKey.trim()) return;
        setIsValidating(true);
        setError(null);
        try {
            // Use default model (2.5-flash-lite)
            await GemininService.analyzeTranscript(inputKey, "Test");
            setApiKey(inputKey);
            onOpenChange(false);
        } catch {
            setError("Invalid Key or Quota Exceeded. Try a new key.");
        } finally {
            setIsValidating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/20 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl p-6 shadow-xl relative">
                <button
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900"
                >
                    ✕
                </button>
                <h2 className="text-xl font-bold text-zinc-900 mb-4">Switch Out Your API Key</h2>
                <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-3 text-base sm:text-sm text-zinc-900 mb-4 focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                />
                {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
                <button
                    onClick={handleSave}
                    disabled={isValidating}
                    className="w-full bg-zinc-900 hover:bg-black text-white font-bold py-3 rounded-lg flex justify-center transition-colors"
                >
                    {isValidating ? <Loader2 className="animate-spin" /> : "Save Key"}
                </button>
                <p className="mt-4 text-xs text-zinc-500 text-center mb-6">
                    Get a key from <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 underline">Google AI Studio</a>
                </p>

                {/* Disconnect Section */}
                {apiKey && (
                    <div className="pt-6 border-t border-zinc-800">
                        <button
                            onClick={() => {
                                if (confirmDisconnect) {
                                    fullLogout();
                                    onOpenChange(false);
                                } else {
                                    setConfirmDisconnect(true);
                                }
                            }}
                            className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${confirmDisconnect
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                                }`}
                        >
                            <LogOut className="w-4 h-4" />
                            {confirmDisconnect ? "Confirm Disconnect?" : "Disconnect Session"}
                        </button>
                        {confirmDisconnect && (
                            <p className="text-[10px] text-red-400 text-center mt-2 animate-pulse">
                                This will clear your API key and reset the project.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
