# Manual SYNC-001 Test Protocol

## Quick Two-Tab Test (5 minutes)

### Step 1: Setup
1. Open Chrome/Edge/Safari
2. Open Tab 1: `http://localhost:3000/todo`
3. Open Tab 2: `http://localhost:3000/todo`
4. Open DevTools console in both tabs (F12)

### Step 2: Connect Tab 1
1. Click **"🔒 Sync"** button
2. Enter passphrase: `test-room-123`
3. Click **"Establish Secure Connection"**
4. Wait for "Securely Connected" status
5. Note the **Session Fingerprint** (e.g., "A1B2")
6. Console should show: `[PRESENCE] Broadcasting heartbeat...`

### Step 3: Connect Tab 2 (within 30 seconds)
1. Click **"🔒 Sync"** button
2. Enter same passphrase: `test-room-123`
3. Click **"Establish Secure Connection"**
4. Verify **same Session Fingerprint** as Tab 1
5. Console should show: `[PRESENCE] Peer heartbeat received...`

### Step 4: Verify Peer Discovery
**PASS Criteria:**
- Both tabs show 👤 **2** (not 👤 1)
- Tab 1 console shows: `[PEER DISCOVERY] Received presence pulse, setting hasPeers=true`
- Tab 2 console shows: `[PEER DISCOVERY] Received presence pulse, setting hasPeers=true`
- **Session Fingerprint matches** on both tabs

**FAIL Criteria:**
- Either tab shows 👤 1 after 10 seconds
- Different Session Fingerprints
- "E2EE Decryption failed" errors in console
- `[PRESENCE] onPeerPresence callback not set!` warning

### Step 5: Test Data Sync
1. Close sync modal on both tabs
2. On Tab 1: Add a task named "Test from Tab 1"
3. Wait 5 seconds
4. Check Tab 2: Task should appear automatically

## Debug Console Commands

Run these in browser console to monitor sync:

```javascript
// Monitor peer state every 2 seconds
setInterval(() => {
  const store = window.__STORE__.getState();
  console.log(`👤 Peers: ${store.hasPeers ? 'YES' : 'NO'}, Room: ${store.roomFingerprint}, Status: ${store.syncStatus}`);
}, 2000);

// Monitor network messages
const origLog = console.log;
console.log = (...args) => {
  if (args[0]?.includes('PRESENCE') || args[0]?.includes('NETWORK') || args[0]?.includes('PEER')) {
    origLog.apply(console, ['📡', ...args]);
  }
  origLog.apply(console, args);
};
```

## Alternative: Debug Page Test

Use the standalone debug page:
1. Tab 1: Open `http://localhost:3000/sync-debug.html`
2. Tab 2: Open `http://localhost:3000/sync-debug.html?auto=true&room=test-room-123`
3. Click **Connect** on Tab 1
4. Tab 2 auto-connects
5. Watch metrics panel for "Peers Detected: 1"

## Log Collection

If test fails, export logs from debug page or run in console:

```javascript
// Export all logs
const logs = [];
console.log = (...args) => {
  logs.push(args.join(' '));
  origLog.apply(console, args);
};

// Later, to download:
const blob = new Blob([logs.join('\n')], {type: 'text/plain'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'sync-debug.log';
a.click();
```

## Expected Results

**Working Sync:**
- Peers: 1+ (both tabs detect each other)
- Messages: sent/received incrementing
- Last Peer Seen: shows seconds ago
- Presence heartbeats: every 15 seconds

**Broken Sync (SYNC-001):**
- Peers: 0 (never detects other peer)
- Messages sent: >0, Messages received: 0
- No "Peer heartbeat received" logs
- Session Fingerprint may differ

## Next Steps

If manual test **PASSES** but automated test **FAILS**:
→ Browser resource issue, not sync bug. Use manual testing for validation.

If manual test **FAILS**:
→ Real SYNC-001 bug. Check:
1. Server logs for broadcast issues
2. Room ID consistency in console
3. E2EE decryption errors
4. Presence callback registration

## Report Template

```
Manual Test Result: [PASS/FAIL]
Browser: [Chrome/Safari/Firefox/Edge]
Session Fingerprints: [e.g., both show "A1B2"]
Peer Count: [👤 1 or 👤 2]
Errors in Console: [any red errors]
Data Sync Works: [YES/NO]
```
