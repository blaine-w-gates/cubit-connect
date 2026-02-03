'use client';

import { useAppStore } from '@/store/useAppStore';
import { Share2 } from 'lucide-react';

export function GlobalAlert() {
  const { modalAlert, setModalAlert } = useAppStore();

  if (!modalAlert) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200"
      onClick={() => setModalAlert(null)}
    >
      <div
        className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-700 max-w-sm w-full animate-in zoom-in-95 duration-200 text-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
          <Share2 className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-bold text-zinc-900 dark:text-zinc-50 mb-1">Hold on!</h4>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{modalAlert}</p>
        </div>
        <button
          onClick={() => setModalAlert(null)}
          className="bg-black dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
