# API Documentation

**Version**: 1.0  
**Date**: April 26, 2026  
**Status**: Production Ready

---

## Table of Contents

1. [Authentication](#authentication)
2. [Sync API](#sync-api)
3. [Checkpoint API](#checkpoint-api)
4. [Health API](#health-api)
5. [Rate Limits](#rate-limits)
6. [Error Handling](#error-handling)

---

## Authentication

The sync system uses **anonymous authentication** via Supabase.

### Anonymous Sign-In

```typescript
import { signInAnonymously } from '@/lib/supabaseClient';

const result = await signInAnonymously();
if (result.success) {
  // Authenticated anonymously
  console.log('Session:', result.data.session);
}
```

### E2EE Key Derivation

All sync operations require an E2EE key derived from a passphrase:

```typescript
import { deriveSyncKey } from '@/lib/cryptoSync';

const derivedKey = await deriveSyncKey('your-passphrase');
```

---

## Sync API

### SupabaseSyncProd

Main class for real-time synchronization.

#### Constructor

```typescript
const sync = new SupabaseSyncProd(
  ydoc: Y.Doc,                    // Yjs document instance
  roomIdHash: string,            // Hashed room identifier
  onStatusChange?: (status) => void,
  onSyncActivity?: () => void,
  onPeerPresence?: (peerId) => void,
  onPeerDisconnect?: (peerId) => void,
  onPeerEditing?: (peerId) => void
);
```

#### Methods

##### `connect(derivedKey: CryptoKey): Promise<void>`

Connect to Supabase Realtime with E2EE encryption.

```typescript
try {
  await sync.connect(derivedKey);
  console.log('Connected');
} catch (error) {
  console.error('Connection failed:', error);
}
```

##### `disconnect(): void`

Disconnect from sync and cleanup resources.

```typescript
sync.disconnect();
```

##### `isConnectedToServer(): boolean`

Check connection status.

```typescript
if (sync.isConnectedToServer()) {
  // Safe to sync
}
```

##### `broadcastUpdate(update: Uint8Array): void`

Broadcast encrypted update to peers.

```typescript
const update = Y.encodeStateAsUpdate(ydoc);
sync.broadcastUpdate(update);
```

---

## Checkpoint API

### CheckpointService

Save and load document checkpoints.

#### Get Instance

```typescript
import { getCheckpointService } from '@/lib/checkpointService';

const service = getCheckpointService(clientId);
```

#### Save Checkpoint

```typescript
const checkpoint: CheckpointData = {
  roomHash: 'room-hash',
  clientId: 'client-id',
  data: Y.encodeStateAsUpdate(ydoc),
  metadata: { version: '1.0' }
};

const result = await service.saveCheckpoint(checkpoint);
// Returns: StoredCheckpoint | null
```

#### Load Latest Checkpoint

```typescript
const checkpoint = await service.loadLatestCheckpoint('room-hash');
if (checkpoint) {
  Y.applyUpdate(ydoc, checkpoint.data);
}
```

#### List Checkpoints

```typescript
const checkpoints = await service.listCheckpoints('room-hash', 10);
// Returns: StoredCheckpoint[]
```

---

## Health API

### Endpoint: `GET /api/health`

Returns system health status.

#### Response

```json
{
  "status": "healthy",
  "timestamp": "2026-04-26T12:00:00Z",
  "version": "1.0.0",
  "subsystems": {
    "transport": {
      "status": "healthy",
      "current": "websocket",
      "circuitState": "closed"
    },
    "audit": {
      "status": "healthy",
      "queued": 0,
      "total": 100
    },
    "rateLimiter": {
      "status": "healthy",
      "activeBuckets": 5,
      "totalViolations": 0
    },
    "featureFlags": {
      "status": "healthy",
      "activeRules": 10
    }
  }
}
```

#### Status Codes

- `200`: Healthy or degraded
- `503`: Unhealthy

---

## Rate Limits

### Default Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| All API | 100 | 1 minute |
| /api/sync | 200 | 1 minute |
| /api/health | 10 | 1 minute |
| /api/auth | 5 | 1 minute |

### Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1714123456
X-RateLimit-Window: 60000
```

### 429 Response

When limit exceeded:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Limit: 100 per 60000ms",
  "resetTime": 1714123456789
}
```

---

## Error Handling

### Error Codes

| Code | Description |
|------|-------------|
| `SYNC001` | Connection timeout |
| `SYNC002` | Authentication failed |
| `SYNC003` | Encryption error |
| `SYNC004` | Decryption failed |
| `SYNC005` | Rate limit exceeded |
| `SYNC006` | Checkpoint save failed |
| `SYNC007` | Checkpoint load failed |

### Error Response Format

```typescript
interface SyncError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}
```

### Retry Strategy

```typescript
// Automatic retry with exponential backoff
// Attempt 1: Immediate
// Attempt 2: 1 second delay
// Attempt 3: 2 second delay
// Attempt 4: 4 second delay
// Then fail
```

---

## Security

### E2EE Encryption

All sync data is encrypted using AES-256-GCM:

```typescript
// Encryption
const encrypted = await encryptUpdate(update, derivedKey);

// Decryption
const decrypted = await decryptUpdate(encrypted, derivedKey);
```

### Security Headers

All responses include:

```
Content-Security-Policy: default-src 'self' ...
Strict-Transport-Security: max-age=31536000
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
```

---

## Examples

### Full Sync Lifecycle

```typescript
import * as Y from 'yjs';
import { SupabaseSyncProd } from '@/lib/supabaseSyncProd';
import { deriveSyncKey } from '@/lib/cryptoSync';

// 1. Create document
const ydoc = new Y.Doc();
const ytext = ydoc.getText('content');

// 2. Derive E2EE key
const derivedKey = await deriveSyncKey('shared-passphrase');

// 3. Create sync instance
const sync = new SupabaseSyncProd(
  ydoc,
  'room-hash',
  (status) => console.log('Status:', status)
);

// 4. Connect
try {
  await sync.connect(derivedKey);
  console.log('Connected!');
} catch (error) {
  console.error('Failed:', error);
}

// 5. Edit document
ytext.insert(0, 'Hello World');
// Updates are automatically broadcast

// 6. Disconnect
sync.disconnect();
```

---

## Support

For issues or questions:
1. Check [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review [Security Audit](./SECURITY_AUDIT.md)
3. File issue with logs and reproduction steps

---

*This API is production-ready and covered by comprehensive integration tests.*
