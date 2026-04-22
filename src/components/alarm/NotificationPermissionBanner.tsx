'use client';

import { useState } from 'react';
import { Bell, X } from 'lucide-react';

function getInitialPermission(): NotificationPermission {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission;
  }
  return 'default';
}

export function NotificationPermissionBanner() {
  const [permission, setPermission] = useState<NotificationPermission>(getInitialPermission);
  const [isDismissed, setIsDismissed] = useState(false);

  const isVisible = permission !== 'granted' && !isDismissed;

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        // Test notification
        new Notification('Cubit Connect', {
          body: 'Notifications enabled! You will now receive alarm alerts.',
          icon: '/favicon.ico',
        });
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    }
  };

  const dismiss = () => {
    setIsDismissed(true);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-white/20 rounded-full shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm mb-1">Enable Alarm Notifications</h4>
          <p className="text-xs text-cyan-100 mb-3">
            To receive Pomodoro timer alerts even when the app is in the background, please enable browser notifications.
          </p>
          <div className="flex gap-2">
            <button
              onClick={requestPermission}
              className="px-3 py-1.5 bg-white text-cyan-600 text-sm font-medium rounded-md hover:bg-cyan-50 transition-colors"
            >
              Enable Notifications
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 text-cyan-100 text-sm hover:text-white transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="p-1 text-cyan-100 hover:text-white transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
