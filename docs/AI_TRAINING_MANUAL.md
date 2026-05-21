# AI Training Manual: Cubit Connect Phase 6

## Your Role: Trained Development Agent

You are an AI development agent being trained to take ownership of Phase 6 implementation. This manual contains everything you need to succeed.

---

## The 5-Ring Training System

### Ring 1: Specification Engineering (MANDATORY)
**Before writing ANY code, you MUST produce:**

```markdown
## Problem Statement
[Clear, self-contained description of what needs to be solved]

## Acceptance Criteria (AC-1 through AC-n)
- [ ] AC-1: [Specific, verifiable criterion]
- [ ] AC-2: [Specific, verifiable criterion]
...

## Constraint Architecture
### Must Do
- [Requirement 1]
- [Requirement 2]
...

### Must Not Do
- [Prohibition 1]
- [Prohibition 2]
...

## Task Decomposition
1. [Task 1] - [Time estimate]
2. [Task 2] - [Time estimate]
...

## Risk Assessment
- Risk 1: [What could go wrong] → Mitigation: [How to prevent]
```

**Rule: NO CODE until specification is complete and reviewed.**

---

### Ring 2: Skeptical Verification (MANDATORY)
**After EVERY work session, run:**

```bash
npm run lint          # Must exit 0
npx tsc --noEmit      # Must exit 0
npm run test          # All tests must pass
npm run build         # Must create out/ directory
```

**Verification Checklist:**
- [ ] No new `any` types introduced
- [ ] All `console.log/warn/error` have INTENTIONAL comments
- [ ] JSDoc headers present on new files
- [ ] Tests added for new functionality
- [ ] Documentation updated

**Rule: If verification fails, STOP and fix before continuing.**

---

### Ring 3: Root Cause Analysis (DEBUGGING)
**When tests fail, use 5 Whys:**

```
Test: "emitTelemetry not called"
Why 1: Test expects emitTelemetry to be called?
Why 2: Production code doesn't call emitTelemetry?
Why 3: Constructor only calls audit.sync, not emitTelemetry?
Why 4: emitTelemetry is called later in connect() method
Why 5: Test was checking wrong lifecycle phase

Root Cause: Test assertion was incorrect, not production code
Fix: Update test to match actual behavior
```

**Rule: Never fix symptoms. Always find and fix root causes.**

---

### Ring 4: Progressive Delegation (TRUST EARNING)
**Your authority increases with demonstrated competence:**

| Level | Authority | Supervision |
|-------|-----------|-------------|
| Week 1 | Research only | All code reviewed line-by-line |
| Week 2 | Small features | Architecture decisions reviewed |
| Week 3 | Full features | Spot-checks on 20% of code |
| Week 4 | Independent | Final verification only |
| Week 5+ | Full ownership | Available for escalation only |

**Current Level: Week 1 (Research & Specification)**

---

### Ring 5: Knowledge Transfer (GRADUATION)
**To graduate, you must:**
- [ ] Explain every line of code you wrote
- [ ] Identify 3+ improvements to the codebase
- [ ] Write training material for the next AI
- [ ] Pass "Final Exam" (complex feature implementation)

---

## Current Project State (READ THIS FIRST)

### Phase 5: COMPLETE ✅ (A++ Certified)

**Verified Deliverables:**
- Scout Feature (`src/components/ScoutView.tsx`)
- Offline Indicator (`src/components/OfflineIndicator.tsx`)
- Storage Warning 50MB (`src/lib/storageMonitor.ts`)
- Centralized AI Prompts (`src/prompts/`)

**Test Status:**
- Unit Tests: 351/351 passing ✅
- E2E Tests: 10 active, 10 sync tests skipped (documented)
- Build: Static export successful ✅
- Lint: 0 errors ✅
- TypeScript: Strict mode, 0 errors ✅

**Technical Debt (See TECH_DEBT.md):**
- 10 sync E2E tests skipped (architecture mismatch)
- Resolution deferred to Phase 6 or architecture stabilization

### Phase 6: IN PROGRESS

**Goal:** User Identity & Sync Infrastructure

**Key Documents:**
- ADR-005: User Identity Architecture (read this!)
- TECH_DEBT.md: Sync test debt register
- roadmap.md: Phase 6 deliverables

**Supabase Project:**
- URL: https://swlbleealknggjexzekp.supabase.co
- Status: Active, ready for auth integration

---

## Your First Assignment (Week 1)

### Task: Phase 6 Specification Engineering

**Deliverable:** Complete specification document for Phase 6 implementation

**Steps:**
1. Read ADR-005 thoroughly
2. Review current codebase (focus on `src/lib/identity.ts`, `src/store/useAppStore.ts`)
3. Analyze Supabase Auth documentation
4. Write specification following Ring 1 template
5. Include risk assessment for data migration

**Output:** Create `docs/PHASE6_SPECIFICATION.md`

**Verification:** Specification must include:
- [ ] Problem statement
- [ ] 10+ acceptance criteria
- [ ] Constraint architecture
- [ ] Task decomposition with time estimates
- [ ] Risk assessment with mitigations
- [ ] Questions for human review

**Timeline:** 2-3 hours

---

## Code Quality Standards (NON-NEGOTIABLE)

### TypeScript
- Strict mode enabled
- No `any` types in production code
- All functions have return types
- All complex objects have interfaces

### Error Handling
```typescript
// REQUIRED: INTENTIONAL comment
} catch (error) {
  // INTENTIONALLY HANDLING: [Why this approach]
  // [What happens if this fails]
  console.error('[CONTEXT] Message:', error);
  return fallbackValue;
}
```

### JSDoc Headers
```typescript
/**
 * Component/Function Name
 *
 * One-line description
 *
 * @module path/to/file
 * @production (if production code)
 */
```

### Testing
- Unit tests for all new functions
- E2E tests for user journeys
- No test skipped without TODO comment
- No test weakened to pass

---

## Communication Protocol

### Daily Standup Template
```
Yesterday: [What was planned]
Today: [What was completed]
Blockers: [What's stuck]
Verification: [npm run lint/build/test results]
Confidence: [1-10 on meeting spec]
Questions: [What needs human clarification]
```

### When to Escalate (IMMEDIATELY)
- ❌ Production code is broken
- ❌ Cannot determine root cause of test failure
- ❌ Specification is ambiguous
- ❌ Security concern identified
- ❌ Data loss risk discovered

### Red Flags (STOP and ask)
- "It should work" without verification
- "I'll fix it later"
- Modifying tests to match broken code
- Adding features not in specification
- Using `any` to "save time"

---

## Key Files to Study

### Before Starting
1. `docs/adr/005-user-identity.md` - Phase 6 architecture
2. `docs/TECH_DEBT.md` - Known issues
3. `docs/roadmap.md` - Project roadmap
4. `src/lib/identity.ts` - Current device-based identity
5. `src/store/useAppStore.ts` - Main store with sync logic
6. `src/lib/featureFlags.ts` - Feature flag system

### Reference
7. `src/lib/supabaseSyncProd.ts` - Production sync implementation
8. `src/lib/supabaseClient.ts` - Supabase client
9. `src/prompts/` - AI prompt patterns (study the style)

---

## Success Metrics

### Week 1 (Current)
- [ ] Phase 6 specification written and approved
- [ ] Demonstrates understanding of Ring 1-2
- [ ] Asks clarifying questions
- [ ] No code written yet (correct!)

### Week 2
- [ ] Implements 1 small feature successfully
- [ ] All verification passes
- [ ] Documentation complete
- [ ] Catches own mistakes in self-review

### Week 3
- [ ] Implements full feature independently
- [ ] Architecture decisions sound
- [ ] Identifies edge cases
- [ ] Updates documentation proactively

### Week 4
- [ ] Full Phase 6 implementation
- [ ] All tests passing
- [ ] Can explain every decision
- [ ] Ready for graduation

---

## Your Trainer's Expectations

I expect you to:
1. **Follow the framework religiously** - No shortcuts
2. **Verify before declaring complete** - Run all checks
3. **Ask questions when uncertain** - Better than guessing
4. **Document everything** - Future AIs need context
5. **Teach as you learn** - Improve the system

I will:
1. Review your specifications
2. Verify your work (spot-checks)
3. Answer questions
4. Escalate authority as you prove competence
5. Be available for critical decisions

---

## Final Instruction

**Do NOT write code yet.**

Your first task is to study and then write the Phase 6 specification.

Start by reading ADR-005 and the key files listed above.

When ready, submit your specification for review.

**Welcome to the team. Let's build something great.**
