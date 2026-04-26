# ADR 001: Supabase Realtime for Synchronization

**Status**: Accepted  
**Date**: April 26, 2026  
**Decision Makers**: Engineering Team  

## Context

We needed a real-time synchronization solution for the Cube It Connect project management tool that would:
- Support multi-user collaboration
- Handle Yjs document updates efficiently
- Work within our GitHub Pages deployment constraint (no custom server)
- Provide end-to-end encryption (E2EE)

## Decision

We chose **Supabase Realtime** as our synchronization infrastructure.

## Rationale

### Why Supabase Realtime?

1. **Serverless Architecture**: No custom server required - works with GitHub Pages
2. **WebSocket Support**: Native WebSocket channels for real-time updates
3. **PostgreSQL Backend**: Reliable storage for checkpoints and metadata
4. **Row Level Security**: Built-in access control
5. **Free Tier**: Generous limits for our use case

### Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Firebase Realtime | Popular, mature | Vendor lock-in, pricing | ❌ Rejected |
| AWS AppSync | Enterprise features | Complex setup, cost | ❌ Rejected |
| Custom WebSocket | Full control | Requires server, maintenance burden | ❌ Rejected |
| Ably/Pusher | Managed WebSockets | Cost, external dependency | ❌ Rejected |
| Yjs WebRTC | Direct P2P | Unreliable signaling, firewall issues | ❌ Rejected |

## Implementation

### Architecture

```
Client A ← WebSocket → Supabase Realtime ← WebSocket → Client B
                ↓
            PostgreSQL (checkpoints, presence)
```

### Key Components

1. **SupabaseSyncProd.ts**: Main sync class with E2EE
2. **cryptoSync.ts**: Web Crypto API for encryption
3. **checkpointService.ts**: Persistence layer
4. **middleware.ts**: Security headers, CORS, rate limiting

### E2EE Implementation

- AES-256-GCM encryption via Web Crypto API
- PBKDF2 key derivation (100,000 iterations)
- Keys marked as non-extractable
- No plaintext over network

## Consequences

### Positive
- ✅ Zero server maintenance
- ✅ Scales automatically
- ✅ Free tier sufficient for MVP
- ✅ Strong TypeScript support
- ✅ Built-in authentication

### Negative
- ⚠️ Vendor dependency on Supabase
- ⚠️ Limited offline support (needs fallback strategy)
- ⚠️ Real-time quotas on free tier

## Related Decisions

- ADR 002: E2EE via Web Crypto API
- ADR 003: Yjs for CRDT implementation

## References

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Web Crypto API Spec](https://www.w3.org/TR/WebCryptoAPI/)
