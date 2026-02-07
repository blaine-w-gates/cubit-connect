import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { GeminiService } from '@/services/gemini';
import { LogOut } from 'lucide-react';

const Spinner = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default function SettingsDialog() {
  const { apiKey, setApiKey, fullLogout, isSettingsOpen, setIsSettingsOpen, settingsVariant } = useAppStore();
  const open = isSettingsOpen;
  const onOpenChange = (v: boolean) => setIsSettingsOpen(v);
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
      await GeminiService.analyzeTranscript(inputKey, 'Test');
      setApiKey(inputKey);
      onOpenChange(false);
    } catch {
      setError('Invalid Key or Quota Exceeded. Try a new key.');
    } finally {
      setIsValidating(false);
    }
  };

  const isQuotaMode = settingsVariant === 'quota';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md bg-white border rounded-xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 ${isQuotaMode ? 'border-red-200 ring-4 ring-red-50' : 'border-zinc-200'
          }`}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 transition-colors"
        >
          ✕
        </button>

        {isQuotaMode ? (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <span className="text-lg">🔴</span>
              <h2 className="text-xl font-bold">Usage Limit Reached</h2>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">
              The free tier for this Google Cloud Project is exhausted.
              <br /><br />
              To continue, you must create a <strong className="text-zinc-900">NEW Project</strong> in Google AI Studio and generate a new key.
            </p>
          </div>
        ) : (
          <h2 className="text-xl font-bold text-zinc-900 mb-4">Switch Out Your API Key</h2>
        )}

        <input
          type="password"
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
          placeholder="AIzaSy..."
          className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-3 text-base sm:text-sm text-zinc-900 mb-4 focus:ring-2 focus:ring-zinc-900 focus:outline-none"
        />
        {error && <div className="text-red-500 text-sm mb-4 font-medium flex items-center gap-2">⚠️ {error}</div>}

        <button
          onClick={handleSave}
          disabled={isValidating}
          className={`w-full font-bold py-3 rounded-lg flex justify-center transition-all ${isQuotaMode
            ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200 shadow-lg'
            : 'bg-zinc-900 hover:bg-black text-white shadow-lg'
            }`}
        >
          {isValidating ? <Spinner className="animate-spin w-5 h-5" /> : 'Save Key'}
        </button>
        <p className="mt-4 text-xs text-zinc-500 text-center mb-6">
          Get a key from{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            className="text-blue-400 underline"
          >
            Google AI Studio
          </a>
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
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
            >
              <LogOut className="w-4 h-4" />
              {confirmDisconnect ? 'Confirm Disconnect?' : 'Disconnect Session'}
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
