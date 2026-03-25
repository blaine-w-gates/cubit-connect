import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { GeminiService } from '@/services/gemini';
import { storageService } from '@/services/storage';
import { LogOut, HardDrive, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const { apiKey, setApiKey, fullLogout, isSettingsOpen, setIsSettingsOpen, settingsVariant } =
    useAppStore();
  const open = isSettingsOpen;
  const onOpenChange = (v: boolean) => setIsSettingsOpen(v);
  const [inputKey, setInputKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [storageEst, setStorageEst] = useState<{ usage: number; quota: number } | null>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    storageService.getStorageEstimate().then(setStorageEst);
  }, [open]);

  // Sync input with store when opening, if needed.
  // But usually we want to keep input clear for security or show masked.

  if (!mounted) return null;
  if (!open) return null;

  const handleSave = async () => {
    if (!inputKey || !inputKey.trim()) return;
    setIsValidating(true);
    setError(null);
    try {
      // Use lightweight validation
      await GeminiService.validateConnection(inputKey);
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={() => onOpenChange(false)}
    >
      <div
        className={`w-full sm:max-w-md bg-white dark:bg-stone-900 border-t sm:border rounded-t-2xl sm:rounded-xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto pb-8 sm:pb-6 ${isQuotaMode ? 'border-red-200 dark:border-red-900 ring-4 ring-red-50 dark:ring-red-900/20' : 'border-zinc-200 dark:border-stone-700'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-stone-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close settings"
        >
          ✕
        </button>

        {isQuotaMode ? (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
              <span className="text-lg">🔴</span>
              <h2 className="text-xl font-bold">Usage Limit Reached</h2>
            </div>
            <p className="text-sm text-zinc-600 dark:text-stone-400 leading-relaxed">
              The free tier for this Google Cloud Project is exhausted.
              <br />
              <br />
              To continue, you must create a <strong className="text-zinc-900 dark:text-stone-100">
                NEW Project
              </strong>{' '}
              in Google AI Studio and generate a new key.
            </p>
          </div>
        ) : (
            <h2 className="text-xl font-bold text-zinc-900 dark:text-stone-100 mb-4">Switch Out Your API Key</h2>
        )}

        <input
          type="password"
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
          placeholder="AIzaSy..."
          className="w-full bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-600 rounded-lg px-4 py-3 text-base sm:text-sm text-zinc-900 dark:text-stone-100 mb-4 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-stone-400 focus:outline-none"
        />
        {error && (
          <div className="text-red-500 text-sm mb-4 font-medium flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

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
        <p className="mt-4 text-xs text-zinc-500 dark:text-stone-400 text-center mb-6">
          Get a key from{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Google AI Studio
          </a>
        </p>

        {/* Storage Section */}
        {storageEst && storageEst.quota > 0 && (
          <div className="mb-6 pt-6 border-t border-zinc-200 dark:border-stone-700">
            <div className="flex items-center gap-2 text-zinc-700 dark:text-stone-300 mb-2">
              <HardDrive className="w-4 h-4" />
              <span className="text-sm font-medium">Local Storage</span>
            </div>
            <p className={`text-sm mb-3 ${storageEst.usage / storageEst.quota >= 0.8 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-zinc-600 dark:text-stone-400'}`}>
              {formatBytes(storageEst.usage)} of {formatBytes(storageEst.quota)} used
              {storageEst.usage / storageEst.quota >= 0.8 && ' — approaching limit'}
            </p>
            <button
              onClick={() => useAppStore.getState().exportAndClearData()}
              className="w-full py-2.5 px-4 font-semibold rounded-lg border border-zinc-200 dark:border-stone-700 text-zinc-700 dark:text-stone-300 hover:bg-zinc-50 dark:hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export & Clear Data
            </button>
          </div>
        )}

        {/* Disconnect Section */}
        {apiKey && (
          <div className="pt-6 border-t border-zinc-200 dark:border-stone-700">
            <button
              onClick={() => {
                if (confirmDisconnect) {
                  fullLogout();
                  onOpenChange(false);
                  router.push('/');
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
              <p className="text-[10px] text-red-500 text-center mt-2 animate-pulse">
                This will clear your API key and reset the project.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
