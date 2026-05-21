# TRAINING PROMPT: Week 2 - Implementation Phase 6A

## Your Role: Implementation Agent

You are now an **Implementation Agent** with authority to write production code. Your trainer (lead architect) will review your work at key checkpoints.

**Current Level:** Week 2 of 5  
**Authority:** 40% - Implement with heavy review  
**Scope:** Phase 6A - Email/Password Authentication (OAuth deferred to Phase 6B)

---

## Mission: Implement Core Auth Infrastructure

**Deliverable:** Working email/password authentication with data migration

**Must Demonstrate:**
- Ring 2: Skeptical Verification (run checks after each task)
- Ring 3: Root Cause Analysis (debug failing tests properly)
- Ring 4: Progressive Delegation (earn trust through quality)

---

## Daily Standup Protocol

**Before starting each day, post this:**

```
DAILY STANDUP - Day [X]

Yesterday's Plan: [What you intended to do]
Yesterday's Actual: [What you completed]
Today's Plan: [What you'll work on today]
Blockers: [Any issues needing trainer help]
Verification Status: [npm run lint/test/build results]
Confidence: [1-10 on meeting today's goals]
```

---

## Implementation Tasks (Phase 6A Only)

### Task 1: Database Schema (Day 1 Morning)
**Deliverable:** `supabase/migrations/20260427_add_user_identity.sql`

**Requirements:**
1. Create `user_devices` table
2. Create `identity_migrations` table  
3. Add RLS policies to ALL existing tables (projects, todo_items, etc.)
4. Add RLS policies to new tables

**Acceptance Criteria:**
- [ ] Migration can be applied to Supabase
- [ ] RLS policies prevent cross-user data access
- [ ] Anonymous users can still read/write their own data
- [ ] All tables have policies documented

**Verification:**
```bash
# After writing SQL, verify syntax
# (You cannot run against real DB yet, but check for SQL errors)
```

**Checkpoint:** Post SQL file for trainer review before proceeding

---

### Task 2: Auth Module Core (Day 1 Afternoon)
**Deliverable:** `src/lib/auth.ts`

**Requirements:**
```typescript
// Core auth functions
export async function signUp(email: string, password: string): Promise<AuthResult>
export async function signIn(email: string, password: string): Promise<AuthResult>
export async function signOut(): Promise<void>
export async function getAuthState(): Promise<AuthState>
export async function linkDeviceToUser(userId: string, deviceId: string): Promise<void>

// Types
export interface AuthResult {
  success: boolean
  userId?: string
  error?: string
}

export interface AuthState {
  status: 'anonymous' | 'authenticated' | 'pending'
  userId: string | null
  deviceId: string
  email: string | null
}
```

**Must Use:**
- Supabase Auth (already in supabaseClient.ts)
- Proper error handling with INTENTIONAL comments
- Audit logging for all auth events
- Feature flags for gradual rollout

**Acceptance Criteria:**
- [ ] signUp creates user in Supabase Auth
- [ ] signUp initiates device linking
- [ ] signIn authenticates and links device
- [ ] signOut clears session
- [ ] getAuthState returns correct status
- [ ] All functions have JSDoc headers
- [ ] All errors have INTENTIONAL comments

**Verification:**
```bash
npm run lint          # Must pass
npx tsc --noEmit      # Must pass
```

**Checkpoint:** Post auth.ts for review after writing, before testing

---

### Task 3: Migration Module (Day 2)
**Deliverable:** `src/lib/migration.ts`

**Requirements:**
```typescript
// Data migration functions
export async function exportAnonymousData(): Promise<ExportData>
export async function migrateAnonymousData(userId: string): Promise<MigrationResult>
export async function rollbackMigration(userId: string): Promise<void>

export interface ExportData {
  projects: Project[]
  timestamp: number
  deviceId: string
}

export interface MigrationResult {
  success: boolean
  migratedProjects: number
  errors: string[]
}
```

**Migration Strategy:**
1. Export all anonymous data to JSON (safety backup)
2. Copy projects to user-owned namespace
3. Log migration to `identity_migrations` table
4. Update local storage with user context

**Acceptance Criteria:**
- [ ] exportAnonymousData returns all projects
- [ ] migrateAnonymousData copies to user namespace
- [ ] Original anonymous data preserved until cleanup
- [ ] Rollback can restore anonymous access
- [ ] Handles empty project list gracefully
- [ ] All errors have INTENTIONAL comments

**Verification:**
```bash
npm run lint
npx tsc --noEmit
npm run test          # All existing tests must still pass
```

**Checkpoint:** Post migration.ts for review

---

### Task 4: Store Integration (Day 3 Morning)
**Deliverable:** Additions to `src/store/useAppStore.ts`

**Requirements:**
Add to state:
```typescript
authUserId: string | null
authStatus: 'anonymous' | 'authenticated' | 'pending'
migrationStatus: 'idle' | 'exporting' | 'migrating' | 'complete' | 'error'
```

Add actions:
```typescript
signUp: async (email: string, password: string) => {
  // 1. Call auth.signUp
  // 2. If success, trigger migration
  // 3. Update auth state
  // 4. Update migration status
}

signIn: async (email: string, password: string) => {
  // 1. Call auth.signIn
  // 2. If success, trigger migration (if needed)
  // 3. Update auth state
}

signOut: async () => {
  // 1. Call auth.signOut
  // 2. Return to anonymous state
  // 3. Clear user context but keep deviceId
}
```

**Acceptance Criteria:**
- [ ] Initial state is 'anonymous'
- [ ] signUp updates authStatus to 'authenticated'
- [ ] signOut returns to 'anonymous'
- [ ] migrationStatus tracks progress
- [ ] All existing store functionality preserved
- [ ] No regression in existing tests

**Critical Rule:** 
- DO NOT break existing store functionality
- All 351 existing tests must still pass
- Use useShallow selectors to prevent unnecessary re-renders

**Verification:**
```bash
npm run test          # All 351 tests must pass
npm run lint
npx tsc --noEmit
```

**Checkpoint:** Run tests and post results. If any test fails, STOP and debug.

---

### Task 5: AuthModal Component (Day 3 Afternoon)
**Deliverable:** `src/components/AuthModal.tsx`

**Requirements:**
- Modal dialog for login/register
- Email and password inputs
- Submit button with loading state
- Error display
- Link to toggle between login/register modes

**Must Use:**
- Existing UI components from `src/components/ui/`
- Zustand store for auth actions
- Proper error handling
- Accessibility (aria labels, keyboard navigation)

**Acceptance Criteria:**
- [ ] Form validates email format
- [ ] Form validates password length (min 8)
- [ ] Loading state during submission
- [ ] Error messages displayed
- [ ] Can close modal
- [ ] Accessible (keyboard navigation)
- [ ] Responsive design

**Verification:**
```bash
npm run lint
npx tsc --noEmit
npm run build         # Must build successfully
```

**Checkpoint:** Post component for visual review

---

### Task 6: IdentitySettings Component (Day 4 Morning)
**Deliverable:** `src/components/IdentitySettings.tsx`

**Requirements:**
- Section for settings page
- Shows current auth status
- Shows linked devices
- Button to open AuthModal
- Option to sign out
- Migration status display (if applicable)

**Acceptance Criteria:**
- [ ] Shows "Anonymous" or authenticated email
- [ ] Lists linked devices
- [ ] Sign out button works
- [ ] Shows migration progress if active
- [ ] Link to "Why register?" explanation

**Verification:**
```bash
npm run lint
npx tsc --noEmit
```

---

### Task 7: Unit Tests (Day 4 Afternoon - Day 5 Morning)
**Deliverable:** 
- `tests/unit/auth.test.ts`
- `tests/unit/migration.test.ts`
- `tests/unit/useAppStore.auth.test.ts`

**Requirements:**
Write tests for all functions in Task 2-4
Use mocking for Supabase (see setup.ts pattern)

**Acceptance Criteria:**
- [ ] All auth functions tested
- [ ] All migration functions tested
- [ ] Store auth state tested
- [ ] All tests pass
- [ ] No tests skipped without TODO

**Verification:**
```bash
npm run test          # All tests must pass (351 + new ones)
```

**Critical:** If tests fail, debug using Ring 3 (5 Whys). DO NOT skip tests.

---

### Task 8: ADR-006 Documentation (Day 5 Afternoon)
**Deliverable:** `docs/adr/006-anonymous-sync.md`

**Requirements:**
Document the anonymous user sync strategy

**Sections:**
- Context (why we need this)
- Decision (what we built)
- Consequences (trade-offs)
- Implementation notes

**Acceptance Criteria:**
- [ ] Explains anonymous → registered flow
- [ ] Documents migration strategy
- [ ] References all new files
- [ ] Explains RLS policies

---

## Weekly Verification (End of Week 2)

**Final Checklist:**
- [ ] `npm run lint` - 0 errors
- [ ] `npx tsc --noEmit` - 0 errors
- [ ] `npm run test` - All 351 original + new tests pass
- [ ] `npm run build` - Static export successful
- [ ] All new files have JSDoc headers
- [ ] All error handling has INTENTIONAL comments
- [ ] ADR-006 written

**Success Criteria:**
| Criterion | Target |
|-----------|--------|
| Test Pass Rate | 100% (351 + new) |
| Lint Errors | 0 |
| Type Errors | 0 |
| Build Success | Yes |
| JSDoc Coverage | 100% of new files |
| Code Review | Trainer approval |

---

## Red Flags (STOP and Escalate)

❌ **DO NOT proceed if:**
- Tests fail and you can't determine root cause
- You modified existing tests to make them pass
- You're using `any` types
- You've written 500+ lines without verification
- You're stuck for >30 minutes

✅ **ESCALATE to trainer:**
- Architecture questions
- Complex debugging
- Security concerns
- Unclear requirements

---

## Authority Escalation

**Current Authority (40%):**
- ✅ Write production code
- ✅ Run verification commands
- ✅ Debug failing tests
- ✅ Ask questions
- ❌ Make architectural changes without review
- ❌ Skip verification
- ❌ Modify trainer's review comments

**Earn 60% authority by:**
- Completing Week 2 with all tests passing
- Demonstrating Ring 2-3 competence
- Proactive documentation
- Identifying edge cases

---

## Communication Protocol

### Daily (Required)
Post standup template at start of each work session.

### After Each Task (Required)
Post:
```
TASK [N] COMPLETE: [Task Name]

Files created/modified:
- [file path]

Verification results:
- Lint: [pass/fail]
- Type check: [pass/fail]  
- Tests: [X pass / Y fail]

Blockers: [none or describe]
Next: [what you're doing next]
```

### When Blocked (Immediate)
Post:
```
BLOCKED: [Describe issue]

What I tried: [steps taken]
What I expect: [expected behavior]
What actually happens: [actual behavior]
Help needed: [specific question]
```

### End of Week (Required)
Post:
```
WEEK 2 COMPLETE

Summary:
- Tasks completed: [X/8]
- Tests: [passing / total]
- Lint: [status]
- Build: [status]

Known issues: [any]
Questions for trainer: [any]

Ready for: Week 3 or revision
```

---

## Trainer Review Points

Your trainer will review at these mandatory checkpoints:

1. **After Task 1:** Database schema review
2. **After Task 2:** Auth module architecture
3. **After Task 4:** Store integration (critical - affects all existing code)
4. **End of Week:** Full codebase review

**Do NOT proceed past checkpoint until trainer approves.**

---

## Reminder

> "Quality is not an act, it is a habit." - Aristotle

You are building on an A++ certified codebase. Every line you write must maintain that standard.

**Follow the framework. Verify constantly. Ask questions. Build with pride.**

---

## Your First Action

Post your Day 1 Standup now:

```
DAILY STANDUP - Day 1

Yesterday's Plan: N/A (Week 1 complete)
Yesterday's Actual: Specification approved (91/100)
Today's Plan: Task 1 (DB Schema) + Task 2 (Auth Module)
Blockers: None
Verification Status: Ready to begin
Confidence: 8/10
```

Then begin Task 1.

**Good luck. Your trainer is watching and ready to help.**
