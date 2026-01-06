import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { GemininService } from '@/services/gemini';
import { Loader2 } from 'lucide-react';

export default function SettingsDialog() {
    const { apiKey, setApiKey } = useAppStore();
    const [inputKey, setInputKey] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;
    if (apiKey) return null;

    const handleSave = async () => {
        if (!inputKey.trim()) return;
        setIsValidating(true);
        setError(null);
        try {
            // Use default model (2.5-flash-lite)
            await GemininService.analyzeTranscript(inputKey, "Test");
            setApiKey(inputKey);
        } catch (err) {
            setError("Invalid Key or Quota Exceeded. Try a new key.");
        } finally {
            setIsValidating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4">Setup API Key</h2>
                <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white mb-4"
                />
                {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
                <button
                    onClick={handleSave}
                    disabled={isValidating}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex justify-center"
                >
                    {isValidating ? <Loader2 className="animate-spin" /> : "Save Key"}
                </button>
                <p className="mt-4 text-xs text-zinc-500 text-center">
                    Get a key from <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 underline">Google AI Studio</a>
                </p>
            </div>
        </div>
    );
}
