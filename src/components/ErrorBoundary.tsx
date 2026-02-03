'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Key, RefreshCcw, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { storageService } from '@/services/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | unknown;
  newKey: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    newKey: '',
  };

  public static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error, newKey: '' };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Cubit System Failure:', error, errorInfo);
  }

  private getErrorMessage(): string {
    const e = this.state.error;
    if (e instanceof Error) return e.message;
    if (typeof e === 'string') return e;
    return 'Unknown System Error';
  }

  handleSaveKey = async () => {
    const key = this.state.newKey.trim();
    if (!key) return;

    useAppStore.getState().setApiKey(key);

    // 🛡️ DATA SAFETY: Force Save before Reload
    try {
      const state = useAppStore.getState();
      if (state.tasks.length > 0 || state.transcript) {
        await storageService.saveProject(
          state.tasks,
          state.transcript || undefined,
          state.scoutResults,
          state.projectType,
          state.projectTitle,
        );
      }
    } catch (e) {
      console.error('Safety Save Failed:', e);
    }

    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleHardReset = async () => {
    if (confirm('This will wipe all local data and reset the app. Are you sure?')) {
      await useAppStore.getState().fullLogout();
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      const rawMsg = this.getErrorMessage();
      const msg = rawMsg.toLowerCase();
      const isQuota = msg.includes('quota') || msg.includes('429') || msg.includes('limit');

      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-50 text-zinc-900 p-6">
          <div className="max-w-md w-full bg-white border border-zinc-200 shadow-xl rounded-xl p-8">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${isQuota ? 'bg-purple-50 text-purple-600' : 'bg-red-50 text-red-600'}`}
            >
              {isQuota ? <Key className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <h1 className="text-xl font-bold text-center mb-2">
              {isQuota ? 'API Limit Reached' : 'System Error'}
            </h1>
            <p className="text-zinc-500 text-sm text-center mb-6 leading-relaxed">
              {isQuota
                ? 'You have hit the free tier limit (~20 requests/day). To continue immediately, please enter your own Google Gemini API Key below.'
                : 'The application encountered a critical error. Your data is safe in local storage.'}
            </p>
            {isQuota ? (
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Paste API Key (AIza...)"
                  className="w-full px-4 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                  value={this.state.newKey}
                  onChange={(e) => this.setState({ newKey: e.target.value })}
                />
                <button
                  onClick={this.handleSaveKey}
                  disabled={!this.state.newKey}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Save & Resume
                </button>
                <p className="text-xs text-center text-zinc-400 mt-2">
                  Keys are stored locally on your device.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-100 p-3 rounded text-xs font-mono text-red-700 overflow-auto max-h-32 break-all">
                  {rawMsg}
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-black text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Reload Application
                </button>
                <button
                  onClick={this.handleHardReset}
                  className="w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Hard Reset (Clear Data)
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
