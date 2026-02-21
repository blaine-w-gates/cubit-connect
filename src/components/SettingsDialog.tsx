import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { LogOut, ShieldCheck } from 'lucide-react';

export default function SettingsDialog() {
  const { fullLogout, isSettingsOpen, setIsSettingsOpen, settingsVariant } = useAppStore();
  const open = isSettingsOpen;
  const onOpenChange = (v: boolean) => setIsSettingsOpen(v);
  const [mounted, setMounted] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!open) return null;

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
              The external AI backend may be experiencing heavy load or quota limitations.
              <br />
              <br />
              Please try again later.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-zinc-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Connection Secure
            </h2>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
              <div className="text-xs text-emerald-800 leading-relaxed">
                <strong>Zero-Trust Architecture:</strong> Your session is active and secure. No API keys are stored in your browser. All intelligent processing is proxied securely through our hardened server node.
              </div>
            </div>
          </>
        )}

        {/* Disconnect Section */}
        <div className="pt-6 border-t border-zinc-200">
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
                : 'bg-white border text-zinc-700 hover:bg-zinc-50'
              }`}
          >
            <LogOut className="w-4 h-4" />
            {confirmDisconnect ? 'Confirm Disconnect?' : 'End Local Session'}
          </button>
          {confirmDisconnect && (
            <p className="text-[10px] text-red-500 text-center mt-2 animate-pulse">
              This will safely clear your local workspace.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
