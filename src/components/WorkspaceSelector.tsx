'use client';

import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { Monitor, Globe, ShieldCheck } from 'lucide-react';
import type { WorkspaceType } from '@/lib/identity';

const TABS: { type: WorkspaceType; label: string; icon: typeof Monitor }[] = [
  { type: 'personalUno', label: 'My Projects', icon: Monitor },
  { type: 'personalMulti', label: 'Shared Projects', icon: Globe },
];

export default function WorkspaceSelector() {
  const {
    activeWorkspaceType,
    syncStatus,
    setIsSyncModalOpen,
  } = useAppStore(
    useShallow((s) => ({
      activeWorkspaceType: s.activeWorkspaceType,
      syncStatus: s.syncStatus,
      setIsSyncModalOpen: s.setIsSyncModalOpen,
    })),
  );

  const switchWorkspace = useAppStore((s) => s.switchWorkspace);

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-100 dark:bg-stone-900 border-b border-zinc-200 dark:border-stone-700">
      {TABS.map(({ type, label, icon: Icon }) => {
        const isActive = activeWorkspaceType === type;
        const isMulti = type === 'personalMulti';
        const isSynced = isMulti && syncStatus === 'connected';

        return (
          <button
            key={type}
            onClick={() => {
              if (isMulti && syncStatus !== 'connected') {
                setIsSyncModalOpen(true);
                return;
              }
              if (!isActive) {
                switchWorkspace(type);
              }
            }}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold
              transition-all duration-150 select-none
              ${isActive
                ? 'bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 shadow-sm ring-1 ring-zinc-200 dark:ring-stone-600'
                : 'text-zinc-500 dark:text-stone-400 hover:bg-zinc-200/60 dark:hover:bg-stone-800/50 hover:text-zinc-700 dark:hover:text-stone-300'
              }
            `}
            title={isMulti && syncStatus !== 'connected' ? 'Connect E2EE Sync to access shared projects' : label}
          >
            {isSynced ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Icon className="w-3.5 h-3.5" />
            )}
            <span className="hidden min-[360px]:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
