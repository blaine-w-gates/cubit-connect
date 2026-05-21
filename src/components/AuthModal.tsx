/**
 * Auth Modal Component
 *
 * Provides Sign In / Sign Up functionality with tabbed interface.
 * Integrates with useAppStore auth actions for authentication flow.
 *
 * @module src/components/AuthModal
 * @production
 * @version 1.0.0
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';

interface AuthModalProps {
  /** Whether modal is visible */
  isOpen: boolean;
  /** Callback when modal closes */
  onClose: () => void;
}

/**
 * Auth Modal
 *
 * Tabbed interface for Sign In and Sign Up operations.
 * Handles form validation, loading states, and error display.
 *
 * @param props - Component props
 * @returns Modal JSX or null if closed/auth disabled
 */
export function AuthModal({ isOpen, onClose }: AuthModalProps): React.ReactElement | null {
  // Local state - MUST be before any conditional returns (React hooks rule)
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store actions
  const signUp = useAppStore((state) => state.signUp);
  const signIn = useAppStore((state) => state.signIn);
  const authStatus = useAppStore((state) => state.authStatus);

  const isLoading = authStatus === 'pending';

  // Close modal when auth succeeds (using ref to prevent stale closure issues)
  useEffect(() => {
    if (authStatus === 'authenticated' && isOpen) {
      onClose();
    }
  }, [authStatus, isOpen, onClose]);

  /**
   * Validate email format
   */
  const isValidEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }, []);

  /**
   * Validate password strength
   */
  const isValidPassword = useCallback((password: string): boolean => {
    return password.length >= 8;
  }, []);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validate inputs
      if (!isValidEmail(email)) {
        setError('Please enter a valid email address');
        return;
      }

      if (!isValidPassword(password)) {
        setError('Password must be at least 8 characters');
        return;
      }

      // Perform auth action
      try {
        const result =
          activeTab === 'signup'
            ? await signUp(email, password)
            : await signIn(email, password);

        if (!result.success) {
          setError(result.error || 'Authentication failed');
        }
        // Success handled by useEffect watching authStatus
      } catch (err) {
        // INTENTIONALLY HANDLING: Unexpected errors during auth
        // Display user-friendly error while preserving app stability
        setError('An unexpected error occurred. Please try again.');
        console.error('[AUTH MODAL] Submit error:', err);
      }
    },
    [email, password, activeTab, signUp, signIn, isValidEmail, isValidPassword]
  );

  /**
   * Handle overlay click to close
   */
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading]
  );

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-stone-900 border-t sm:border rounded-t-2xl sm:rounded-xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto pb-8 sm:pb-6 border-zinc-200 dark:border-stone-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={() => !isLoading && onClose()}
          disabled={isLoading}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-stone-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Close authentication"
        >
          <X size={20} />
        </button>

        {/* Title */}
        <h2
          id="auth-modal-title"
          className="text-xl font-bold text-zinc-900 dark:text-stone-100 mb-4"
        >
          {activeTab === 'signin' ? 'Sign In' : 'Create Account'}
        </h2>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-zinc-100 dark:bg-stone-800 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => { setActiveTab('signin'); setError(null); }}
            disabled={isLoading}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors min-h-[44px] disabled:opacity-50 ${
              activeTab === 'signin'
                ? 'bg-white dark:bg-stone-700 text-zinc-900 dark:text-stone-100 shadow-sm'
                : 'text-zinc-600 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('signup'); setError(null); }}
            disabled={isLoading}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors min-h-[44px] disabled:opacity-50 ${
              activeTab === 'signup'
                ? 'bg-white dark:bg-stone-700 text-zinc-900 dark:text-stone-100 shadow-sm'
                : 'text-zinc-600 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email input */}
          <div>
            <label
              htmlFor="auth-email"
              className="block text-sm font-medium text-zinc-700 dark:text-stone-300 mb-1"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 placeholder-zinc-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-stone-500 min-h-[44px] disabled:opacity-50"
              autoComplete="email"
            />
          </div>

          {/* Password input */}
          <div>
            <label
              htmlFor="auth-password"
              className="block text-sm font-medium text-zinc-700 dark:text-stone-300 mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                placeholder="Minimum 8 characters"
                className="w-full px-3 py-2 pr-10 border border-zinc-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 placeholder-zinc-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-stone-500 min-h-[44px] disabled:opacity-50"
                autoComplete={activeTab === 'signup' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-stone-300 p-1 disabled:opacity-50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-stone-400">
              Must be at least 8 characters
            </p>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-zinc-900 dark:bg-stone-100 text-white dark:text-zinc-900 font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-stone-500 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{activeTab === 'signin' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <span>{activeTab === 'signin' ? 'Sign In' : 'Create Account'}</span>
            )}
          </button>
        </form>

        {/* Additional info */}
        <p className="mt-4 text-xs text-center text-zinc-500 dark:text-stone-400">
          {activeTab === 'signin'
            ? "Don't have an account? Click 'Sign Up' above."
            : 'Already have an account? Click "Sign In" above.'}
        </p>
      </div>
    </div>
  );
}
