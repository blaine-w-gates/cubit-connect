'use client';

import React from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetData = async () => {
    try {
      const { useAppStore } = await import('@/store/useAppStore');
      await useAppStore.getState().resetProject();
      this.setState({ hasError: false, error: null });
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isYjsError = this.state.error?.message?.includes('Y') ||
      this.state.error?.message?.includes('yjs') ||
      this.state.error?.message?.includes('CRDT') ||
      this.state.error?.message?.includes('applyUpdate');

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-stone-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-stone-800 p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-stone-100">
              Something went wrong
            </h2>
            <p className="text-sm text-zinc-600 dark:text-stone-400 mt-2">
              {isYjsError
                ? 'A data synchronization error occurred. Your data may be corrupted. Try reloading, or reset local data if the problem persists.'
                : 'An unexpected error occurred. Try reloading the page.'}
            </p>
          </div>

          {this.state.error && (
            <div className="bg-zinc-50 dark:bg-stone-800/50 rounded-lg p-3 text-left">
              <p className="text-xs font-mono text-zinc-500 dark:text-stone-400 break-all">
                {this.state.error.message}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-zinc-900 dark:bg-stone-200 text-white dark:text-stone-900 font-semibold rounded-xl hover:bg-zinc-800 dark:hover:bg-stone-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Page
            </button>
            <button
              onClick={this.handleResetData}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 font-semibold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Reset Local Data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
