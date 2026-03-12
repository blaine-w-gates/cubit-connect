import * as Y from 'yjs';
import { encryptUpdate, decryptUpdate } from '@/lib/cryptoSync';

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

    private clearHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
        this.heartbeatInterval = null;
        this.heartbeatTimeout = null;
    }

    private intentionalDisconnect: boolean = false;
    private reconnectAttempts: number = 0;
    private onStatusChange: (status: 'connecting' | 'connected' | 'error' | 'disconnected') => void;

    constructor(
        ydoc: Y.Doc,
        serverUrl: string,
        roomIdHash: string,
        onStatusChange: (status: 'connecting' | 'connected' | 'error' | 'disconnected') => void
    ) {
        this.ydoc = ydoc;
        this.serverUrl = serverUrl;
        this.roomIdHash = roomIdHash;
        this.onStatusChange = onStatusChange;
    }

    /**
     * Initializes the WebSocket connection.
     */
    async connect(derivedKey: CryptoKey): Promise<void> {
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
                console.log('🔗 E2EE WebSocket connected. Requesting Cache...');

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
                        this.catchUpLock = false;
                        
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

                    // Extract Unencrypted Native Header
                    const messageType = encryptedPayload[0];

                    if (messageType === MSG_HEARTBEAT) {
                        if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
                        return;
                    }

                    if (messageType === MSG_ROOM_EMPTY) {
                        console.log('🌱 Room is empty. Uploading Genesis Checkpoint...');
                        const fullState = Y.encodeStateAsUpdate(this.ydoc);
                        this.broadcastCheckpoint(fullState);
                        this.catchUpLock = false;
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
                            Y.applyUpdate(this.ydoc, yjsData);
                        }, 'network');

                        // Release the Genesis Lock only AFTER the massive blob is mathematically merged
                        this.catchUpLock = false;
                        console.log('✅ Genesis Catch-Up Complete. Unlocking Live Diffs.');

                        if (hasOfflineEdits) {
                            console.log('🔄 Uploading Post-Merge Genesis Diff to sync offline work...');
                            const fullState = Y.encodeStateAsUpdate(this.ydoc);
                            this.broadcastCheckpoint(fullState);
                        } else {
                            console.log('✅ No offline edits detected. Skipping Post-Merge broadcast to save bandwidth.');
                        }

                    } else if (messageType === MSG_UPDATE) {
                        console.log(`📥 [INBOUND] Received live P2P Diff (${encryptedPayload.length} bytes)`);
                        // BAND 1: Live Peer Diffs
                        // SYNCHRONICITY TRAP: If a peer types while we are downloading the checkpoint,
                        // applying their diff *before* the checkpoint mathematically corrupts the vector clock.
                        if (this.catchUpLock) {
                            console.warn('⏳ [INBOUND] Dropping live diff because Genesis Catch-Up is still locking.');
                            return;
                        }

                        this.ydoc.transact(() => {
                            Y.applyUpdate(this.ydoc, yjsData);
                        }, 'network');
                        console.log(`🟢 [INBOUND] Decrypted and successfully merged into Y.Doc!`);
                    }
                } catch (err) {
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
            // Synchronously flushes OS-Buffer BEFORE browser kills the thread
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
        });
    }

    private handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            if ((!this.ws || this.ws.readyState !== WebSocket.OPEN) && !this.intentionalDisconnect && this.key) {
                console.log('📱 OS Wake-Up: Foreground resurrection sequence initiating...');
                this.connect(this.key);
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

            console.log(`📡 [OUTBOUND] Sending live P2P Diff (${payload.length} bytes)`);

            // Push the fully encrypted, tiny byte-array into the emergency OS buffer queue
            this.pendingDiffs.push(payload);
            this.ws.send(payload);
        } catch (e) {
            console.error("Encryption failed before sending P2P diff:", e);
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

            // The massive Checkpoint contains all prior history mathematically. 
            // We can safely garbage-collect the pending tiny diffs queue.
            this.pendingDiffs = [];
        } catch (e) {
            console.error("Encryption failed before sending Checkpoint:", e);
        }
    }

    disconnect() {
        this.intentionalDisconnect = true;
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
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
        this.pendingDiffs = [];
    }
}
