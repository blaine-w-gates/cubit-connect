'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { NetworkSync } from '@/lib/networkSync';
import { deriveSyncKey } from '@/lib/cryptoSync';

interface LogEntry {
  time: string;
  type: 'local' | 'network' | 'system' | 'error';
  message: string;
}

export default function SyncTestPage() {
  // Connection state
  const [passphrase, setPassphrase] = useState('test-sync-2024');
  const [isConnected, setIsConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [hasPeers, setHasPeers] = useState(false);
  
  // Yjs state
  const [ydocId, setYdocId] = useState<string>('none');
  const [clientId, setClientId] = useState<number>(0);
  const [ydocCreated, setYdocCreated] = useState(false);
  const [updateCount, setUpdateCount] = useState({ local: 0, network: 0 });
  
  // Data state
  const [localText, setLocalText] = useState('');
  const [receivedText, setReceivedText] = useState('');
  const [networkFlash, setNetworkFlash] = useState(false);
  
  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Refs
  const ydocRef = useRef<Y.Doc | null>(null);
  const yTextRef = useRef<Y.Text | null>(null);
  const networkSyncRef = useRef<NetworkSync | null>(null);
  const syncKeyRef = useRef<CryptoKey | null>(null);
  const localTextRef = useRef(localText);
  
  // Keep ref in sync
  useEffect(() => {
    localTextRef.current = localText;
  }, [localText]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    const entry: LogEntry = {
      time: new Date().toISOString().split('T')[1].split('.')[0],
      type,
      message
    };
    setLogs(prev => [...prev.slice(-50), entry]);
  }, []);

  // Flash effect for network updates
  const triggerNetworkFlash = useCallback(() => {
    setNetworkFlash(true);
    setTimeout(() => setNetworkFlash(false), 300);
  }, []);

  // Connect to sync server
  const connect = async () => {
    if (isConnected) return;
    
    setSyncStatus('connecting');
    addLog('system', `Connecting with passphrase: ${passphrase}`);
    
    try {
      // Derive crypto key first
      const syncKey = await deriveSyncKey(passphrase);
      syncKeyRef.current = syncKey;
      
      // Create room hash
      const encoder = new TextEncoder();
      const roomHash = await crypto.subtle.digest('SHA-256', encoder.encode(passphrase));
      const roomIdHash = Array.from(new Uint8Array(roomHash)).map(b => b.toString(16).padStart(2, '0')).join('');
      const roomFingerprint = roomIdHash.slice(0, 4).toUpperCase();
      
      // Create fresh Y.Doc
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;
      
      const newYdocId = crypto.randomUUID();
      (ydoc as unknown as { __observerId?: string }).__observerId = newYdocId;
      setYdocId(newYdocId);
      setClientId(ydoc.clientID);
      addLog('system', `Created ydoc: ${newYdocId.slice(0, 8)}..., clientID: ${ydoc.clientID}`);
      
      // Create shared text
      const yText = ydoc.getText('shared');
      yTextRef.current = yText;
      
      // Set initial content
      if (localTextRef.current) {
        yText.insert(0, localTextRef.current);
      }
      
      // Register observer BEFORE creating NetworkSync
      ydoc.on('update', (update: Uint8Array, origin: unknown) => {
        const originStr = typeof origin === 'string' ? origin : String(origin);
        addLog(origin === 'network' ? 'network' : 'local', `Update received - origin: ${originStr}, size: ${update.length}b`);
        
        if (origin === 'network') {
          setUpdateCount(prev => ({ ...prev, network: prev.network + 1 }));
          triggerNetworkFlash();
          const text = yText.toString();
          setReceivedText(text);
          addLog('network', `Text updated from network: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);
        } else {
          setUpdateCount(prev => ({ ...prev, local: prev.local + 1 }));
        }
      });
      
      setYdocCreated(true);
      addLog('system', 'Observer registered on ydoc');
      
      // Create NetworkSync with correct constructor signature
      const SYNC_SERVER_URL = process.env.NEXT_PUBLIC_SYNC_SERVER_URL || 'wss://cubit-sync-relay.onrender.com';
      
      const networkSync = new NetworkSync(
        ydoc,
        SYNC_SERVER_URL,
        roomIdHash,
        (status) => {
          setSyncStatus(status);
          setIsConnected(status === 'connected');
          addLog('system', `Status changed: ${status}`);
        },
        () => {
          addLog('system', 'Sync activity detected');
        },
        () => {
          setHasPeers(true);
          addLog('system', 'Peer presence detected');
        },
        () => {
          setHasPeers(false);
          addLog('system', 'Peer disconnected');
        },
        (isEditing: boolean) => {
          addLog('system', `Peer editing: ${isEditing}`);
        }
      );
      
      networkSyncRef.current = networkSync;
      
      // Connect with the crypto key
      await networkSync.connect(syncKey);
      
      addLog('system', `Connected to room ${roomFingerprint}`);
      
    } catch (err: unknown) {
      // INTENTIONALLY HANDLING: Connection failures should be logged to UI, not crash the test page
      const msg = err instanceof Error ? err.message : String(err);
      addLog('error', `Connection failed: ${msg}`);
      setSyncStatus('error');
    }
  };

  // Disconnect
  const disconnect = () => {
    addLog('system', 'Disconnecting...');
    networkSyncRef.current?.disconnect();
    networkSyncRef.current = null;
    ydocRef.current?.destroy();
    ydocRef.current = null;
    syncKeyRef.current = null;
    setIsConnected(false);
    setSyncStatus('disconnected');
    setYdocCreated(false);
    setHasPeers(false);
    setYdocId('none');
    setClientId(0);
    setUpdateCount({ local: 0, network: 0 });
  };

  // Update local text and broadcast
  const updateLocalText = (text: string) => {
    setLocalText(text);
    
    if (yTextRef.current && ydocRef.current) {
      const yText = yTextRef.current;
      const current = yText.toString();
      
      ydocRef.current.transact(() => {
        if (current.length > 0) {
          yText.delete(0, current.length);
        }
        if (text.length > 0) {
          yText.insert(0, text);
        }
      }, 'local');
      
      addLog('local', `Text updated locally: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);
    }
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">Yjs Sync Diagnostic</h1>
            <p className="text-sm text-gray-400">Isolate sync layer from UI complexity</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              syncStatus === 'connected' ? 'bg-green-600 text-white' :
              syncStatus === 'connecting' ? 'bg-yellow-600 text-white' :
              syncStatus === 'error' ? 'bg-red-600 text-white' :
              'bg-gray-600 text-gray-300'
            }`}>
              {syncStatus.toUpperCase()}
            </div>
            {hasPeers && (
              <div className="px-3 py-1 rounded-full text-sm font-medium bg-blue-600 text-white animate-pulse">
                PEER CONNECTED
              </div>
            )}
            <div className="text-sm text-gray-400">
              ydoc: <span className="text-blue-300 font-mono">{ydocId.slice(0, 8)}...</span>
            </div>
            <div className="text-sm text-gray-400">
              clientID: <span className="text-purple-300 font-mono">{clientId}</span>
            </div>
            <div className={`w-3 h-3 rounded-full ${
              ydocCreated ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`} title={ydocCreated ? 'YDoc created' : 'No YDoc'} />
          </div>
        </div>

        {/* Connection Controls */}
        <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-4">
          <input
            type="text"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter passphrase..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            disabled={isConnected}
          />
          <button
            onClick={isConnected ? disconnect : connect}
            className={`px-6 py-2 rounded font-medium transition-colors ${
              isConnected 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>

        {/* Update Counters */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
            <div className="text-blue-300 text-sm font-semibold">Local Updates (Origin !== &apos;network&apos;)</div>
            <div className="text-2xl font-bold text-blue-400">{updateCount.local}</div>
          </div>
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
            <div className="text-green-300 text-sm font-semibold">Network Updates (Origin === &apos;network&apos;)</div>
            <div className="text-2xl font-bold text-green-400">{updateCount.network}</div>
            {updateCount.network === 0 && isConnected && (
              <div className="text-xs text-yellow-400 mt-1">⚠️ No network updates yet - sync may not be working</div>
            )}
          </div>
        </div>

        {/* Text Areas */}
        <div className="grid grid-cols-2 gap-6">
          {/* Local Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-blue-300">Local Input (You)</h2>
              <span className="text-xs text-gray-500">Type here → broadcasts to peers</span>
            </div>
            <textarea
              value={localText}
              onChange={(e) => updateLocalText(e.target.value)}
              placeholder="Type here to test sync..."
              className="w-full h-64 bg-gray-800 border-2 border-blue-600 rounded-lg p-4 text-white resize-none focus:outline-none focus:border-blue-400"
              disabled={!isConnected && !ydocCreated}
            />
            <div className="text-right text-xs text-gray-500">
              {localText.length} chars
            </div>
          </div>

          {/* Received from Network */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-green-300">Received from Network</h2>
              <span className="text-xs text-gray-500">Updates from peers appear here</span>
            </div>
            <div className={`relative transition-all duration-150 ${
              networkFlash ? 'ring-4 ring-green-500 ring-opacity-75' : ''
            }`}>
              <textarea
                value={receivedText}
                readOnly
                placeholder="Network updates will appear here..."
                className="w-full h-64 bg-gray-800 border-2 border-green-600 rounded-lg p-4 text-white resize-none focus:outline-none"
              />
              {networkFlash && (
                <div className="absolute inset-0 bg-green-500/20 rounded-lg pointer-events-none animate-pulse" />
              )}
            </div>
            <div className="text-right text-xs text-gray-500">
              {receivedText.length} chars
              {networkFlash && <span className="ml-2 text-green-400 font-bold animate-pulse">● UPDATE RECEIVED</span>}
            </div>
          </div>
        </div>

        {/* Status Panel */}
        <div className="bg-gray-800 rounded-lg p-4 grid grid-cols-5 gap-4 text-sm">
          <div>
            <div className="text-gray-500 mb-1">Connection</div>
            <div className={`font-mono font-bold ${
              isConnected ? 'text-green-400' : 'text-red-400'
            }`}>
              {isConnected ? '● CONNECTED' : '○ DISCONNECTED'}
            </div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Y.Doc Created</div>
            <div className={`font-mono font-bold ${
              ydocCreated ? 'text-green-400' : 'text-red-400'
            }`}>
              {ydocCreated ? '● YES' : '○ NO'}
            </div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Y.Doc Instance</div>
            <div className="font-mono text-blue-400 truncate">
              {ydocId === 'none' ? 'none' : ydocId.slice(0, 16)}
            </div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Yjs ClientID</div>
            <div className="font-mono text-purple-400">{clientId}</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Peers</div>
            <div className={`font-mono font-bold ${
              hasPeers ? 'text-green-400' : 'text-gray-500'
            }`}>
              {hasPeers ? '● YES' : '○ NO'}
            </div>
          </div>
        </div>

        {/* Event Log */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-300">Event Log (Last 50)</h2>
            <button
              onClick={clearLogs}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="bg-black rounded-lg p-3 h-64 overflow-y-auto font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-600 italic">No events yet...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`${
                  log.type === 'network' ? 'text-green-400' :
                  log.type === 'local' ? 'text-blue-400' :
                  log.type === 'error' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  <span className="text-gray-600">[{log.time}]</span>{' '}
                  <span className="font-bold uppercase">{log.type}:</span>{' '}
                  {log.message}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 text-sm text-blue-200">
          <h3 className="font-semibold mb-2">Testing Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open this page on two devices (Chrome + iPad) with the same passphrase</li>
            <li>Click &quot;Connect&quot; on both devices</li>
            <li>Wait for &quot;PEER CONNECTED&quot; badge to appear on both</li>
            <li>Type in the Local Input area on Device A</li>
            <li>Watch for green flash and text appearing in &quot;Received from Network&quot; on Device B</li>
            <li>Check that &quot;Network Updates&quot; counter increments - this proves observer is firing</li>
            <li>If counter stays at 0 but text appears → UI layer bug (observer isn&apos;t firing)</li>
            <li>If text doesn&apos;t appear at all → Yjs/Network layer bug</li>
          </ol>
        </div>

        {/* Key Diagnostic Indicators */}
        <div className="grid grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg border-2 ${
            updateCount.network > 0 
              ? 'bg-green-900/50 border-green-500' 
              : 'bg-gray-800 border-gray-600'
          }`}>
            <div className="font-semibold text-lg mb-1">Observer Status</div>
            <div className={`text-2xl font-bold ${
              updateCount.network > 0 ? 'text-green-400' : 'text-gray-500'
            }`}>
              {updateCount.network > 0 ? '✅ FIRING' : '❓ NOT TESTED'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Network updates trigger ydoc.on(&apos;update&apos;) with origin=&apos;network&apos;
            </div>
          </div>

          <div className={`p-4 rounded-lg border-2 ${
            isConnected && hasPeers
              ? 'bg-blue-900/50 border-blue-500' 
              : 'bg-gray-800 border-gray-600'
          }`}>
            <div className="font-semibold text-lg mb-1">WebSocket Status</div>
            <div className={`text-2xl font-bold ${
              isConnected ? (hasPeers ? 'text-blue-400' : 'text-yellow-400') : 'text-gray-500'
            }`}>
              {isConnected ? (hasPeers ? '✅ PEERS' : '⏳ WAITING') : '❌ DISCONNECTED'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Connection established and peer presence detected
            </div>
          </div>

          <div className={`p-4 rounded-lg border-2 ${
            receivedText.length > 0 && localText !== receivedText
              ? 'bg-green-900/50 border-green-500' 
              : 'bg-gray-800 border-gray-600'
          }`}>
            <div className="font-semibold text-lg mb-1">Data Sync</div>
            <div className={`text-2xl font-bold ${
              receivedText.length > 0 ? 'text-green-400' : 'text-gray-500'
            }`}>
              {receivedText.length > 0 ? '✅ SYNCED' : '❓ NO DATA'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Text data successfully propagated between peers
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
