'use client';

import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { X } from 'lucide-react';

interface ShortcutsHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  page: 'global' | 'todo' | 'engine';
}

export function ShortcutsHelpOverlay({ isOpen, onClose, page }: ShortcutsHelpOverlayProps) {
  if (!isOpen) return null;

  const pageShortcuts = SHORTCUTS[page] || [];
  const allShortcuts = [...SHORTCUTS.global, ...pageShortcuts];

  // Group by group name
  const groups = allShortcuts.reduce((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {} as Record<string, typeof allShortcuts>);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-700 rounded-lg shadow-2xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-bold italic">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-stone-200 transition-colors"
            aria-label="Close shortcuts help"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {Object.entries(groups).map(([group, shortcuts]) => (
            <div key={group}>
              <div className="text-xs font-mono text-zinc-400 dark:text-stone-500 uppercase mb-2">
                {group}
              </div>
              <div className="space-y-1.5">
                {shortcuts.map((s) => (
                  <div key={s.keys} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 dark:text-stone-400">{s.description}</span>
                    <kbd className="font-mono text-xs bg-zinc-100 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 px-2 py-0.5 rounded">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-stone-800 text-xs text-zinc-400 dark:text-stone-500">
          Press <kbd className="font-mono bg-zinc-100 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 px-1.5 py-0.5 rounded">?</kbd> to toggle this help · <kbd className="font-mono bg-zinc-100 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 px-1.5 py-0.5 rounded">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
