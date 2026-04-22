/**
 * Cubit Connect - Dumb Relay (Dual-Band Topology)
 * 
 * Deployment: Render (Web Service)
 * Env: REDIS_URL
 * 
 * Responsibilities:
 * 1. Maintain WebSocket connections routed by Room ID hash.
 * 2. Cache the Last `MSG_CHECKPOINT` (1MB+ encrypted blob) in Redis.
 * 3. Maintain a rolling array of the Last 100 `MSG_UPDATE` (tiny diffs) in Redis.
 * 4. Serve the Checkpoint + Diffs on `MSG_REQUEST_CACHE`.
 * 5. Allow up to 50MB WebSocket payloads to prevent truncated E2EE Checkpoints.
 */

const WebSocket = require('ws');
const http = require('http');
// redis required conditionally below

const PORT = process.env.PORT || 8080;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Protocol Identifiers
const MSG_UPDATE = 3;
const MSG_REQUEST_CACHE = 4; // This was 4
const MSG_HEARTBEAT = 7; // Added
const MSG_CHECKPOINT = 5;
const MSG_ROOM_EMPTY = 6;

async function startServer() {
    console.log(`📡 Initializing Dumb Relay Server...`);

    // Initialize Redis Client
    let redisClient;
    if (process.env.SYNC_MODE === 'memory') {
        process.env.REDIS_URL = 'memory';
    }

    if (process.env.REDIS_URL === 'memory' || !process.env.REDIS_URL) {
        console.log('📂 Using In-Memory fallback (No Redis)');
        const memoryStore = new Map();
        redisClient = {
            connect: async () => { },
            on: () => { },
            get: async (opts, key) => memoryStore.get(key),
            set: async (key, val) => { memoryStore.set(key, val); return 'OK'; },
            lRange: async (opts, key) => memoryStore.get(key) || [],
            lPush: async (opts, key, val) => {
                const list = memoryStore.get(key) || [];
                list.unshift(val);
                if (list.length > 100) list.pop();
                memoryStore.set(key, list);
                return list.length;
            },
            lTrim: async () => 'OK',
            expire: async () => 'OK',
            multi: () => ({
                set: function (k, v) { memoryStore.set(k, v); return this; },
                lPush: function (opts, k, v) {
                    const list = memoryStore.get(k) || [];
                    list.unshift(v);
                    if (list.length > 100) list.pop();
                    memoryStore.set(k, list);
                    return this;
                },
                lTrim: function () { return this; },
                expire: function () { return this; },
                exec: async () => ['OK'],
            }),
            commandOptions: (opts) => opts,
        };
    } else {
        const redis = require('redis');
        redisClient = redis.createClient({ url: REDIS_URL });
        redisClient.on('error', err => console.error('Redis Error:', err));
        await redisClient.connect();
        console.log('✅ Connected to Redis cache');
    }

    // Create HTTP Server (Render requires binding to a port)
    const server = http.createServer((req, res) => {
        // Health check endpoint for CI/playwright
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Cubit Connect Dumb Relay is Active\n');
    });

    // Create WebSocket Server with 50MB payload limit
    const wss = new WebSocket.Server({
        server,
        maxPayload: 50 * 1024 * 1024 // 50MB Limit
    });

    wss.on('connection', (ws, req) => {
        // Extract Room ID from URL query parameters (?room=xxxx)
        const url = new URL(req.url, `http://${req.headers.host}`);
        const roomId = url.searchParams.get('room');

        if (!roomId) {
            console.log('❌ Connection rejected: Room ID missing');
            ws.close(1008, "Room ID missing");
            return;
        }

        console.log(`🔌 New connection for room: ${roomId}`);
        // Assign Room and Set TCP Sever Lock
        ws.roomId = roomId;
        ws.isCatchingUp = true;

        ws.on('message', async (message) => {
            const payload = new Uint8Array(message);
            if (payload.length === 0) return;

            const messageType = payload[0];
            console.log(`📩 [SERVER] Received MSG_${messageType} from peer in room ${roomId.slice(0, 8)}`);

            if (messageType === MSG_REQUEST_CACHE) {
                // [BAND 2] The Checkpoint Download
                const checkpointKey = `room:${roomId}:checkpoint`;
                const diffListKey = `room:${roomId}:diffs`;

                try {
                    console.log(`📦 [CACHE] Peer requested cache for room ${roomId.slice(0, 8)}`);
                    
                    // 1. Send the last Full Checkpoint (or notify if empty)
                    const checkpointBlob = await redisClient.get(checkpointKey);
                    console.log(`📦 [CACHE] Redis checkpoint for ${roomId.slice(0, 8)}: ${checkpointBlob ? 'exists (' + checkpointBlob.length + ' bytes)' : 'NULL'}`);
                    
                    if (checkpointBlob && ws.readyState === WebSocket.OPEN) {
                        console.log(`📤 [CACHE] Sending checkpoint (${checkpointBlob.length} bytes) to peer in ${roomId.slice(0, 8)}`);
                        ws.send(checkpointBlob);
                        console.log(`✅ [CACHE] Checkpoint sent successfully`);
                    } else if (!checkpointBlob && ws.readyState === WebSocket.OPEN) {
                        console.log(`📤 [CACHE] No checkpoint found, sending MSG_ROOM_EMPTY to ${roomId.slice(0, 8)}`);
                        // Room is entirely empty. Signal client to upload its Genesis Checkpoint.
                        ws.send(new Uint8Array([MSG_ROOM_EMPTY]));
                    } else {
                        console.warn(`⚠️ [CACHE] Cannot send: readyState=${ws.readyState}, hasBlob=${!!checkpointBlob}`);
                    }

                    // 2. Send the rolling buffer of up to 100 Live Diffs (Chronologically)
                    const diffBlobs = await redisClient.lRange(diffListKey, 0, 99);
                    console.log(`📦 [CACHE] Found ${diffBlobs.length} diffs for room ${roomId.slice(0, 8)}`);
                    // Engineer Mandate: lPush puts newest at front. We must reverse to apply Oldest -> Newest.
                    diffBlobs.reverse();
                    let sentCount = 0;
                    for (const diff of diffBlobs) {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(diff);
                            sentCount++;
                        }
                    }
                    console.log(`📤 [CACHE] Sent ${sentCount}/${diffBlobs.length} diffs to ${roomId.slice(0, 8)}`);

                    // Release the TCP Sever Lock *AFTER* the massive blob finishes transmission
                    ws.isCatchingUp = false;
                    console.log(`🔓 [CACHE] Catch-Up Lock released for peer in room ${roomId.slice(0, 8)}`);
                } catch (err) {
                    console.error(`Error serving cache to ${roomId}:`, err);
                    ws.isCatchingUp = false; // Release lock even on error
                }
            }
            else if (messageType === MSG_UPDATE) {
                // [BAND 1] Live Diff P2P Broadcasting & Rolling Buffer
                
                // Note: We cannot detect presence heartbeats from encrypted payload,
                // so we always broadcast MSG_UPDATE to ensure presence gets through.

                // Broadcast to other peers in the same room
                let broadcastCount = 0;
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN && client.roomId === roomId) {
                        // Always broadcast MSG_UPDATE - presence heartbeats must reach peers
                        // even during catch-up to establish peer discovery
                        client.send(message);
                        broadcastCount++;
                    }
                });
                if (broadcastCount > 0) {
                    console.log(`📡 Relayed MSG_UPDATE to ${broadcastCount} peers in room ${roomId.slice(0, 8)}`);
                }

                // Push to Redis List and Trim to exactly 100 historical diffs
                const diffListKey = `room:${roomId}:diffs`;
                const multi = redisClient.multi()
                    .lPush(diffListKey, Buffer.from(message))
                    .lTrim(diffListKey, 0, 99) // Safe overlap for Yjs idempotency
                    .expire(diffListKey, 86400 * 7); // 7-Day Expiry to prevent RAM leaks

                multi.exec().catch(err => console.error(`Error saving diff for ${roomId}:`, err));
            }
            else if (messageType === MSG_CHECKPOINT) {
                // [BAND 2] The Checkpoint Upload (Deep Idle or visibilitychange)

                // THE RELAY RACE CONDITION PROTOCOL:
                // We DO NOT hard-delete `diffListKey` here, as that creates a Race Condition 
                // where incoming live diffs from peers are erased before being read.
                // We rely on the natural `lTrim` of the rolling buffer. Yjs mathematically ignores historically overlapping ghosts.
                const checkpointKey = `room:${roomId}:checkpoint`;

                redisClient.multi()
                    .set(checkpointKey, Buffer.from(message))
                    .expire(checkpointKey, 86400 * 7) // 7-Day Expiry
                    .exec()
                    .catch(err => console.error(`Error saving checkpoint for ${roomId}:`, err));
            }
            else if (messageType === MSG_HEARTBEAT) {
                // Echo back to sender (for connection health check)
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(payload);
                }
                
                // Also broadcast to other peers as a lightweight presence signal
                // This helps peers discover each other immediately upon connection
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN && client.roomId === roomId) {
                        client.send(payload);
                    }
                });
            }
        });

        ws.on('close', () => {
            // Cleanup client mappings if necessary
        });
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Dumb Relay running on port ${PORT}`);
    });
}

startServer().catch(err => {
    console.error("FATAL SERVER CRASH:", err);
    process.exit(1);
});
