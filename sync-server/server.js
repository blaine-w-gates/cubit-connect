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
const redis = require('redis');

const PORT = process.env.PORT || 8080;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Protocol Identifiers
const MSG_UPDATE = 3;
const MSG_REQUEST_CACHE = 4;
const MSG_CHECKPOINT = 5;
const MSG_ROOM_EMPTY = 6;

async function startServer() {
    console.log(`📡 Initializing Dumb Relay Server...`);

    // Initialize Redis Client
    const redisClient = redis.createClient({ url: REDIS_URL });
    redisClient.on('error', err => console.error('Redis Error:', err));
    await redisClient.connect();
    console.log('✅ Connected to Redis cache');

    // Create HTTP Server (Render requires binding to a port)
    const server = http.createServer((req, res) => {
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
            ws.close(1008, "Room ID missing");
            return;
        }

        // Assign Room and Set TCP Sever Lock
        ws.roomId = roomId;
        ws.isCatchingUp = true;

        ws.on('message', async (message, isBinary) => {
            if (!isBinary) return;

            const payload = new Uint8Array(message);
            if (payload.length === 0) return;

            const messageType = payload[0];

            if (messageType === MSG_REQUEST_CACHE) {
                // [BAND 2] The Checkpoint Download
                const checkpointKey = `room:${roomId}:checkpoint`;
                const diffListKey = `room:${roomId}:diffs`;

                try {
                    // 1. Send the last Full Checkpoint (or notify if empty)
                    const checkpointBlob = await redisClient.get(redis.commandOptions({ returnBuffers: true }), checkpointKey);
                    if (checkpointBlob && ws.readyState === WebSocket.OPEN) {
                        ws.send(checkpointBlob);
                    } else if (!checkpointBlob && ws.readyState === WebSocket.OPEN) {
                        // Room is entirely empty. Signal client to upload its Genesis Checkpoint.
                        ws.send(new Uint8Array([MSG_ROOM_EMPTY]));
                    }

                    // 2. Send the rolling buffer of up to 100 Live Diffs (Chronologically)
                    const diffBlobs = await redisClient.lRange(redis.commandOptions({ returnBuffers: true }), diffListKey, 0, 99);
                    // Engineer Mandate: lPush puts newest at front. We must reverse to apply Oldest -> Newest.
                    diffBlobs.reverse();
                    for (const diff of diffBlobs) {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(diff);
                        }
                    }

                    // Release the TCP Sever Lock *AFTER* the massive blob finishes transmission
                    ws.isCatchingUp = false;
                } catch (err) {
                    console.error(`Error serving cache to ${roomId}:`, err);
                    ws.isCatchingUp = false; // Release lock even on error
                }
            }
            else if (messageType === MSG_UPDATE) {
                // [BAND 1] Live Diff P2P Broadcasting & Rolling Buffer

                // Broadcast to other peers in the same room
                // THE TCP SEVER PROTOCOL: Do not send to peers currently downloading the Genesis blob
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN && client.roomId === roomId && !client.isCatchingUp) {
                        client.send(message);
                    }
                });

                // Push to Redis List and Trim to exactly 100 historical diffs
                const diffListKey = `room:${roomId}:diffs`;
                const multi = redisClient.multi()
                    .lPush(redis.commandOptions({ returnBuffers: true }), diffListKey, Buffer.from(message))
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
        });

        ws.on('close', () => {
            // Cleanup client mappings if necessary
        });
    });

    server.listen(PORT, () => {
        console.log(`🚀 Dumb Relay running on port ${PORT}`);
    });
}

startServer().catch(err => {
    console.error("FATAL SERVER CRASH:", err);
    process.exit(1);
});
