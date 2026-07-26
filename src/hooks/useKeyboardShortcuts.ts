'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface ShortcutDef {
  keys: string;
  description: string;
  group: string;
}

export const SHORTCUTS: Record<string, ShortcutDef[]> = {
  global: [
    { keys: 'g e', description: 'Go to Engine', group: 'Navigation' },
    { keys: 'g t', description: 'Go to Todo', group: 'Navigation' },
    { keys: 'g d', description: 'Go to Today', group: 'Navigation' },
    { keys: '⌘ ,', description: 'Open Settings', group: 'Navigation' },
    { keys: '?', description: 'Show this help', group: 'Help' },
    { keys: 'Esc', description: 'Close overlays / dialogs', group: 'Help' },
  ],
  todo: [
    { keys: 'n', description: 'New task', group: 'Todo' },
    { keys: 'Space', description: 'Toggle task completion', group: 'Todo' },
    { keys: 'Delete', description: 'Delete selected task', group: 'Todo' },
  ],
  engine: [
    { keys: '⌘ ⏎', description: 'Start processing', group: 'Engine' },
    { keys: 's', description: 'Toggle Scout mode', group: 'Engine' },
    { keys: 'v', description: 'Toggle Video mode', group: 'Engine' },
  ],
};

function isTypingInInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
}

export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [showHelp, setShowHelp] = useState(false);
  const gPressed = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getPage = useCallback(() => {
    if (pathname === '/todo') return 'todo';
    if (pathname === '/engine') return 'engine';
    return 'global';
  }, [pathname]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Escape always works — close help overlay
    if (e.key === 'Escape') {
      if (showHelp) {
        setShowHelp(false);
        e.preventDefault();
        return;
      }
      // Close settings/sync modals via store
      const store = (window as unknown as { __STORE__?: { getState: () => { setIsSettingsOpen: (v: boolean) => void; setIsSyncModalOpen: (v: boolean) => void } } }).__STORE__;
      if (store) {
        const s = store.getState();
        s.setIsSettingsOpen(false);
        s.setIsSyncModalOpen(false);
      }
      return;
    }

    // ? shows help (shift+/)
    if (e.key === '?' && !isTypingInInput()) {
      e.preventDefault();
      setShowHelp((prev) => !prev);
      return;
    }

    // Disable shortcuts when typing in input fields
    if (isTypingInInput()) return;

    const isMod = e.metaKey || e.ctrlKey;
    const page = getPage();

    // Cmd/Ctrl+, — open settings
    if (isMod && e.key === ',') {
      e.preventDefault();
      const store = (window as unknown as { __STORE__?: { getState: () => { setIsSettingsOpen: (v: boolean) => void } } }).__STORE__;
      if (store) store.getState().setIsSettingsOpen(true);
      return;
    }

    // Cmd/Ctrl+Enter — start processing (engine only)
    if (isMod && e.key === 'Enter' && page === 'engine') {
      e.preventDefault();
      const btn = document.getElementById('ignition') as HTMLButtonElement | null;
      btn?.click();
      return;
    }

    // Two-key sequence: g + e/t/d for navigation
    if (e.key === 'g' && !isMod) {
      gPressed.current = true;
      if (gTimer.current) clearTimeout(gTimer.current);
      gTimer.current = setTimeout(() => { gPressed.current = false; }, 800);
      return;
    }

    if (gPressed.current && !isMod) {
      gPressed.current = false;
      if (gTimer.current) { clearTimeout(gTimer.current); gTimer.current = null; }

      if (e.key === 'e') { e.preventDefault(); router.push('/engine'); return; }
      if (e.key === 't') { e.preventDefault(); router.push('/todo'); return; }
      if (e.key === 'd') { e.preventDefault(); router.push('/today'); return; }
    }

    // Page-specific shortcuts
    if (page === 'todo') {
      const store = (window as unknown as { __STORE__?: { getState: () => { addTodoRow: (task?: string) => void; todoRows: { id: string; isCompleted: boolean }[]; toggleTodoRowCompletion: (id: string) => void; deleteTodoRow: (id: string) => void; lastAddedRowId: string | null } } }).__STORE__;
      if (!store) return;
      const s = store.getState();

      // n — new task
      if (e.key === 'n' && !isMod) {
        e.preventDefault();
        s.addTodoRow('');
        return;
      }

      // Space — toggle completion of most recently added row
      if (e.key === ' ' && !isMod) {
        e.preventDefault();
        const targetId = s.lastAddedRowId || s.todoRows[0]?.id;
        if (targetId) s.toggleTodoRowCompletion(targetId);
        return;
      }

      // Delete — delete most recently added row
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isMod) {
        e.preventDefault();
        const targetId = s.lastAddedRowId || s.todoRows[0]?.id;
        if (targetId) s.deleteTodoRow(targetId);
        return;
      }
    }

    if (page === 'engine') {
      const store = (window as unknown as { __STORE__?: { getState: () => { setInputMode: (m: 'video' | 'text' | 'scout') => void } } }).__STORE__;
      if (!store) return;
      const s = store.getState();

      // s — toggle scout mode
      if (e.key === 's' && !isMod) {
        e.preventDefault();
        s.setInputMode('scout');
        document.getElementById('ignition')?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      // v — toggle video mode
      if (e.key === 'v' && !isMod) {
        e.preventDefault();
        s.setInputMode('video');
        return;
      }
    }
  }, [router, showHelp, getPage]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}
