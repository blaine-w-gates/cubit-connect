/**
 * Identity Settings Component
 *
 * Displays user authentication status, linked devices, and migration state.
 * Provides sign out functionality and "data at risk" warnings for anonymous users.
 *
 * @module src/components/IdentitySettings
 * @production
 * @version 1.0.0
 */

'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/shallow';
import { getLinkedDevices, type LinkedDevice } from '@/lib/auth';
import { getMigrationStatus } from '@/lib/migration';
import {
  LogOut,
  Shield,
  AlertTriangle,
  CheckCircle,
  Smartphone,
  Laptop,
  Tablet,
  Loader2,
} from 'lucide-react';

interface MigrationInfo {
  status: string | null;
  projectCount: number;
}

/**
 * Identity Settings Panel
 *
 * Shows authentication state, linked devices, and migration status.
 *
 * @returns Settings panel JSX
 */
export function IdentitySettings(): React.ReactElement {
  // Auth state from store
  const { authStatus, authEmail, authUserId, signOut } = useAppStore(
    useShallow((state) => ({
      authStatus: state.authStatus,
      authEmail: state.authEmail,
      authUserId: state.authUserId,
      signOut: state.signOut,
    }))
  );

  // Local state
  const [linkedDevices, setLinkedDevices] = useState<LinkedDevice[]>([]);
  const [migrationInfo, setMigrationInfo] = useState<MigrationInfo>({
    status: null,
    projectCount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load device and migration data when authenticated
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        // Load linked devices
        if (authUserId) {
          const devices = await getLinkedDevices(authUserId);
          setLinkedDevices(devices);
        }

        // Load migration status
        const migrationMeta = getMigrationStatus();
        setMigrationInfo({
          status: migrationMeta?.status ?? null,
          projectCount: migrationMeta?.projectCount ?? 0,
        });
      } catch (err) {
        console.error('[IDENTITY SETTINGS] Failed to load data:', err);
        setError('Failed to load account information');
      } finally {
        setIsLoading(false);
      }
    }

    if (authStatus === 'authenticated' && authUserId) {
      loadData();
    }
  }, [authStatus, authUserId]);

  async function handleSignOut() {
    setIsLoading(true);
    setError(null);

    try {
      await signOut();
      // Sign out successful - store will update authStatus
    } catch (err) {
      console.error('[IDENTITY SETTINGS] Sign out error:', err);
      setError('Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  }

  // Anonymous user warning
  if (authStatus === 'anonymous') {
    return (
      <div className="p-4 space-y-4">
        <AnonymousWarning />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Auth Status Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-stone-700">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-stone-100">
            Authenticated
          </h3>
          <p className="text-sm text-zinc-500 dark:text-stone-400">
            {authEmail || 'No email'}
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center gap-2 text-zinc-500 dark:text-stone-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading account info...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Linked Devices */}
      <section>
        <h4 className="text-sm font-medium text-zinc-700 dark:text-stone-300 mb-3 flex items-center gap-2">
          <Smartphone className="w-4 h-4" />
          Linked Devices
        </h4>

        {linkedDevices.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-stone-400">
            No devices linked yet. This device will be linked automatically.
          </p>
        ) : (
          <div className="space-y-2">
            {linkedDevices.map((device) => (
              <DeviceRow
                key={device.deviceId}
                device={device}
                isCurrent={device.deviceId === currentDeviceId}
              />
            ))}
          </div>
        )}
      </section>

      {/* Migration Status */}
      <section>
        <h4 className="text-sm font-medium text-zinc-700 dark:text-stone-300 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Data Migration
        </h4>

        <MigrationStatus status={migrationInfo.status} />
      </section>

      {/* Sign Out Button */}
      <div className="pt-4 border-t border-zinc-200 dark:border-stone-700">
        <button
          onClick={handleSignOut}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          Sign Out
        </button>
      </div>
    </div>
  );
}

/**
 * Anonymous User Warning
 *
 * Displays warning about data not being backed up.
 */
function AnonymousWarning(): React.ReactElement {
  return (
    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
            Data at Risk
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
            You&apos;re using Cubit anonymously. Your data is stored locally only and
            could be lost if you clear your browser data or switch devices.
          </p>
          <button
            onClick={() => {
              // Open auth modal - would need to be passed as prop or use global state
              // For now, redirect to header auth button
              const authButton = document.querySelector('[data-auth-trigger]');
              authButton?.dispatchEvent(new Event('click'));
            }}
            className="text-sm font-medium text-amber-800 dark:text-amber-200 hover:underline"
          >
            Sign up to back up your data →
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Device Row Component
 *
 * Displays a single linked device.
 */
function DeviceRow({ device, isCurrent }: { device: LinkedDevice; isCurrent?: boolean }): React.ReactElement {
  const deviceIconClass = 'w-5 h-5 text-zinc-500 dark:text-stone-400';

  return (
    <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-stone-800/50 rounded-lg">
      <DeviceIcon type="unknown" className={deviceIconClass} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-stone-100 truncate">
          {device.deviceName || 'Unknown Device'}
        </p>
        <p className="text-xs text-zinc-500 dark:text-stone-400">
          Last seen: {formatLastSeen(device.lastSeenAt)}
        </p>
      </div>
      {isCurrent && (
        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
          Current
        </span>
      )}
    </div>
  );
}

/**
 * Migration Status Component
 */
function MigrationStatus({
  status,
}: {
  status: string | null;
}): React.ReactElement {
  if (!status || status === 'idle') {
    return (
      <p className="text-sm text-zinc-500 dark:text-stone-400">
        No migration needed. Your data is safe.
      </p>
    );
  }

  if (status === 'completed') {
    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm">Migration complete. Data is backed up.</span>
      </div>
    );
  }

  if (status === 'in_progress' || status === 'exporting' || status === 'migrating') {
    return (
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Migration in progress...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm">Migration failed. Data may not be backed up.</span>
      </div>
    );
  }

  return (
    <p className="text-sm text-zinc-500 dark:text-stone-400">
      Migration status: {status}
    </p>
  );
}

/**
 * Device Icon Component
 *
 * Renders appropriate device icon based on type.
 */
function DeviceIcon({
  type,
  className,
}: {
  type: string | undefined;
  className?: string;
}): React.ReactElement {
  switch (type?.toLowerCase()) {
    case 'mobile':
    case 'phone':
      return <Smartphone className={className} />;
    case 'tablet':
    case 'ipad':
      return <Tablet className={className} />;
    default:
      return <Laptop className={className} />;
  }
}

/**
 * Current device ID for comparison
 */
const currentDeviceId = typeof window !== 'undefined'
  ? localStorage.getItem('cubit_device_id') || ''
  : '';

/**
 * Format last seen timestamp
 */
function formatLastSeen(timestamp: string | number | undefined): string {
  if (!timestamp) return 'Unknown';

  const timestampMs = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const now = Date.now();
  const diff = now - timestampMs;

  // Less than 1 hour
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return minutes < 1 ? 'Just now' : `${minutes}m ago`;
  }

  // Less than 24 hours
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}h ago`;
  }

  // Days
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}
