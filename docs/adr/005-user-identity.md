# ADR-005: User Identity Architecture

## Status
Proposed - Pending Review

## Context

Cubit Connect currently uses anonymous, device-based identity (`deviceId` from `src/lib/identity.ts`). Each device generates a unique fingerprint that serves as:
- Data ownership marker in IndexedDB
- Yjs ClientID for CRDT operations
- Workspace namespace isolation

This model has worked for single-device usage and anonymous multi-device sync (via passphrase-derived rooms), but lacks:
1. **Data persistence across device loss** - New device = new identity
2. **User experience continuity** - Cannot recover data if localStorage is cleared
3. **Security boundaries** - Any device with the passphrase can access shared rooms
4. **Future monetization path** - No user accounts to associate with paid tiers

## Decision

Migrate from device-based anonymous identity to **optional Supabase Authentication** with graceful degradation.

### Architecture: "Progressive Identity"

```
┌─────────────────────────────────────────────────────────────┐
│                    IDENTITY STATES                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐        ┌──────────────┐                   │
│  │  ANONYMOUS   │───────▶│  REGISTERED  │                   │
│  │   (Current)  │        │   (Future)   │                   │
│  └──────────────┘        └──────────────┘                   │
│         │                       │                           │
│         │                       │                           │
│    deviceId +              supabaseUserId                 │
│    localStorage            + deviceId (linked)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Anonymous by Default**: New users start with device-based identity (no friction)
2. **Opt-in Registration**: Users can create accounts at any time
3. **Data Migration**: On registration, existing device data migrates to user account
4. **Backward Compatibility**: Existing anonymous users continue working unchanged
5. **Graceful Degradation**: If Supabase is unavailable, fall back to anonymous mode

### Identity Model

```typescript
interface IdentityState {
  // Anonymous (always present)
  deviceId: string;           // Unique per device/browser
  
  // Registered (null until registration)
  supabaseUserId: string | null;
  authStatus: 'anonymous' | 'authenticated' | 'pending';
  
  // Migration tracking
  dataMigratedAt: number | null;
  lastAnonymousProjectIds: string[];
}
```

### Data Ownership Matrix

| User Type | Storage Key | Sync Behavior | Backup |
|-----------|-------------|---------------|--------|
| Anonymous | `deviceId` | Passphrase rooms only | None |
| Anonymous → Registered | `deviceId` → `supabaseUserId` | Seamless transition | On registration |
| Registered | `supabaseUserId` | Cloud + Passphrase rooms | Automatic |

### Supabase Schema Changes

```sql
-- Users table (managed by Supabase Auth)
-- Extended via auth.users metadata

-- Device Linkage Table
CREATE TABLE user_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id text NOT NULL,
    device_name text,
    last_seen_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, device_id)
);

-- Anonymous → Registered Data Migration Log
CREATE TABLE identity_migrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    old_device_id text NOT NULL,
    new_user_id uuid REFERENCES auth.users(id),
    migrated_projects jsonb,
    migrated_at timestamptz DEFAULT now()
);
```

## Consequences

### Positive
- **Data Recovery**: Users can recover data on new devices via login
- **Cross-Device Sync**: Automatic sync for registered users (no passphrases needed)
- **Security**: Row-level security policies protect user data
- **Monetization Path**: Clear distinction between free/anonymous and paid tiers

### Negative
- **Complexity**: Dual identity modes require careful state management
- **Migration Risk**: Data migration bugs could lose user data
- **Supabase Dependency**: Registered mode requires Supabase availability
- **Privacy Concerns**: Some users may not want accounts

### Mitigations
- Comprehensive migration testing with rollback capability
- Clear user communication during migration
- Anonymous mode always available as fallback
- Local-first architecture preserved (data always in IndexedDB)

## Implementation Tasks

### Phase 1: Foundation (2 weeks)
1. Supabase Auth integration (email/password, OAuth)
2. `user_devices` table and RLS policies
3. Identity state machine in `useAppStore`
4. Device linking on registration

### Phase 2: Data Migration (2 weeks)
1. Export anonymous projects before migration
2. Import to user-owned namespace
3. Yjs workspace switching logic
4. Migration rollback capability

### Phase 3: UX (1 week)
1. Registration/login flows
2. Settings page identity section
3. Migration progress UI
4. Data export before migration

## Open Questions

1. **OAuth Providers**: Which (Google, GitHub, etc.)?
2. **Anonymous Sync Limit**: Should anonymous users have any cloud features?
3. **Pricing Tiers**: What differentiates free vs paid?
4. **Data Retention**: How long keep orphaned anonymous data?

## Related Documents
- ADR-001: Supabase Realtime for Sync (existing)
- ADR-002: E2EE Sync Protocol (existing)
- ADR-004: Storage Monitoring (existing - will need user-scoped quotas)
- docs/TECH_DEBT.md: Sync test architecture (must resolve before Phase 6)

## References
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [RLS Policies Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
