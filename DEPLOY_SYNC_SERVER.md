# Deploying the Cubit Connect Sync Relay Server on Render

> **Context for AI Assistant:** This guide walks a user through deploying a Node.js WebSocket relay server on Render.com. The server enables real-time End-to-End Encrypted (E2EE) synchronization between devices running the Cubit Connect web app. The user's frontend app is ALREADY deployed on Render as a Static Site at `cubit-connect.onrender.com`. This guide deploys the BACKEND relay as a SEPARATE service.

---

## Architecture Overview

```
Frontend (Next.js Static Site)          Relay Server (Node.js + Redis)
cubit-connect.onrender.com             cubit-sync-relay.onrender.com
         │                                        │
         │    Browser opens WSS connection ──────►│
         │◄──── Encrypted Yjs CRDT blobs ────────►│
         │                                        │
         │    All data is AES-256-GCM encrypted   │
         │    BEFORE leaving the browser.          │
         │    The relay CANNOT read any data.      │
```

## Prerequisites

- A [Render.com](https://render.com) account (the user already has one)
- The GitHub repo: `blaine-w-gates/cubit-connect`
- The sync server code lives at: `sync-server/server.js` in the repo root

---

## Step 1: Create a New Render Web Service

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect the **same GitHub repository**: `blaine-w-gates/cubit-connect`
4. Configure these settings:

| Setting | Value |
|---------|-------|
| **Name** | `cubit-sync-relay` (or any name you prefer) |
| **Region** | Same region as your frontend (e.g., Oregon US West) |
| **Root Directory** | `sync-server` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Instance Type** | Free (or Starter for persistent uptime) |

> **CRITICAL:** The **Root Directory** MUST be set to `sync-server`. This tells Render to only look at the `sync-server/` subfolder, not the Next.js frontend.

5. Click **"Create Web Service"**

---

## Step 2: Provision a Redis Instance

The relay server uses Redis to cache encrypted checkpoints and recent diffs so new devices can catch up when they connect.

1. In the Render Dashboard, click **"New +"** → **"Redis"**
2. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `cubit-sync-redis` |
| **Region** | Same region as your Web Service |
| **Instance Type** | Free (25MB, fine for testing) or Starter ($7/mo for production) |
| **Maxmemory Policy** | `allkeys-lru` (evicts oldest data when full) |

3. Click **"Create Redis Instance"**
4. Once created, copy the **Internal URL** (looks like `redis://red-xxxxx:6379`)

---

## Step 3: Set the Environment Variable

1. Go to your **`cubit-sync-relay`** Web Service dashboard
2. Click **"Environment"** in the left sidebar
3. Add this environment variable:

| Key | Value |
|-----|-------|
| `REDIS_URL` | Paste the Redis Internal URL from Step 2 |

> **Tip:** If both services are in the same Render region, use the **Internal URL** (faster, no egress charges). If different regions, use the External URL.

4. Click **"Save Changes"** — Render will automatically redeploy

---

## Step 4: Verify the Relay Server is Running

Once deployed, visit your relay server's URL in a browser:

```
https://cubit-sync-relay.onrender.com
```

You should see the plain text response:
```
Cubit Connect Dumb Relay is Active
```

If you see this, the server is alive and accepting connections.

---

## Step 5: Update the Frontend Client URL

The frontend currently points to the wrong URL. You need to update it to point to the new relay server.

### Option A: Update via Render Environment Variables (Recommended)

1. Go to your **frontend** Static Site on Render (`cubit-connect`)
2. Go to **"Environment"** → Add/Update:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SYNC_SERVER_URL` | `wss://cubit-sync-relay.onrender.com` |

3. Trigger a manual deploy (or push a commit)

### Option B: Update the Code Files Directly

Edit these two files in the repo:

**`.env.production`**
```
NEXT_PUBLIC_SYNC_SERVER_URL=wss://cubit-sync-relay.onrender.com
```

**`.env.local`**
```
NEXT_PUBLIC_SYNC_SERVER_URL=wss://cubit-sync-relay.onrender.com
```

Then commit and push. Render will auto-deploy.

### Fallback Hardcoded Value

The code in `src/store/useAppStore.ts` line ~150 also has a hardcoded fallback:
```typescript
const SYNC_SERVER_URL = process.env.NEXT_PUBLIC_SYNC_SERVER_URL || 'wss://cubit-connect.onrender.com';
```

If you cannot set env vars on Render for a Static Site, update this line directly to:
```typescript
const SYNC_SERVER_URL = process.env.NEXT_PUBLIC_SYNC_SERVER_URL || 'wss://cubit-sync-relay.onrender.com';
```

---

## Step 6: Test the Connection

1. Open `cubit-connect.onrender.com/todo` in two different browsers
2. Click the **"Sync"** button on both
3. Enter the **same passphrase** (minimum 12 characters) on both
4. The spinner should resolve to a green **"Securely Connected"** state with a matching 4-character fingerprint
5. Create a to-do item in one browser — it should appear in the other within 1-2 seconds

---

## Troubleshooting

### Spinner still spinning after 60 seconds
- Check the Render dashboard for the relay service — is it running?
- Free-tier Render services spin down after 15 minutes of inactivity. The first connection may take 30-60 seconds while it cold-boots.
- Check browser DevTools Console for error messages

### "E2EE Payload Rejected" in console
- The passphrase is different on the two devices. Re-enter it carefully.

### Redis connection errors in Render logs
- Verify the `REDIS_URL` environment variable is set correctly
- Ensure both the Redis instance and the Web Service are in the same region

### Data doesn't sync after connection
- Both devices must be on the **same passphrase**
- Check that the 4-character fingerprint matches on both devices
- If one device had data before connecting, it will upload a "Genesis Checkpoint" — the other device receives it after a few seconds

---

## Free Tier Limitations

| Limitation | Impact | Solution |
|------------|--------|----------|
| Server sleeps after 15min idle | First connection slow (~30s) | Upgrade to Starter ($7/mo) |
| Redis 25MB limit | Can hold ~25 encrypted checkpoints | Upgrade Redis or rely on 7-day auto-expiry |
| 750 free hours/month | Shared across all free services | Monitor usage in Render dashboard |

---

## Security Notes

- **The relay server is "zero-knowledge"** — it only forwards encrypted binary blobs
- **AES-256-GCM encryption** happens entirely in the browser via the Web Crypto API
- **PBKDF2 with 100,000 iterations** derives the encryption key from the passphrase
- **The passphrase never leaves the device** — only encrypted data and a SHA-256 room hash are transmitted
- **Redis stores only encrypted blobs** — even if Redis is compromised, data is unreadable without the passphrase
