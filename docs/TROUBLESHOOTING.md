# Troubleshooting Guide

**Version**: 1.0  
**Date**: April 26, 2026  

---

## Common Issues

### 1. Sync Not Working

**Symptoms**: Changes not syncing between devices  
**Severity**: High

#### Diagnosis Steps

```bash
# 1. Check health endpoint
curl http://localhost:3000/api/health

# 2. Verify Supabase connection
node -e "require('@supabase/supabase-js').createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).from('yjs_checkpoints').select('count').then(console.log)"

# 3. Check browser console for WebSocket errors
# Open DevTools → Console → Filter for "WebSocket" or "Realtime"
```

#### Common Causes

| Cause | Fix |
|-------|-----|
| Missing env vars | Check `.env.local` has Supabase credentials |
| Realtime disabled | Enable in Supabase Dashboard → Database → Replication |
| Room hash mismatch | Ensure both devices use same passphrase |
| E2EE key mismatch | Verify both devices derive same key |

#### Quick Fix

```typescript
// Reset sync state
localStorage.clear();
window.location.reload();
```

---

### 2. Connection Timeout

**Symptoms**: "Connection timeout" error after 30 seconds  
**Severity**: Medium

#### Diagnosis

```bash
# Check network
curl -w "%{time_total}\n" $NEXT_PUBLIC_SUPABASE_URL
# Should be < 2 seconds
```

#### Fixes

1. **Increase timeout** (temporary):
```typescript
// In supabaseClient.ts
const AUTH_TIMEOUT_MS = 30000; // Increase from 10000
```

2. **Check Supabase status**: https://status.supabase.com/

3. **Verify network**: Ensure no firewall blocking wss:// connections

---

### 3. Rate Limit Errors (429)

**Symptoms**: "Too many requests" error  
**Severity**: Low

#### Diagnosis

Check rate limit headers:
```bash
curl -I http://localhost:3000/api/health
grep X-RateLimit
```

#### Fix

Wait for window to reset (1 minute), or adjust limits:
```typescript
// src/middleware/rateLimit.ts
API_RATE_LIMITS: {
  default: { windowMs: 60000, maxRequests: 200 } // Increase
}
```

---

### 4. Encryption Errors

**Symptoms**: "Decryption failed" or "Invalid key"  
**Severity**: High

#### Diagnosis

```typescript
// Check key derivation
const key = await deriveSyncKey('passphrase');
console.log('Key type:', key.type); // Should be 'secret'
console.log('Algorithm:', key.algorithm.name); // Should be 'AES-GCM'
```

#### Fixes

1. **Regenerate key**:
```typescript
const newKey = await deriveSyncKey('new-passphrase');
```

2. **Clear stored data**:
```bash
localStorage.removeItem('cubit_sync_key');
```

---

### 5. Checkpoint Save Failures

**Symptoms**: "Failed to save checkpoint" error  
**Severity**: Medium

#### Diagnosis

```bash
# Check Supabase storage
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/yjs_checkpoints?select=count" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

#### Common Causes

- **Size limit**: Checkpoints > 1MB will fail
- **Permissions**: RLS policy blocking writes
- **Storage full**: Check Supabase dashboard

#### Fix

```sql
-- Increase size limit (if needed)
-- Or compress data before saving
```

---

### 6. Build Failures

**Symptoms**: `npm run build` fails  
**Severity**: High

#### Quick Fixes

```bash
# Clear everything
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

#### Common Errors

| Error | Fix |
|-------|-----|
| "Cannot find module" | `npm install` missing dependency |
| "Type error" | Check `tsconfig.json` paths |
| "Window is not defined" | Add `"use client"` to component |

---

### 7. TypeScript Errors

**Symptoms**: `npm run type-check` fails  
**Severity**: Medium

#### Common Fixes

```bash
# Regenerate types
npx tsc --noEmit --incremental

# Check specific file
npx tsc --noEmit src/lib/supabaseSyncProd.ts
```

---

### 8. Test Failures

**Symptoms**: `npm test` fails  
**Severity**: Low (for dev)

#### Diagnosis

```bash
# Run specific test
npx vitest run tests/unit/supabaseClient.test.ts

# Run with coverage
npx vitest run --coverage
```

#### Common Issues

- **Missing env vars**: Tests need `NEXT_PUBLIC_SUPABASE_URL`
- **Supabase not running**: Some tests need real Supabase
- **Network issues**: Integration tests need internet

#### Fix

```bash
# Skip integration tests
npx vitest run tests/unit/

# Or mock Supabase
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
```

---

### 9. Performance Issues

**Symptoms**: UI lag, high memory usage  
**Severity**: Medium

#### Diagnosis

```bash
# Check performance
npx lighthouse http://localhost:3000

# Memory profiling
# Chrome DevTools → Performance → Memory
```

#### Fixes

1. **Clear old checkpoints**:
```sql
-- Delete old checkpoints (keep last 10 per room)
DELETE FROM yjs_checkpoints
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY room_hash ORDER BY sequence_number DESC) as rn
    FROM yjs_checkpoints
  ) t
  WHERE t.rn <= 10
);
```

2. **Limit metrics history**:
```typescript
// syncPerformanceMonitor.ts
const MAX_HISTORY_SIZE = 100; // Reduce from 1000
```

---

### 10. Security Warnings

**Symptoms**: CSP violations in console  
**Severity**: Low (if expected)

#### Diagnosis

Check CSP report:
```javascript
// In browser console
document.querySelector('meta[http-equiv="Content-Security-Policy"]')
```

#### Fix

Update CSP in `src/middleware/securityHeaders.ts`:
```typescript
const DEFAULT_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' ...";
```

---

## Debug Mode

Enable detailed logging:

```typescript
// In browser console
localStorage.setItem('debug', 'true');
window.location.reload();
```

This enables:
- WebSocket message logging
- Sync state changes
- Performance metrics

---

## Getting Help

### Information to Provide

When reporting issues, include:
1. Browser version
2. Error messages (screenshot or text)
3. Steps to reproduce
4. Environment variables (redact secrets)
5. Console logs
6. Network tab screenshots

### Checklist Before Reporting

- [ ] Checked this troubleshooting guide
- [ ] Verified environment variables
- [ ] Cleared browser cache
- [ ] Tried incognito/private mode
- [ ] Checked Supabase status page
- [ ] Reviewed browser console for errors

---

## Emergency Procedures

### Complete Reset

**Warning**: This deletes all local data!

```bash
# Clear everything
localStorage.clear();
indexedDB.deleteDatabase('cubit');
window.location.reload();
```

### Disable Sync

```typescript
// In browser console
localStorage.setItem('sync_disabled', 'true');
window.location.reload();
```

---

*This troubleshooting guide covers common issues. For complex problems, review logs and provide detailed information when seeking support.*
