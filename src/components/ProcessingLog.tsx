'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { ChevronUp, ChevronDown, Terminal } from 'lucide-react';

export default function ProcessingLog() {
  const { isProcessing, logs } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-open on Processing Start
  useEffect(() => {
    if (isProcessing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true);
    }
  }, [isProcessing]);

  // Log Logic - MOVED TO EVENT-DRIVEN.
  // Effect removed to prevent render-loop duplication.

  // Auto-scroll logic
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  // Always render to show System Status bar
  // if (logs.length === 0 && !isProcessing) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-stone-900 border-t border-zinc-200 dark:border-stone-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] font-sans transition-colors">
      {/* Header / Toggle Bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-[40px] flex items-center justify-between px-4 hover:bg-zinc-50 dark:hover:bg-stone-800 transition-colors"
      >
        <div className="flex items-center gap-2 text-zinc-600 dark:text-stone-400">
          <Terminal className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">System Status</span>
          {isProcessing && (
            <span className="flex h-2 w-2 relative ml-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-zinc-400 dark:text-stone-600" />
        ) : (
          <ChevronUp className="w-4 h-4 text-zinc-400 dark:text-stone-600" />
        )}
      </button>

      {/* Collapsible Body */}
      {isOpen && (
        <div className="h-48 border-t border-zinc-100 dark:border-stone-800 bg-zinc-50/50 dark:bg-black/20 p-4 overflow-y-auto font-mono text-xs">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`${log.message.includes('Complete') || log.message.includes('Success') ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-stone-400'} mb-1 border-l-2 border-zinc-300 dark:border-stone-700 pl-2 flex gap-2`}
            >
              <span className="text-zinc-400 dark:text-stone-600 font-bold shrink-0">
                [{log.timestamp}]
              </span>
              <span>{log.message}</span>
            </div>
          ))}
          <div ref={bottomRef} className="h-2" />
        </div>
      )}
    </div>
  );
}
