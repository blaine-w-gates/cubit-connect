# ADR 003: Security Headers Implementation

**Status**: Accepted  
**Date**: April 26, 2026  
**Decision Makers**: Engineering Team  

## Context

Following security best practices and compliance requirements, we needed to implement security headers for:
- XSS protection
- Clickjacking prevention
- MIME sniffing prevention
- HTTPS enforcement

## Decision

We implemented comprehensive security headers via Next.js middleware.

## Headers Implemented

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | `default-src 'self'; ...` | XSS protection |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | HTTPS enforcement |
| X-Frame-Options | `DENY` | Clickjacking prevention |
| X-Content-Type-Options | `nosniff` | MIME sniffing prevention |
| Referrer-Policy | `strict-origin-when-cross-origin` | Privacy |
| Permissions-Policy | `camera=(), microphone=()` | Feature restriction |

## Implementation

### Middleware Architecture

```typescript
// src/middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Add security headers
  const securityHeaders = generateSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}
```

### CSP Configuration

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
frame-ancestors 'none';
```

### Rationale for CSP Directives

- `'unsafe-inline'` scripts: Required for Next.js
- `'unsafe-eval'`: Required for some libraries
- `connect-src`: Supabase WebSocket connections
- `frame-ancestors 'none'`: Prevents embedding

## Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Helmet.js (Express) | Comprehensive | Requires Express server | ❌ Not applicable |
| Cloudflare Headers | Edge deployment | Vendor lock-in | ❌ Not applicable |
| nginx headers | Fast | Requires nginx | ❌ Not applicable |
| Next.js headers config | Static | Less flexible | ⚠️ Partial use |

## Consequences

### Positive
- ✅ Defense in depth against XSS
- ✅ SEO benefit (HSTS preload)
- ✅ Compliance with security standards
- ✅ Easy to maintain

### Negative
- ⚠️ CSP violations may block legitimate resources
- ⚠️ `'unsafe-inline'` reduces XSS protection
- ⚠️ Requires testing after each dependency update

## Testing

```bash
# Verify headers
curl -I http://localhost:3000/api/health

# Expected output:
# Content-Security-Policy: default-src 'self'...
# X-Frame-Options: DENY
# Strict-Transport-Security: max-age=31536000...
```

## References

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [CSP Quick Reference](https://content-security-policy.com/)
- [HSTS Preload](https://hstspreload.org/)
