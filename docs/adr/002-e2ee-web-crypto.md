# ADR 002: End-to-End Encryption via Web Crypto API

**Status**: Accepted  
**Date**: April 26, 2026  
**Decision Makers**: Engineering Team, Security Review  

## Context

Our synchronization system needed end-to-end encryption (E2EE) to ensure:
- Server cannot read user data
- Privacy for sensitive project information
- Compliance with data protection principles

## Decision

We chose **Web Crypto API** with AES-256-GCM for E2EE.

## Rationale

### Why Web Crypto API?

1. **Native Browser Support**: No external dependencies
2. **Hardware Acceleration**: Uses CPU crypto instructions
3. **Standardized**: W3C spec, well-reviewed
4. **Non-extractable Keys**: Keys can't be exported
5. **Modern Algorithms**: AES-GCM, PBKDF2

### Security Architecture

```
Passphrase → PBKDF2 → AES-256-GCM Key
                               ↓
Plaintext Yjs Update → Encrypt → Ciphertext
                               ↓
                    Supabase Realtime
                               ↓
Ciphertext → Decrypt → Plaintext Yjs Update
```

### Key Derivation

```javascript
// 100,000 iterations PBKDF2
const key = await deriveSyncKey('user-passphrase');
// key.extractable === false (non-extractable)
```

### Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| libsodium-wasm | Fast, audited | Wasm dependency, bundle size | ❌ Rejected |
| crypto-js | Pure JS, popular | Slower, no hardware acceleration | ❌ Rejected |
| OpenPGP.js | Full PGP support | Complex API, overkill for our use | ❌ Rejected |
| TweetNaCl | Small, fast | External dependency | ❌ Rejected |

## Implementation Details

### Encryption Flow

1. User enters passphrase
2. PBKDF2 derives 256-bit key
3. Yjs updates encrypted with AES-GCM
4. Random IV per encryption
5. Ciphertext + IV sent to Supabase

### Security Properties

- **Confidentiality**: AES-256-GCM encryption
- **Integrity**: GCM authentication tag
- **Non-repudiation**: Key derived from passphrase
- **Forward secrecy**: New IV per message

## Consequences

### Positive
- ✅ Zero external crypto dependencies
- ✅ Fast (hardware accelerated)
- ✅ Secure key storage
- ✅ Standardized implementation

### Negative
- ⚠️ Passphrase is only key (no key recovery)
- ⚠️ Web Crypto API not available in Node.js (test mocking needed)
- ⚠️ Key rotation requires re-encryption

## Threat Model

### Mitigated Threats
- Server compromise (data encrypted)
- Man-in-the-middle (E2EE prevents reading)
- Passphrase brute force (PBKDF2 100k iterations)

### Accepted Risks
- User must remember/share passphrase
- No key escrow or recovery
- Browser must support Web Crypto API

## References

- [Web Crypto API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [AES-GCM RFC 5288](https://tools.ietf.org/html/rfc5288)
- [PBKDF2 RFC 2898](https://tools.ietf.org/html/rfc2898)
