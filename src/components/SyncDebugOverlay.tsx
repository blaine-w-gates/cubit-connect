/**
 * SyncDebugOverlay - Visual Sync Health Dashboard
 * 
 * Displays real-time sync diagnostics:
 * - YDoc instance ID
 * - Observer registration status
 * - Sync connection status
 * - Last update timestamp
 * - Pending updates count
 * - Divergence detection
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getYDoc } from '@/store/useAppStore';
import { getInstanceId, generateDiagnosticReport, takeSnapshot, getSnapshots, compareSnapshots } from '@/lib/syncDiagnostics';
import { getGlobalConnectionManager } from '@/lib/syncConnectionManager';
import type { ConnectionHealth } from '@/lib/syncConnectionManager';
import * as Y from 'yjs';

interface SyncDebugState {
  ydocId: string | null;
  observerRegistered: boolean;
  syncStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  hasPeers: boolean;
  lastUpdateAt: number | null;
  pendingUpdates: number;
  zustandProjectCount: number;
  ydocProjectCount: number;
  diverged: boolean;
  isOpen: boolean;
  connectionHealth: ConnectionHealth | null;
}

// Separate component to handle the ticking time display
function LastUpdateTime({ lastUpdateAt }: { lastUpdateAt: number }) {
  const [secondsAgo, setSecondsAgo] = useState(() => 
    Math.round((Date.now() - lastUpdateAt) / 1000)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastUpdateAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdateAt]);

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">Last Update:</span>
      <span className="text-slate-300">{secondsAgo}s ago</span>
    </div>
  );
}

export function SyncDebugOverlay() {
  const [state, setState] = useState<SyncDebugState>({
    ydocId: null,
    observerRegistered: false,
    syncStatus: 'disconnected',
    hasPeers: false,
    lastUpdateAt: null,
    pendingUpdates: 0,
    zustandProjectCount: 0,
    ydocProjectCount: 0,
    diverged: false,
    isOpen: false,
    connectionHealth: null,
  });

  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null);
  const lastUpdateRef = useRef<number | null>(null);

  const collectState = useCallback(() => {
    const ydoc = getYDoc();
    const ydocIdValue = getInstanceId(ydoc);
    const ydocId = ydocIdValue ?? null;
    const observerId = (ydoc as { __observerId?: string }).__observerId;
    
    // Get Zustand state
    const storeState = useAppStore.getState();
    
    // Get Yjs state
    const yProjects = ydoc.getMap('projects');
    const yProjectCount = Array.from(yProjects.values()).filter((p: unknown) => {
      const proj = p as Y.Map<unknown>;
      return !proj.get('isDeleted');
    }).length;

    // Check for divergence
    const diverged = storeState.todoProjects.length !== yProjectCount;

    // Get connection health
    const connectionHealth = getGlobalConnectionManager().getHealth();

    setState(prev => ({
      ...prev,
      ydocId,
      observerRegistered: observerId === ydocId,
      syncStatus: storeState.syncStatus,
      hasPeers: storeState.hasPeers,
      zustandProjectCount: storeState.todoProjects.length,
      ydocProjectCount: yProjectCount,
      diverged,
      connectionHealth,
    }));
  }, []);

  useEffect(() => {
    // Listen for Yjs updates to track last update time
    const ydoc = getYDoc();
    const updateHandler = () => {
      lastUpdateRef.current = Date.now();
      setState(prev => ({
        ...prev,
        lastUpdateAt: Date.now(),
      }));
    };
    ydoc.on('update', updateHandler);

    // Start collection interval
    const interval = setInterval(() => {
      collectState();
    }, 1000);

    return () => {
      clearInterval(interval);
      ydoc.off('update', updateHandler);
    };
  }, [collectState]);

  const takeNewSnapshot = useCallback(() => {
    const snap = takeSnapshot('manual', {
      zustandProjects: useAppStore.getState().todoProjects.length,
      syncStatus: useAppStore.getState().syncStatus,
    });
    
    // Get all snapshots for display
    const allSnaps = getSnapshots();
    
    // If we have 2+ snapshots, compare the last two
    if (allSnaps.length >= 2) {
      const comparison = compareSnapshots(allSnaps[allSnaps.length - 2], allSnaps[allSnaps.length - 1]);
      const snapshot = JSON.stringify({
        timestamp: Date.now(),
        newSnapshot: snap,
        comparison,
        totalSnapshots: allSnaps.length,
      }, null, 2);
      setLastSnapshot(snapshot);
    } else {
      const snapshot = JSON.stringify({
        timestamp: Date.now(),
        newSnapshot: snap,
        totalSnapshots: allSnaps.length,
      }, null, 2);
      setLastSnapshot(snapshot);
    }
  }, []);

  const exportDiagnostics = useCallback(() => {
    const report = generateDiagnosticReport();
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-diagnostics-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (!state.isOpen) {
    return (
      <button
        onClick={() => setState(prev => ({ ...prev, isOpen: true }))}
        className="fixed bottom-4 right-4 z-[9999] bg-slate-800 text-white px-3 py-2 rounded-md text-xs font-mono shadow-lg hover:bg-slate-700 transition-colors"
      >
        🔧 Sync Debug
        {state.diverged && <span className="ml-2 text-red-400">⚠️</span>}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-slate-900 text-white rounded-lg shadow-2xl border border-slate-700 overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
        <span className="font-semibold">Sync Health Dashboard</span>
        <button
          onClick={() => setState(prev => ({ ...prev, isOpen: false }))}
          className="text-slate-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Status Grid */}
      <div className="p-3 space-y-2">
        {/* YDoc Status */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">YDoc ID:</span>
          <span className="text-xs" title={state.ydocId || 'unknown'}>
            {state.ydocId ? `${state.ydocId.slice(0, 8)}...` : 'unknown'}
          </span>
        </div>

        {/* Observer Status */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Observer:</span>
          <span className={state.observerRegistered ? 'text-green-400' : 'text-red-400'}>
            {state.observerRegistered ? '✓ Registered' : '✗ Missing'}
          </span>
        </div>

        {/* Sync Status */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Sync:</span>
          <span className={
            state.syncStatus === 'connected' ? 'text-green-400' :
            state.syncStatus === 'connecting' ? 'text-yellow-400' :
            'text-slate-400'
          }>
            {state.syncStatus}
            {state.hasPeers && ' (peers)'}
          </span>
        </div>

        {/* State Divergence */}
        <div className="flex items-center justify-between border-t border-slate-700 pt-2 mt-2">
          <span className="text-slate-400">Projects:</span>
          <span className={state.diverged ? 'text-red-400' : 'text-green-400'}>
            Z:{state.zustandProjectCount} / Y:{state.ydocProjectCount}
            {state.diverged && ' ⚠️'}
          </span>
        </div>

        {/* Last Update */}
        {state.lastUpdateAt && (
          <LastUpdateTime lastUpdateAt={state.lastUpdateAt} />
        )}

        {/* Connection Health */}
        {state.connectionHealth && (
          <div className="border-t border-slate-700 pt-2 mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">Conn Health:</span>
              <span className={state.connectionHealth.isHealthy ? 'text-green-400' : 'text-red-400'}>
                {state.connectionHealth.isHealthy ? '✓ Healthy' : '✗ Unhealthy'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Peer Count:</span>
              <span className="text-slate-300">{state.connectionHealth.peerCount}</span>
            </div>
            {state.connectionHealth.missedHeartbeats > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Missed HB:</span>
                <span className="text-yellow-400">{state.connectionHealth.missedHeartbeats}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-3 py-2 bg-slate-800 border-t border-slate-700 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={collectState}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded text-xs transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={takeNewSnapshot}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded text-xs transition-colors"
          >
            Snapshot
          </button>
        </div>
        <button
          onClick={exportDiagnostics}
          className="w-full bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs transition-colors"
        >
          Export Full Diagnostics
        </button>
      </div>

      {/* Snapshot Preview */}
      {lastSnapshot && (
        <div className="px-3 py-2 bg-slate-950 border-t border-slate-700 max-h-32 overflow-auto">
          <div className="text-slate-400 text-xs mb-1">Last Snapshot:</div>
          <pre className="text-[10px] text-slate-300 whitespace-pre-wrap">
            {lastSnapshot.slice(0, 500)}...
          </pre>
        </div>
      )}
    </div>
  );
}
