# SYNC-001 Debugging Runbook

## Issue: Peers Connect But Don't See Each Other (👤 1)

**Symptom**: Both peers connect to sync server, show "Securely Connected", have matching Session Fingerprint, but peer count remains at 1 instead of 2.

---

## Quick Diagnostic Steps

### Step 1: Verify Room ID Consistency
```
Check: Do both peers show the same Session Fingerprint?
- If NO → Room ID mismatch (crypto issue)
- If YES → Proceed to Step 2
```

### Step 2: Check Browser Console Logs
Look for these log patterns:
```
✅ Expected (working):
[PRESENCE] Broadcasting heartbeat...
[PRESENCE] Peer heartbeat received...
[PRESENCE] Calling onPeerPresence callback
[PEER DISCOVERY] Received presence pulse, setting hasPeers=true

❌ Problem indicators:
[PRESENCE] Skipping heartbeat - ws=0, key=false  → Not connected
[PRESENCE] onPeerPresence callback not set!      → Callback issue
🛡️ E2EE Decryption failed...                    → Key mismatch
📥 [NETWORK] Received MSG_UPDATE... (but no presence log) → Message not being decrypted
```

### Step 3: Run Automated Test with Logging
```bash
npx playwright test tests/minimal-two-peer.spec.ts --project="Desktop Chrome"
```
Check test output for:
- Room ID match/mismatch
- Browser log excerpts showing PRESENCE/NETWORK/PEER messages
- Diagnostic reports on failure

---

## Common Root Causes

### Cause A: Room ID Mismatch (Different Rooms)
**Symptoms**: Different Session Fingerprints, different room IDs in server logs

**Fix**: 
- Ensure `deriveRoomId()` in `cryptoSync.ts` uses deterministic algorithm
- Check that same passphrase produces same hash on both peers
- Verify static salt is consistent

### Cause B: Server Not Broadcasting
**Symptoms**: Server logs show "Relayed MSG_UPDATE" but clients don't receive

**Fix**:
- Check `sync-server/server.js` MSG_UPDATE broadcast logic
- Ensure `isCatchingUp` flag isn't blocking broadcasts
- Verify clients are joined to same room

### Cause C: Encryption Key Mismatch
**Symptoms**: "E2EE Decryption failed" in console, messages received but can't decrypt

**Fix**:
- Verify `deriveSyncKey()` produces same key from same passphrase
- Check PBKDF2 salt and iterations are identical
- Look for any non-deterministic key derivation

### Cause D: Presence Detection Failure
**Symptoms**: Heartbeats sent/received but `hasPeers` never becomes true

**Fix**:
- Check `onPeerPresence` callback is properly set in `useAppStore.ts`
- Verify presence detection logic in `networkSync.ts` MSG_UPDATE handler
- Ensure empty update `[0, 0]` detection works

---

## Debug Tools

### Tool 1: Standalone Debug Page
```
URL: http://localhost:3000/sync-debug.html
```
- Open in two tabs
- Enter same passphrase
- Click Connect on both
- Watch for "PEER DISCOVERED!" message
- Use "Export Logs" button to capture diagnostics

### Tool 2: Browser Console Tracing
Add this to browser console for live debugging:
```javascript
// Monitor peer state
setInterval(() => {
  const store = window.__STORE__.getState();
  console.log(`hasPeers=${store.hasPeers}, roomId=${store.activeWorkspaceId?.slice(0,8)}`);
}, 2000);
```

### Tool 3: Network Tab Analysis
In Chrome DevTools Network tab:
1. Filter by "WS" (WebSocket)
2. Look for binary messages being sent/received
3. Check message sizes (presence = ~40 bytes, data = larger)

---

## Code Locations for Debugging

### Room ID Derivation
```
File: src/lib/cryptoSync.ts
Function: deriveRoomId(passphrase: string): Promise<string>
```
Add logging to verify deterministic output:
```javascript
console.log(`[CRYPTO] Room ID for "${passphrase}": ${hash.slice(0, 16)}...`);
```

### Peer Presence Detection
```
File: src/lib/networkSync.ts
Lines: MSG_UPDATE handler (~line 260)
```
Look for:
```javascript
if (yjsData.length === 2 && yjsData[0] === 0 && yjsData[1] === 0) {
  // Presence heartbeat detected
  this.onPeerPresence?.();
}
```

### Server Broadcast Logic
```
File: sync-server/server.js
Lines: MSG_UPDATE handler (~line 147)
```
Verify broadcast to all clients in room:
```javascript
wss.clients.forEach(client => {
  if (client !== ws && client.roomId === roomId) {
    client.send(message);
  }
});
```

---

## Test-Driven Debugging

### Test 1: Minimal Two-Peer Test
```bash
npm run test:minimal-two-peer
```
Expected: Both tests pass (A→B and B→A sync)

### Test 2: Ping-Pong Test
```bash
npm run test:ping-pong
```
Expected: Rapid bidirectional sync works

### Test 3: Manual Two-Tab Test
1. Open `/todo` in Tab A
2. Open `/todo` in Tab B
3. Connect both to same room
4. Add task in Tab A
5. Verify appears in Tab B within 5 seconds

---

## Decision Tree

```
Peers in same room?
├── NO → Check deriveRoomId() determinism
│        └── Fix cryptoSync.ts
│
├── YES → Messages being received?
│         ├── NO → Check server broadcast
│         │        └── Fix sync-server/server.js
│         │
│         └── YES → Presence detected?
│                   ├── NO → Check decryption / key mismatch
│                   │        └── Fix deriveSyncKey()
│                   │
│                   └── YES → Callback firing?
│                             ├── NO → Check onPeerPresence setup
│                             │        └── Fix useAppStore.ts
│                             │
│                             └── YES → hasPeers updating?
│                                       └── Check useAppStore set() calls
```

---

## Emergency Workarounds

If you need sync working immediately while debugging:

1. **Disable Encryption** (development only):
   - Set `MSG_UPDATE` payload to unencrypted
   - Bypass `decryptUpdate()` in client

2. **Increase Logging**:
   - Set all console.log levels to verbose
   - Add window.__DEBUG = true for extra tracing

3. **Use Local Sync Server**:
   - Run `node sync-server/server.js` locally
   - Connect to `ws://localhost:8080`
   - Easier to add server-side logging

---

## Verification Checklist

After any fix, verify:
- [ ] Both peers show same Session Fingerprint
- [ ] Browser console shows "[PRESENCE] Peer heartbeat received"
- [ ] UI shows "👤 2" after connection
- [ ] Tasks added on Peer A appear on Peer B
- [ ] Tasks added on Peer B appear on Peer A
- [ ] No "E2EE Decryption failed" errors in console
- [ ] Automated tests pass (`minimal-two-peer.spec.ts`)

---

## References

- Architecture: docs/adr-001-workspace-model.md
- Crypto: src/lib/cryptoSync.ts
- Network: src/lib/networkSync.ts
- Server: sync-server/server.js
- Store: src/store/useAppStore.ts
