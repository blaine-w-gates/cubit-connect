# Supabase Keys and Security

This document outlines the keys used for the Supabase integration in Cubit Connect.

## Keys Overview

| Key Name | Location | Exposure | Purpose |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | **Public** | The endpoint for your Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | **Public** | Used for client-side operations like Realtime and Auth. |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | **Private** | Admin key. **NEVER** expose to the client. |

## Dashboard Location
You can find these keys in your Supabase Dashboard under:
**Project Settings** > **API**

## Security Best Practices
1. **Never commit `.env.local`**: It is added to `.gitignore`.
2. **Service Role Key**: Only use this key in server-side code (Node.js, Edge Functions). It bypasses Row Level Security (RLS).
3. **Anonymous Auth**: We use `supabase.auth.signInAnonymously()` to identify devices without requiring email/password.

## Key Rotation
If keys are leaked:
1. Go to the Supabase Dashboard.
2. Navigate to **API Settings**.
3. Click **Roll Key** for the affected key.
4. Update `.env.local` immediately.

## Migration from Legacy
We are moving from a custom "Dumb Relay" WebSocket server to Supabase Realtime.
- **Legacy**: `ws://localhost:8080`
- **Modern**: `https://muircluzpzdqiqivcing.supabase.co`
