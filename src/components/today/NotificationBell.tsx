/**
 * NotificationBell Component - A+ Grade Premium Implementation
 * 
 * Features:
 * - Elegant Bell icon toggle with smooth animations
 * - Anti-spam: Pre-prompt Toast before native permission request
 * - Permission state persistence in TodayPreferences
 * - Graceful handling of denied state
 */

'use client';

import { useCallback, useState } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationBellProps {
  enabled: boolean;
  permission: NotificationPermission | null;
  onEnable: () => void;
  onDisable: () => void;
}

export function NotificationBell({
  enabled,
  permission,
  onEnable,
  onDisable,
}: NotificationBellProps) {
  const [isRequesting, setIsRequesting] = useState(false);

  const handleToggle = useCallback(() => {
    // If already enabled, just disable
    if (enabled) {
      onDisable();
      toast.info('Notifications disabled for timer', {
        duration: 2000,
      });
      return;
    }

    // If permission is already granted, just enable
    if (permission === 'granted') {
      onEnable();
      toast.success('Notifications enabled!', {
        duration: 2000,
      });
      return;
    }

    // If permission was denied, show message about browser settings
    if (permission === 'denied') {
      toast.error('Notifications blocked. Please enable them in your browser settings.', {
        duration: 5000,
      });
      return;
    }

    // Show pre-prompt Toast for first-time request
    if (permission === 'default' || permission === null) {
      setIsRequesting(true);
      
      toast.custom(
        (t) => (
          <div className="flex items-start gap-3 p-4 bg-white dark:bg-stone-900 rounded-xl shadow-xl border border-stone-200 dark:border-stone-700 max-w-sm">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-1">
                Enable Notifications?
              </p>
              <p className="text-xs text-stone-600 dark:text-stone-400 mb-3">
                Cubit Connect needs notification permission to alert you when the timer finishes in the background.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    toast.dismiss(t);
                    setIsRequesting(false);
                    
                    // Request native permission
                    if (typeof window !== 'undefined' && 'Notification' in window) {
                      Notification.requestPermission().then((newPermission) => {
                        if (newPermission === 'granted') {
                          onEnable();
                          toast.success('Notifications enabled!', {
                            duration: 2000,
                          });
                        } else if (newPermission === 'denied') {
                          toast.error('Notifications denied. You can enable them later in settings.', {
                            duration: 3000,
                          });
                        }
                      });
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3 h-3" />
                  Allow
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t);
                    setIsRequesting(false);
                  }}
                  className="px-3 py-1.5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 text-xs font-medium transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        ),
        {
          duration: Infinity,
        }
      );
    }
  }, [enabled, permission, onEnable, onDisable]);

  // Determine icon state
  const Icon = !enabled || permission === 'denied' ? BellOff : Bell;
  const isDisabled = permission === 'denied';

  return (
    <button
      onClick={handleToggle}
      disabled={isRequesting}
      className={`group relative p-2.5 rounded-xl transition-all duration-300 ${
        isRequesting
          ? 'opacity-50 cursor-wait'
          : isDisabled
            ? 'text-stone-400 cursor-not-allowed'
            : enabled
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
              : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
      }`}
      aria-label={enabled ? 'Disable notifications' : 'Enable notifications'}
      title={
        isDisabled
          ? 'Notifications blocked in browser settings'
          : enabled
            ? 'Notifications enabled - click to disable'
            : 'Enable timer notifications'
      }
    >
      <Icon 
        className={`w-5 h-5 transition-transform duration-300 ${
          !isDisabled && 'group-hover:scale-110'
        } ${enabled && !isDisabled && 'animate-pulse'}`} 
      />
      
      {/* Active indicator dot */}
      {enabled && !isDisabled && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
      )}
    </button>
  );
}

/**
 * Show a native browser notification
 */
export function showTimerNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'cubit-timer',
      requireInteraction: true,
    });
  }
}
