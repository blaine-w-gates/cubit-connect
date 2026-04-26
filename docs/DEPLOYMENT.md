# Deployment Guide

**Version**: 1.0  
**Date**: April 26, 2026  
**Status**: Production Ready

---

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Git

---

## Environment Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd cube-it-connect
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Optional: Feature Flags
NEXT_PUBLIC_ENABLE_SYNC=true
NEXT_PUBLIC_ENABLE_OFFLINE_MODE=true
```

---

## Database Setup

### 1. Create Tables

Run in Supabase SQL Editor:

```sql
-- Yjs Checkpoints Table
CREATE TABLE IF NOT EXISTS yjs_checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_hash TEXT NOT NULL,
  client_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  data BYTEA NOT NULL,
  is_compressed BOOLEAN DEFAULT false,
  original_size INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_checkpoints_room ON yjs_checkpoints(room_hash);
CREATE INDEX idx_checkpoints_client ON yjs_checkpoints(client_id);
CREATE INDEX idx_checkpoints_sequence ON yjs_checkpoints(room_hash, sequence_number DESC);

-- Enable RLS
ALTER TABLE yjs_checkpoints ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for simplicity
CREATE POLICY "Allow all" ON yjs_checkpoints FOR ALL USING (true);
```

### 2. Enable Realtime

In Supabase Dashboard:
1. Go to Database → Replication
2. Enable Realtime for `yjs_checkpoints` table

---

## Build & Deploy

### Local Development

```bash
# Start dev server
npm run dev

# Open http://localhost:3000
```

### Production Build

```bash
# Build
npm run build

# Start production server
npm start
```

### Static Export (GitHub Pages)

```bash
# Configure next.config.js for static export
npm run build

# Deploy dist/ folder
```

---

## Verification

### 1. Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "version": "1.0.0"
}
```

### 2. Security Headers

```bash
curl -I http://localhost:3000/api/health
```

Expected headers:
```
Content-Security-Policy: ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
```

### 3. Rate Limiting

```bash
# Make 101 requests quickly
curl http://localhost:3000/api/health
```

After 100 requests, expect:
```
HTTP/1.1 429 Too Many Requests
```

---

## Environment-Specific Configuration

### Development

```env
ALLOWED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://localhost:54321
```

### Staging

```env
ALLOWED_ORIGINS=https://staging.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
```

### Production

```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
```

---

## Troubleshooting

### Build Errors

```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Supabase Connection Issues

1. Verify environment variables
2. Check Supabase dashboard status
3. Test connection:
```bash
curl $NEXT_PUBLIC_SUPABASE_URL/rest/v1/
```

### Rate Limiting Too Aggressive

Adjust in `src/middleware/rateLimit.ts`:
```typescript
API_RATE_LIMITS: {
  default: { windowMs: 60000, maxRequests: 200 } // Increase limit
}
```

---

## Rollback Procedure

### Database Rollback

```sql
-- Drop checkpoints table
DROP TABLE IF EXISTS yjs_checkpoints;
```

### Code Rollback

```bash
# Revert to previous commit
git revert HEAD
npm run build
```

---

## Monitoring

### Health Endpoint

Monitor `/api/health` for:
- 200 OK: System healthy
- 503: System unhealthy

### Logs

```bash
# View logs
npm run dev 2>&1 | tee dev.log

# Production logs
pm2 logs
```

---

## Security Checklist

Before production:
- [ ] Environment variables set
- [ ] Security headers verified
- [ ] Rate limiting tested
- [ ] Database RLS enabled
- [ ] HTTPS enforced
- [ ] CSP headers configured
- [ ] CORS origins restricted

---

## Support

For deployment issues:
1. Check [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review logs
3. Verify environment variables

---

*This deployment guide ensures production-ready deployment of the sync infrastructure.*
