# Phase 1 Runbook: Operational Procedures

## Enabling the Migration
To test the Supabase transport:
1. Open the browser console (F12).
2. Run `window.__toggleSupabaseSync__()`.
3. Reload the page.

## Monitoring
Check for errors in:
1. **Console**: Look for `[SYNC ERROR]` or `[SUPABASE SYNC]`.
2. **Telemetry**: Inspect `window.__SYNC_TELEMETRY__`.

## Emergency Rollback
If the app becomes unresponsive or sync fails:
1. The system should auto-rollback.
2. If it doesn't, run `localStorage.setItem('USE_SUPABASE_SYNC', 'false')`.
3. Reload the page.

## Troubleshooting
- **No keys found**: Ensure `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Auth Failure**: Check Supabase Dashboard > Authentication > Providers > Anonymous (must be enabled).
- **Presence Issues**: Check Supabase Dashboard > Realtime (must be enabled for the project).
