'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { ApiKeyInput } from '@/components/setup/ApiKeyInput';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Dashboard } from '@/components/dashboard/Dashboard';

export default function Home() {
  const isHydrated = useAppStore((state) => state.isHydrated);
  const apiKey = useAppStore((state) => state.apiKey);
  const isPrivateBrowsing = useAppStore((state) => state.isPrivateBrowsing);
  const initialize = useAppStore((state) => state.initialize);
  const reset = useAppStore((state) => state.reset);

  // Initialize store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Show loading while hydrating
  if (!isHydrated) {
    return <LoadingSpinner message="Initializing..." />;
  }

  // No API key - show setup
  if (!apiKey) {
    return <ApiKeyInput />;
  }

  // API key exists - show dashboard
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Cubit Connect</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => reset(true)}
              className="text-sm text-gray-500 hover:text-amber-600 transition-colors"
            >
              New Project
            </button>
            <button
              onClick={() => reset(false)}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Reset All
            </button>
          </div>
        </div>
      </header>

      {/* Private Browsing Warning */}
      {isPrivateBrowsing && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <p className="text-yellow-800 text-sm text-center">
            ⚠️ Private browsing mode - data will not persist
          </p>
        </div>
      )}

      {/* Dashboard */}
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <Dashboard />
      </div>
    </main>
  );
}
