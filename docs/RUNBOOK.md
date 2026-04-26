# Operations Runbook

**Version**: 1.0  
**Date**: April 26, 2026  
**Status**: Production

---

## Table of Contents

1. [On-Call Procedures](#on-call-procedures)
2. [Incident Response](#incident-response)
3. [Deployment](#deployment)
4. [Monitoring](#monitoring)
5. [Troubleshooting](#troubleshooting)
6. [Escalation](#escalation)

---

## On-Call Procedures

### Shift Handoff

1. **Current Issues**: Review open incidents
2. **System Health**: Check /api/health
3. **Error Rates**: Review last 24h error logs
4. **Anomalies**: Note any unusual patterns

### Tools Required

- Supabase Dashboard access
- GitHub repository access
- Error tracking system (if configured)
- Communication channel (Slack/Discord)

---

## Incident Response

### Severity Levels

| Level | Impact | Response Time | Examples |
|-------|--------|---------------|----------|
| P0 | Total outage | 15 min | Sync completely down |
| P1 | Major degradation | 1 hour | High error rate, slow sync |
| P2 | Minor issues | 4 hours | Single user issues |
| P3 | Cosmetic | 24 hours | UI glitches |

### Incident Response Playbook

#### P0: Sync Outage

```bash
# 1. Verify the issue
curl https://your-domain.com/api/health

# 2. Check Supabase status
curl https://status.supabase.com/api/v2/status.json

# 3. Check if environment variables are set
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# 4. If Supabase is down, implement fallback mode
# Enable local-only mode in settings

# 5. Communicate to users
# Post status update on status page/social media
```

**Recovery Steps**:
1. Verify Supabase service status
2. Check for deployment issues
3. Rollback if recent deployment caused issue
4. Enable emergency local-only mode if needed

#### P1: High Error Rate

```bash
# Check error logs
npm run logs:errors

# Identify error type
grep -c "E2EE_DECRYPTION_FAILED" logs.txt
grep -c "SUPABASE_CONNECTION_ERROR" logs.txt

# Common fixes:
# - E2EE errors: Check passphrase consistency
# - Connection errors: Verify Supabase credentials
# - Rate limiting: Check X-RateLimit-Remaining headers
```

#### P2: Single User Issue

1. Ask user to:
   - Clear browser cache
   - Try incognito mode
   - Check browser console for errors
   - Verify they're using correct passphrase

2. If sync issues:
   - Check user's client ID in Supabase
   - Verify room hash matches
   - Reset sync state if needed

---

## Deployment

### Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] Security audit passed (`npm run security:audit`)
- [ ] Type check passed (`npx tsc --noEmit`)
- [ ] Environment variables set
- [ ] Database migrations tested
- [ ] Rollback plan documented

### Deployment Steps

```bash
# 1. Run pre-deployment checks
npm run pre-deploy

# 2. Build production
npm run build

# 3. Deploy to hosting
npm run deploy

# 4. Verify deployment
curl https://your-domain.com/api/health

# 5. Monitor for 30 minutes
npm run monitor:watch
```

### Rollback Procedure

```bash
# Emergency rollback (2 minutes)
git revert HEAD
npm run build
npm run deploy

# Notify users of rollback
echo "Deployment rolled back due to issues"
```

---

## Monitoring

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Sync latency | < 500ms | > 2000ms |
| Error rate | < 1% | > 5% |
| Uptime | 99.9% | < 99% |
| Checkpoint save time | < 1s | > 5s |

### Health Check

```bash
# Full system health
curl https://your-domain.com/api/health | jq

# Expected output:
{
  "status": "healthy",
  "subsystems": {
    "transport": { "status": "healthy" },
    "audit": { "status": "healthy" },
    "rateLimiter": { "status": "healthy" }
  }
}
```

### Log Analysis

```bash
# Error patterns
grep -E "ERROR|FAIL" logs.txt | sort | uniq -c | sort -rn

# Sync errors by room
grep "SYNC_ERROR" logs.txt | cut -d' ' -f5 | sort | uniq -c

# Performance issues
grep "latencyMs.*[0-9]{4,}" logs.txt
```

---

## Troubleshooting

### Common Issues Quick Reference

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "Sync failed" | Wrong passphrase | Verify passphrase |
| "Connection timeout" | Supabase issue | Check status page |
| "Decryption failed" | E2EE key mismatch | Re-enter passphrase |
| "429 errors" | Rate limiting | Wait 1 minute |
| High memory usage | Large Yjs document | Compress checkpoints |

### Debug Mode

Enable detailed logging:

```javascript
// In browser console
localStorage.setItem('debug', 'true');
window.location.reload();
```

---

## Escalation

### Escalation Path

1. **L1**: On-call engineer (first 1 hour)
2. **L2**: Senior engineer + PM (if unresolved after 1 hour)
3. **L3**: Full team + external support (if critical after 4 hours)

### When to Escalate

- **P0 incident**: Immediately
- **Security breach**: Immediately
- **Data loss**: Immediately
- **Unresolved after 1 hour**: Standard escalation

### External Contacts

- **Supabase Support**: support@supabase.com
- **Vercel Support**: (if using Vercel)
- **Security Team**: (internal contact)

---

## Post-Incident Review

After every P0/P1 incident:

1. **Timeline**: Document exactly what happened when
2. **Root Cause**: Identify underlying issue
3. **Impact Assessment**: Users affected, duration
4. **Remediation**: What fixed it
5. **Prevention**: How to prevent recurrence
6. **Action Items**: Specific tasks with owners

**Template**: Use [Incident Review Template](./INCIDENT_TEMPLATE.md)

---

## Runbook Maintenance

- **Review**: Monthly with team
- **Update**: After every major incident
- **Test**: Quarterly drill of P0 procedures
- **Version**: Update date/version on changes

---

*This runbook is a living document. Keep it updated with lessons learned.*
