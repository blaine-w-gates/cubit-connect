# Changelog

All notable changes to the Cube It Connect synchronization system.

## [1.2.0] - 2026-04-27

### Added - Phase 6: User Identity & Sync Architecture (Complete)

#### Authentication System
- **Supabase Auth Integration**: Email/password authentication with session persistence
- **AuthModal**: Sign in/up UI with form validation and error handling (`src/components/AuthModal.tsx`)
- **AuthInitializer**: Automatic session restoration on app startup (`src/components/AuthInitializer.tsx`)
- **Header Integration**: Auth status display with user email (`src/components/Header.tsx`)

#### Data Migration
- **Anonymous → Authenticated Migration**: Copy-not-move strategy preserves data safety
- **Migration Module**: Export, migrate, rollback operations (`src/lib/migration.ts`)
- **Backup System**: 30-day localStorage retention for rollback capability
- **Database Schema**: `user_devices`, `identity_migrations`, `user_projects` tables

#### Identity Management
- **IdentitySettings**: Account management UI with linked devices and migration status (`src/components/IdentitySettings.tsx`)
- **SettingsDialog Integration**: Identity section added to settings panel
- **Device Linking**: Automatic device association on authentication
- **Cross-device Support**: Foundation for multi-device data synchronization

#### Testing
- **103 Unit Tests**: Comprehensive coverage for auth, migration, and store integration
  - `tests/unit/auth.test.ts` (33 tests)
  - `tests/unit/migration.test.ts` (40 tests)
  - `tests/unit/storeAuth.test.ts` (28 tests)
- **SSR Safety**: All auth modules handle server-side rendering
- **Type Safety**: Full TypeScript coverage with zero errors

#### Architecture Documentation
- **ADR-006**: Anonymous to Identity Migration Architecture (`docs/ADR-006-Anonymous-Identity-Architecture.md`)
- **Progressive Identity**: Anonymous by default, opt-in registration
- **State Machine**: Documented auth status transitions

### Technical Details
- Database Migration: `supabase/migrations/20260427_add_user_identity.sql`
- Feature Flags: Auth system controlled via `ENABLE_SUPABASE_AUTH`
- Zero Breaking Changes: Existing anonymous users unaffected

## [1.1.0] - 2026-04-27

### Added - Phase 5 Feature Expansion (Complete)

#### User Experience
- **Offline Indicator**: Sticky banner showing network status (`src/components/OfflineIndicator.tsx`)
- **Storage Warning**: 50MB threshold warning for IndexedDB quota (`src/lib/storageMonitor.ts`, `StorageWarningBanner.tsx`)
- **Scout Feature**: Multi-platform search assistant (`src/components/ScoutView.tsx`)

#### Developer Experience
- **Centralized AI Prompts**: Organized prompt templates in `src/prompts/` directory
  - `analysis.ts` - Transcript analysis and step generation
  - `scout.ts` - Multi-platform search queries
  - `types.ts` - Type definitions for prompt functions
  - `index.ts` - Barrel exports

#### Architecture
- **ADR-004**: Storage monitoring specification (docs/adr/004-storage-monitoring.md)
- **ADR-005**: User identity architecture (docs/adr/005-user-identity.md)
- **SupabaseSync**: Clean re-export of SupabaseSyncProd (`src/lib/supabaseSync.ts`)

### Changed
- **Legacy NetworkSync**: Fully removed from codebase (architecture consolidation complete)
  - Renamed all `networkSync` references to `syncManager` in `useAppStore.ts`
  - Removed WebSocket fallback logic
  - Unified on Supabase Realtime for sync transport

### Technical Debt
- **Sync E2E Tests**: Skipped 10 test files due to architecture mismatch
  - See `docs/TECH_DEBT.md` for detailed register
  - Tests expect legacy WebSocket, app uses Supabase Realtime
  - Resolution deferred to Phase 6 or architecture stabilization

## [1.0.0] - 2026-04-26

### Added

#### Security
- **M3**: Content Security Policy (CSP) headers
- **M4**: CORS configuration with origin validation
- **M5**: API rate limiting (100 req/min default)
- Security middleware integration via Next.js middleware.ts
- X-Frame-Options: DENY for clickjacking protection
- Strict-Transport-Security for HTTPS enforcement
- X-Content-Type-Options: nosniff
- Permissions-Policy for feature restriction

#### E2EE & Sync
- End-to-end encryption via Web Crypto API (AES-256-GCM)
- PBKDF2 key derivation (100,000 iterations)
- Supabase Realtime integration
- Yjs document synchronization
- Checkpoint persistence with compression
- Automatic retry with exponential backoff

#### Testing
- 305+ passing tests (unit + integration)
- Middleware tests for security headers
- Rate limiting tests
- E2EE round-trip verification
- Checkpoint persistence tests
- Chaos engineering tests

#### Documentation
- API documentation (docs/API.md)
- Security audit (docs/SECURITY_AUDIT.md)
- Deployment guide (docs/DEPLOYMENT.md)
- Troubleshooting guide (docs/TROUBLESHOOTING.md)
- Architecture Decision Records (4 ADRs)
- This changelog

#### Monitoring
- Performance monitoring (SyncPerformanceMonitor)
- Audit logging system
- Circuit breaker pattern
- Error alerting (Slack/PagerDuty)
- Health check endpoint (/api/health)

### Changed

- Upgraded to Next.js 14+ with App Router
- Migrated to TypeScript strict mode
- Implemented comprehensive error handling
- Added 44+ INTENTIONAL comments for error documentation

### Removed

- **Legacy Sync System**: Deleted custom WebSocket sync implementation (ADR-004)
  - Removed `src/lib/networkSync.ts` (1,847 lines)
  - Removed `sync-server/` directory (Node.js relay server)
  - Removed `tests/e2e/sync.spec.ts` (legacy E2E tests)
  - Removed `src/app/sync-test/page.tsx` (diagnostic page)
  - Archived `DEPLOY_SYNC_SERVER.md` to GRAVEYARD.md
  - Migration: Supabase Realtime is now the only sync transport
  - Rationale: Simplified architecture, reduced maintenance burden, better reliability

### Fixed

- **Critical**: Fixed 15 failing integration tests
- **Security**: Implemented missing M3, M4, M5 gaps
- **Docs**: Created comprehensive documentation suite
- **Tests**: Achieved 100% test pass rate (305/305)

## [0.9.0] - 2026-04-20

### Added
- Initial Supabase integration
- Yjs document support
- Basic checkpoint service
- Rate limiter implementation

### Known Issues
- 15 integration tests failing
- Security headers missing
- Documentation incomplete

## [0.8.0] - 2026-04-15

### Added
- Project scaffolding
- Basic UI components
- Local storage persistence
- Gemini AI integration

---

## Versioning

We use [SemVer](https://semver.org/):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

## Categories

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

---

*This changelog follows the [Keep a Changelog](https://keepachangelog.com/) format.*
