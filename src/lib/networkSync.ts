import * as Y from 'yjs';
import { encryptUpdate, decryptUpdate } from './cryptoSync';
import { getGlobalConnectionManager } from './syncConnectionManager';

export const MSG_UPDATE = 3;
export const MSG_REQUEST_CACHE = 4;
export const MSG_CHECKPOINT = 5;
export const MSG_ROOM_EMPTY = 6;
export const MSG_HEARTBEAT = 7;

/**
 * NetworkSync
 * 
 * Manages the Zero-Trust E2EE WebSocket connection using the Dual-Band Topology.
 * 1. P2P Live Diffs (MSG_UPDATE)
 * 2. Heavy Cloud Checkpoints (MSG_CHECKPOINT) Every 30s
 */
export class NetworkSync {
    private ws: WebSocket | null = null;
    private key: CryptoKey | null = null;
    private ydoc: Y.Doc;
    private serverUrl: string;
    private roomIdHash: string;

    // To protect against async Promise cancellation during `visibilitychange` teardown,
    // we keep any currently-encrypting diffs in a synchronous queue.
    private pendingDiffs: Uint8Array[] = [];

    // THE GENESIS DROP LOCK (Dual-Band Race Condition)
    // We must ignore live diffs from peers while the massive initial checkpoint is still downloading/parsing.
    private catchUpLock: boolean = true;
    private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
    private presenceInterval: ReturnType<typeof setInterval> | null = null;
    private visibilityListenerBound: boolean = false;
    private queuedLiveDiffsDuringCatchUp: Uint8Array[] = [];

    private releaseCatchUpLock() {
        if (!this.catchUpLock) return;
        this.catchUpLock = false;
        if (this.queuedLiveDiffsDuringCatchUp.length > 0) {
            console.log(`📦 Replaying ${this.queuedLiveDiffsDuringCatchUp.length} queued live diffs after catch-up.`);
            this.ydoc.transact(() => {
                this.queuedLiveDiffsDuringCatchUp.forEach((diff) => {
                    Y.applyUpdate(this.ydoc, diff, 'network');
                });
            }, 'network');
            this.queuedLiveDiffsDuringCatchUp = [];
            this.onSyncActivity?.();
        }
    }

    private clearHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
        if (this.presenceInterval) clearInterval(this.presenceInterval);
        this.heartbeatInterval = null;
        this.heartbeatTimeout = null;
        this.presenceInterval = null;
    }

    private intentionalDisconnect: boolean = false;
    private reconnectAttempts: number = 0;
    private onStatusChange: (status: 'connecting' | 'connected' | 'error' | 'disconnected') => void;
    private onSyncActivity?: () => void;
    private onPeerPresence?: () => void;
    private onPeerDisconnect?: () => void;
    private onPeerEditing?: (isEditing: boolean) => void;

    constructor(
        ydoc: Y.Doc,
        serverUrl: string,
        roomIdHash: string,
        onStatusChange: (status: 'connecting' | 'connected' | 'error' | 'disconnected') => void,
        onSyncActivity?: () => void,
        onPeerPresence?: () => void,
        onPeerDisconnect?: () => void,
        onPeerEditing?: (isEditing: boolean) => void
    ) {
        this.ydoc = ydoc;
        this.serverUrl = serverUrl;
        this.roomIdHash = roomIdHash;
        this.onStatusChange = onStatusChange;
        this.onSyncActivity = onSyncActivity;
        this.onPeerPresence = onPeerPresence;
        this.onPeerDisconnect = onPeerDisconnect;
        this.onPeerEditing = onPeerEditing;
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ydocId = (this.ydoc as any).__observerId || 'unknown';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.log(`[NETWORKSYNC DEBUG] Constructor - using ydoc ${ydocId}, ydoc.guid:`, (this.ydoc as any).guid);

        // --- BROADCAST ENGINE ---
        // Every local mutation (origin !== 'network') must be encrypted and sent to the relay.
        // This ensures Peers stay in sync without manual 'Save' buttons.
        this.ydoc.on('update', (update, origin) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updateYdocId = (this.ydoc as any).__observerId || 'unknown';
            console.log(`[NETWORKSYNC DEBUG] ydoc.on(update) fired on ydoc ${updateYdocId}, origin:`, origin);
            if (origin !== 'network') {
                console.log(`📡 [YJS] Local change detected (length: ${update.length}, origin: ${origin}). Broadcasting...`);
                this.broadcastUpdate(update);
            }
        });
    }

    /**
     * Initializes the WebSocket connection.
     */
    async connect(derivedKey: CryptoKey): Promise<void> {
        console.log(`🔌 NetworkSync: Connecting to ${this.serverUrl}?room=${this.roomIdHash.slice(0, 8)}...`);
        return new Promise((resolve, reject) => {
            if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return resolve();

            // ENGINEER GUARDRAIL: Purge native background backoff loop before manual resurrection
            if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
            this.clearHeartbeat();

            this.key = derivedKey;
            this.intentionalDisconnect = false;

            // Connect to Dumb Relay server.
            const url = new URL(this.serverUrl);
            url.searchParams.set('room', this.roomIdHash);

            this.ws = new WebSocket(url.toString());
            this.ws.binaryType = 'arraybuffer'; // Strict: Prevent Base64 overhead

            this.connectionTimeout = setTimeout(() => {
                if (this.ws?.readyState !== WebSocket.OPEN) {
                    this.ws?.close();
                    reject(new Error("WebSocket connection timeout"));
                }
            }, 60000); // Increased to 60 seconds to absorb Render free-tier cold boots

            this.ws.onopen = async () => {
                if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
                this.reconnectAttempts = 0; // Reset backoff pool on success
                this.onStatusChange('connected');
                console.log(`🔗 E2EE WebSocket connected to ${this.serverUrl}. Requesting Cache...`);

                // THE APPLICATION-LEVEL HEARTBEAT (Bypassing ws.ping limits)
                this.heartbeatInterval = setInterval(() => {
                    if (this.ws?.readyState === WebSocket.OPEN) {
                        this.ws.send(new Uint8Array([MSG_HEARTBEAT]));

                        // Kill connection if no echo returned in 5s
                        this.heartbeatTimeout = setTimeout(() => {
                            console.warn("💀 Heartbeat dropped. Emulating TCP sever.");
                            this.ws?.close();
                        }, 5000);
                    }
                }, 30000);

                // ENCRYPTED PEER PRESENCE TRACKING (Dumb Relay Bypass)
                // We broadcast an empty Yjs Update [0, 0] every 15s. The relay assumes it is live data and broadcasts it
                // to everyone. This lets us verify other peers are alive and enforcing 2-Player Strict Mode.
                this.presenceInterval = setInterval(() => {
                    if (this.ws?.readyState === WebSocket.OPEN && this.key) {
                        console.log(`[PRESENCE] Broadcasting heartbeat from ydoc ${(this.ydoc as unknown as { __observerId?: string }).__observerId?.slice(0, 8) || 'unknown'}`);
                        const emptyUpdate = new Uint8Array([0, 0]);
                        this.broadcastUpdate(emptyUpdate);
                    } else {
                        console.log(`[PRESENCE] Skipping heartbeat - ws=${this.ws?.readyState}, key=${!!this.key}`);
                    }
                }, 15000);

                // The "Catch-Up" Protocol (Dual-Band): Download Last Checkpoint + Last 100 Diffs
                const payload = new Uint8Array([MSG_REQUEST_CACHE]);
                // Request Cache packet does not need encryption, it just triggers the server playback
                this.ws?.send(payload);

                // --- DEADLOCK WATCHDOG (The "Founder" Resolution) ---
                // If we are the FIRST peer in an empty room, the server might not send a Checkpoint.
                // We deploy a 2.5s watchdog to automatically unlock and assume "Founder" status.
                setTimeout(() => {
                    if (this.catchUpLock && this.ws?.readyState === WebSocket.OPEN) {
                        console.log('⚡ [SYNC] Watchdog Timeout: No checkpoint received. Assuming Founder status. Unlocking Live Diffs.');
                        this.releaseCatchUpLock();
                        
                        // Seed the empty server with our Genesis Checkpoint
                        const fullState = Y.encodeStateAsUpdate(this.ydoc);
                        this.broadcastCheckpoint(fullState);
                    }
                }, 2500);

                resolve();
            };

            this.ws.onmessage = async (event) => {
                if (!(event.data instanceof ArrayBuffer)) return;

                try {
                    const encryptedPayload = new Uint8Array(event.data);
                    const messageType = encryptedPayload[0];
                    
                    // Update connection manager stats
                    getGlobalConnectionManager().updateStats({ messagesReceived: 1 });
                    
                    // Detailed MSG_UPDATE tracing
                    if (messageType === MSG_UPDATE) {
                        console.log(`📥 [NETWORK] Received MSG_UPDATE (${encryptedPayload.length} bytes) from server`);
                    }

                    if (messageType === MSG_HEARTBEAT) {
                        if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
                        // Record heartbeat in connection manager
                        getGlobalConnectionManager().recordHeartbeat();
                        return;
                    }

                    if (messageType === MSG_ROOM_EMPTY) {
                        console.log('🌱 Room is empty. Uploading Genesis Checkpoint...');
                        const fullState = Y.encodeStateAsUpdate(this.ydoc);
                        this.broadcastCheckpoint(fullState);
                        this.releaseCatchUpLock();
                        return;
                    } 
                    
                    // IF WE REACH HERE, IT'S ENCRYPTED DATA
                    const decrypted = await decryptUpdate(encryptedPayload.slice(1), this.key!);
                    if (decrypted.length === 0) return;
                    const yjsData = decrypted;

                    if (messageType === MSG_CHECKPOINT) {
                        // BAND 2: The Genesis Checkpoint

                        // THE CHECKPOINT STORM PREVENTION:
                        // We only broadcast our local state back if we genuinely have offline edits 
                        // the server lacks. We calculate this by extracting the server's state vector 
                        // via a temporary doc, and asking our local ydoc to generate the missing bytes.
                        const tempDoc = new Y.Doc();
                        Y.applyUpdate(tempDoc, yjsData);
                        const serverStateVector = Y.encodeStateVector(tempDoc);
                        const offlineEdits = Y.encodeStateAsUpdate(this.ydoc, serverStateVector);
                        const hasOfflineEdits = offlineEdits.length > 2; // An empty Yjs update is [0, 0]

                        this.ydoc.transact(() => {
                            Y.applyUpdate(this.ydoc, yjsData, 'network');
                        }, 'network');
                        this.onSyncActivity?.();

                        // Release the Genesis Lock only AFTER the massive blob is mathematically merged
                        this.releaseCatchUpLock();
                        console.log('✅ Genesis Catch-Up Complete. Unlocking Live Diffs.');

                        if (hasOfflineEdits) {
                            console.log('🔄 Uploading Post-Merge Genesis Diff to sync offline work...');
                            const fullState = Y.encodeStateAsUpdate(this.ydoc);
                            this.broadcastCheckpoint(fullState);

                            // 🔴 BUG FIX: The generic Dumb Relay swallows MSG_CHECKPOINT to save it to cache, 
                            // BUT it intentionally does not broadcast it to other live peers. To ensure live peers 
                            // merge our offline edits immediately, we actively P2P broadcast the exact delta array.
                            console.log('📡 Also broadcasting offline edits as P2P diff to bypass checkpoint swallowing...');
                            this.broadcastUpdate(offlineEdits);
                        } else {
                            console.log('✅ No offline edits detected. Skipping Post-Merge broadcast to save bandwidth.');
                        }

                    } else if (messageType === MSG_UPDATE) {
                        // DETECT ENCRYPTED PEER PRESENCE HEARTBEAT
                        // An empty Yjs update [0, 0] is mathematically harmless, but serves as proof of life.
                        if (yjsData.length === 2 && yjsData[0] === 0 && yjsData[1] === 0) {
                            console.log(`[PRESENCE] Peer heartbeat received on ydoc ${(this.ydoc as unknown as { __observerId?: string }).__observerId?.slice(0, 8) || 'unknown'}`);
                            // Record in connection manager for peer count tracking
                            getGlobalConnectionManager().updatePeerCount(1);
                            if (this.onPeerPresence) {
                                console.log('[PRESENCE] Calling onPeerPresence callback');
                                this.onPeerPresence();
                            } else {
                                console.warn('[PRESENCE] onPeerPresence callback not set!');
                            }
                            return; // Bypass Yjs merge payload cost entirely
                        }
                        
                        // DETECT EXPLICIT DISCONNECT
                        if (yjsData.length === 2 && yjsData[0] === 255 && yjsData[1] === 255) {
                            console.log('🚪 Peer explicitly disconnected.');
                            if (this.onPeerDisconnect) this.onPeerDisconnect();
                            return;
                        }

                        console.log(`📥 [INBOUND] Received live P2P Diff (${encryptedPayload.length} bytes)`);
                        // BAND 1: Live Peer Diffs
                        // SYNCHRONICITY TRAP: If a peer types while we are downloading the checkpoint,
                        // applying their diff *before* the checkpoint mathematically corrupts the vector clock.
                        if (this.catchUpLock) {
                            console.warn('⏳ [INBOUND] Queueing live diff because Genesis Catch-Up is still locking.');
                            this.queuedLiveDiffsDuringCatchUp.push(yjsData);
                            return;
                        }
                        
                        // BROADCAST SIGNAL: Peer has begun an edit. 
                        // This triggers the "Strict Mode" turn-based lock on the local UI.
                        if (this.onPeerEditing) this.onPeerEditing(true);

                        this.ydoc.transact(() => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const applyYdocId = (this.ydoc as any).__observerId || 'unknown';
                            console.log(`[NETWORKSYNC DEBUG] Applying update to ydoc ${applyYdocId} with origin 'network'`);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const observerCount = (this.ydoc as any)._observers?.get?.('update')?.length ?? 'unknown';
                            console.log(`[NETWORKSYNC DEBUG] BEFORE applyUpdate - ydoc has ${observerCount} update observers`);
                            Y.applyUpdate(this.ydoc, yjsData, 'network');
                            console.log(`[NETWORKSYNC DEBUG] AFTER applyUpdate - update applied, observer should have fired`);
                        }, 'network');
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const afterYdocId = (this.ydoc as any).__observerId || 'unknown';
                        console.log(`[NETWORKSYNC DEBUG] Update applied to ydoc ${afterYdocId}`);
                        console.log(`🟢 [INBOUND] Decrypted and successfully merged into Y.Doc!`);
                        this.onSyncActivity?.();
                    }
                } catch (err) {
                    const msgType = (event.data as ArrayBuffer).byteLength > 0 ? new Uint8Array(event.data)[0] : 'unknown';
                    if (msgType === MSG_UPDATE) {
                        console.warn("🛡️ E2EE Decryption failed for MSG_UPDATE - possible key mismatch or corrupted packet");
                    }
                    console.warn("🛡️ E2EE Payload Rejected (Possible wrong password or corrupted packet):", err);
                }
            };

            this.ws.onerror = (err) => {
                console.error("❌ WebSocket Sync Error:", err);
            };

            this.ws.onclose = () => {
                console.log("🔌 WebSocket Sync Closed.");
                this.clearHeartbeat();

                if (this.intentionalDisconnect) {
                    this.onStatusChange('disconnected');
                } else if (this.key) {
                    // THE INFINITE BATTERY DRAIN (MAX RETRIES)
                    if (this.reconnectAttempts >= 15) {
                        console.error('❌ Max reconnect attempts reached. Giving up to save battery.');
                        this.onStatusChange('error');
                        return;
                    }

                    // THE THUNDERING HERD PREVENTION
                    // True Exponential Backoff + Millisecond Jitter
                    const baseDelay = 3000;
                    const maxDelay = 60000;
                    const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay);
                    const jitter = Math.floor(Math.random() * 1000);
                    const delay = exponentialDelay + jitter;

                    console.log(`⏳ Auto-Reconnecting in ${Math.round(delay / 1000)} seconds...`);
                    this.reconnectAttempts++;

                    // THE ZOMBIE RECONNECT (UI BLINDNESS)
                    this.onStatusChange('connecting');

                    this.reconnectTimeout = setTimeout(() => {
                        if (this.key && !this.intentionalDisconnect) {
                            // THE UNHANDLED PROMISE REJECTION
                            this.connect(this.key).catch(err => {
                                console.warn('Background reconnect failed', err);
                            });
                        }
                    }, delay);
                }
            };

            // The iOS Safari 'Swipe Up' Fix
            // Register exactly once to prevent listener stacking across reconnects
            if (!this.visibilityListenerBound) {
                document.addEventListener('visibilitychange', this.handleVisibilityChange);
                this.visibilityListenerBound = true;
            }
        });
    }

    private handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            if ((!this.ws || this.ws.readyState !== WebSocket.OPEN) && !this.intentionalDisconnect && this.key) {
                console.log('📱 OS Wake-Up: Foreground resurrection sequence initiating...');
                this.connect(this.key).catch((err) => {
                    console.warn('Foreground reconnect failed:', err);
                });
            }
        }
        else if (document.visibilityState === 'hidden' && this.ws?.readyState === WebSocket.OPEN && this.pendingDiffs.length > 0) {
            console.log(`OS Suspending: Synchronously flushing ${this.pendingDiffs.length} tiny live diffs to TCP buffer...`);
            // SYNCHRONOUS TCP DUMP: No `await`, no `Crypto.subtle`. Bypasses the Web Crypto Promise Trap.
            try {
                for (const diff of this.pendingDiffs) {
                    this.ws.send(diff);
                }
                this.pendingDiffs = []; // Clear queue after emergency dump
            } catch (err) {
                console.error("Failed synchronous OS TCP dump:", err);
            }
        }
    };

    /**
     * Broadcasts a live, tiny CRDT operational update to the relay instantly.
     */
    async broadcastUpdate(update: Uint8Array) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.key) return;

        try {
            // Encrypt the Yjs Update directly
            const ciphertext = await encryptUpdate(update, this.key);
            
            // Prepend UNENCRYPTED routing byte so the Dumb Relay can parse it
            const payload = new Uint8Array(ciphertext.length + 1);
            payload[0] = MSG_UPDATE;
            payload.set(ciphertext, 1);

            // Track message stats
            const isPresence = update.length === 2 && update[0] === 0 && update[1] === 0;
            console.log(`📡 [OUTBOUND] Sending ${isPresence ? 'presence heartbeat' : 'P2P Diff'} (${payload.length} bytes)`);
            getGlobalConnectionManager().updateStats({ messagesSent: 1 });

            // Push the fully encrypted, tiny byte-array into the emergency OS buffer queue
            this.pendingDiffs.push(payload);
            this.ws.send(payload);

            // Avoid triggering UI spinner for invisible presence pings
            if (update.length > 2) {
                this.onSyncActivity?.();
            }
        } catch (e) {
            console.error("Encryption failed before sending P2P diff:", e);
        }
    }
    
    /**
     * Broadcasts an explicit termination signal.
     */
    async sendDisconnectSignal() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.key) return;
        try {
            const update = new Uint8Array([255, 255]);
            const ciphertext = await encryptUpdate(update, this.key);
            const payload = new Uint8Array(ciphertext.length + 1);
            payload[0] = MSG_UPDATE;
            payload.set(ciphertext, 1);
            this.ws.send(payload);
        } catch (e) {
            console.error("Failed to send disconnect signal", e);
        }
    }

    /**
     * Broadcasts the massive 1MB+ Full Checkpoint (Debounced/Deep Idle).
     */
    async broadcastCheckpoint(fullUpdate: Uint8Array) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.key) return;

        try {
            // Encrypt the Yjs Update directly
            const ciphertext = await encryptUpdate(fullUpdate, this.key);

            // Prepend UNENCRYPTED routing byte so the Dumb Relay can parse it
            const payload = new Uint8Array(ciphertext.length + 1);
            payload[0] = MSG_CHECKPOINT;
            payload.set(ciphertext, 1);

            this.ws.send(payload);
            this.onSyncActivity?.();

            // The massive Checkpoint contains all prior history mathematically. 
            // We can safely garbage-collect the pending tiny diffs queue.
            this.pendingDiffs = [];
        } catch (e) {
            console.error("Encryption failed before sending Checkpoint:", e);
        }
    }

    disconnect() {
        this.sendDisconnectSignal().finally(() => {
            this.intentionalDisconnect = true;
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
            this.visibilityListenerBound = false;
            this.clearHeartbeat();

            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }

            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            this.key = null;
            this.onStatusChange('disconnected');
            console.log('🔌 E2EE WebSocket disconnected by Client.');
        });
    }
}
